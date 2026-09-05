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


async def list_domains_with_topics(db: AsyncSession, user_id: Optional[uuid.UUID] = None) -> List[Dict[str, Any]]:
    """Lấy danh sách tất cả các Lĩnh vực và Chủ đề kèm số lượng câu hỏi"""
    # Count questions per topic and chapter
    topic_conds = [Question.status != "archived", Question.topic_id != None]
    chap_conds = [Question.status != "archived", Question.chapter_id != None]
    if user_id:
        topic_conds.append(Question.created_by == user_id)
        chap_conds.append(Question.created_by == user_id)

    q_topic_counts_stmt = select(Question.topic_id, func.count(Question.id)).where(*topic_conds).group_by(Question.topic_id)
    q_topic_counts = dict((await db.execute(q_topic_counts_stmt)).all())

    q_chap_counts_stmt = select(Question.chapter_id, func.count(Question.id)).where(*chap_conds).group_by(Question.chapter_id)
    q_chap_counts = dict((await db.execute(q_chap_counts_stmt)).all())

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
        topics_sum = 0
        for tp in ch.topics:
            count = q_topic_counts.get(tp.id, 0)
            topics_sum += count
            topics_data.append({
                "id": str(tp.id),
                "name": tp.name,
                "order_index": tp.order_index,
                "question_count": count,
            })

        chap_direct = q_chap_counts.get(ch.id, 0)
        domain_total_q = max(chap_direct, topics_sum)

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


async def get_full_curriculum_tree(db: AsyncSession) -> List[Dict[str, Any]]:
    """
    Lấy toàn bộ cây Ngân hàng Câu hỏi:
    Môn học -> Chương -> Chủ đề -> Bài học
    Kèm số lượng câu hỏi động tại từng cấp.
    """
    # 1. Count questions per lesson, topic, chapter, subject
    q_topic_stmt = select(Question.topic_id, func.count(Question.id)).where(Question.status != "archived").group_by(Question.topic_id)
    topic_counts = dict((await db.execute(q_topic_stmt)).all())

    q_chapter_stmt = select(Question.chapter_id, func.count(Question.id)).where(Question.status != "archived").group_by(Question.chapter_id)
    chapter_counts = dict((await db.execute(q_chapter_stmt)).all())

    q_sub_stmt = select(Question.subject_id, func.count(Question.id)).where(Question.status != "archived").group_by(Question.subject_id)
    subject_counts = dict((await db.execute(q_sub_stmt)).all())

    stmt = (
        select(Subject)
        .where(Subject.is_active == True)
        .options(
            selectinload(Subject.chapters).selectinload(Chapter.topics).selectinload(Topic.lessons)
        )
        .order_by(Subject.name)
    )
    res = await db.execute(stmt)
    subjects = res.scalars().all()

    tree = []
    for sub in subjects:
        chapters_data = []
        sub_total_q = subject_counts.get(sub.id, 0)

        for ch in sub.chapters:
            topics_data = []
            ch_total_q = chapter_counts.get(ch.id, 0)

            for tp in ch.topics:
                lessons_data = []
                tp_q = topic_counts.get(tp.id, 0)
                ch_total_q += tp_q

                for ls in tp.lessons:
                    lessons_data.append({
                        "id": str(ls.id),
                        "name": ls.name,
                        "type": "lesson",
                        "topic_id": str(tp.id),
                        "order_index": ls.order_index,
                        "question_count": 0,
                    })

                topics_data.append({
                    "id": str(tp.id),
                    "name": tp.name,
                    "type": "topic",
                    "chapter_id": str(ch.id),
                    "order_index": tp.order_index,
                    "question_count": tp_q,
                    "children": lessons_data,
                })

            sub_total_q += ch_total_q

            chapters_data.append({
                "id": str(ch.id),
                "name": ch.name,
                "type": "chapter",
                "subject_id": str(sub.id),
                "order_index": ch.order_index,
                "question_count": ch_total_q,
                "children": topics_data,
            })

        tree.append({
            "id": str(sub.id),
            "name": sub.name,
            "code": sub.code,
            "type": "subject",
            "question_count": sub_total_q,
            "children": chapters_data,
        })

    return tree


async def delete_curriculum_node(db: AsyncSession, node_type: str, node_id: uuid.UUID) -> bool:
    """Xóa an toàn node trong cây chương trình học"""
    if node_type == "subject":
        stmt = delete(Subject).where(Subject.id == node_id)
    elif node_type == "chapter":
        stmt = delete(Chapter).where(Chapter.id == node_id)
    elif node_type == "topic":
        stmt = delete(Topic).where(Topic.id == node_id)
    elif node_type == "lesson":
        stmt = delete(Lesson).where(Lesson.id == node_id)
    else:
        return False

    res = await db.execute(stmt)
    await db.commit()
    return res.rowcount > 0


