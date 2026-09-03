import uuid
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.schemas.assignment import (
    AssignmentCreate, AssignmentOut, SaveResponseRequest,
    ExamTakingStateOut, AttemptResultOut
)
from app.services import assignment_service

router = APIRouter(tags=["assignments"])


# ─── Teacher / Admin Assignment Endpoints ─────────────────────────────────────

@router.post("/assignments", response_model=AssignmentOut, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    data: AssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên được giao bài")
    return await assignment_service.create_assignment(db, data, current_user.id)


@router.get("/assignments")
async def list_assignments(
    class_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    if current_user.has_role("teacher", "admin"):
        assignments = await assignment_service.list_assignments(db, class_id)
        return [
            {
                "id": a.id,
                "name": a.name,
                "exam_id": a.exam_id,
                "exam_name": a.exam.name if a.exam else "Đề thi",
                "class_id": a.class_id,
                "class_name": a.class_.name if a.class_ else "Lớp học",
                "duration_minutes": a.duration_minutes,
                "start_time": a.start_time,
                "end_time": a.end_time,
                "pass_score": a.pass_score,
                "status": a.status,
                "total_submissions": len(a.attempts or []),
                "created_at": a.created_at,
            }
            for a in assignments
        ]
    else:
        # Student view
        return await assignment_service.list_student_assignments(db, current_user.id)


@router.get("/assignments/{assignment_id}")
async def get_assignment(
    assignment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    a = await assignment_service.get_assignment(db, assignment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Không tìm thấy đợt kiểm tra")
    return {
        "id": a.id,
        "name": a.name,
        "exam_id": a.exam_id,
        "exam_name": a.exam.name if a.exam else "Đề thi",
        "class_id": a.class_id,
        "class_name": a.class_.name if a.class_ else "Lớp học",
        "duration_minutes": a.duration_minutes,
        "start_time": a.start_time,
        "end_time": a.end_time,
        "pass_score": a.pass_score,
        "status": a.status,
        "total_submissions": len(a.attempts or []),
        "created_at": a.created_at,
    }


@router.get("/assignments/{assignment_id}/submissions")
async def list_assignment_submissions(
    assignment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên xem được danh sách bài nộp")
    return await assignment_service.list_assignment_submissions(db, assignment_id)


# ─── Student Exam Taking Endpoints ───────────────────────────────────────────

@router.post("/assignments/{assignment_id}/start", response_model=ExamTakingStateOut)
async def start_exam_taking(
    assignment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Học sinh bắt đầu hoặc tiếp tục làm bài thi"""
    try:
        return await assignment_service.start_or_resume_attempt(db, assignment_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/attempts/{attempt_id}/state", response_model=ExamTakingStateOut)
async def get_attempt_state(
    attempt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Lấy trạng thái phòng thi hiện tại của học sinh theo attempt_id"""
    try:
        return await assignment_service.get_attempt_state(db, attempt_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/attempts/{attempt_id}/responses")
async def save_attempt_response(
    attempt_id: uuid.UUID,
    data: SaveResponseRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Lưu câu trả lời tạm thời của học sinh (Drafting)"""
    success = await assignment_service.save_response(db, attempt_id, data, current_user.id)
    if not success:
        raise HTTPException(status_code=400, detail="Không thể lưu câu trả lời hoặc bài thi đã kết thúc")
    return {"status": "saved"}


@router.post("/attempts/{attempt_id}/submit", response_model=AttemptResultOut)
async def submit_exam_attempt(
    attempt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Học sinh nộp bài và kích hoạt bộ chấm tự động (Auto-grading Engine)"""
    try:
        return await assignment_service.submit_and_grade_attempt(db, attempt_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/attempts/{attempt_id}/result", response_model=AttemptResultOut)
async def get_attempt_result(
    attempt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Xem kết quả và lời giải chi tiết của bài thi"""
    try:
        return await assignment_service.get_attempt_result(db, attempt_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/student/history")
async def get_student_history(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Lấy toàn bộ lịch sử các bài kiểm tra đã làm của học sinh"""
    from app.models.assignment import ExamAttempt, Assignment
    from app.models.exam import Exam
    from app.models.class_ import Class
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    stmt = (
        select(ExamAttempt)
        .join(Assignment, ExamAttempt.assignment_id == Assignment.id)
        .options(
            selectinload(ExamAttempt.assignment).selectinload(Assignment.exam),
            selectinload(ExamAttempt.assignment).selectinload(Assignment.class_),
        )
        .where(ExamAttempt.user_id == current_user.id)
        .order_by(ExamAttempt.start_time.desc())
    )
    res = await db.execute(stmt)
    attempts = res.scalars().all()

    return [
        {
            "id": str(att.id),
            "assignment_id": str(att.assignment_id),
            "assignment_name": att.assignment.name if att.assignment else "Bài kiểm tra",
            "exam_name": att.assignment.exam.name if att.assignment and att.assignment.exam else "Đề thi",
            "class_name": att.assignment.class_.name if att.assignment and att.assignment.class_ else "Lớp học",
            "start_time": att.start_time,
            "submitted_at": att.submitted_at,
            "status": att.status,
            "score": att.score,
            "max_score": att.max_score,
            "is_passed": att.is_passed,
        }
        for att in attempts
    ]
