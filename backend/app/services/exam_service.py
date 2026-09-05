import uuid
from typing import Sequence, Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.exam import ExamMatrix, ExamMatrixSection, Exam, ExamSection, ExamQuestion
from app.models.question import Question, QuestionVersion
from app.schemas.exam import ExamMatrixCreate, ExamMatrixUpdate, ExamCreate, ExamUpdate
from app.ai.agents.selection import QuestionSelectionAgent, ExamSelectionPlan
from app.ai.providers import get_provider
from app.core.config import settings


async def create_matrix(db: AsyncSession, data: ExamMatrixCreate, user_id: uuid.UUID) -> ExamMatrix:
    matrix = ExamMatrix(
        name=data.name,
        subject_id=data.subject_id,
        class_id=data.class_id,
        total_questions=data.total_questions,
        total_points=data.total_points,
        created_by=user_id,
        status="draft"
    )
    db.add(matrix)
    await db.flush()
    
    for sec in data.sections:
        section = ExamMatrixSection(
            matrix_id=matrix.id,
            name=sec.name,
            question_type=sec.question_type,
            question_count=sec.question_count,
            points_per_question=sec.points_per_question,
            rules=sec.rules
        )
        db.add(section)
    
    await db.commit()
    await db.refresh(matrix)
    return matrix


