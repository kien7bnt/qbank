import uuid
import random
import logging
from typing import List, Dict, Any, Tuple, Optional, Set
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.models.exam import Exam, ExamSection, ExamQuestion, ExamInstance
from app.models.assignment import Assignment, ExamAttempt
from app.models.question import Question, QuestionOption, QuestionCoding, QuestionEssay
from app.models.user import User

logger = logging.getLogger(__name__)

MAX_GENERATION_ATTEMPTS = 100


def calculate_overlap(set_a: Set[str], set_b: Set[str]) -> float:
    """
    Tính tỷ lệ trùng giữa 2 tập câu hỏi (so sánh dựa trên ID câu hỏi):
    overlap = số câu trùng / số câu của đề
    """
    if not set_a:
        return 0.0
    common = set_a.intersection(set_b)
    return len(common) / len(set_a)


def check_candidate_overlap(
    candidate_set: Set[str],
    existing_sets: List[Set[str]],
    max_overlap_ratio: float,
) -> Tuple[bool, float]:
    """
    So sánh tập câu hỏi ứng viên với tất cả các đề đã sinh trước đó.
    Trả về: (is_valid, max_overlap_found)
    """
    if not existing_sets:
        return True, 0.0

    max_found = 0.0
    for prev_set in existing_sets:
        ratio = calculate_overlap(candidate_set, prev_set)
        if ratio > max_found:
            max_found = ratio
        if ratio > max_overlap_ratio + 1e-6:
            return False, max_found

    return True, max_found


async def get_exam_with_pool(db: AsyncSession, exam_id: uuid.UUID) -> Optional[Exam]:
    """Tải đề thi cùng toàn bộ các phần thi và câu hỏi nguồn (Question Pool)"""
    stmt = (
        select(Exam)
        .options(
            selectinload(Exam.sections)
            .selectinload(ExamSection.questions)
            .selectinload(ExamQuestion.question)
            .selectinload(Question.options),
            selectinload(Exam.sections)
            .selectinload(ExamSection.questions)
            .selectinload(ExamQuestion.question)
            .selectinload(Question.coding_data),
            selectinload(Exam.sections)
            .selectinload(ExamSection.questions)
            .selectinload(ExamQuestion.question)
            .selectinload(Question.essay_data),
        )
        .where(Exam.id == exam_id)
    )
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


def _flatten_exam_pool(exam: Exam) -> List[Dict[str, Any]]:
    """Trích xuất danh sách câu hỏi nguồn hợp lệ từ đề thi"""
    pool = []
    seen_ids = set()
    for sec in exam.sections or []:
        for eq in sec.questions or []:
            if eq.question and str(eq.question.id) not in seen_ids:
                seen_ids.add(str(eq.question.id))
                pool.append({
                    "question_id": str(eq.question.id),
                    "exam_question": eq,
                    "question": eq.question,
                    "default_points": eq.points or 1.0,
                })
    return pool


