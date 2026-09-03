import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.schemas.exam import (
    ExamMatrixCreate, ExamMatrixOut, ExamMatrixUpdate,
    ExamCreate, ExamOut, ExamUpdate, GenerateExamRequest, AutoSelectRequest,
    CreateExamFromQuestionsRequest
)
from app.services import exam_service

router = APIRouter(tags=["exams"])


@router.post("/exam-matrices", response_model=ExamMatrixOut, status_code=status.HTTP_201_CREATED)
async def create_matrix(
    data: ExamMatrixCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên được tạo ma trận")
    return await exam_service.create_matrix(db, data, current_user.id)


@router.get("/exam-matrices", response_model=List[ExamMatrixOut])
@router.get("/exams/matrices", response_model=List[ExamMatrixOut])
async def list_matrices(
    subject_id: Optional[str] = None,
    class_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    return await exam_service.list_matrices(db, subject_id, class_id)


@router.get("/exam-matrices/{matrix_id}", response_model=ExamMatrixOut)
async def get_matrix(
    matrix_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    matrix = await exam_service.get_matrix(db, matrix_id)
    if not matrix:
        raise HTTPException(status_code=404, detail="Không tìm thấy ma trận")
    return matrix


@router.delete("/exam-matrices/{matrix_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_matrix(
    matrix_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên được xóa ma trận")
    success = await exam_service.delete_matrix(db, matrix_id)
    if not success:
        raise HTTPException(status_code=404, detail="Không tìm thấy ma trận")


@router.post("/exam-matrices/{matrix_id}/auto-select")
async def auto_select_questions(
    matrix_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Sử dụng AI Selection Agent để chọn câu hỏi theo ma trận"""
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên được thực hiện tính năng này")
    try:
        plan = await exam_service.auto_select_for_matrix(db, matrix_id)
        return plan
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/exam-matrices/{matrix_id}/generate-exam", response_model=ExamOut)
async def generate_exam(
    matrix_id: uuid.UUID,
    data: GenerateExamRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Tự động sinh đề thi từ ma trận bằng AI Selection Agent"""
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên được tạo đề thi")
    try:
        exam = await exam_service.create_exam_from_matrix(
            db, matrix_id, name=data.name, class_id=data.class_id, user_id=current_user.id
        )
        return exam
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/exams", response_model=ExamOut, status_code=status.HTTP_201_CREATED)
async def create_exam(
    data: ExamCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên được tạo đề thi")
    return await exam_service.create_exam(db, data, current_user.id)


@router.post("/exams/from-questions", response_model=ExamOut, status_code=status.HTTP_201_CREATED)
async def create_exam_from_questions(
    data: CreateExamFromQuestionsRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Tạo đề thi trực tiếp từ danh sách câu hỏi được chọn trong ngân hàng"""
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên được tạo đề thi")
    return await exam_service.create_exam_from_question_ids(
        db,
        name=data.name,
        question_ids=data.question_ids,
        user_id=current_user.id,
        class_id=data.class_id,
        duration_minutes=data.duration_minutes,
        points_per_question=data.points_per_question,
        shuffle_questions=data.shuffle_questions,
        shuffle_options=data.shuffle_options,
    )


@router.get("/exams", response_model=List[ExamOut])
async def list_exams(
    class_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    return await exam_service.list_exams(db, class_id)


@router.get("/exams/{exam_id}")
async def get_exam(
    exam_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    exam = await exam_service.get_exam(db, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy đề thi")
    
    # Return formatted exam details with populated question content
    return {
        "id": exam.id,
        "name": exam.name,
        "matrix_id": exam.matrix_id,
        "class_id": exam.class_id,
        "status": exam.status,
        "duration_minutes": exam.duration_minutes,
        "start_time": exam.start_time,
        "end_time": exam.end_time,
        "shuffle_questions": exam.shuffle_questions,
        "shuffle_options": exam.shuffle_options,
        "show_results": exam.show_results,
        "created_at": exam.created_at,
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
                        "order_index": eq.order_index,
                        "points": eq.points,
                        "stem": eq.question.stem if eq.question else "",
                        "type": eq.question.type if eq.question else "mcq",
                        "bloom_level": eq.question.bloom_level if eq.question else None,
                        "difficulty": eq.question.expected_difficulty if eq.question else None,
                        "options": [
                            {
                                "id": opt.id,
                                "label": opt.label,
                                "text": opt.text,
                                "is_correct": opt.is_correct
                            }
                            for opt in (eq.question.options if eq.question else [])
                        ]
                    }
                    for eq in sec.questions
                ]
            }
            for sec in exam.sections
        ]
    }


@router.delete("/exams/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exam(
    exam_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên được xóa đề thi")
    success = await exam_service.delete_exam(db, exam_id)
    if not success:
        raise HTTPException(status_code=404, detail="Không tìm thấy đề thi")
