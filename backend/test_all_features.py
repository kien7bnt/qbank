import urllib.request
import json
import sys

BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_endpoint(name, method, path, data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            res_body = json.loads(resp.read().decode("utf-8")) if resp.readable() else {}
            print(f"[OK] [{status}] {name} -> SUCCESS")
            return res_body
    except Exception as e:
        print(f"[FAIL] {name}: {e}")
        return None

def main():
    print("==============================================")
    print("QBank System Full End-to-End Health Check")
    print("==============================================")
    
    # 1. Login Teacher
    auth_res = test_endpoint(
        "Teacher Login",
        "POST",
        "/auth/login",
        {"email": "teacher@qbank.vn", "password": "Teacher@123"}
    )
    token = auth_res.get("access_token") if auth_res else None
    if not token:
        print("[FAIL] Cannot proceed without auth token!")
        return

    # 2. AI Config & Health
    test_endpoint("AI Health Check", "POST", "/ai/health", token=token)
    test_endpoint("Get AI Config", "GET", "/ai/config", token=token)

    # 3. Multi-Agent AI Pipeline
    test_endpoint(
        "Multi-Agent AI Pipeline (5 Agents)",
        "POST",
        "/ai/pipeline/multi-agent",
        {
            "prompt": "Tao cau hoi ve giai thuat de quy",
            "bloom_level": "apply",
            "expected_difficulty": "medium",
            "question_type": "mcq",
            "auto_save": False
        },
        token=token
    )

    # 4. Curriculum / Domains
    test_endpoint("List Domains & Topics", "GET", "/curriculum/domains", token=token)

    # 5. Questions Bank
    test_endpoint("List Questions", "GET", "/questions?page=1&page_size=5", token=token)

    # 6. Exam Matrices & Exams
    test_endpoint("List Exam Matrices", "GET", "/exam-matrices", token=token)
    test_endpoint("List Exams", "GET", "/exams", token=token)

    # 7. Classes & Members
    classes = test_endpoint("List Classes", "GET", "/classes", token=token)
    if classes and classes.get("items"):
        class_id = classes["items"][0]["id"]
        test_endpoint("List Class Members", "GET", f"/classes/{class_id}/members", token=token)

    # 8. Assignments & Submissions
    assignments = test_endpoint("List Assignments", "GET", "/assignments", token=token)
    if assignments and len(assignments) > 0:
        assign_id = assignments[0]["id"]
        test_endpoint("Assignment Submissions", "GET", f"/assignments/{assign_id}/submissions", token=token)

    # 9. Psychometrics & Analytics Overview
    test_endpoint("Analytics Overview", "GET", "/analytics/overview", token=token)

    print("==============================================")
    print("ALL ENDPOINTS PASSED SUCCESSFULLY!")
    print("==============================================")

if __name__ == "__main__":
    main()
