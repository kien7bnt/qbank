import math
import uuid
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.models.question import Question, QuestionOption
from app.models.exam import Exam
from app.models.assignment import Assignment, ExamAttempt, StudentResponse
from app.models.class_ import Class, ClassMember
from app.models.user import User


def compute_irt_params(
    q: Question,
    p_value: Optional[float] = None,
    d_value: Optional[float] = None
) -> tuple[float, float, float]:
    """
    Computes 3PL Item Response Theory parameters:
    - irt_a: Discrimination parameter (Độ phân biệt) [0.40 to 2.50]
    - irt_b: Difficulty parameter (Độ khó) [-2.50 to 2.50]
    - irt_c: Pseudo-guessing parameter (Đoán mò) [0.00 to 0.50]
    """
    # 1. Discrimination (a)
    if d_value is not None:
        irt_a = round(max(0.40, min(2.50, 0.80 + 1.20 * d_value)), 2)
    else:
        bloom_map = {
            "remember": 0.85,
            "understand": 1.05,
            "apply": 1.35,
            "analyze": 1.65,
        }
        irt_a = bloom_map.get((q.bloom_level or "").lower(), 1.05)

    # 2. Difficulty (b)
    if p_value is not None and 0.0 < p_value < 1.0:
        clamped_p = max(0.02, min(0.98, p_value))
        irt_b = round(-math.log(clamped_p / (1.0 - clamped_p)), 2)
        irt_b = max(-2.50, min(2.50, irt_b))
    else:
        diff_map = {
            "easy": -1.20,
            "medium": 0.05,
            "hard": 1.25,
        }
        irt_b = diff_map.get((q.expected_difficulty or "").lower(), 0.05)

    # 3. Guessing (c)
    if q.type == "mcq":
        opt_count = len(q.options) if getattr(q, "options", None) else 4
        if opt_count == 2:
            irt_c = 0.50
        elif opt_count > 0:
            irt_c = round(1.0 / opt_count, 2)
        else:
            irt_c = 0.25
    else:
        irt_c = 0.0

    return irt_a, irt_b, irt_c



async def get_overview_stats(db: AsyncSession, user_id: Optional[uuid.UUID] = None) -> Dict[str, Any]:
    # 1. Questions stats
    q_stmt = select(Question).where(Question.status != "archived")
    if user_id:
        q_stmt = q_stmt.where(Question.created_by == user_id)
    q_res = await db.execute(q_stmt)
    questions = q_res.scalars().all()
    total_questions = len(questions)

    approved_count = sum(1 for q in questions if q.status == "approved")
    draft_count = sum(1 for q in questions if q.status == "draft")

    bloom_dist = {"remember": 0, "understand": 0, "apply": 0, "analyze": 0, "evaluate": 0, "create": 0}
    diff_dist = {"easy": 0, "medium": 0, "hard": 0}
    type_dist = {"mcq": 0, "essay": 0, "coding": 0}

    for q in questions:
        if q.bloom_level in bloom_dist:
            bloom_dist[q.bloom_level] += 1
        if q.expected_difficulty in diff_dist:
            diff_dist[q.expected_difficulty] += 1
        if q.type in type_dist:
            type_dist[q.type] += 1

    # 2. Exams & Assignments
    ex_stmt = select(Exam)
    assign_stmt = select(Assignment)
    if user_id:
        ex_stmt = ex_stmt.where(Exam.created_by == user_id)
        assign_stmt = assign_stmt.where(Assignment.created_by == user_id)
    ex_count = len((await db.execute(ex_stmt)).scalars().all())
    assign_count = len((await db.execute(assign_stmt)).scalars().all())

    # 3. Attempts & Scores
    att_stmt = select(ExamAttempt).where(ExamAttempt.status.in_(["graded", "submitted"]))
    if user_id:
        # Only attempts on assignments created by this teacher
        att_stmt = att_stmt.join(Assignment, ExamAttempt.assignment_id == Assignment.id).where(Assignment.created_by == user_id)
    attempts = (await db.execute(att_stmt)).scalars().all()
    total_attempts = len(attempts)

    avg_score = 0.0
    pass_count = 0
    if total_attempts > 0:
        total_score_sum = sum(a.score or 0.0 for a in attempts)
    resp_counts = {}
    r_stmt = select(StudentResponse.question_id, func.count(StudentResponse.id)).group_by(StudentResponse.question_id)
    r_res = await db.execute(r_stmt)
    for q_id, count in r_res.all():
        resp_counts[q_id] = count

    calibrated_count = sum(
        1 for q in questions if (resp_counts.get(q.id, 0) >= 10 or (getattr(q, "is_calibrated", False) and getattr(q, "response_count", 0) >= 10))
    )

    # 2. Exams stats
    e_stmt = select(Exam).where(Exam.status != "archived")
    if user_id:
        e_stmt = e_stmt.where(Exam.created_by == user_id)
    e_res = await db.execute(e_stmt)
    exams = e_res.scalars().all()
    total_exams = len(exams)

    # 3. Classes stats
    c_stmt = select(Class)
    if user_id:
        c_stmt = c_stmt.where(Class.teacher_id == user_id)
    c_res = await db.execute(c_stmt)
    classes = c_res.scalars().all()
    total_classes = len(classes)

    # 4. Total students across classes
    m_stmt = select(func.count(func.distinct(ClassMember.user_id)))
    if user_id and classes:
        m_stmt = m_stmt.where(ClassMember.class_id.in_([c.id for c in classes]))
    total_students = (await db.execute(m_stmt)).scalar() or 0

    return {
        "total_questions": total_questions,
        "approved_questions": approved_count,
        "draft_questions": draft_count,
        "calibrated_questions": calibrated_count,
        "uncalibrated_questions": max(0, total_questions - calibrated_count),
        "total_exams": total_exams,
        "total_classes": total_classes,
        "total_students": total_students,
    }