DEFAULT_SUBJECTS = [
    {"name": "Toán học", "code": "MATH", "description": "Môn Toán học phổ thông & nâng cao"},
    {"name": "Vật lý", "code": "PHYS", "description": "Môn Vật lý"},
    {"name": "Hóa học", "code": "CHEM", "description": "Môn Hóa học"},
    {"name": "Ngữ văn", "code": "LIT", "description": "Môn Ngữ văn"},
    {"name": "Tiếng Anh", "code": "ENG", "description": "Môn Tiếng Anh"},
]

DEFAULT_MATH_CURRICULUM = [
    {
        "name": "Chương 1: Hàm số và Đồ thị",
        "order": 1,
        "topics": [
            "Tính đơn điệu của hàm số",
            "Cực trị của hàm số",
            "Giá trị lớn nhất và nhỏ nhất của hàm số",
            "Đường tiệm cận của đồ thị hàm số",
            "Khảo sát sự biến thiên và vẽ đồ thị hàm số",
        ],
    },
    {
        "name": "Chương 2: Mũ và Logarit",
        "order": 2,
        "topics": [
            "Lũy thừa và hàm số lũy thừa",
            "Logarit và hàm số logarit",
            "Phương trình và bất phương trình mũ",
            "Phương trình và bất phương trình logarit",
        ],
    },
    {
        "name": "Chương 3: Nguyên hàm và Tích phân",
        "order": 3,
        "topics": [
            "Nguyên hàm và các phương pháp tìm nguyên hàm",
            "Định nghĩa và tính chất của tích phân",
            "Ứng dụng hình học của tích phân (Diện tích, Thể tích)",
        ],
    },
    {
        "name": "Chương 4: Số phức",
        "order": 4,
        "topics": [
            "Số phức và các phép toán cơ bản",
            "Tập hợp điểm biểu diễn số phức",
            "Phương trình bậc hai với hệ số thực",
        ],
    },
    {
        "name": "Chương 5: Hình học không gian & Oxyz",
        "order": 5,
        "topics": [
            "Khối đa diện và thể tích khối đa diện",
            "Mặt nón, mặt trụ, mặt cầu",
            "Hệ tọa độ trong không gian Oxyz",
            "Phương trình mặt phẳng và đường thẳng",
        ],
    },
]


async def seed_default_curriculum(db: AsyncSession) -> Dict[str, Any]:
    """Khởi tạo cây môn học, chương và chủ đề chuẩn cho lần đầu (không đè dữ liệu đã có)"""
    subjects_created = 0
    chapters_created = 0
    topics_created = 0

    # 1. Subjects
    for s_data in DEFAULT_SUBJECTS:
        stmt = select(Subject).where(Subject.code == s_data["code"])
        res = await db.execute(stmt)
        sub = res.scalar_one_or_none()
        if not sub:
            sub = Subject(name=s_data["name"], code=s_data["code"], description=s_data["description"])
            db.add(sub)
            await db.flush()
            subjects_created += 1

    # Find or use MATH subject
    math_res = await db.execute(select(Subject).where(Subject.code == "MATH"))
    math_subject = math_res.scalar_one_or_none()
    if not math_subject:
        math_subject = Subject(name="Toán học", code="MATH", description="Môn Toán học phổ thông")
        db.add(math_subject)
        await db.flush()

    # 2. Chapters & Topics for MATH
    for ch_idx, ch_info in enumerate(DEFAULT_MATH_CURRICULUM, start=1):
        ch_stmt = select(Chapter).where(Chapter.subject_id == math_subject.id, Chapter.name == ch_info["name"])
        ch_res = await db.execute(ch_stmt)
        chapter = ch_res.scalar_one_or_none()
        if not chapter:
            chapter = Chapter(
                subject_id=math_subject.id,
                name=ch_info["name"],
                order_index=ch_info.get("order", ch_idx),
            )
            db.add(chapter)
            await db.flush()
            chapters_created += 1

        for tp_idx, tp_name in enumerate(ch_info["topics"], start=1):
            tp_stmt = select(Topic).where(Topic.chapter_id == chapter.id, Topic.name == tp_name)
            tp_res = await db.execute(tp_stmt)
            topic = tp_res.scalar_one_or_none()
            if not topic:
                topic = Topic(
                    chapter_id=chapter.id,
                    name=tp_name,
                    order_index=tp_idx,
                )
                db.add(topic)
                await db.flush()
                topics_created += 1

    await db.commit()
    return {
        "message": "Đã khởi tạo cây môn học và chủ đề thành công",
        "subjects_created": subjects_created,
        "chapters_created": chapters_created,
        "topics_created": topics_created,
    }

