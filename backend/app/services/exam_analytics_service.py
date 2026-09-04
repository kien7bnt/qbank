"""
Service layer for Exam Analytics, Psychometrics (IF & ID) and Student Results
"""
from __future__ import annotations
import uuid
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.exam import Exam, ExamSection, ExamQuestion
from app.models.assignment import Assignment, ExamAttempt, StudentResponse
from app.models.class_ import Class, ClassMember
from app.models.user import User
from app.models.question import Question, QuestionOption


async def get_exam_analytics_overview(db: AsyncSession, exam_id: uuid.UUID) -> Dict[str, Any]:
    # 1. Fetch Exam and related Assignments
    exam_stmt = select(Exam).where(Exam.id == exam_id)
    exam_res = await db.execute(exam_stmt)
    exam = exam_res.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy đề thi")

    # Fetch all attempts for assignments of this exam
    att_stmt = (
        select(ExamAttempt)
        .join(Assignment, ExamAttempt.assignment_id == Assignment.id)
        .where(Assignment.exam_id == exam_id)
        .options(selectinload(ExamAttempt.user), selectinload(ExamAttempt.responses))
    )
    att_res = await db.execute(att_stmt)
    all_attempts = att_res.scalars().all()

    submitted_attempts = [a for a in all_attempts if a.status in ("submitted", "graded") and a.score is not None]
    
    total_submissions = len(submitted_attempts)
    scores = [a.score for a in submitted_attempts if a.score is not None]
    
    avg_score = round(sum(scores) / total_submissions, 2) if total_submissions > 0 else 0.0
    highest_score = max(scores) if scores else 0.0
    lowest_score = min(scores) if scores else 0.0
    passed_count = len([s for s in scores if s >= 5.0])
    pass_rate = round((passed_count / total_submissions) * 100, 1) if total_submissions > 0 else 0.0

    # Score distribution brackets: [<5, 5-6.5, 6.5-8, 8-10]
    score_distribution = {
        "under_5": len([s for s in scores if s < 5.0]),
        "5_to_6_5": len([s for s in scores if 5.0 <= s < 6.5]),
        "6_5_to_8": len([s for s in scores if 6.5 <= s < 8.0]),
        "8_to_10": len([s for s in scores if s >= 8.0]),
    }

    return {
        "exam_id": str(exam.id),
        "exam_name": exam.name,
        "total_attempts": len(all_attempts),
        "total_submissions": total_submissions,
        "average_score": avg_score,
        "highest_score": highest_score,
        "lowest_score": lowest_score,
        "passed_count": passed_count,
        "failed_count": total_submissions - passed_count,
        "pass_rate": pass_rate,
        "score_distribution": score_distribution,
    }


async def get_exam_student_results(db: AsyncSession, exam_id: uuid.UUID) -> List[Dict[str, Any]]:
    att_stmt = (
        select(ExamAttempt)
        .join(Assignment, ExamAttempt.assignment_id == Assignment.id)
        .where(Assignment.exam_id == exam_id)
        .options(
            selectinload(ExamAttempt.user),
            selectinload(ExamAttempt.responses).selectinload(StudentResponse.question),
        )
        .order_by(ExamAttempt.submitted_at.desc())
    )
    att_res = await db.execute(att_stmt)
    attempts = att_res.scalars().all()

    student_results = []
    for a in attempts:
        user = a.user
        mcq_pts = sum((r.points_earned or 0.0) for r in a.responses if r.question and r.question.type == "mcq")
        essay_pts = sum((r.points_earned or 0.0) for r in a.responses if r.question and r.question.type == "essay")
        
        correct_count = len([r for r in a.responses if r.is_correct is True])
        wrong_count = len([r for r in a.responses if r.is_correct is False])
        skipped_count = len([r for r in a.responses if not r.selected_option_id and not r.text_response])

        duration_sec = 0
        if a.start_time and a.submitted_at:
            duration_sec = int((a.submitted_at - a.start_time).total_seconds())

        student_results.append({
            "attempt_id": str(a.id),
            "user_id": str(user.id) if user else "",
            "full_name": user.full_name if user else "Học sinh",
            "user_name": user.full_name if user else "Học sinh",
            "email": user.email if user else "",
            "user_email": user.email if user else "",
            "attempt_number": a.attempt_number,
            "score": round(a.score, 2) if a.score is not None else 0.0,
            "max_score": a.max_score,
            "is_passed": a.is_passed,
            "status": a.status,
            "mcq_score": round(mcq_pts, 2),
            "mcq_points": round(mcq_pts, 2),
            "essay_score": round(essay_pts, 2),
            "essay_points": round(essay_pts, 2),
            "correct_count": correct_count,
            "wrong_count": wrong_count,
            "skipped_count": skipped_count,
            "duration_minutes": round(duration_sec / 60, 1),
            "duration_seconds": duration_sec,
            "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
        })

    return student_results


