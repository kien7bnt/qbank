from __future__ import annotations
import uuid
from typing import Optional, List, Dict, Any

from sqlalchemy import select, func, delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.curriculum import Chapter, Lesson, LearningObjective, Subject, Topic
from app.models.question import Question
from app.schemas.curriculum import (
    ChapterCreate, ChapterNode, ChapterOut,
    CurriculumTree,
    LearningObjectiveCreate, LearningObjectiveNode, LearningObjectiveOut,
    LessonCreate, LessonNode, LessonOut,
    SubjectCreate, SubjectOut,
    TopicCreate, TopicNode, TopicOut,
)


async def get_subjects(db: AsyncSession) -> list[Subject]:
    result = await db.execute(
        select(Subject).where(Subject.is_active == True).order_by(Subject.name)
    )
    return result.scalars().all()


async def get_default_subject(db: AsyncSession) -> Subject:
    res = await db.execute(select(Subject).limit(1))
    sub = res.scalar_one_or_none()
    if not sub:
        sub = Subject(name="Toán & Khoa học", code="DEFAULT", description="Lĩnh vực chung")
        db.add(sub)
        await db.commit()
        await db.refresh(sub)
    return sub


async def list_domains_with_topics(db: AsyncSession) -> List[Dict[str, Any]]:
    """Lấy danh sách tất cả các Lĩnh vực và Chủ đề kèm số lượng câu hỏi"""
    # Count questions per topic and chapter
    q_topic_counts_stmt = select(Question.topic_id, func.count(Question.id)).where(Question.status != "archived").group_by(Question.topic_id)
    q_topic_counts = dict((await db.execute(q_topic_counts_stmt)).all())

    stmt = (
        select(Chapter)
        .options(selectinload(Chapter.topics))
        .order_by(Chapter.order_index, Chapter.name)
    )
    res = await db.execute(stmt)
    chapters = res.scalars().all()

    domains = []
    for ch in chapters:
        topics_data = []
        domain_total_q = 0
        for tp in ch.topics:
            count = q_topic_counts.get(tp.id, 0)
            domain_total_q += count
            topics_data.append({
                "id": str(tp.id),
                "name": tp.name,
                "order_index": tp.order_index,
                "question_count": count,
            })

        domains.append({
            "id": str(ch.id),
            "name": ch.name,
            "description": ch.description,
            "order_index": ch.order_index,
            "question_count": domain_total_q,
            "topics": topics_data,
        })

    return domains


async def create_domain(db: AsyncSession, name: str, description: Optional[str] = None) -> Dict[str, Any]:
    sub = await get_default_subject(db)
    chapter = Chapter(subject_id=sub.id, name=name, description=description)
    db.add(chapter)
    await db.commit()
    await db.refresh(chapter)
    return {
        "id": str(chapter.id),
        "name": chapter.name,
        "description": chapter.description,
        "question_count": 0,
        "topics": [],
    }


async def update_domain(db: AsyncSession, domain_id: uuid.UUID, name: str, description: Optional[str] = None) -> bool:
    stmt = update(Chapter).where(Chapter.id == domain_id).values(name=name, description=description)
    res = await db.execute(stmt)
    await db.commit()
    return res.rowcount > 0


async def delete_domain(db: AsyncSession, domain_id: uuid.UUID) -> bool:
    stmt = delete(Chapter).where(Chapter.id == domain_id)
    res = await db.execute(stmt)
    await db.commit()
    return res.rowcount > 0


async def create_topic_under_domain(db: AsyncSession, domain_id: uuid.UUID, name: str) -> Dict[str, Any]:
    topic = Topic(chapter_id=domain_id, name=name)
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return {
        "id": str(topic.id),
        "chapter_id": str(domain_id),
        "name": topic.name,
        "question_count": 0,
    }


async def update_topic(db: AsyncSession, topic_id: uuid.UUID, name: str) -> bool:
    stmt = update(Topic).where(Topic.id == topic_id).values(name=name)
    res = await db.execute(stmt)
    await db.commit()
    return res.rowcount > 0


async def delete_topic(db: AsyncSession, topic_id: uuid.UUID) -> bool:
    stmt = delete(Topic).where(Topic.id == topic_id)
    res = await db.execute(stmt)
    await db.commit()
    return res.rowcount > 0


async def create_subject(db: AsyncSession, data: SubjectCreate) -> Subject:
    subject = Subject(name=data.name, code=data.code, description=data.description)
    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    return subject


async def get_subject_tree(db: AsyncSession, subject_id: uuid.UUID) -> Optional[CurriculumTree]:
    result = await db.execute(
        select(Subject)
        .options(
            selectinload(Subject.chapters)
            .selectinload(Chapter.topics)
            .selectinload(Topic.lessons)
            .selectinload(Lesson.learning_objectives)
        )
        .where(Subject.id == subject_id)
    )
    subject = result.scalar_one_or_none()
    if not subject:
        return None

    chapters = [
        ChapterNode(
            id=ch.id,
            subject_id=ch.subject_id,
            name=ch.name,
            order_index=ch.order_index,
            description=ch.description,
            topics=[
                TopicNode(
                    id=tp.id,
                    chapter_id=tp.chapter_id,
                    name=tp.name,
                    order_index=tp.order_index,
                    lessons=[
                        LessonNode(
                            id=ls.id,
                            topic_id=ls.topic_id,
                            name=ls.name,
                            order_index=ls.order_index,
                            learning_objectives=[
                                LearningObjectiveNode(
                                    id=lo.id,
                                    lesson_id=lo.lesson_id,
                                    description=lo.description,
                                    bloom_level=lo.bloom_level,
                                )
                                for lo in ls.learning_objectives
                            ],
                        )
                        for ls in tp.lessons
                    ],
                )
                for tp in ch.topics
            ],
        )
        for ch in subject.chapters
    ]

    return CurriculumTree(
        subject=SubjectOut.model_validate(subject),
        chapters=chapters,
    )


async def create_chapter(db: AsyncSession, data: ChapterCreate) -> Chapter:
    chapter = Chapter(**data.model_dump())
    db.add(chapter)
    await db.commit()
    await db.refresh(chapter)
    return chapter


async def create_topic(db: AsyncSession, data: TopicCreate) -> Topic:
    topic = Topic(**data.model_dump())
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return topic


async def create_lesson(db: AsyncSession, data: LessonCreate) -> Lesson:
    lesson = Lesson(**data.model_dump())
    db.add(lesson)
    await db.commit()
    await db.refresh(lesson)
    return lesson


async def create_learning_objective(db: AsyncSession, data: LearningObjectiveCreate) -> LearningObjective:
    lo = LearningObjective(**data.model_dump())
    db.add(lo)
    await db.commit()
    await db.refresh(lo)
    return lo