async def get_question_psychometrics(db: AsyncSession, question_id: uuid.UUID) -> Dict[str, Any]:
    q_stmt = select(Question).options(selectinload(Question.options)).where(Question.id == question_id)
    q = (await db.execute(q_stmt)).scalar_one_or_none()
    if not q:
        raise ValueError("Question not found")

    resp_stmt = select(StudentResponse).where(StudentResponse.question_id == question_id)
    responses = (await db.execute(resp_stmt)).scalars().all()
    n = len(responses)

    if n == 0:
        irt_a, irt_b, irt_c = compute_irt_params(q)
        return {
            "question_id": str(question_id),
            "is_calibrated": False,
            "sample_size": 0,
            "facility_index_p": None,
            "discrimination_index_d": None,
            "irt_a": getattr(q, "irt_a", None) or irt_a,
            "irt_b": getattr(q, "irt_b", None) or irt_b,
            "irt_c": getattr(q, "irt_c", None) or irt_c,
            "real_difficulty": q.expected_difficulty or "medium",
            "distractor_analysis": [],
            "status_text": "Chưa có lượt làm bài nào (cần tối thiểu 10 lượt để định cỡ chuẩn xác)",
        }

    # Calculate Facility Index (P = R/N)
    correct_count = sum(1 for r in responses if r.is_correct)
    p_value = round(correct_count / n, 3)

    # Real Difficulty based on P-value
    if p_value >= 0.7:
        real_diff = "easy"
        real_diff_label = "Dễ (P ≥ 0.7)"
    elif p_value >= 0.3:
        real_diff = "medium"
        real_diff_label = "Trung bình (0.3 ≤ P < 0.7)"
    else:
        real_diff = "hard"
        real_diff_label = "Khó (P < 0.3)"

    # Distractor Analysis
    distractor_data = []
    for opt in q.options:
        opt_selected_count = sum(1 for r in responses if r.selected_option_id == opt.id)
        pct = round((opt_selected_count / n) * 100, 1)
        distractor_data.append({
            "option_id": str(opt.id),
            "label": opt.label,
            "text": opt.text,
            "is_correct": opt.is_correct,
            "selected_count": opt_selected_count,
            "selection_rate": pct,
            "is_effective": pct >= 5.0 if not opt.is_correct else True,
        })

    # Discrimination approximation
    d_value = round(min(1.0, max(-1.0, (p_value - 0.2) * 1.5)), 2)
    irt_a, irt_b, irt_c = compute_irt_params(q, p_value=p_value, d_value=d_value)

    quality_eval = "Đạt chuẩn chất lượng"
    if p_value > 0.95:
        quality_eval = "Câu hỏi quá dễ, độ phân loại thấp"
    elif p_value < 0.15:
        quality_eval = "Câu hỏi quá khó hoặc phương án có sự nhầm lẫn"

    is_calibrated = n >= 10
    return {
        "question_id": str(question_id),
        "is_calibrated": is_calibrated,
        "sample_size": n,
        "facility_index_p": p_value,
        "discrimination_index_d": d_value,
        "irt_a": getattr(q, "irt_a", None) or irt_a,
        "irt_b": getattr(q, "irt_b", None) or irt_b,
        "irt_c": getattr(q, "irt_c", None) or irt_c,
        "real_difficulty": real_diff,
        "real_difficulty_label": real_diff_label,
        "quality_evaluation": quality_eval,
        "distractor_analysis": distractor_data,
        "status_text": (
            "Đã định cỡ bằng lý thuyết khảo thí cổ điển (CTT) và mô hình IRT 3PL"
            if is_calibrated
            else f"Đang thu thập dữ liệu ({n}/10 lượt làm, cần tối thiểu 10 lượt để định cỡ)"
        ),
    }


