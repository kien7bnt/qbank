from __future__ import annotations
import uuid
from typing import Any, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.question import (
    Question, QuestionCoding, QuestionEssay, QuestionOption, QuestionVersion
)
from app.schemas.question import (
    BulkActionRequest, QuestionCreate, QuestionListItem, QuestionUpdate, QuestionVersionOut
)


async def _next_item_id(db: AsyncSession) -> str:
    result = await db.execute(select(func.count()).select_from(Question))
    count = result.scalar_one()
    return f"Q{count + 1:04d}"


async def create_question(
    db: AsyncSession, data: QuestionCreate, user_id: uuid.UUID
) -> Question:
    item_id = await _next_item_id(db)

    question = Question(
        item_id=item_id,
        type=data.type,
        status="draft",
        stem=data.stem,
        rationale=data.rationale,
        subject_id=data.subject_id,
        chapter_id=data.chapter_id,
        topic_id=data.topic_id,
        lesson_id=data.lesson_id,
        learning_objective_id=data.learning_objective_id,
        bloom_level=data.bloom_level,
        expected_difficulty=data.expected_difficulty,
        created_by=user_id,
        version=1,
    )
    db.add(question)
    await db.flush()

    # MCQ options
    if data.type == "mcq" and data.options:
        for idx, opt_data in enumerate(data.options):
            option = QuestionOption(
                question_id=question.id,
                label=opt_data.label,
                text=opt_data.text,
                is_correct=opt_data.is_correct,
                distractor_reason=opt_data.distractor_reason,
                order_index=idx,
            )
            db.add(option)

    # Essay
    if data.type == "essay" and data.essay_data:
        essay = QuestionEssay(
            question_id=question.id,
            sample_answer=data.essay_data.sample_answer,
            rubric=data.essay_data.rubric,
            max_points=data.essay_data.max_points,
        )
        db.add(essay)

    # Coding
    if data.type == "coding" and data.coding_data:
        coding = QuestionCoding(
            question_id=question.id,
            **data.coding_data.model_dump(),
        )
        db.add(coding)

    # Save initial version snapshot
    snapshot = data.model_dump()
    snapshot["item_id"] = item_id
    version = QuestionVersion(
        question_id=question.id,
        version_number=1,
        snapshot=snapshot,
        changed_by=user_id,
    )
    db.add(version)

    await db.commit()
    q = await get_question(db, question.id)
    return q or question


async def get_question(db: AsyncSession, question_id: uuid.UUID) -> Optional[Question]:
    result = await db.execute(
        select(Question)
        .options(
            selectinload(Question.options),
            selectinload(Question.essay_data),
            selectinload(Question.coding_data),
            selectinload(Question.subject),
            selectinload(Question.chapter),
            selectinload(Question.topic),
        )
        .where(Question.id == question_id, Question.status != "archived")
    )
    return result.scalar_one_or_none()


