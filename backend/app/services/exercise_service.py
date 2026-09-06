from __future__ import annotations

import uuid
from typing import Optional, Sequence
from datetime import datetime
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.exam import Exam, ExamSection, ExamQuestion
from app.models.question import Question, QuestionVersion


async def list_exercises(
    db: AsyncSession,
    class_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
) -> Sequence[Exam]:
    """Danh sách các bộ bài tập trong Kho Bài Tập (type == 'exercise')"""
    stmt = (
        select(Exam)
        .options(
            selectinload(Exam.sections).selectinload(ExamSection.questions)
        )
        .where(Exam.type == "exercise")
        .order_by(Exam.created_at.desc())
    )
    if class_id:
        stmt = stmt.where(Exam.class_id == class_id)
    if user_id:
        stmt = stmt.where(Exam.created_by == user_id)

    result = await db.execute(stmt)
    return result.scalars().all()


async def get_exercise(db: AsyncSession, exercise_id: uuid.UUID) -> Optional[Exam]:
    """Chi tiết bộ bài tập kèm danh sách câu hỏi"""
    stmt = (
        select(Exam)
        .options(
            selectinload(Exam.sections)
            .selectinload(ExamSection.questions)
            .selectinload(ExamQuestion.question)
            .selectinload(Question.options)
        )
        .where(and_(Exam.id == exercise_id, Exam.type == "exercise"))
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_exercise_from_question_ids(
    db: AsyncSession,
    name: str,
    question_ids: list[uuid.UUID],
    user_id: uuid.UUID,
    class_id: Optional[uuid.UUID] = None,
    duration_minutes: int = 45,
    practice_mode: str = "free",
    allow_retry: bool = True,
    show_hints: bool = True,
    points_per_question: Optional[float] = None,
) -> Exam:
    """Tạo bộ bài tập mới từ danh sách câu hỏi được chọn trong Ngân hàng câu hỏi"""
    pts = points_per_question if points_per_question is not None else (10.0 / len(question_ids) if question_ids else 1.0)

    exercise = Exam(
        name=name,
        type="exercise",
        class_id=class_id,
        duration_minutes=duration_minutes,
        practice_mode=practice_mode,
        allow_retry=allow_retry,
        show_hints=show_hints,
        allow_review=True,
        show_score=True,
        show_responses=True,
        show_correct_answers=True,
        show_explanations=True,
        show_feedback=True,
        shuffle_questions=False,
        shuffle_options=False,
        show_results="immediately",
        created_by=user_id,
        status="published",
    )
    db.add(exercise)
    await db.flush()

    section = ExamSection(
        exam_id=exercise.id,
        name="Danh sách bài tập",
        order_index=0,
        question_type="mixed",
    )
    db.add(section)
    await db.flush()

    for idx, qid in enumerate(question_ids):
        # Lấy hoặc tạo phiên bản snapshot
        v_stmt = (
            select(QuestionVersion)
            .where(QuestionVersion.question_id == qid)
            .order_by(QuestionVersion.version_number.desc())
        )
        v_res = await db.execute(v_stmt)
        q_version = v_res.scalars().first()

        q_obj = await db.get(Question, qid)
        if not q_version and q_obj:
            q_version = QuestionVersion(
                question_id=qid,
                version_number=q_obj.version,
                snapshot={"stem": q_obj.stem, "type": q_obj.type},
                changed_by=user_id,
            )
            db.add(q_version)
            await db.flush()

        if q_version:
            eq = ExamQuestion(
                exam_id=exercise.id,
                section_id=section.id,
                question_id=qid,
                question_version_id=q_version.id,
                order_index=idx,
                points=round(pts, 2),
            )
            db.add(eq)

        # Cập nhật usage_count và đánh dấu thuộc Kho Bài Tập
        if q_obj:
            q_obj.usage_count = (q_obj.usage_count or 0) + 1
            q_obj.in_exercise_bank = True

    await db.commit()
    await db.refresh(exercise)
    return exercise


async def add_questions_to_exercise(
    db: AsyncSession,
    exercise_id: uuid.UUID,
    question_ids: list[uuid.UUID],
    user_id: uuid.UUID,
) -> Exam:
    """Thêm câu hỏi vào bộ bài tập đã có"""
    exercise = await get_exercise(db, exercise_id)
    if not exercise:
        raise ValueError("Không tìm thấy bộ bài tập")

    if not exercise.sections:
        section = ExamSection(
            exam_id=exercise.id,
            name="Danh sách bài tập",
            order_index=0,
            question_type="mixed",
        )
        db.add(section)
        await db.flush()
    else:
        section = exercise.sections[0]

    # Kiểm tra các câu đã có trong bài tập để tránh trùng lặp
    existing_qids = {eq.question_id for eq in section.questions}
    current_count = len(section.questions)

    for qid in question_ids:
        if qid in existing_qids:
            continue

        v_stmt = (
            select(QuestionVersion)
            .where(QuestionVersion.question_id == qid)
            .order_by(QuestionVersion.version_number.desc())
        )
        v_res = await db.execute(v_stmt)
        q_version = v_res.scalars().first()

        q_obj = await db.get(Question, qid)
        if not q_version and q_obj:
            q_version = QuestionVersion(
                question_id=qid,
                version_number=q_obj.version,
                snapshot={"stem": q_obj.stem, "type": q_obj.type},
                changed_by=user_id,
            )
            db.add(q_version)
            await db.flush()

        if q_version:
            eq = ExamQuestion(
                exam_id=exercise.id,
                section_id=section.id,
                question_id=qid,
                question_version_id=q_version.id,
                order_index=current_count,
                points=1.0,
            )
            db.add(eq)
            current_count += 1

        if q_obj:
            q_obj.usage_count = (q_obj.usage_count or 0) + 1
            q_obj.in_exercise_bank = True

    await db.commit()
    await db.refresh(exercise)
    return exercise


async def remove_question_from_exercise(
    db: AsyncSession,
    exercise_id: uuid.UUID,
    question_id: uuid.UUID,
) -> bool:
    """Gỡ câu hỏi khỏi bộ bài tập"""
    stmt = (
        select(ExamQuestion)
        .where(
            and_(
                ExamQuestion.exam_id == exercise_id,
                ExamQuestion.question_id == question_id,
            )
        )
    )
    result = await db.execute(stmt)
    eq = result.scalar_one_or_none()
    if not eq:
        return False

    await db.delete(eq)

    # Giảm usage_count nếu có
    q_obj = await db.get(Question, question_id)
    if q_obj and q_obj.usage_count and q_obj.usage_count > 0:
        q_obj.usage_count -= 1

    await db.commit()
    return True


async def delete_exercise(db: AsyncSession, exercise_id: uuid.UUID) -> bool:
    """Xóa bộ bài tập khỏi kho"""
    exercise = await get_exercise(db, exercise_id)
    if not exercise:
        return False

    # Giảm usage_count cho các câu hỏi thuộc bài tập này
    for sec in exercise.sections:
        for eq in sec.questions:
            q_obj = await db.get(Question, eq.question_id)
            if q_obj and q_obj.usage_count and q_obj.usage_count > 0:
                q_obj.usage_count -= 1

    await db.delete(exercise)
    await db.commit()
    return True
