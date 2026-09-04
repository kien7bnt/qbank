"""
Service layer for 2D Exam Matrices and Multi-Variant Exam Generation
"""
from __future__ import annotations
import random
import uuid
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.exam import Exam, ExamSection, ExamQuestion, ExamVariant, ExamMatrix, ExamMatrixRule
from app.models.question import Question, QuestionOption
from app.schemas.exam import MatrixGridValidateRequest, MatrixGridValidateResult, GenerateVariantsRequest


def validate_matrix_grid(data: MatrixGridValidateRequest) -> MatrixGridValidateResult:
    """
    Kiểm tra tính hợp lệ của Ma trận đề thi 2D:
    - Tổng số câu
    - Tổng điểm
    - Phân bổ Bloom (Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao)
    - Phân bổ Độ khó (Dễ, Trung bình, Khó)
    - Phân bổ Loại câu hỏi
    """
    total_q = 0
    total_pts = 0.0
    bloom_dist: Dict[str, int] = {}
    diff_dist: Dict[str, int] = {}
    type_dist: Dict[str, int] = {}
    errors: List[str] = []
    warnings: List[str] = []

    for rule in data.rules:
        if rule.question_count <= 0:
            errors.append(f"Số lượng câu hỏi trong ô phải lớn hơn 0")
            continue
        if rule.points_per_question <= 0:
            errors.append(f"Điểm mỗi câu trong ô phải lớn hơn 0")
            continue

        count = rule.question_count
        pts = count * rule.points_per_question

        total_q += count
        total_pts += pts

        b = (rule.bloom_level or "understand").lower()
        d = (rule.difficulty or "medium").lower()
        t = (rule.question_type or "mcq").lower()

        bloom_dist[b] = bloom_dist.get(b, 0) + count
        diff_dist[d] = diff_dist.get(d, 0) + count
        type_dist[t] = type_dist.get(t, 0) + count

    if total_q == 0:
        errors.append("Ma trận đề thi chưa có câu hỏi nào.")

    if data.expected_total_questions and total_q != data.expected_total_questions:
        errors.append(
            f"Tổng số câu trong các ô ({total_q} câu) không khớp với tổng số câu yêu cầu ({data.expected_total_questions} câu)."
        )

    if data.expected_total_points and abs(total_pts - data.expected_total_points) > 0.01:
        warnings.append(
            f"Tổng điểm các ô ({round(total_pts, 2)}đ) chênh lệch với tổng điểm yêu cầu ({data.expected_total_points}đ)."
        )

    is_valid = len(errors) == 0

    return MatrixGridValidateResult(
        is_valid=is_valid,
        total_questions=total_q,
        total_points=round(total_pts, 2),
        bloom_distribution=bloom_dist,
        difficulty_distribution=diff_dist,
        question_type_distribution=type_dist,
        errors=errors,
        warnings=warnings,
    )


async def generate_exam_variants(
    db: AsyncSession,
    exam_id: uuid.UUID,
    data: GenerateVariantsRequest,
    user,
) -> List[ExamVariant]:
    """
    Tạo nhiều mã đề (001, 002, 003, 004...) từ đề gốc:
    - Đảo thứ tự câu hỏi
    - Đảo thứ tự đáp án lựa chọn (A, B, C, D)
    - Lưu mapping chuẩn xác để chấm điểm tự động không bị lệch
    """
    # 1. Fetch Exam with Sections and Questions
    stmt = (
        select(Exam)
        .where(Exam.id == exam_id)
        .options(
            selectinload(Exam.sections).selectinload(ExamSection.questions).selectinload(ExamQuestion.question).selectinload(Question.options),
            selectinload(Exam.variants),
        )
    )
    res = await db.execute(stmt)
    exam = res.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy đề thi")

    # Collect all questions
    all_exam_questions: List[ExamQuestion] = []
    for sec in exam.sections:
        all_exam_questions.extend(sec.questions)

    if not all_exam_questions:
        raise HTTPException(status_code=400, detail="Đề thi chưa có câu hỏi nào để sinh mã đề")

    # Clear old variants
    for old_v in exam.variants:
        await db.delete(old_v)
    await db.flush()

    variants = []
    count = data.variant_count
    prefix = data.code_prefix or "00"

    for i in range(1, count + 1):
        if len(str(i)) == 1:
            code_str = f"{prefix}{i}"
        else:
            code_str = f"{prefix[:-1] if len(prefix) > 1 else ''}{i}"

        # 1. Shuffle question order if requested
        q_order = [str(eq.question_id) for eq in all_exam_questions]
        if data.shuffle_questions:
            # Seed with variant index to ensure reproducible and distinct permutations
            rng = random.Random(f"{exam_id}_{code_str}")
            rng.shuffle(q_order)

        # 2. Shuffle options per question if requested
        opt_shuffles: Dict[str, List[str]] = {}
        for eq in all_exam_questions:
            q = eq.question
            if q and q.type == "mcq" and q.options:
                opt_ids = [str(o.id) for o in q.options]
                if data.shuffle_options:
                    rng = random.Random(f"{exam_id}_{code_str}_{q.id}")
                    shuffled_opts = list(opt_ids)
                    rng.shuffle(shuffled_opts)
                    opt_shuffles[str(q.id)] = shuffled_opts
                else:
                    opt_shuffles[str(q.id)] = opt_ids

        variant = ExamVariant(
            exam_id=exam.id,
            variant_code=code_str,
            question_order=q_order,
            option_shuffles=opt_shuffles,
        )
        db.add(variant)
        variants.append(variant)

    await db.commit()
    return variants
