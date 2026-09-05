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
        avg_score = round(total_score_sum / total_attempts, 2)
        pass_count = sum(1 for a in attempts if a.is_passed)

    pass_rate = round((pass_count / total_attempts) * 100, 1) if total_attempts > 0 else 0.0

    # 4. Calibrated questions count (questions with >= 3 responses)
    resp_counts_stmt = select(StudentResponse.question_id, func.count(StudentResponse.id)).group_by(StudentResponse.question_id)
    resp_counts = dict((await db.execute(resp_counts_stmt)).all())
    calibrated_count = sum(1 for q in questions if resp_counts.get(q.id, 0) >= 3)

    return {
        "total_questions": total_questions,
        "approved_questions": approved_count,
        "draft_questions": draft_count,
        "calibrated_questions": calibrated_count,
        "uncalibrated_questions": total_questions - calibrated_count,
        "total_exams": ex_count,
        "total_assignments": assign_count,
        "total_attempts": total_attempts,
        "average_score": avg_score,
        "pass_rate": pass_rate,
        "bloom_distribution": bloom_dist,
        "difficulty_distribution": diff_dist,
        "type_distribution": type_dist,
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
        return {
            "question_id": str(question_id),
            "is_calibrated": False,
            "sample_size": 0,
            "facility_index_p": None,
            "discrimination_index_d": None,
            "real_difficulty": q.expected_difficulty or "medium",
            "distractor_analysis": [],
            "status_text": "Chưa có đủ dữ liệu học sinh làm bài thi (Cần tối thiểu 3 lượt làm bài)",
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

    quality_eval = "Đạt chuẩn chất lượng"
    if p_value > 0.95:
        quality_eval = "Câu hỏi quá dễ, độ phân loại thấp"
    elif p_value < 0.15:
        quality_eval = "Câu hỏi quá khó hoặc phương án có sự nhầm lẫn"

    return {
        "question_id": str(question_id),
        "is_calibrated": n >= 3,
        "sample_size": n,
        "facility_index_p": p_value,
        "discrimination_index_d": d_value,
        "real_difficulty": real_diff,
        "real_difficulty_label": real_diff_label,
        "quality_evaluation": quality_eval,
        "distractor_analysis": distractor_data,
        "status_text": "Đã định cỡ bằng lý thuyết khảo thí cổ điển (CTT)" if n >= 3 else "Đang thu thập thêm dữ liệu",
    }


async def calibrate_questions(db: AsyncSession) -> Dict[str, Any]:
    """Định cỡ lại toàn bộ câu hỏi trong ngân hàng dựa trên CTT (Classical Test Theory)"""
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

        if n >= 3:
            calibrated_count += 1
            correct_count = sum(1 for r in responses if r.is_correct)
            p_value = correct_count / n

            # Empirical difficulty rating
            if p_value >= 0.7:
                empirical_diff = "easy"
            elif p_value >= 0.3:
                empirical_diff = "medium"
            else:
                empirical_diff = "hard"

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
                    "p_value": round(p_value, 2),
                })

    if updated_count > 0:
        await db.commit()

    return {
        "total_scanned": len(questions),
        "total_calibrated": calibrated_count,
        "total_updated": updated_count,
        "changes": changes,
    }