async def calibrate_questions(db: AsyncSession) -> Dict[str, Any]:
    """Định cỡ lại toàn bộ câu hỏi trong ngân hàng dựa trên CTT và mô hình IRT 3PL (Yêu cầu N >= 10)"""
    q_stmt = select(Question).options(selectinload(Question.options)).where(Question.status != "archived")
    q_res = await db.execute(q_stmt)
    questions = q_res.scalars().all()

    calibrated_count = 0
    updated_count = 0
    changes = []

    for q in questions:
        resp_stmt = select(StudentResponse).where(StudentResponse.question_id == q.id)
        responses = (await db.execute(resp_stmt)).scalars().all()
        n = len(responses)
        q.response_count = n

        if n >= 10:
            q.is_calibrated = True
            calibrated_count += 1
            correct_count = sum(1 for r in responses if r.is_correct)
            p_value = round(correct_count / n, 3)
            d_value = round(min(1.0, max(-1.0, (p_value - 0.2) * 1.5)), 2)

            # Empirical difficulty rating
            if p_value >= 0.7:
                empirical_diff = "easy"
            elif p_value >= 0.3:
                empirical_diff = "medium"
            else:
                empirical_diff = "hard"

            irt_a, irt_b, irt_c = compute_irt_params(q, p_value=p_value, d_value=d_value)
            q.actual_difficulty = p_value
            q.discrimination_index = d_value
            q.irt_a = irt_a
            q.irt_b = irt_b
            q.irt_c = irt_c

            if q.expected_difficulty != empirical_diff:
                old_diff = q.expected_difficulty
                q.expected_difficulty = empirical_diff
                updated_count += 1
                changes.append({
                    "question_id": str(q.id),
                    "stem": q.stem[:65] + "..." if len(q.stem) > 65 else q.stem,
                    "old_difficulty": old_diff,
                    "new_difficulty": empirical_diff,
                    "sample_size": n,
                    "p_value": p_value,
                })
        else:
            # Under 10 attempts: strictly NOT calibrated
            q.is_calibrated = False
            q.actual_difficulty = None
            q.discrimination_index = None
            # Maintain or calculate prior IRT parameters for reference
            irt_a, irt_b, irt_c = compute_irt_params(q)
            q.irt_a = irt_a
            q.irt_b = irt_b
            q.irt_c = irt_c
            updated_count += 1

    await db.commit()

    return {
        "total_scanned": len(questions),
        "total_calibrated": calibrated_count,
        "total_updated": updated_count,
        "changes": changes,
    }
