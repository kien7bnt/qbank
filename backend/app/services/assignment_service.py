import uuid
import random
from typing import Sequence, Optional, List, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.models.assignment import Assignment, ExamAttempt, StudentResponse
from app.models.exam import Exam, ExamSection, ExamQuestion
from app.models.class_ import Class, ClassMember
from app.models.question import Question, QuestionOption, QuestionCoding, QuestionEssay
from app.schemas.assignment import (
    AssignmentCreate, AssignmentUpdate, AssignmentOut, SaveResponseRequest,
    ExamTakingStateOut, QuestionTakingOut, AttemptResultOut, ResponseDetailOut
)
from app.services import compiler_service


async def create_assignment(db: AsyncSession, data: AssignmentCreate, user_id: uuid.UUID) -> Assignment:
    assignment_type = getattr(data, "assignment_type", "exam") or "exam"
    max_attempts = 999 if assignment_type == "homework" else (data.max_attempts or 1)

    assignment = Assignment(
        name=data.name,
        exam_id=data.exam_id,
        class_id=data.class_id,
        session_id=data.session_id,
        assignment_type=assignment_type,
        start_time=data.start_time,
        end_time=data.end_time,
        duration_minutes=data.duration_minutes,
        max_attempts=max_attempts,
        pass_score=data.pass_score,
        shuffle_questions=data.shuffle_questions,
        shuffle_options=data.shuffle_options,
        show_results=data.show_results,
        created_by=user_id,
        status="published"
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return await get_assignment(db, assignment.id) or assignment


async def get_assignment(db: AsyncSession, assignment_id: uuid.UUID) -> Optional[Assignment]:
    stmt = (
        select(Assignment)
        .options(
            selectinload(Assignment.exam),
            selectinload(Assignment.class_),
            selectinload(Assignment.session),
            selectinload(Assignment.attempts)
        )
        .where(Assignment.id == assignment_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_assignments(db: AsyncSession, class_id: Optional[uuid.UUID] = None) -> Sequence[Assignment]:
    stmt = (
        select(Assignment)
        .options(
            selectinload(Assignment.exam),
            selectinload(Assignment.class_),
            selectinload(Assignment.session),
            selectinload(Assignment.attempts)
        )
        .order_by(Assignment.created_at.desc())
    )
    if class_id:
        stmt = stmt.where(Assignment.class_id == class_id)
        
    result = await db.execute(stmt)
    return result.scalars().all()


async def update_assignment(db: AsyncSession, assignment_id: uuid.UUID, data: AssignmentUpdate) -> Optional[Assignment]:
    assignment = await get_assignment(db, assignment_id)
    if not assignment:
        return None
    if data.name is not None:
        assignment.name = data.name.strip()
    if data.session_id is not None:
        assignment.session_id = data.session_id
    if data.assignment_type is not None:
        assignment.assignment_type = data.assignment_type
        if data.assignment_type == "homework" and assignment.max_attempts == 1:
            assignment.max_attempts = 999
        elif data.assignment_type == "exam" and assignment.max_attempts > 1:
            assignment.max_attempts = 1
    if data.start_time is not None:
        assignment.start_time = data.start_time
    if data.end_time is not None:
        assignment.end_time = data.end_time
    if data.duration_minutes is not None:
        assignment.duration_minutes = data.duration_minutes
    if data.status is not None:
        assignment.status = data.status
    await db.commit()
    return await get_assignment(db, assignment_id)


async def delete_assignment(db: AsyncSession, assignment_id: uuid.UUID) -> bool:
    assignment = await get_assignment(db, assignment_id)
    if not assignment:
        return False
    await db.delete(assignment)
    await db.commit()
    return True


async def list_student_assignments(db: AsyncSession, user_id: uuid.UUID) -> List[Dict[str, Any]]:
    """Get all assignments for classes the student is enrolled in"""
    # 1. Find classes student joined
    member_stmt = select(ClassMember.class_id).where(ClassMember.user_id == user_id)
    member_res = await db.execute(member_stmt)
    class_ids = member_res.scalars().all()

    if not class_ids:
        return []

    stmt = (
        select(Assignment)
        .options(
            selectinload(Assignment.exam),
            selectinload(Assignment.class_),
            selectinload(Assignment.session),
        )
        .where(
            and_(
                Assignment.class_id.in_(class_ids),
                Assignment.status.in_(["published", "closed"])
            )
        )
        .order_by(Assignment.created_at.desc())
    )
    res = await db.execute(stmt)
    assignments = res.scalars().all()

    # 2. Attach student's attempts
    items = []
    for a in assignments:
        att_stmt = (
            select(ExamAttempt)
            .where(and_(ExamAttempt.assignment_id == a.id, ExamAttempt.user_id == user_id))
            .order_by(ExamAttempt.start_time.desc())
        )
        att_res = await db.execute(att_stmt)
        attempts = att_res.scalars().all()
        latest_attempt = attempts[0] if attempts else None

        items.append({
            "id": a.id,
            "name": a.name,
            "assignment_type": "homework" if getattr(a, "assignment_type", None) in ["homework", "assignment"] else "exam",
            "exam_id": a.exam_id,
            "exam_name": a.exam.name if a.exam else "Đề thi",
            "class_id": a.class_id,
            "class_name": a.class_.name if a.class_ else "Lớp học",
            "session_name": getattr(a.session, "name", getattr(a.session, "title", None)) if getattr(a, "session", None) else None,
            "duration_minutes": a.duration_minutes,
            "max_attempts": a.max_attempts,
            "start_time": a.start_time,
            "end_time": a.end_time,
            "pass_score": a.pass_score,
            "status": a.status,
            "created_at": a.created_at,
            "my_attempt": {
                "id": latest_attempt.id,
                "attempt_number": latest_attempt.attempt_number,
                "status": latest_attempt.status,
                "score": latest_attempt.score,
                "max_score": latest_attempt.max_score,
                "is_passed": latest_attempt.is_passed,
                "submitted_at": latest_attempt.submitted_at,
            } if latest_attempt else None
        })

    return items


async def start_or_resume_attempt(
    db: AsyncSession, assignment_id: uuid.UUID, user_id: uuid.UUID, force_new: bool = False
) -> ExamTakingStateOut:
    assignment = await get_assignment(db, assignment_id)
    if not assignment:
        raise ValueError("Assignment not found")

    # Check student class enrollment
    if assignment.class_id:
        member_check = await db.execute(
            select(ClassMember).where(
                and_(ClassMember.class_id == assignment.class_id, ClassMember.user_id == user_id)
            )
        )
        if not member_check.scalar_one_or_none():
            raise ValueError("Bạn không thuộc danh sách học sinh của lớp học này.")

    is_homework = getattr(assignment, "assignment_type", "exam") in ["homework", "assignment"]

    # 1. Check for active in_progress attempt
    stmt = (
        select(ExamAttempt)
        .options(selectinload(ExamAttempt.responses))
        .where(
            and_(
                ExamAttempt.assignment_id == assignment_id,
                ExamAttempt.user_id == user_id,
                ExamAttempt.status == "in_progress"
            )
        )
    )
    res = await db.execute(stmt)
    attempt = res.scalar_one_or_none()

    # If force_new requested for homework and there is an existing in_progress attempt, complete it so we can start fresh
    if attempt and force_new and is_homework:
        attempt.status = "submitted"
        attempt.submitted_at = datetime.utcnow()
        await db.commit()
        attempt = None

    # 2. If no active attempt, check eligibility and create one
    if not attempt:
        # Check all existing attempts for this student
        count_stmt = (
            select(ExamAttempt)
            .where(and_(ExamAttempt.assignment_id == assignment_id, ExamAttempt.user_id == user_id))
            .order_by(ExamAttempt.attempt_number.desc())
        )
        count_res = await db.execute(count_stmt)
        past_attempts = count_res.scalars().all()

        now_utc = datetime.utcnow()
        if assignment.start_time:
            st_check = assignment.start_time.replace(tzinfo=None) if assignment.start_time.tzinfo else assignment.start_time
            if now_utc < st_check:
                raise ValueError(f"Chưa đến thời gian làm bài. Bài sẽ được mở vào lúc: {st_check.strftime('%H:%M ngày %d/%m/%Y')}")

        if assignment.end_time:
            et_check = assignment.end_time.replace(tzinfo=None) if assignment.end_time.tzinfo else assignment.end_time
            if now_utc > et_check:
                raise ValueError(f"Đã hết thời gian làm bài. Hạn chót đã kết thúc vào lúc: {et_check.strftime('%H:%M ngày %d/%m/%Y')}")

        if not is_homework:
            # Exam: strictly only 1 attempt!
            if past_attempts and any(pa.status in ["submitted", "graded"] for pa in past_attempts):
                raise ValueError("Bài kiểm tra này chỉ được làm 1 lần duy nhất và bạn đã hoàn thành bài thi.")
            if len(past_attempts) >= (assignment.max_attempts or 1):
                raise ValueError("Bạn đã hết lượt làm bài kiểm tra này.")

        # Load Exam with questions
        exam_stmt = (
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
            .where(Exam.id == assignment.exam_id)
        )
        exam_res = await db.execute(exam_stmt)
        exam = exam_res.scalar_one_or_none()
        if not exam:
            raise ValueError("Exam not found for assignment")

        # Flatten questions
        question_items = []
        total_max_points = 0.0
        for sec in exam.sections:
            for eq in sec.questions:
                if eq.question:
                    options_data = [
                        {
                            "id": str(opt.id),
                            "label": opt.label,
                            "text": opt.text,
                        }
                        for opt in (eq.question.options or [])
                    ]
                    if assignment.shuffle_options:
                        random.shuffle(options_data)

                    coding_info = None
                    if eq.question.type == "coding":
                        cd = eq.question.coding_data
                        coding_info = {
                            "problem_statement": cd.problem_statement if cd else eq.question.stem,
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

                    essay_info = None
                    if eq.question.type == "essay" and eq.question.essay_data:
                        ed = eq.question.essay_data
                        essay_info = {
                            "sample_answer": ed.sample_answer,
                            "max_points": ed.max_points or eq.points,
                        }

                    question_items.append({
                        "id": str(eq.question.id),
                        "stem": eq.question.stem,
                        "type": eq.question.type,
                        "order_index": eq.order_index,
                        "points": eq.points,
                        "bloom_level": eq.question.bloom_level,
                        "options": options_data,
                        "coding_data": coding_info,
                        "essay_data": essay_info,
                    })
                    total_max_points += eq.points

        if assignment.shuffle_questions:
            random.shuffle(question_items)

        attempt_number = len(past_attempts) + 1

        attempt = ExamAttempt(
            assignment_id=assignment.id,
            user_id=user_id,
            attempt_number=attempt_number,
            start_time=datetime.utcnow(),
            max_score=total_max_points or 10.0,
            question_snapshot=question_items,
            status="in_progress",
        )
        db.add(attempt)
        await db.commit()
        await db.refresh(attempt)

    # 3. Calculate remaining seconds
    now = datetime.utcnow()
    is_homework = getattr(assignment, "assignment_type", "exam") == "homework"
    if is_homework:
        if assignment.end_time:
            et = assignment.end_time.replace(tzinfo=None) if assignment.end_time.tzinfo else assignment.end_time
            remaining = max(0, int((et - now).total_seconds()))
        else:
            remaining = 8640000  # Effectively unlimited
    else:
        st = attempt.start_time.replace(tzinfo=None) if attempt.start_time.tzinfo else attempt.start_time
        elapsed = (now - st).total_seconds()
        total_allowed = (assignment.duration_minutes or 45) * 60
        remaining = max(0, int(total_allowed - elapsed))

    # Auto submit if expired
    if remaining <= 0 and attempt.status == "in_progress":
        return await submit_and_grade_attempt(db, attempt.id, user_id)

    # 4. Map existing student responses
    resp_map = {r.question_id: r for r in (attempt.responses or [])}

    questions_out = []
    for q_item in (attempt.question_snapshot or []):
        qid = uuid.UUID(q_item["id"])
        user_resp = resp_map.get(qid)

        questions_out.append(
            QuestionTakingOut(
                id=qid,
                stem=q_item["stem"],
                type=q_item["type"],
                order_index=q_item["order_index"],
                points=q_item["points"],
                bloom_level=q_item.get("bloom_level"),
                options=q_item.get("options", []),
                selected_option_id=user_resp.selected_option_id if user_resp else None,
                text_response=user_resp.text_response if user_resp else None,
                code_response=user_resp.code_response if user_resp else None,
                coding_data=q_item.get("coding_data"),
                essay_data=q_item.get("essay_data"),
            )
        )

    return ExamTakingStateOut(
        attempt_id=attempt.id,
        assignment_id=assignment.id,
        assignment_name=assignment.name,
        assignment_type=getattr(assignment, "assignment_type", "exam") or "exam",
        attempt_number=attempt.attempt_number or 1,
        duration_minutes=assignment.duration_minutes,
        start_time=attempt.start_time,
        remaining_seconds=remaining,
        status=attempt.status,
        end_time=assignment.end_time,
        questions=questions_out,
    )


async def get_attempt_state(db: AsyncSession, attempt_id: uuid.UUID, user_id: uuid.UUID) -> ExamTakingStateOut:
    attempt = await db.get(
        ExamAttempt,
        attempt_id,
        options=[
            selectinload(ExamAttempt.assignment),
            selectinload(ExamAttempt.responses),
        ],
    )
    if not attempt:
        raise ValueError("Không tìm thấy lượt làm bài")

    assignment = attempt.assignment
    now = datetime.utcnow()
    is_homework = getattr(assignment, "assignment_type", "exam") == "homework"
    if is_homework:
        if assignment.end_time:
            et = assignment.end_time.replace(tzinfo=None) if assignment.end_time.tzinfo else assignment.end_time
            remaining = max(0, int((et - now).total_seconds()))
        else:
            remaining = 8640000
    else:
        st = attempt.start_time.replace(tzinfo=None) if attempt.start_time.tzinfo else attempt.start_time
        elapsed = (now - st).total_seconds()
        total_allowed = (assignment.duration_minutes or 45) * 60
        remaining = max(0, int(total_allowed - elapsed))

    resp_map = {r.question_id: r for r in (attempt.responses or [])}

    questions_out = []
    for q_item in (attempt.question_snapshot or []):
        qid = uuid.UUID(q_item["id"]) if isinstance(q_item["id"], str) else q_item["id"]
        user_resp = resp_map.get(qid)

        questions_out.append(
            QuestionTakingOut(
                id=qid,
                stem=q_item["stem"],
                type=q_item["type"],
                order_index=q_item.get("order_index", 0),
                points=q_item.get("points", 1.0),
                bloom_level=q_item.get("bloom_level"),
                options=q_item.get("options", []),
                selected_option_id=user_resp.selected_option_id if user_resp else None,
                text_response=user_resp.text_response if user_resp else None,
                code_response=user_resp.code_response if user_resp else None,
                coding_data=q_item.get("coding_data"),
                essay_data=q_item.get("essay_data"),
            )
        )

    return ExamTakingStateOut(
        attempt_id=attempt.id,
        assignment_id=assignment.id,
        assignment_name=assignment.name,
        assignment_type=getattr(assignment, "assignment_type", "exam") or "exam",
        attempt_number=attempt.attempt_number or 1,
        duration_minutes=assignment.duration_minutes,
        start_time=attempt.start_time,
        remaining_seconds=remaining,
        status=attempt.status,
        end_time=assignment.end_time,
        questions=questions_out,
    )


async def save_response(db: AsyncSession, attempt_id: uuid.UUID, data: SaveResponseRequest, user_id: uuid.UUID) -> bool:
    # Verify attempt belongs to user and is in_progress
    stmt = select(ExamAttempt).where(and_(ExamAttempt.id == attempt_id, ExamAttempt.user_id == user_id))
    res = await db.execute(stmt)
    attempt = res.scalar_one_or_none()
    if not attempt or attempt.status != "in_progress":
        return False

    # Check if response already exists
    r_stmt = select(StudentResponse).where(
        and_(StudentResponse.attempt_id == attempt_id, StudentResponse.question_id == data.question_id)
    )
    r_res = await db.execute(r_stmt)
    resp = r_res.scalar_one_or_none()

    if not resp:
        resp = StudentResponse(
            attempt_id=attempt_id,
            question_id=data.question_id,
            selected_option_id=data.selected_option_id,
            text_response=data.text_response,
            code_response=data.code_response,
            answered_at=datetime.utcnow(),
        )
        db.add(resp)
    else:
        resp.selected_option_id = data.selected_option_id
        resp.text_response = data.text_response
        resp.code_response = data.code_response
        resp.answered_at = datetime.utcnow()

    await db.commit()
    return True


async def submit_and_grade_attempt(db: AsyncSession, attempt_id: uuid.UUID, user_id: uuid.UUID) -> AttemptResultOut:
    stmt = (
        select(ExamAttempt)
        .options(
            selectinload(ExamAttempt.assignment),
            selectinload(ExamAttempt.user),
            selectinload(ExamAttempt.responses).selectinload(StudentResponse.question).selectinload(Question.options)
        )
        .where(and_(ExamAttempt.id == attempt_id, ExamAttempt.user_id == user_id))
    )
    res = await db.execute(stmt)
    attempt = res.scalar_one_or_none()
    if not attempt:
        raise ValueError("Attempt not found")

    assignment = attempt.assignment

    # 1. Load questions and compute grade
    total_score = 0.0
    correct_count = 0
    resp_map = {r.question_id: r for r in attempt.responses}

    for q_item in (attempt.question_snapshot or []):
        qid = uuid.UUID(q_item["id"])
        pts = float(q_item.get("points", 1.0))
        resp = resp_map.get(qid)
        q_type = q_item.get("type", "mcq")

        # Fetch actual question options for answer key
        q_obj = await db.get(Question, qid)
        if not q_obj:
            continue

        if q_type == "mcq":
            correct_opt = next((o for o in (q_obj.options or []) if o.is_correct), None)
            if resp:
                if resp.selected_option_id and correct_opt and resp.selected_option_id == correct_opt.id:
                    resp.is_correct = True
                    resp.points_earned = pts
                    total_score += pts
                    correct_count += 1
                else:
                    resp.is_correct = False
                    resp.points_earned = 0.0
            else:
                blank_resp = StudentResponse(
                    attempt_id=attempt.id,
                    question_id=qid,
                    is_correct=False,
                    points_earned=0.0,
                    answered_at=datetime.utcnow()
                )
                db.add(blank_resp)

        elif q_type == "coding":
            if resp and resp.code_response and resp.code_response.strip():
                cd_data = q_item.get("coding_data") or {}
                test_cases = cd_data.get("test_cases") or []

                if not test_cases and (cd_data.get("sample_input") or cd_data.get("sample_output")):
                    test_cases = [{
                        "input": cd_data.get("sample_input", ""),
                        "output": cd_data.get("sample_output", ""),
                        "is_hidden": False,
                    }]

                if not test_cases and q_obj and q_obj.coding_data:
                    test_cases = getattr(q_obj.coding_data, "test_cases", []) or []
                    if not test_cases and (q_obj.coding_data.sample_input or q_obj.coding_data.sample_output):
                        test_cases = [{
                            "input": q_obj.coding_data.sample_input or "",
                            "output": q_obj.coding_data.sample_output or "",
                            "is_hidden": False,
                        }]

                lang = "python"
                if cd_data.get("allowed_languages"):
                    lang = cd_data["allowed_languages"][0]

                eval_res = await compiler_service.run_test_cases(
                    source_code=resp.code_response,
                    language=lang,
                    test_cases=test_cases,
                )

                p_count = eval_res["passed_count"]
                t_count = max(1, eval_res["total_count"])
                earned = round(pts * (p_count / t_count), 2)

                resp.points_earned = earned
                resp.is_correct = (p_count == t_count)
                total_score += earned
                if resp.is_correct:
                    correct_count += 1
                resp.feedback = f"Chấm tự động qua Judge0 (edusoft.vn): Vượt qua {p_count}/{t_count} test case. Điểm: {earned}/{pts}."
            else:
                if resp:
                    resp.is_correct = False
                    resp.points_earned = 0.0
                    resp.feedback = "Chưa làm bài lập trình."
                else:
                    blank_resp = StudentResponse(
                        attempt_id=attempt.id,
                        question_id=qid,
                        is_correct=False,
                        points_earned=0.0,
                        feedback="Chưa làm bài lập trình.",
                        answered_at=datetime.utcnow()
                    )
                    db.add(blank_resp)

        elif q_type == "essay":
            if resp and resp.text_response and resp.text_response.strip():
                resp.points_earned = pts
                resp.is_correct = True
                total_score += pts
                correct_count += 1
                resp.feedback = "Đã nộp bài tự luận thành công."
            else:
                if resp:
                    resp.is_correct = False
                    resp.points_earned = 0.0
                    resp.feedback = "Chưa làm bài tự luận."
                else:
                    blank_resp = StudentResponse(
                        attempt_id=attempt.id,
                        question_id=qid,
                        is_correct=False,
                        points_earned=0.0,
                        feedback="Chưa làm bài tự luận.",
                        answered_at=datetime.utcnow()
                    )
                    db.add(blank_resp)

    # 2. Update Attempt status and score
    attempt.score = round(total_score, 2)
    if getattr(assignment, "assignment_type", None) in ["homework", "assignment"] or (assignment.pass_score or 0) <= 0:
        attempt.is_passed = True
    else:
        attempt.is_passed = attempt.score >= assignment.pass_score
    attempt.status = "graded"
    attempt.submitted_at = datetime.utcnow()

    # 3. Update response_count and calibration status for questions
    for q_item in (attempt.question_snapshot or []):
        qid_str = q_item.get("id")
        if qid_str:
            qid = uuid.UUID(qid_str)
            q_obj = await db.get(Question, qid)
            if q_obj:
                r_count_stmt = select(func.count(StudentResponse.id)).where(StudentResponse.question_id == qid)
                cnt = (await db.execute(r_count_stmt)).scalar() or 0
                q_obj.response_count = cnt
                if cnt >= 10:
                    q_obj.is_calibrated = True

    await db.commit()

    return await get_attempt_result(db, attempt_id, user_id)


async def get_attempt_result(db: AsyncSession, attempt_id: uuid.UUID, user_id: uuid.UUID) -> AttemptResultOut:
    stmt = (
        select(ExamAttempt)
        .options(
            selectinload(ExamAttempt.assignment),
            selectinload(ExamAttempt.user),
            selectinload(ExamAttempt.responses).selectinload(StudentResponse.question).selectinload(Question.options)
        )
        .where(ExamAttempt.id == attempt_id)
    )
    res = await db.execute(stmt)
    attempt = res.scalar_one_or_none()
    if not attempt:
        raise ValueError("Attempt not found")

    resp_map = {r.question_id: r for r in attempt.responses}
    responses_out = []
    correct_count = 0

    for q_item in (attempt.question_snapshot or []):
        qid = uuid.UUID(q_item["id"])
        pts = float(q_item.get("points", 1.0))
        resp = resp_map.get(qid)
        q_obj = await db.get(Question, qid)
        correct_opt = next((o for o in (q_obj.options if q_obj else []) if o.is_correct), None)

        if resp and resp.is_correct:
            correct_count += 1

        responses_out.append(
            ResponseDetailOut(
                question_id=qid,
                stem=q_item["stem"],
                type=q_item["type"],
                points=pts,
                points_earned=resp.points_earned if resp else 0.0,
                is_correct=resp.is_correct if resp else False,
                selected_option_id=resp.selected_option_id if resp else None,
                correct_option_id=correct_opt.id if correct_opt else None,
                text_response=resp.text_response if resp else None,
                code_response=resp.code_response if resp else None,
                coding_data=q_item.get("coding_data"),
                essay_data=q_item.get("essay_data"),
                rationale=q_obj.rationale if q_obj else None,
                options=[
                    {
                        "id": str(o.id),
                        "label": o.label,
                        "text": o.text,
                        "is_correct": o.is_correct,
                    }
                    for o in (q_obj.options if q_obj else [])
                ],
                feedback=resp.feedback if resp else None
            )
        )

    assignment = attempt.assignment
    assignment_type = getattr(assignment, "assignment_type", "exam") or "exam"
    is_homework = (assignment_type == "homework")

    return AttemptResultOut(
        attempt_id=attempt.id,
        assignment_id=attempt.assignment_id,
        assignment_name=assignment.name,
        assignment_type=assignment_type,
        attempt_number=attempt.attempt_number or 1,
        can_retry=is_homework,
        user_name=attempt.user.full_name,
        start_time=attempt.start_time,
        submitted_at=attempt.submitted_at,
        score=attempt.score,
        max_score=attempt.max_score,
        is_passed=attempt.is_passed,
        status=attempt.status,
        total_questions=len(attempt.question_snapshot or []),
        correct_answers_count=correct_count,
        responses=responses_out,
    )


async def list_assignment_submissions(db: AsyncSession, assignment_id: uuid.UUID) -> List[Dict[str, Any]]:
    stmt = (
        select(ExamAttempt)
        .options(selectinload(ExamAttempt.user))
        .where(ExamAttempt.assignment_id == assignment_id)
        .order_by(ExamAttempt.submitted_at.desc())
    )
    res = await db.execute(stmt)
    attempts = res.scalars().all()

    return [
        {
            "id": a.id,
            "student_id": a.user_id,
            "student_name": a.user.full_name,
            "student_email": a.user.email,
            "start_time": a.start_time,
            "submitted_at": a.submitted_at,
            "score": a.score,
            "max_score": a.max_score,
            "is_passed": a.is_passed,
            "status": a.status,
        }
        for a in attempts
    ]
