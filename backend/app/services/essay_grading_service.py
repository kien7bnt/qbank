"""
Service layer for Essay Grading & Teacher Reviews
"""
from __future__ import annotations
import uuid
from typing import Optional, Dict, Any
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.assignment import StudentResponse, ExamAttempt
from app.models.question import Question, QuestionEssay
from app.models.rubric import Rubric, EssayGrading, EssayGradingReview
from app.schemas.rubric import EssayGradingReviewCreate, EssayManualGradeRequest
from app.ai.agents.essay_grading import EssayGradingAgent
from app.ai.providers import get_provider
from app.core.config import settings


def _get_active_provider():
    p_name = getattr(settings, "AI_PROVIDER", "mock").lower()
    if p_name in ("gemini", "google"):
        return get_provider(
            "gemini",
            api_key=getattr(settings, "GEMINI_API_KEY", ""),
            model=getattr(settings, "GEMINI_MODEL", "gemini-2.0-flash"),
        )
    elif p_name == "openai":
        return get_provider(
            "openai",
            api_key=getattr(settings, "OPENAI_API_KEY", ""),
            model=getattr(settings, "OPENAI_MODEL", "gpt-4o"),
        )
    return get_provider("mock")


async def grade_student_essay_response(
    db: AsyncSession,
    response_id: uuid.UUID,
    rubric_id: Optional[uuid.UUID] = None,
) -> EssayGrading:
    # 1. Fetch Student Response with Question and Attempt
    stmt = (
        select(StudentResponse)
        .where(StudentResponse.id == response_id)
        .options(
            selectinload(StudentResponse.question).selectinload(Question.essay_data),
            selectinload(StudentResponse.attempt),
        )
    )
    res = await db.execute(stmt)
    student_response = res.scalar_one_or_none()
    if not student_response:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu trả lời của sinh viên")

    question = student_response.question
    if not question or question.type != "essay":
        raise HTTPException(status_code=400, detail="Câu hỏi này không phải là câu hỏi tự luận")

    essay_data: Optional[QuestionEssay] = question.essay_data
    sample_answer = ""
    if essay_data and essay_data.sample_answer:
        sample_answer = essay_data.sample_answer.strip()
    elif getattr(question, "rationale", None):
        sample_answer = question.rationale.strip()

    max_points = essay_data.max_points if (essay_data and essay_data.max_points) else None
    if not max_points and student_response.attempt and student_response.attempt.question_snapshot:
        for qs in student_response.attempt.question_snapshot:
            if str(qs.get("id")) == str(question.id):
                max_points = float(qs.get("points", 10.0))
                break
    if not max_points:
        max_points = 10.0

    # 2. Determine Rubric (Target or latest active in system)
    target_rubric_id = rubric_id or (essay_data.rubric_id if essay_data else None)
    if not target_rubric_id:
        r_default_stmt = select(Rubric).order_by(Rubric.created_at.desc()).limit(1)
        r_default_res = await db.execute(r_default_stmt)
        default_rubric = r_default_res.scalar_one_or_none()
        if default_rubric:
            target_rubric_id = default_rubric.id

    rubric_criteria_list = []
    if target_rubric_id:
        r_stmt = (
            select(Rubric)
            .where(Rubric.id == target_rubric_id)
            .options(selectinload(Rubric.criteria).selectinload(Rubric.criteria.property.mapper.class_.levels))
        )
        r_res = await db.execute(r_stmt)
        rubric_obj = r_res.scalar_one_or_none()
        if rubric_obj and rubric_obj.criteria:
            for c in rubric_obj.criteria:
                rubric_criteria_list.append({
                    "name": c.name,
                    "description": c.description or "",
                    "weight": c.weight,
                    "max_score": c.max_score,
                    "levels": [
                        {"score": lv.score, "level_name": lv.level_name, "description": lv.description}
                        for lv in c.levels
                    ]
                })

    # 3. Clean student text (extract text & attachment if JSON)
    raw_text = student_response.text_response or ""
    clean_student_answer = raw_text
    try:
        trimmed = raw_text.strip()
        if trimmed.startswith("{") and trimmed.endswith("}"):
            import json
            parsed = json.loads(trimmed)
            if "text" in parsed:
                clean_student_answer = parsed.get("text", "")
                if parsed.get("attachment"):
                    att = parsed["attachment"]
                    clean_student_answer += f"\n[Học sinh đính kèm tệp bài làm: {att.get('name')} ({att.get('type')})]"
    except Exception:
        pass

    # 4. Execute AI Essay Grading Agent
    provider = _get_active_provider()
    agent = EssayGradingAgent(provider=provider)
    output = await agent.run(
        stem=question.stem,
        sample_answer=sample_answer,
        student_answer=clean_student_answer,
        bloom_level=question.bloom_level or "understand",
        max_points=max_points,
        rubric_data=rubric_criteria_list,
    )

    if output.data:
        ai_calculated_score = float(output.data.final_score)
        breakdown = output.data.breakdown
        overall_feedback = output.data.overall_feedback
    else:
        ai_calculated_score = 0.0
        breakdown = []
        overall_feedback = output.error or "Lỗi trong quá trình chấm AI"


    # 4. Save or Update EssayGrading record
    eg_stmt = select(EssayGrading).where(EssayGrading.response_id == response_id)
    eg_res = await db.execute(eg_stmt)
    essay_grading = eg_res.scalar_one_or_none()

    if not essay_grading:
        essay_grading = EssayGrading(
            response_id=response_id,
            rubric_id=target_rubric_id,
            ai_score=ai_calculated_score,
            ai_feedback=overall_feedback,
            criteria_breakdown=breakdown,
            final_score=ai_calculated_score,
            final_feedback=overall_feedback,
            status="ai_graded",
        )
        db.add(essay_grading)
    else:
        essay_grading.ai_score = ai_calculated_score
        essay_grading.ai_feedback = overall_feedback
        essay_grading.criteria_breakdown = breakdown
        # If not manually reviewed by teacher yet, update final score
        if essay_grading.status != "teacher_reviewed":
            essay_grading.final_score = ai_calculated_score
            essay_grading.final_feedback = overall_feedback

    # 5. Update StudentResponse score and recalculate total attempt score
    student_response.points_earned = essay_grading.final_score
    student_response.feedback = essay_grading.final_feedback
    student_response.is_correct = (essay_grading.final_score >= (max_points * 0.5))

    await db.flush()
    await _recalculate_attempt_total_score(db, student_response.attempt_id)
    await db.commit()
    await db.refresh(essay_grading)

    return essay_grading


