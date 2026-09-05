from __future__ import annotations
import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_db, get_current_user
from app.models.question import Question, QuestionCoding
from app.services import compiler_service

router = APIRouter(prefix="/compiler", tags=["compiler"])


class CodeRunRequest(BaseModel):
    source_code: str
    language: str = "python"
    stdin: Optional[str] = ""
    expected_output: Optional[str] = None


class CodeTestQuestionRequest(BaseModel):
    question_id: uuid.UUID
    source_code: str
    language: str = "python"


@router.get("/languages")
async def get_languages():
    """Lấy danh sách các ngôn ngữ lập trình được hỗ trợ chấm online"""
    return [
        {"id": "python", "name": "Python 3 (3.8.1)", "judge0_id": 71, "extension": "py"},
        {"id": "cpp", "name": "C++ (GCC 9.2)", "judge0_id": 54, "extension": "cpp"},
        {"id": "c", "name": "C (GCC 9.2)", "judge0_id": 50, "extension": "c"},
        {"id": "java", "name": "Java (OpenJDK 13)", "judge0_id": 62, "extension": "java"},
        {"id": "javascript", "name": "JavaScript (Node.js 12)", "judge0_id": 63, "extension": "js"},
    ]


@router.post("/run")
async def run_code(
    payload: CodeRunRequest,
    current_user=Depends(get_current_user),
):
    """
    Chạy mã nguồn lập trình tùy ý thông qua Judge0 (compiler.edusoft.vn)
    """
    if not payload.source_code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã nguồn không được để trống",
        )

    result = await compiler_service.execute_code(
        source_code=payload.source_code,
        language=payload.language,
        stdin=payload.stdin or "",
        expected_output=payload.expected_output,
    )
    return result


@router.post("/test-question")
async def test_question_code(
    payload: CodeTestQuestionRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Chạy thử mã nguồn của thí sinh với các test case của câu hỏi
    """
    stmt = (
        select(Question)
        .options(selectinload(Question.coding_data))
        .where(Question.id == payload.question_id)
    )
    res = await db.execute(stmt)
    q = res.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi")

    cd = q.coding_data
    test_cases: List[Dict[str, Any]] = []

    if cd:
        if getattr(cd, "test_cases", None):
            test_cases.extend(cd.test_cases)
        # Add sample input/output if present and test_cases is empty
        if not test_cases and (cd.sample_input or cd.sample_output):
            test_cases.append({
                "input": cd.sample_input or "",
                "output": cd.sample_output or "",
                "is_hidden": False,
            })

    result = await compiler_service.run_test_cases(
        source_code=payload.source_code,
        language=payload.language,
        test_cases=test_cases,
    )
    return result