async def get_matrix(db: AsyncSession, matrix_id: uuid.UUID) -> Optional[ExamMatrix]:
    stmt = select(ExamMatrix).options(selectinload(ExamMatrix.sections)).where(ExamMatrix.id == matrix_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_matrices(
    db: AsyncSession,
    subject_id: Optional[str] = None,
    class_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
) -> Sequence[ExamMatrix]:
    stmt = select(ExamMatrix).options(selectinload(ExamMatrix.sections)).order_by(ExamMatrix.created_at.desc())
    if subject_id:
        stmt = stmt.where(ExamMatrix.subject_id == subject_id)
    if class_id:
        stmt = stmt.where(ExamMatrix.class_id == class_id)
    if user_id:
        stmt = stmt.where(ExamMatrix.created_by == user_id)
        
    result = await db.execute(stmt)
    return result.scalars().all()


async def delete_matrix(db: AsyncSession, matrix_id: uuid.UUID) -> bool:
    matrix = await get_matrix(db, matrix_id)
    if not matrix:
        return False
    await db.delete(matrix)
    await db.commit()
    return True


async def auto_select_for_matrix(db: AsyncSession, matrix_id: uuid.UUID) -> ExamSelectionPlan:
    matrix = await get_matrix(db, matrix_id)
    if not matrix:
        raise ValueError("Matrix not found")

    # Fetch available questions for this subject
    stmt = select(Question).where(Question.subject_id == matrix.subject_id)
    result = await db.execute(stmt)
    questions = result.scalars().all()

    # Prepare candidate dicts
    candidates = [
        {
            "id": str(q.id),
            "stem": q.stem,
            "type": q.type,
            "bloom_level": q.bloom_level,
            "expected_difficulty": q.expected_difficulty,
            "topic_id": str(q.topic_id) if q.topic_id else None,
            "chapter_id": str(q.chapter_id) if q.chapter_id else None,
        }
        for q in questions
    ]

    # Prepare sections config
    sections_config = [
        {
            "name": s.name,
            "question_type": s.question_type,
            "question_count": s.question_count,
            "points_per_question": s.points_per_question,
            "rules": s.rules or {},
        }
        for s in matrix.sections
    ]

    provider = get_provider(getattr(settings, "AI_PROVIDER", "mock"))
    agent = QuestionSelectionAgent(provider=provider)
    output = await agent.execute(
        matrix_name=matrix.name,
        sections=sections_config,
        candidate_questions=candidates,
    )

    if not output.data:
        raise ValueError(output.error or "Failed to select questions")

    return output.data


async def create_exam_from_matrix(
    db: AsyncSession, matrix_id: uuid.UUID, name: str, class_id: Optional[uuid.UUID], user_id: uuid.UUID
) -> Exam:
    matrix = await get_matrix(db, matrix_id)
    if not matrix:
        raise ValueError("Matrix not found")

    # Run auto selection
    selection_plan = await auto_select_for_matrix(db, matrix_id)

    # Create Exam
    exam = Exam(
        name=name,
        matrix_id=matrix.id,
        class_id=class_id or matrix.class_id,
        duration_minutes=45,
        created_by=user_id,
        status="draft"
    )
    db.add(exam)
    await db.flush()

    # Create sections & questions
    for order_idx, sec_res in enumerate(selection_plan.selected_sections):
        sec_cfg = next((s for s in matrix.sections if s.name == sec_res.section_name), None)
        q_type = sec_cfg.question_type if sec_cfg else "mcq"
        pts = sec_cfg.points_per_question if sec_cfg else 1.0

        exam_section = ExamSection(
            exam_id=exam.id,
            name=sec_res.section_name,
            order_index=order_idx,
            question_type=q_type,
        )
        db.add(exam_section)
        await db.flush()

        # Add questions
        for q_idx, qid_str in enumerate(sec_res.question_ids):
            qid = uuid.UUID(qid_str)
            
            # Find latest question version
            v_stmt = select(QuestionVersion).where(QuestionVersion.question_id == qid).order_by(QuestionVersion.version_number.desc())
            v_res = await db.execute(v_stmt)
            q_version = v_res.scalars().first()

            if not q_version:
                # If no explicit version entry, fallback create or find
                # fetch question
                q_obj = await db.get(Question, qid)
                if q_obj:
                    q_version = QuestionVersion(
                        question_id=qid,
                        version_number=q_obj.version,
                        snapshot={"stem": q_obj.stem, "type": q_obj.type},
                        changed_by=user_id
                    )
                    db.add(q_version)
                    await db.flush()

            if q_version:
                eq = ExamQuestion(
                    exam_id=exam.id,
                    section_id=exam_section.id,
                    question_id=qid,
                    question_version_id=q_version.id,
                    order_index=q_idx,
                    points=pts,
                )
                db.add(eq)

    await db.commit()
    await db.refresh(exam)
    return exam


async def get_exam(db: AsyncSession, exam_id: uuid.UUID) -> Optional[Exam]:
    stmt = (
        select(Exam)
        .options(
            selectinload(Exam.sections).selectinload(ExamSection.questions).selectinload(ExamQuestion.question).selectinload(Question.options)
        )
        .where(Exam.id == exam_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_exams(
    db: AsyncSession,
    class_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
) -> Sequence[Exam]:
    stmt = (
        select(Exam)
        .options(selectinload(Exam.sections).selectinload(ExamSection.questions))
        .order_by(Exam.created_at.desc())
    )
    if class_id:
        stmt = stmt.where(Exam.class_id == class_id)
    if user_id:
        stmt = stmt.where(Exam.created_by == user_id)
        
    result = await db.execute(stmt)
    return result.scalars().all()


async def delete_exam(db: AsyncSession, exam_id: uuid.UUID) -> bool:
    exam = await get_exam(db, exam_id)
    if not exam:
        return False
    await db.delete(exam)
    await db.commit()
    return True


async def create_exam_from_question_ids(
    db: AsyncSession,
    name: str,
    question_ids: list[uuid.UUID],
    user_id: uuid.UUID,
    class_id: Optional[uuid.UUID] = None,
    duration_minutes: int = 45,
    points_per_question: Optional[float] = None,
    shuffle_questions: bool = False,
    shuffle_options: bool = False,
) -> Exam:
    pts = points_per_question if points_per_question is not None else (10.0 / len(question_ids) if question_ids else 1.0)

    exam = Exam(
        name=name,
        class_id=class_id,
        duration_minutes=duration_minutes,
        shuffle_questions=shuffle_questions,
        shuffle_options=shuffle_options,
        created_by=user_id,
        status="draft",
    )
    db.add(exam)
    await db.flush()

    exam_section = ExamSection(
        exam_id=exam.id,
        name="Phần thi trắc nghiệm & tự luận",
        order_index=0,
        question_type="mixed",
    )
    db.add(exam_section)
    await db.flush()

    for idx, qid in enumerate(question_ids):
        v_stmt = (
            select(QuestionVersion)
            .where(QuestionVersion.question_id == qid)
            .order_by(QuestionVersion.version_number.desc())
        )
        v_res = await db.execute(v_stmt)
        q_version = v_res.scalars().first()

        if not q_version:
            q_obj = await db.get(Question, qid)
            if q_obj:
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
                exam_id=exam.id,
                section_id=exam_section.id,
                question_id=qid,
                question_version_id=q_version.id,
                order_index=idx,
                points=round(pts, 2),
            )
            db.add(eq)

    await db.commit()
    await db.refresh(exam)
    return exam