async def review_essay_grading(
    db: AsyncSession,
    grading_id: uuid.UUID,
    data: EssayGradingReviewCreate,
    user,
) -> EssayGrading:
    stmt = (
        select(EssayGrading)
        .where(EssayGrading.id == grading_id)
        .options(selectinload(EssayGrading.response), selectinload(EssayGrading.reviews))
    )
    res = await db.execute(stmt)
    grading = res.scalar_one_or_none()
    if not grading:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi chấm tự luận")

    # Record review history
    prev_score = grading.final_score
    review = EssayGradingReview(
        grading_id=grading.id,
        reviewer_id=user.id,
        previous_score=prev_score,
        new_score=data.new_score,
        comment=data.comment.strip() if data.comment else None,
        action=data.action,
    )
    db.add(review)

    # Update final score
    grading.final_score = data.new_score
    grading.status = "teacher_reviewed"
    if data.comment:
        grading.final_feedback = data.comment.strip()

    # Update StudentResponse
    if grading.response:
        grading.response.points_earned = data.new_score
        if data.comment:
            grading.response.feedback = data.comment.strip()
        await db.flush()
        await _recalculate_attempt_total_score(db, grading.response.attempt_id)

    await db.commit()
    await db.refresh(grading)
    return grading


async def manual_grade_student_essay_response(
    db: AsyncSession,
    data: EssayManualGradeRequest,
    user,
) -> EssayGrading:
    # 1. Fetch StudentResponse with Question and Attempt
    stmt = (
        select(StudentResponse)
        .where(StudentResponse.id == data.response_id)
        .options(
            selectinload(StudentResponse.question).selectinload(Question.essay_data),
            selectinload(StudentResponse.attempt),
        )
    )
    res = await db.execute(stmt)
    student_response = res.scalar_one_or_none()
    if not student_response:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu trả lời của sinh viên")

    question = student_response.question
    if not question or question.type != "essay":
        raise HTTPException(status_code=400, detail="Câu hỏi này không phải là câu hỏi tự luận")

    essay_data: Optional[QuestionEssay] = question.essay_data
    max_points = essay_data.max_points if (essay_data and essay_data.max_points) else None
    if not max_points and student_response.attempt and student_response.attempt.question_snapshot:
        for qs in student_response.attempt.question_snapshot:
            if str(qs.get("id")) == str(question.id):
                max_points = float(qs.get("points", 10.0))
                break
    if not max_points:
        max_points = 10.0

    target_score = max(0.0, min(float(data.score), max_points))
    feedback_text = data.feedback.strip() if data.feedback else ""

    # 2. Get or create EssayGrading
    eg_stmt = (
        select(EssayGrading)
        .where(EssayGrading.response_id == data.response_id)
        .options(selectinload(EssayGrading.reviews))
    )
    eg_res = await db.execute(eg_stmt)
    essay_grading = eg_res.scalar_one_or_none()

    prev_score = 0.0
    if not essay_grading:
        essay_grading = EssayGrading(
            response_id=data.response_id,
            rubric_id=(essay_data.rubric_id if essay_data else None),
            ai_score=0.0,
            ai_feedback="Giáo viên tự xem và chấm điểm trực tiếp.",
            criteria_breakdown=data.criteria_breakdown or [],
            final_score=target_score,
            final_feedback=feedback_text,
            status="teacher_reviewed",
        )
        db.add(essay_grading)
        await db.flush()
    else:
        prev_score = essay_grading.final_score
        essay_grading.final_score = target_score
        essay_grading.final_feedback = feedback_text
        if data.criteria_breakdown is not None:
            essay_grading.criteria_breakdown = data.criteria_breakdown
        essay_grading.status = "teacher_reviewed"

    # 3. Log teacher review
    review = EssayGradingReview(
        grading_id=essay_grading.id,
        reviewer_id=user.id,
        previous_score=prev_score,
        new_score=target_score,
        comment=feedback_text,
        action="manual_grade",
    )
    db.add(review)

    # 4. Update StudentResponse
    student_response.points_earned = target_score
    student_response.feedback = feedback_text
    student_response.is_correct = (target_score >= (max_points * 0.5))

    await db.flush()
    await _recalculate_attempt_total_score(db, student_response.attempt_id)
    await db.commit()
    await db.refresh(essay_grading)
    return essay_grading


async def get_essay_grading_by_response(db: AsyncSession, response_id: uuid.UUID) -> Optional[EssayGrading]:
    stmt = (
        select(EssayGrading)
        .where(EssayGrading.response_id == response_id)
        .options(
            selectinload(EssayGrading.rubric),
            selectinload(EssayGrading.reviews).selectinload(EssayGradingReview.reviewer),
        )
    )
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def _recalculate_attempt_total_score(db: AsyncSession, attempt_id: uuid.UUID) -> None:
    stmt = select(StudentResponse).where(StudentResponse.attempt_id == attempt_id)
    res = await db.execute(stmt)
    responses = res.scalars().all()

    total_score = sum((r.points_earned or 0.0) for r in responses)

    att_stmt = select(ExamAttempt).where(ExamAttempt.id == attempt_id)
    att_res = await db.execute(att_stmt)
    attempt = att_res.scalar_one_or_none()
    if attempt:
        attempt.score = round(total_score, 2)
        attempt.is_passed = total_score >= (attempt.max_score * 0.5)
        # If all questions graded, set status to graded
        attempt.status = "graded"
