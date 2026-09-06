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
from app.models.curriculum import Chapter
from app.schemas.question import (
    BulkActionRequest, QuestionCreate, QuestionListItem, QuestionUpdate, QuestionVersionOut,
    QuestionBatchCreateRequest, QuestionBatchCreateResponse,
)


async def _next_item_id(db: AsyncSession) -> str:
    stmt = select(Question.item_id)
    result = await db.execute(stmt)
    all_item_ids = set(result.scalars().all())

    max_num = 0
    for iid in all_item_ids:
        if iid and iid.startswith("Q") and iid[1:].isdigit():
            try:
                num = int(iid[1:])
                if num > max_num:
                    max_num = num
            except ValueError:
                pass

    next_num = max(max_num + 1, len(all_item_ids) + 1)
    while f"Q{next_num:04d}" in all_item_ids:
        next_num += 1

    return f"Q{next_num:04d}"


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
        bloom_level=data.bloom_level or "understand",
        expected_difficulty=data.expected_difficulty or "medium",
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
                order_index=opt_data.order_index if opt_data.order_index is not None else idx,
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

    # Save initial version snapshot (mode="json" serializes UUIDs to strings)
    snapshot = data.model_dump(mode="json")
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


async def create_questions_batch(
    db: AsyncSession, data: QuestionBatchCreateRequest, user_id: uuid.UUID
) -> QuestionBatchCreateResponse:
    created_ids: list[uuid.UUID] = []
    
    stmt = select(Question.item_id)
    result = await db.execute(stmt)
    all_item_ids = set(result.scalars().all())

    max_num = 0
    for iid in all_item_ids:
        if iid and iid.startswith("Q") and iid[1:].isdigit():
            try:
                num = int(iid[1:])
                if num > max_num:
                    max_num = num
            except ValueError:
                pass

    next_num = max(max_num, len(all_item_ids))

    for q_data in data.questions:
        next_num += 1
        while f"Q{next_num:04d}" in all_item_ids:
            next_num += 1
        item_id = f"Q{next_num:04d}"
        all_item_ids.add(item_id)

        chapter_id = q_data.chapter_id or data.chapter_id
        topic_id = q_data.topic_id or data.topic_id
        subject_id = q_data.subject_id or data.subject_id

        question = Question(
            item_id=item_id,
            type=q_data.type or "mcq",
            status="draft",
            stem=q_data.stem,
            rationale=q_data.rationale,
            subject_id=subject_id,
            chapter_id=chapter_id,
            topic_id=topic_id,
            lesson_id=q_data.lesson_id,
            learning_objective_id=q_data.learning_objective_id,
            bloom_level=q_data.bloom_level or "understand",
            expected_difficulty=q_data.expected_difficulty or "medium",
            created_by=user_id,
            version=1,
        )
        db.add(question)
        await db.flush()
        created_ids.append(question.id)

        # MCQ options
        if (q_data.type or "mcq") == "mcq" and q_data.options:
            for idx, opt_data in enumerate(q_data.options):
                option = QuestionOption(
                    question_id=question.id,
                    label=opt_data.label,
                    text=opt_data.text,
                    is_correct=opt_data.is_correct,
                    distractor_reason=opt_data.distractor_reason,
                    order_index=opt_data.order_index if opt_data.order_index is not None else idx,
                )
                db.add(option)

        # Essay
        if q_data.type == "essay" and q_data.essay_data:
            essay = QuestionEssay(
                question_id=question.id,
                sample_answer=q_data.essay_data.sample_answer,
                rubric=q_data.essay_data.rubric,
                max_points=q_data.essay_data.max_points,
            )
            db.add(essay)

        # Coding
        if q_data.type == "coding" and q_data.coding_data:
            coding = QuestionCoding(
                question_id=question.id,
                **q_data.coding_data.model_dump(),
            )
            db.add(coding)

        # Snapshot
        snapshot = q_data.model_dump(mode="json")
        snapshot["item_id"] = item_id
        version = QuestionVersion(
            question_id=question.id,
            version_number=1,
            snapshot=snapshot,
            changed_by=user_id,
        )
        db.add(version)

    await db.commit()
    return QuestionBatchCreateResponse(
        total_created=len(created_ids),
        created_ids=created_ids,
        message=f"Đã tạo thành công {len(created_ids)} câu hỏi vào ngân hàng"
    )


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
    created_by: Optional[uuid.UUID] = None,
    in_exercise_bank: Optional[bool] = None,
) -> Tuple[list[Question], int]:
    query = (
        select(Question)
        .options(
            selectinload(Question.options),
            selectinload(Question.subject),
            selectinload(Question.chapter),
            selectinload(Question.topic),
        )
        .where(Question.status != "archived")
    )

    if in_exercise_bank is not None:
        query = query.where(Question.in_exercise_bank == in_exercise_bank)
    if created_by:
        query = query.where(Question.created_by == created_by)
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
    is_admin: bool = False,
) -> Question:
    question = await get_question(db, question_id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy câu hỏi")
    if not is_admin and question.created_by != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền chỉnh sửa câu hỏi này")

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
    snapshot: dict[str, Any] = data.model_dump(mode="json")
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


async def delete_question(
    db: AsyncSession,
    question_id: uuid.UUID,
    user_id: Optional[uuid.UUID] = None,
    is_admin: bool = False,
) -> bool:
    question = await get_question(db, question_id)
    if not question:
        return False
    if not is_admin and user_id and question.created_by != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền xóa câu hỏi này")
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
    is_admin: bool = False,
) -> dict:
    question_ids = [
        uuid.UUID(str(qid)) if not isinstance(qid, uuid.UUID) else qid
        for qid in data.question_ids
    ]
    action = data.action
    payload = data.payload or {}
    updated = 0

    if not question_ids:
        return {"updated": 0, "action": action}

    base_filter = [Question.id.in_(question_ids)]
    if not is_admin:
        base_filter.append(Question.created_by == user_id)

    if action in ("archive", "delete"):
        stmt = (
            update(Question)
            .where(*base_filter)
            .values(status="archived")
        )
        result = await db.execute(stmt)
        updated = result.rowcount

    elif action == "approve":
        stmt = (
            update(Question)
            .where(*base_filter)
            .values(status="approved")
        )
        result = await db.execute(stmt)
        updated = result.rowcount

    elif action == "assign_topic":
        raw_topic_id = payload.get("topic_id")
        raw_chapter_id = payload.get("chapter_id")
        raw_subject_id = payload.get("subject_id")
        vals = {}

        if raw_topic_id:
            try:
                vals["topic_id"] = uuid.UUID(str(raw_topic_id))
            except Exception:
                vals["topic_id"] = raw_topic_id

        if raw_chapter_id:
            try:
                ch_uuid = uuid.UUID(str(raw_chapter_id))
                vals["chapter_id"] = ch_uuid
                # Automatically link subject_id if chapter belongs to a subject
                ch_stmt = select(Chapter.subject_id).where(Chapter.id == ch_uuid)
                ch_subj = (await db.execute(ch_stmt)).scalar_one_or_none()
                if ch_subj:
                    vals["subject_id"] = ch_subj
            except Exception:
                vals["chapter_id"] = raw_chapter_id

        if raw_subject_id:
            try:
                vals["subject_id"] = uuid.UUID(str(raw_subject_id))
            except Exception:
                vals["subject_id"] = raw_subject_id

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


