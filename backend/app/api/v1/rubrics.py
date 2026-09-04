"""
API Routers for Rubrics and AI Essay Grading
"""
from __future__ import annotations
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.schemas.rubric import (
    RubricCreate,
    RubricUpdate,
    RubricOut,
    EssayGradeRequest,
    EssayGradingOut,
    EssayGradingReviewCreate,
)
from app.services import rubric_service, essay_grading_service

router = APIRouter(tags=["rubrics"])


# ─── Rubrics CRUD ────────────────────────────────────────────────────────────

@router.get("/rubrics", response_model=List[RubricOut])
async def list_rubrics(
    subject_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Lấy danh sách các Rubric chấm điểm"""
    return await rubric_service.list_rubrics(db, subject_id, current_user)


@router.get("/rubrics/{rubric_id}", response_model=RubricOut)
async def get_rubric(
    rubric_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Xem chi tiết Rubric kèm các tiêu chí và mức điểm"""
    return await rubric_service.get_rubric(db, rubric_id)


@router.post("/rubrics", response_model=RubricOut, status_code=status.HTTP_201_CREATED)
async def create_rubric(
    data: RubricCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Tạo Rubric chấm điểm mới"""
    if not current_user.has_role("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên hoặc admin mới có quyền tạo Rubric")
    return await rubric_service.create_rubric(db, data, current_user)


@router.put("/rubrics/{rubric_id}", response_model=RubricOut)
async def update_rubric(
    rubric_id: uuid.UUID,
    data: RubricUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Cập nhật Rubric chấm điểm"""
    return await rubric_service.update_rubric(db, rubric_id, data, current_user)


@router.delete("/rubrics/{rubric_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rubric(
    rubric_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Xóa Rubric"""
    await rubric_service.delete_rubric(db, rubric_id, current_user)


# ─── AI Essay Grading Endpoints ──────────────────────────────────────────────

@router.post("/ai/essay-grade", response_model=EssayGradingOut)
async def auto_grade_essay(
    data: EssayGradeRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Kích hoạt AI chấm bài tự luận của học sinh theo Rubric:
    - Phân tích câu trả lời, đối chiếu đáp án mẫu & rubric
    - Trích xuất dẫn chứng (evidence) và lý do (reason)
    - Backend tính toán điểm tất định theo trọng số
    """
    return await essay_grading_service.grade_student_essay_response(
        db,
        response_id=data.response_id,
        rubric_id=data.rubric_id,
    )


@router.get("/essay-grading/{response_id}", response_model=Optional[EssayGradingOut])
async def get_essay_grading_result(
    response_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Lấy kết quả đánh giá tự luận và chi tiết tiêu chí"""
    return await essay_grading_service.get_essay_grading_by_response(db, response_id)


@router.post("/essay-grading/{grading_id}/review", response_model=EssayGradingOut)
async def teacher_review_essay(
    grading_id: uuid.UUID,
    data: EssayGradingReviewCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Giáo viên duyệt, chấp nhận hoặc chỉnh sửa điểm tự luận:
    - Lưu lịch sử review, điểm trước & sau sửa, lý do nhận xét
    - Cập nhật điểm chính thức vào bài thi của học sinh
    """
    if not current_user.has_role("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên hoặc admin mới có quyền duyệt điểm")
    return await essay_grading_service.review_essay_grading(db, grading_id, data, current_user)