async def generate_student_exam_instance(
    db: AsyncSession,
    exam_id: uuid.UUID,
    user_id: uuid.UUID,
    assignment_id: Optional[uuid.UUID] = None,
    attempt_number: int = 1,
    force_regenerate: bool = False,
) -> ExamInstance:
    """
    Sinh đề thi ngẫu nhiên cho từng học sinh có kiểm soát trùng đề:
    1. Kiểm tra nếu học sinh đã có ExamInstance -> trả về ngay (idempotent, refresh không đổi đề).
    2. Random câu hỏi từ Question Pool với random seed duy nhất cho học sinh.
    3. Kiểm tra tỷ lệ trùng câu hỏi (overlap <= max_question_overlap).
    4. Xáo trộn thứ tự câu hỏi và đáp án độc lập.
    5. Lưu cố định ExamInstance vào Database.
    """
    # 1. Check existing instance (Lazy generation / Idempotency)
    if not force_regenerate:
        stmt = select(ExamInstance).where(
            and_(
                ExamInstance.exam_id == exam_id,
                ExamInstance.user_id == user_id,
                ExamInstance.attempt_number == attempt_number,
                ExamInstance.assignment_id == assignment_id if assignment_id else True,
            )
        ).order_by(ExamInstance.created_at.desc())
        res = await db.execute(stmt)
        existing = res.scalar_one_or_none()
        if existing:
            return existing

    # 2. Load Exam & Pool
    exam = await get_exam_with_pool(db, exam_id)
    if not exam:
        raise ValueError("Không tìm thấy đề thi nguồn.")

    pool = _flatten_exam_pool(exam)
    pool_size = len(pool)
    if pool_size == 0:
        raise ValueError("Tập câu hỏi nguồn của đề thi đang trống.")

    # Determine parameters
    target_count = exam.questions_per_instance or pool_size
    if pool_size < target_count:
        raise ValueError(
            f"Tập câu hỏi nguồn ({pool_size} câu) không đủ để lấy {target_count} câu cho mỗi đề thi."
        )

    # Check assignment overrides if any
    max_overlap = exam.max_question_overlap if exam.max_question_overlap is not None else 0.5
    anti_collision = exam.anti_collision_enabled if exam.anti_collision_enabled is not None else True
    shuffle_q = exam.shuffle_questions
    shuffle_opt = exam.shuffle_options

    if assignment_id:
        assignment = await db.get(Assignment, assignment_id)
        if assignment:
            if assignment.questions_per_instance:
                target_count = min(assignment.questions_per_instance, pool_size)
            if assignment.max_question_overlap is not None:
                max_overlap = assignment.max_question_overlap
            if assignment.shuffle_questions is not None:
                shuffle_q = assignment.shuffle_questions
            if assignment.shuffle_options is not None:
                shuffle_opt = assignment.shuffle_options

    # 3. Load all existing instances for anti-collision check
    inst_stmt = select(ExamInstance).where(
        and_(
            ExamInstance.exam_id == exam_id,
            ExamInstance.assignment_id == assignment_id if assignment_id else True,
        )
    )
    inst_res = await db.execute(inst_stmt)
    all_instances = inst_res.scalars().all()
    existing_sets = [set(inst.question_ids) for inst in all_instances if inst.question_ids]

    if pool_size == target_count and len(existing_sets) > 0 and anti_collision and max_overlap < 1.0:
        logger.warning("Pool size equals target count; overlap will be 100%. Adjusting.")

    # 4. Generate candidate with unique seed and overlap verification
    seed_str = f"{exam_id}_{user_id}_{attempt_number}_{random.getrandbits(32)}"
    rng = random.Random(seed_str)

    selected_pool_items = None
    best_candidate_items = None
    lowest_overlap_seen = 1.0
    attempts_done = 0

    all_qids = [p["question_id"] for p in pool]
    qid_to_item = {p["question_id"]: p for p in pool}

    for attempt_idx in range(1, MAX_GENERATION_ATTEMPTS + 1):
        attempts_done = attempt_idx
        # Sample target_count question IDs from pool
        candidate_qids = rng.sample(all_qids, target_count)
        candidate_set = set(candidate_qids)

        if not anti_collision or not existing_sets:
            selected_pool_items = [qid_to_item[qid] for qid in candidate_qids]
            lowest_overlap_seen = 0.0
            break

        is_valid, max_found = check_candidate_overlap(candidate_set, existing_sets, max_overlap)
        if max_found < lowest_overlap_seen:
            lowest_overlap_seen = max_found
            best_candidate_items = [qid_to_item[qid] for qid in candidate_qids]

        if is_valid:
            selected_pool_items = [qid_to_item[qid] for qid in candidate_qids]
            lowest_overlap_seen = max_found
            break

    if selected_pool_items is None:
        # Reached MAX_GENERATION_ATTEMPTS without meeting strict threshold
        raise ValueError(
            f"Không thể sinh đề thi thỏa mãn tỷ lệ trùng tối đa {int(max_overlap * 100)}% sau {MAX_GENERATION_ATTEMPTS} lần thử. "
            f"Ngân hàng câu hỏi nguồn ({pool_size} câu) có thể quá nhỏ so với số lượng học sinh ({len(existing_sets)} đề đã sinh) "
            f"hoặc cấu hình tỷ lệ trùng quá khắt khe (mức trùng thấp nhất tìm được là {int(lowest_overlap_seen * 100)}%)."
        )

    # 5. Independent Question Shuffle
    if shuffle_q:
        rng.shuffle(selected_pool_items)

    # 6. Build Question Snapshot & Independent Option Shuffle
    question_snapshot = []
    option_orders = {}
    total_pts = 0.0
    pts_per_q = round(10.0 / max(1, len(selected_pool_items)), 2)

    for idx, item in enumerate(selected_pool_items, start=1):
        q = item["question"]
        eq = item["exam_question"]

        # Options
        options_data = []
        raw_options = list(q.options or [])
        if shuffle_opt and len(raw_options) > 1:
            rng.shuffle(raw_options)

        opt_order_ids = []
        for opt in raw_options:
            opt_order_ids.append(str(opt.id))
            options_data.append({
                "id": str(opt.id),
                "label": opt.label,
                "text": opt.text,
            })
        option_orders[str(q.id)] = opt_order_ids

        # Coding info
        coding_info = None
        if q.type == "coding":
            cd = q.coding_data
            coding_info = {
                "problem_statement": cd.problem_statement if cd else q.stem,
                "input_format": cd.input_format if cd else None,
                "output_format": cd.output_format if cd else None,
                "constraints": cd.constraints if cd else None,
                "sample_input": cd.sample_input if cd else None,
                "sample_output": cd.sample_output if cd else None,
                "time_limit_ms": cd.time_limit_ms if cd else 1000,
                "allowed_languages": cd.allowed_languages if cd and cd.allowed_languages else ["python", "cpp", "c", "java", "javascript"],
                "starter_code": getattr(cd, "starter_code", "") or "" if cd else "",
                "test_cases": getattr(cd, "test_cases", []) or [] if cd else [],
            }

        # Essay info
        essay_info = None
        if q.type == "essay" and q.essay_data:
            ed = q.essay_data
            essay_info = {
                "sample_answer": ed.sample_answer,
                "max_points": ed.max_points or pts_per_q,
            }

        question_snapshot.append({
            "id": str(q.id),
            "stem": q.stem,
            "type": q.type,
            "order_index": idx,
            "points": pts_per_q,
            "bloom_level": q.bloom_level,
            "options": options_data,
            "coding_data": coding_info,
            "essay_data": essay_info,
        })
        total_pts += pts_per_q

    # 7. Generate Instance Code (e.g. A001, A002...)
    instance_index = len(all_instances) + 1
    instance_code = f"A{instance_index:03d}"

    # 8. Persist ExamInstance
    instance = ExamInstance(
        exam_id=exam.id,
        assignment_id=assignment_id,
        user_id=user_id,
        attempt_number=attempt_number,
        instance_code=instance_code,
        random_seed=seed_str,
        question_ids=[item["question_id"] for item in selected_pool_items],
        question_snapshot=question_snapshot,
        option_orders=option_orders,
        max_overlap_ratio=round(lowest_overlap_seen, 4),
        generation_attempts=attempts_done,
    )
    db.add(instance)
    await db.commit()
    await db.refresh(instance)

    return instance


