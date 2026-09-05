"""
Compiler Service interfacing with Judge0 CE (https://compiler.edusoft.vn)
Provides real-time code execution, custom stdin support, and automated test-case evaluation.
"""
from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger(__name__)

COMPILER_BASE_URL = "https://compiler.edusoft.vn"

# Map friendly language identifiers to Judge0 language IDs
LANGUAGE_MAP: Dict[str, int] = {
    "python": 71,       # Python (3.8.1)
    "py": 71,
    "python3": 71,
    "cpp": 54,          # C++ (GCC 9.2.0)
    "c++": 54,
    "c": 50,            # C (GCC 9.2.0)
    "java": 62,         # Java (OpenJDK 13.0.1)
    "javascript": 63,   # JavaScript (Node.js 12.14.0)
    "js": 63,
    "node": 63,
    "pascal": 47,       # Basic / Pascal
}

LANGUAGE_DISPLAY_NAMES: Dict[str, str] = {
    "python": "Python 3",
    "cpp": "C++ (GCC 9.2)",
    "c": "C (GCC 9.2)",
    "java": "Java (OpenJDK 13)",
    "javascript": "JavaScript (Node.js)",
}


def get_language_id(language: str) -> int:
    """Normalize language name and return Judge0 language_id (defaults to Python 3: 71)."""
    clean_lang = (language or "").strip().lower()
    return LANGUAGE_MAP.get(clean_lang, 71)


async def execute_code(
    source_code: str,
    language: str = "python",
    stdin: str = "",
    expected_output: Optional[str] = None,
    timeout: float = 20.0,
) -> Dict[str, Any]:
    """
    Execute source code via https://compiler.edusoft.vn/submissions?wait=true
    """
    lang_id = get_language_id(language)
    payload = {
        "source_code": source_code or "",
        "language_id": lang_id,
        "stdin": stdin or "",
    }
    if expected_output is not None:
        payload["expected_output"] = expected_output.strip()

    url = f"{COMPILER_BASE_URL}/submissions?wait=true"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=payload)
            if not resp.is_success:
                logger.error(f"Compiler API returned status {resp.status_code}: {resp.text}")
                return {
                    "success": False,
                    "status": "Compiler Error",
                    "status_id": -1,
                    "stdout": None,
                    "stderr": f"Lỗi máy chủ chấm code: {resp.status_code}",
                    "compile_output": None,
                    "time": None,
                    "memory": None,
                    "is_passed": False,
                }

            data = resp.json()
            status_obj = data.get("status") or {}
            status_id = status_obj.get("id", 0)
            status_desc = status_obj.get("description", "Unknown")

            stdout = data.get("stdout") or ""
            stderr = data.get("stderr") or ""
            compile_output = data.get("compile_output") or ""

            is_passed = (status_id == 3)
            if not is_passed and expected_output is not None and stdout:
                if stdout.strip() == expected_output.strip():
                    is_passed = True

            return {
                "success": True,
                "status": status_desc,
                "status_id": status_id,
                "stdout": stdout,
                "stderr": stderr,
                "compile_output": compile_output,
                "time": data.get("time"),
                "memory": data.get("memory"),
                "is_passed": is_passed,
            }

    except httpx.TimeoutException:
        return {
            "success": False,
            "status": "Time Limit Exceeded",
            "status_id": 5,
            "stdout": None,
            "stderr": "Quá thời gian thực thi (Timeout)",
            "compile_output": None,
            "time": timeout,
            "memory": None,
            "is_passed": False,
        }
    except Exception as e:
        logger.exception("Error calling compiler.edusoft.vn")
        return {
            "success": False,
            "status": "Connection Error",
            "status_id": -2,
            "stdout": None,
            "stderr": str(e),
            "compile_output": None,
            "time": None,
            "memory": None,
            "is_passed": False,
        }


async def run_test_cases(
    source_code: str,
    language: str,
    test_cases: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Run source code against multiple test cases and compute score.
    """
    if not test_cases:
        single = await execute_code(source_code, language)
        return {
            "passed_count": 1 if single.get("success") and not single.get("stderr") else 0,
            "total_count": 1,
            "passed_all": single.get("success") and not single.get("stderr"),
            "results": [
                {
                    "case_number": 1,
                    "is_passed": single.get("success") and not single.get("stderr"),
                    "input": "",
                    "expected_output": "",
                    "actual_output": single.get("stdout") or "",
                    "stderr": single.get("stderr") or "",
                    "status": single.get("status"),
                    "time": single.get("time"),
                }
            ],
        }

    results = []
    passed_count = 0

    for idx, tc in enumerate(test_cases):
        tc_input = str(tc.get("input", ""))
        tc_expected = str(tc.get("output", ""))
        is_hidden = tc.get("is_hidden", False)

        exec_res = await execute_code(
            source_code=source_code,
            language=language,
            stdin=tc_input,
            expected_output=tc_expected,
        )

        passed = exec_res.get("is_passed", False)
        if passed:
            passed_count += 1

        results.append({
            "case_number": idx + 1,
            "is_passed": passed,
            "input": "*** [Ẩn]" if is_hidden else tc_input,
            "expected_output": "*** [Ẩn]" if is_hidden else tc_expected,
            "actual_output": exec_res.get("stdout") or "",
            "stderr": exec_res.get("stderr") or exec_res.get("compile_output") or "",
            "status": exec_res.get("status"),
            "time": exec_res.get("time"),
            "memory": exec_res.get("memory"),
        })

    return {
        "passed_count": passed_count,
        "total_count": len(test_cases),
        "passed_all": (passed_count == len(test_cases)),
        "results": results,
    }