# ─── Question Usage & Assessment Operations ──────────────────────────────────

import random
from app.models.exam import Exam, ExamSection, ExamQuestion
from app.schemas.question import (
    AddToAssessmentRequest, AutoGenerateAssessmentRequest,
    QuestionUsageOut, AssessmentReference
)
from app.services import exercise_service, exam_service


async def get_question_usage(db: AsyncSession, question_id: uuid.UUID) -> QuestionUsageOut:
    """Lấy danh sách các bài tập & đề thi đang sử dụng câu hỏi này kèm thống kê"""
    q = await db.get(Question, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi")

    stmt = (
        select(ExamQuestion)
        .options(
            selectinload(ExamQuestion.exam)
            .selectinload(Exam.sections)
            .selectinload(ExamSection.questions)
        )
        .where(ExamQuestion.question_id == question_id)
    )
    result = await db.execute(stmt)
    exam_questions = result.scalars().all()

    assessments_dict: dict[uuid.UUID, AssessmentReference] = {}
    for eq in exam_questions:
        if eq.exam and eq.exam.id not in assessments_dict:
            q_count = sum(len(sec.questions) for sec in eq.exam.sections) if eq.exam.sections else 0
            assessments_dict[eq.exam.id] = AssessmentReference(
                id=eq.exam.id,
                name=eq.exam.name,
                type=getattr(eq.exam, "type", "exam") or "exam",
                status=eq.exam.status,
                created_at=eq.exam.created_at,
                class_name=None,
                question_count=q_count,
            )

    assessments_list = sorted(assessments_dict.values(), key=lambda a: a.created_at, reverse=True)
    usage_count = len(assessments_list)

    if q.usage_count != usage_count:
        q.usage_count = usage_count
        await db.commit()

    stem_prev = (q.stem[:120] + "...") if q.stem and len(q.stem) > 120 else (q.stem or "")

    return QuestionUsageOut(
        question_id=q.id,
        item_id=q.item_id,
        stem_preview=stem_prev,
        usage_count=usage_count,
        attempt_count=0,
        correct_count=0,
        actual_difficulty=q.actual_difficulty,
        discrimination_index=q.discrimination_index,
        irt_a=q.irt_a,
        irt_b=q.irt_b,
        irt_c=q.irt_c,
        assessments=assessments_list,
    )


async def add_to_assessment(
    db: AsyncSession,
    user_id: uuid.UUID,
    req: AddToAssessmentRequest,
) -> dict:
    """Thêm một hoặc nhiều câu hỏi vào bài tập hoặc đề kiểm tra (tạo mới hoặc thêm vào bài có sẵn)"""
    if not req.question_ids:
        raise HTTPException(status_code=400, detail="Vui lòng chọn ít nhất 1 câu hỏi")

    if req.mode == "new":
        name = (req.name or "").strip() or ("Bài tập mới" if req.target_type == "exercise" else "Đề thi mới")
        if req.target_type == "exercise":
            item = await exercise_service.create_exercise_from_question_ids(
                db,
                name=name,
                question_ids=req.question_ids,
                user_id=user_id,
                class_id=req.class_id,
                duration_minutes=req.duration_minutes or 45,
            )
            return {"id": item.id, "name": item.name, "type": "exercise", "message": f"Đã tạo bài tập '{item.name}' với {len(req.question_ids)} câu hỏi"}
        else:
            item = await exam_service.create_exam_from_question_ids(
                db,
                name=name,
                question_ids=req.question_ids,
                user_id=user_id,
                class_id=req.class_id,
                duration_minutes=req.duration_minutes or 45,
                type="exam",
            )
            return {"id": item.id, "name": item.name, "type": "exam", "message": f"Đã tạo đề thi '{item.name}' với {len(req.question_ids)} câu hỏi"}

    elif req.mode == "existing":
        if not req.assessment_id:
            raise HTTPException(status_code=400, detail="Vui lòng chọn bài tập hoặc đề thi cần thêm vào")

        if req.target_type == "exercise":
            item = await exercise_service.add_questions_to_exercise(
                db,
                exercise_id=req.assessment_id,
                question_ids=req.question_ids,
                user_id=user_id,
            )
            return {"id": item.id, "name": item.name, "type": "exercise", "message": f"Đã thêm {len(req.question_ids)} câu hỏi vào bài tập '{item.name}'"}
        else:
            item = await exam_service.add_questions_to_exam(
                db,
                exam_id=req.assessment_id,
                question_ids=req.question_ids,
                user_id=user_id,
            )
            return {"id": item.id, "name": item.name, "type": "exam", "message": f"Đã thêm {len(req.question_ids)} câu hỏi vào đề thi '{item.name}'"}

    raise HTTPException(status_code=400, detail="Chế độ (mode) không hợp lệ")


async def auto_generate_assessment(
    db: AsyncSession,
    user_id: uuid.UUID,
    req: AutoGenerateAssessmentRequest,
) -> dict:
    """Tự động sinh bộ bài tập hoặc đề thi theo tiêu chí ma trận (Bloom, độ khó, chủ đề)"""
    stmt = select(Question).where(Question.status.in_(["approved", "draft"]))

    if req.chapter_id:
        stmt = stmt.where(Question.chapter_id == req.chapter_id)
    if req.topic_id:
        stmt = stmt.where(Question.topic_id == req.topic_id)
    if req.question_types:
        stmt = stmt.where(Question.type.in_(req.question_types))

    res = await db.execute(stmt)
    candidate_questions = list(res.scalars().all())

    if not candidate_questions:
        raise HTTPException(
            status_code=400,
            detail="Không tìm thấy câu hỏi phù hợp trong Ngân hàng câu hỏi để sinh đề/bài tập"
        )

    selected_questions: list[Question] = []
    remaining_pool = list(candidate_questions)

    def pick_matching(bloom: Optional[str], diff: Optional[str], count: int) -> list[Question]:
        nonlocal remaining_pool
        matched = []
        for q in list(remaining_pool):
            b_match = (bloom is None) or (q.bloom_level == bloom)
            d_match = (diff is None) or (q.expected_difficulty == diff)
            if b_match and d_match:
                matched.append(q)
                remaining_pool.remove(q)
                if len(matched) >= count:
                    break
        return matched

    # 1. Bốc theo Bloom
    if req.bloom_mix:
        for bloom, count in req.bloom_mix.items():
            if count > 0:
                picked = pick_matching(bloom, None, count)
                selected_questions.extend(picked)

    # 2. Bốc theo độ khó nếu còn thiếu
    needed = req.total_questions - len(selected_questions)
    if needed > 0 and req.difficulty_mix:
        for diff, count in req.difficulty_mix.items():
            if count > 0 and needed > 0:
                picked = pick_matching(None, diff, min(count, needed))
                selected_questions.extend(picked)
                needed = req.total_questions - len(selected_questions)

    # 3. Bốc bù ngẫu nhiên nếu vẫn còn thiếu
    needed = req.total_questions - len(selected_questions)
    if needed > 0 and remaining_pool:
        random.shuffle(remaining_pool)
        selected_questions.extend(remaining_pool[:needed])

    if not selected_questions:
        raise HTTPException(status_code=400, detail="Không đủ câu hỏi để sinh tự động")

    q_ids = [q.id for q in selected_questions]

    add_req = AddToAssessmentRequest(
        target_type=req.target_type,
        mode="new",
        name=req.name,
        class_id=req.class_id,
        duration_minutes=req.duration_minutes,
        question_ids=q_ids,
    )
    return await add_to_assessment(db, user_id, add_req)