async def list_exam_instances(
    db: AsyncSession,
    exam_id: Optional[uuid.UUID] = None,
    assignment_id: Optional[uuid.UUID] = None,
) -> List[Dict[str, Any]]:
    """Lấy danh sách các ExamInstance đã sinh kèm thông tin học sinh và số câu hỏi"""
    stmt = (
        select(ExamInstance)
        .options(
            selectinload(ExamInstance.user),
            selectinload(ExamInstance.exam),
            selectinload(ExamInstance.assignment),
        )
        .order_by(ExamInstance.created_at.desc())
    )
    if exam_id:
        stmt = stmt.where(ExamInstance.exam_id == exam_id)
    if assignment_id:
        stmt = stmt.where(ExamInstance.assignment_id == assignment_id)

    res = await db.execute(stmt)
    instances = res.scalars().all()

    result = []
    for inst in instances:
        result.append({
            "id": str(inst.id),
            "exam_id": str(inst.exam_id),
            "assignment_id": str(inst.assignment_id) if inst.assignment_id else None,
            "user_id": str(inst.user_id),
            "student_name": inst.user.full_name if inst.user else "Học sinh",
            "student_email": inst.user.email if inst.user else "",
            "instance_code": inst.instance_code,
            "question_count": len(inst.question_ids or []),
            "question_ids": inst.question_ids or [],
            "random_seed": inst.random_seed,
            "max_overlap_ratio": inst.max_overlap_ratio,
            "generation_attempts": inst.generation_attempts,
            "created_at": inst.created_at,
        })
    return result


