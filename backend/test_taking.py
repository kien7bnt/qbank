import asyncio
import uuid
import requests

BASE_URL = "http://127.0.0.1:8000/api/v1"

# 1. Login
resp = requests.post(f"{BASE_URL}/auth/login", json={"email": "student@qbank.vn", "password": "Student@123"})
if not resp.ok:
    print("Login failed:", resp.text)
    exit(1)

token = resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
print("1. Login success!")

# 2. List assignments
resp = requests.get(f"{BASE_URL}/assignments", headers=headers)
assignments = resp.json()
print("2. Assignments found:", len(assignments))
if not assignments:
    print("No assignments found!")
    exit(1)

assign_id = assignments[0]["id"]
print("Selected assignment ID:", assign_id)

# 3. Start attempt
resp = requests.post(f"{BASE_URL}/assignments/{assign_id}/start", headers=headers)
if not resp.ok:
    print("Start failed:", resp.status_code, resp.text)
    exit(1)

state = resp.json()
attempt_id = state["attempt_id"]
print("3. Attempt started successfully! ID:", attempt_id)
print("   Total questions in exam:", len(state["questions"]))

# 4. Get State
resp = requests.get(f"{BASE_URL}/attempts/{attempt_id}/state", headers=headers)
if not resp.ok:
    print("Get state failed:", resp.status_code, resp.text)
    exit(1)
print("4. Get state success! Remaining seconds:", resp.json()["remaining_seconds"])

# 5. Answer Question 1
q1 = state["questions"][0]
opt1 = q1["options"][0]["id"]
resp = requests.post(
    f"{BASE_URL}/attempts/{attempt_id}/responses",
    json={"question_id": q1["id"], "selected_option_id": opt1},
    headers=headers,
)
print("5. Save response success:", resp.json())

# 6. Submit attempt
resp = requests.post(f"{BASE_URL}/attempts/{attempt_id}/submit", headers=headers)
if not resp.ok:
    print("Submit failed:", resp.status_code, resp.text)
    exit(1)

result = resp.json()
print("6. SUBMIT & AUTO-GRADE SUCCESS!")
print(f"   Score: {result['score']}/{result['max_score']} (Passed: {result['is_passed']})")
print(f"   Correct questions: {result['correct_count']}/{result['total_questions']}")
