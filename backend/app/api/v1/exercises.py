from __future__ import annotations

import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.core.dependencies import get_current_user
from app.models.exam import Exam
from app.schemas.exam import ExamOut, ExamUpdate
from app.services import exercise_service


router = APIRouter(tags=["Kho Bài Tập (Exercise Bank)"])


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


class CreateExerciseRequest(BaseModel):
    name: str = Field(..., max_length=255)
    question_ids: list[uuid.UUID] = Field(..., min_length=1)
    class_id: Optional[uuid.UUID] = None
    duration_minutes: int = Field(default=45, ge=1)
    practice_mode: str = Field("free", max_length=20)  # free, linear
    allow_retry: bool = True
    show_hints: bool = True
    points_per_question: Optional[float] = None


class AddQuestionsToExerciseRequest(BaseModel):
    question_ids: list[uuid.UUID] = Field(..., min_length=1)


@router.get("/exercises", response_model=List[ExamOut])
async def list_exercises(
    class_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Lấy danh sách các bộ bài tập trong Kho Bài Tập"""
    user_id = None if current_user.has_role("admin") else current_user.id
    return await exercise_service.list_exercises(db, class_id=class_id, user_id=user_id)


@router.post("/exercises", response_model=ExamOut, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    data: CreateExerciseRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Tạo bộ bài tập mới từ danh sách câu hỏi trong Ngân hàng câu hỏi"""
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên được tạo bài tập")

    return await exercise_service.create_exercise_from_question_ids(
        db,
        name=data.name,
        question_ids=data.question_ids,
        user_id=current_user.id,
        class_id=data.class_id,
        duration_minutes=data.duration_minutes,
        practice_mode=data.practice_mode,
        allow_retry=data.allow_retry,
        show_hints=data.show_hints,
        points_per_question=data.points_per_question,
    )



class ManageExerciseBankQuestionsRequest(BaseModel):
    question_ids: list[uuid.UUID] = Field(..., min_length=1)


@router.post("/exercises/bank/questions", status_code=status.HTTP_200_OK)
async def add_questions_to_exercise_bank(
    data: ManageExerciseBankQuestionsRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Đưa các câu hỏi được chọn từ Ngân hàng vào Kho Bài Tập"""
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên được quản lý Kho Bài Tập")

    from sqlalchemy import update
    from app.models.question import Question
    stmt = update(Question).where(Question.id.in_(data.question_ids)).values(in_exercise_bank=True)
    await db.execute(stmt)
    await db.commit()
    return {"message": f"Đã thêm {len(data.question_ids)} câu hỏi vào Kho Bài Tập", "count": len(data.question_ids)}


@router.delete("/exercises/bank/questions/{question_id}", status_code=status.HTTP_200_OK)
async def remove_question_from_exercise_bank(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Xóa một câu hỏi khỏi Kho Bài Tập (vẫn giữ nguyên trong Ngân hàng gốc)"""
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên được quản lý Kho Bài Tập")

    from sqlalchemy import update
    from app.models.question import Question
    stmt = update(Question).where(Question.id == question_id).values(in_exercise_bank=False)
    await db.execute(stmt)
    await db.commit()
    return {"message": "Đã xóa câu hỏi khỏi Kho Bài Tập"}


@router.post("/exercises/bank/questions/remove", status_code=status.HTTP_200_OK)
async def remove_multiple_from_exercise_bank(
    data: ManageExerciseBankQuestionsRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Xóa nhiều câu hỏi khỏi Kho Bài Tập"""
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên được quản lý Kho Bài Tập")

    from sqlalchemy import update
    from app.models.question import Question
    stmt = update(Question).where(Question.id.in_(data.question_ids)).values(in_exercise_bank=False)
    await db.execute(stmt)
    await db.commit()
    return {"message": f"Đã xóa {len(data.question_ids)} câu hỏi khỏi Kho Bài Tập", "count": len(data.question_ids)}


@router.get("/exercises/{exercise_id}")
async def get_exercise(
    exercise_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Lấy chi tiết bộ bài tập kèm danh sách câu hỏi đã tham chiếu"""
    exercise = await exercise_service.get_exercise(db, exercise_id)
    if not exercise:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài tập")

    return {
        "id": exercise.id,
        "name": exercise.name,
        "type": exercise.type,
        "class_id": exercise.class_id,
        "status": exercise.status,
        "duration_minutes": exercise.duration_minutes,
        "practice_mode": exercise.practice_mode,
        "allow_retry": exercise.allow_retry,
        "show_hints": exercise.show_hints,
        "allow_review": exercise.allow_review,
        "show_score": exercise.show_score,
        "show_responses": exercise.show_responses,
        "show_correct_answers": exercise.show_correct_answers,
        "show_explanations": exercise.show_explanations,
        "show_feedback": exercise.show_feedback,
        "created_at": exercise.created_at,
        "sections": [
            {
                "id": sec.id,
                "name": sec.name,
                "order_index": sec.order_index,
                "question_type": sec.question_type,
                "instructions": sec.instructions,
                "questions": [
                    {
                        "id": eq.id,
                        "question_id": eq.question_id,
                        "question_version_id": eq.question_version_id,
                        "order_index": eq.order_index,
                        "points": eq.points,
                        "stem": eq.question.stem if eq.question else "",
                        "type": eq.question.type if eq.question else "mcq",
                        "bloom_level": eq.question.bloom_level if eq.question else None,
                        "difficulty": eq.question.expected_difficulty if eq.question else None,
                        "rationale": eq.question.rationale if eq.question else None,
                        "options": [
                            {
                                "id": opt.id,
                                "label": opt.label,
                                "text": opt.text,
                                "is_correct": opt.is_correct,
                            }
                            for opt in (eq.question.options if eq.question and eq.question.options else [])
                        ],
                    }
                    for eq in sec.questions
                ],
            }
            for sec in exercise.sections
        ],
    }


@router.put("/exercises/{exercise_id}", response_model=ExamOut)
async def update_exercise(
    exercise_id: uuid.UUID,
    data: ExamUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Cập nhật thông tin / cấu hình bộ bài tập"""
    exercise = await exercise_service.get_exercise(db, exercise_id)
    if not exercise:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ bài tập")

    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(exercise, field, val)

    await db.commit()
    await db.refresh(exercise)
    return exercise


@router.delete("/exercises/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exercise(
    exercise_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Xóa bộ bài tập khỏi kho"""
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên được xóa bài tập")

    ok = await exercise_service.delete_exercise(db, exercise_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài tập")
    return None


@router.post("/exercises/{exercise_id}/questions", response_model=ExamOut)
async def add_questions_to_exercise(
    exercise_id: uuid.UUID,
    data: AddQuestionsToExerciseRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Thêm một hoặc nhiều câu hỏi từ Ngân hàng vào bộ bài tập đã có"""
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên được chỉnh sửa bài tập")

    try:
        return await exercise_service.add_questions_to_exercise(
            db, exercise_id, data.question_ids, current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/exercises/{exercise_id}/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_question_from_exercise(
    exercise_id: uuid.UUID,
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Gỡ bỏ câu hỏi khỏi bộ bài tập"""
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên được chỉnh sửa bài tập")

    ok = await exercise_service.remove_question_from_exercise(db, exercise_id, question_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi trong bài tập")
    return None