async def simulate_random_instances(
    db: AsyncSession,
    exam_id: uuid.UUID,
    num_students: int = 5,
    sample_size: Optional[int] = None,
    max_overlap: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Chạy mô phỏng thử nghiệm (Simulation) sinh đề thi cho nhiều học sinh
    giúp giáo viên kiểm tra mức độ đa dạng và ma trận tỷ lệ trùng lặp.
    """
    exam = await get_exam_with_pool(db, exam_id)
    if not exam:
        raise ValueError("Không tìm thấy đề thi.")

    pool = _flatten_exam_pool(exam)
    pool_size = len(pool)
    target_count = sample_size or exam.questions_per_instance or min(30, pool_size)
    overlap_limit = max_overlap if max_overlap is not None else (exam.max_question_overlap or 0.5)

    if pool_size < target_count:
        raise ValueError(f"Tập câu hỏi nguồn ({pool_size} câu) ít hơn số câu yêu cầu ({target_count} câu).")

    all_qids = [p["question_id"] for p in pool]
    qid_to_stem = {p["question_id"]: p["question"].stem[:80] for p in pool}

    simulated_instances = []
    existing_sets = []
    rng = random.Random(42)

    for s_idx in range(1, num_students + 1):
        chosen_qids = None
        for _ in range(MAX_GENERATION_ATTEMPTS):
            cand_qids = rng.sample(all_qids, target_count)
            cand_set = set(cand_qids)
            is_valid, _ = check_candidate_overlap(cand_set, existing_sets, overlap_limit)
            if is_valid or not existing_sets:
                chosen_qids = cand_qids
                existing_sets.append(cand_set)
                break

        if not chosen_qids:
            chosen_qids = rng.sample(all_qids, target_count)
            existing_sets.append(set(chosen_qids))

        simulated_instances.append({
            "student_index": s_idx,
            "student_label": f"Học sinh {chr(64 + s_idx)}",
            "instance_code": f"SIM-{s_idx:03d}",
            "question_count": len(chosen_qids),
            "question_ids": chosen_qids,
            "sample_questions": [qid_to_stem.get(qid, "") for qid in chosen_qids[:5]],
        })

    # Compute Pairwise Overlap Matrix
    matrix = []
    max_observed = 0.0
    total_pairs = 0
    sum_overlap = 0.0

    for i in range(num_students):
        row = []
        set_i = existing_sets[i]
        for j in range(num_students):
            if i == j:
                row.append(100.0)
            else:
                set_j = existing_sets[j]
                overlap_val = round(calculate_overlap(set_i, set_j) * 100, 1)
                row.append(overlap_val)
                if j > i:
                    total_pairs += 1
                    sum_overlap += overlap_val
                    if overlap_val > max_observed:
                        max_observed = overlap_val
        matrix.append(row)

    avg_observed = round(sum_overlap / max(1, total_pairs), 1)

    return {
        "pool_size": pool_size,
        "sample_size": target_count,
        "max_overlap_configured": round(overlap_limit * 100, 1),
        "max_overlap_observed": max_observed,
        "average_overlap_observed": avg_observed,
        "students": simulated_instances,
        "overlap_matrix": matrix,
    }