async def list_questions(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    type: Optional[str] = None,
    status: Optional[str] = None,
    subject_id: Optional[uuid.UUID] = None,
    chapter_id: Optional[uuid.UUID] = None,
    topic_id: Optional[uuid.UUID] = None,
    bloom_level: Optional[str] = None,
    difficulty: Optional[str] = None,
    search: Optional[str] = None,
    psychometric_status: Optional[str] = None,  # all | unscaled | scaled
) -> Tuple[list[Question], int]:
    query = (
        select(Question)
        .options(
            selectinload(Question.subject),
            selectinload(Question.chapter),
            selectinload(Question.topic),
        )
        .where(Question.status != "archived")
    )

    if type:
        query = query.where(Question.type == type)
    if status:
        query = query.where(Question.status == status)
    if subject_id:
        query = query.where(Question.subject_id == subject_id)
    if chapter_id:
        query = query.where(Question.chapter_id == chapter_id)
    if topic_id:
        query = query.where(Question.topic_id == topic_id)
    if bloom_level:
        query = query.where(Question.bloom_level == bloom_level)
    if difficulty:
        query = query.where(Question.expected_difficulty == difficulty)
    if search:
        query = query.where(
            Question.stem.ilike(f"%{search}%") | Question.item_id.ilike(f"%{search}%")
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    query = (
        query.order_by(Question.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    items = result.scalars().all()
    return items, total


async def update_question(
    db: AsyncSession,
    question_id: uuid.UUID,
    data: QuestionUpdate,
    user_id: uuid.UUID,
) -> Question:
    question = await get_question(db, question_id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy câu hỏi")

    # Update scalar fields
    update_data = data.model_dump(exclude_unset=True, exclude={"options", "essay_data", "coding_data"})
    for field, value in update_data.items():
        setattr(question, field, value)

    # Update options (MCQ)
    if data.options is not None:
        # Delete old options
        for opt in question.options:
            await db.delete(opt)
        await db.flush()
        for idx, opt_data in enumerate(data.options):
            option = QuestionOption(
                question_id=question.id,
                label=opt_data.label,
                text=opt_data.text,
                is_correct=opt_data.is_correct,
                distractor_reason=opt_data.distractor_reason,
                order_index=idx,
            )
            db.add(option)

    # Increment version and save snapshot
    question.version += 1
    snapshot: dict[str, Any] = data.model_dump()
    snapshot["version"] = question.version
    version = QuestionVersion(
        question_id=question.id,
        version_number=question.version,
        snapshot=snapshot,
        changed_by=user_id,
    )
    db.add(version)

    await db.commit()
    await db.refresh(question)
    return question


async def delete_question(db: AsyncSession, question_id: uuid.UUID) -> bool:
    question = await get_question(db, question_id)
    if not question:
        return False
    question.status = "archived"
    await db.commit()
    return True


async def get_question_versions(
    db: AsyncSession, question_id: uuid.UUID
) -> list[QuestionVersion]:
    result = await db.execute(
        select(QuestionVersion)
        .where(QuestionVersion.question_id == question_id)
        .order_by(QuestionVersion.version_number.desc())
    )
    return result.scalars().all()


async def bulk_action(
    db: AsyncSession,
    data: BulkActionRequest,
    user_id: uuid.UUID,
) -> dict:
    question_ids = data.question_ids
    action = data.action
    payload = data.payload
    updated = 0

    if action in ("archive", "delete"):
        stmt = (
            update(Question)
            .where(Question.id.in_(question_ids))
            .values(status="archived")
        )
        result = await db.execute(stmt)
        updated = result.rowcount

    elif action == "approve":
        stmt = (
            update(Question)
            .where(Question.id.in_(question_ids))
            .values(status="approved")
        )
        result = await db.execute(stmt)
        updated = result.rowcount

    elif action == "assign_topic":
        topic_id = payload.get("topic_id")
        chapter_id = payload.get("chapter_id")
        vals = {}
        if topic_id:
            vals["topic_id"] = topic_id
        if chapter_id:
            vals["chapter_id"] = chapter_id
        if vals:
            stmt = update(Question).where(Question.id.in_(question_ids)).values(**vals)
            result = await db.execute(stmt)
            updated = result.rowcount

    elif action == "change_bloom":
        bloom = payload.get("bloom_level")
        if bloom:
            stmt = (
                update(Question)
                .where(Question.id.in_(question_ids))
                .values(bloom_level=bloom)
            )
            result = await db.execute(stmt)
            updated = result.rowcount

    elif action == "change_difficulty":
        diff = payload.get("expected_difficulty")
        if diff:
            stmt = (
                update(Question)
                .where(Question.id.in_(question_ids))
                .values(expected_difficulty=diff)
            )
            result = await db.execute(stmt)
            updated = result.rowcount

    elif action == "change_status":
        new_status = payload.get("status")
        if new_status:
            stmt = (
                update(Question)
                .where(Question.id.in_(question_ids))
                .values(status=new_status)
            )
            result = await db.execute(stmt)
            updated = result.rowcount

    await db.commit()
    return {"updated": updated, "action": action}