async def get_exam_question_psychometrics(db: AsyncSession, exam_id: uuid.UUID) -> List[Dict[str, Any]]:
    """
    Tính toán chỉ số trắc lượng học thuật:
    - Item Facility (IF / Độ khó thực tế): Tỷ lệ học sinh làm đúng (0.0: rất khó -> 1.0: rất dễ)
    - Item Discrimination (ID / Độ phân cách): Khả năng phân loại nhóm giỏi vs nhóm yếu
    """
    # 1. Fetch Exam Questions
    eq_stmt = (
        select(ExamQuestion)
        .join(ExamSection, ExamQuestion.section_id == ExamSection.id)
        .where(ExamSection.exam_id == exam_id)
        .options(selectinload(ExamQuestion.question).selectinload(Question.options))
        .order_by(ExamQuestion.order_index)
    )
    eq_res = await db.execute(eq_stmt)
    exam_questions = eq_res.scalars().all()

    # 2. Fetch all completed attempts sorted by total score for discrimination index (Top 27% vs Bottom 27%)
    att_stmt = (
        select(ExamAttempt)
        .join(Assignment, ExamAttempt.assignment_id == Assignment.id)
        .where(Assignment.exam_id == exam_id, ExamAttempt.status.in_(("submitted", "graded")))
        .options(selectinload(ExamAttempt.responses))
        .order_by(ExamAttempt.score.desc())
    )
    att_res = await db.execute(att_stmt)
    attempts = att_res.scalars().all()

    n_students = len(attempts)
    cutoff = max(1, int(n_students * 0.27)) if n_students >= 4 else 0
    top_group = attempts[:cutoff] if cutoff > 0 else []
    bottom_group = attempts[-cutoff:] if cutoff > 0 else []

    question_analysis = []

    for eq in exam_questions:
        q = eq.question
        if not q:
            continue

        q_id = q.id
        responses_for_q: List[StudentResponse] = []
        for a in attempts:
            for r in a.responses:
                if r.question_id == q_id:
                    responses_for_q.append(r)

        total_ans = len(responses_for_q)
        correct_ans = len([r for r in responses_for_q if r.is_correct is True])

        # Item Facility (IF)
        item_facility = round(correct_ans / total_ans, 2) if total_ans > 0 else 0.5

        # Item Discrimination (ID)
        item_discrimination = 0.0
        if cutoff > 0 and top_group and bottom_group:
            top_correct = sum(
                1 for a in top_group for r in a.responses if r.question_id == q_id and r.is_correct is True
            )
            bottom_correct = sum(
                1 for a in bottom_group for r in a.responses if r.question_id == q_id and r.is_correct is True
            )
            item_discrimination = round((top_correct - bottom_correct) / cutoff, 2)

        # Distractor counts & option frequencies for MCQ
        distractor_counts = {}
        option_frequencies = []
        if q.type == "mcq" and q.options:
            for opt in q.options:
                chosen_count = sum(1 for r in responses_for_q if r.selected_option_id == opt.id)
                distractor_counts[opt.label] = chosen_count
                pct = round((chosen_count / total_ans * 100), 1) if total_ans > 0 else 0.0
                option_frequencies.append({
                    "option_id": str(opt.id),
                    "label": opt.label,
                    "is_correct": opt.is_correct,
                    "percentage": pct,
                })

        # Category labels
        if item_facility >= 0.8:
            diff_cat = "Rất dễ"
        elif item_facility >= 0.6:
            diff_cat = "Dễ"
        elif item_facility >= 0.4:
            diff_cat = "Trung bình"
        elif item_facility >= 0.2:
            diff_cat = "Khó"
        else:
            diff_cat = "Rất khó"

        if item_discrimination >= 0.4:
            disc_cat = "Rất tốt"
        elif item_discrimination >= 0.3:
            disc_cat = "Tốt"
        elif item_discrimination >= 0.2:
            disc_cat = "Tạm chấp nhận"
        else:
            disc_cat = "Kém (Cần xem lại)"

        question_analysis.append({
            "question_id": str(q.id),
            "item_id": q.item_id,
            "stem": q.stem,
            "type": q.type,
            "bloom_level": q.bloom_level,
            "expected_difficulty": q.expected_difficulty,
            "total_answers": total_ans,
            "correct_answers": correct_ans,
            "item_facility": item_facility,  # Độ khó thực tế
            "difficulty_category": diff_cat,
            "discrimination_index": item_discrimination,  # Độ phân cách
            "item_discrimination": item_discrimination,
            "discrimination_category": disc_cat,
            "distractor_counts": distractor_counts,
            "option_frequencies": option_frequencies,
        })

    return question_analysis
