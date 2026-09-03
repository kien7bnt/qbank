"""Seed initial data: roles, subjects, admin, teacher, student, questions, exam, assignment."""
from __future__ import annotations
import asyncio
import uuid
from sqlalchemy import select

from app.db.session import AsyncSessionLocal, init_db
from app.models.curriculum import Chapter, Lesson, LearningObjective, Subject, Topic
from app.models.user import Role, User, UserRole
from app.models.question import Question, QuestionOption, QuestionVersion
from app.models.exam import ExamMatrix, ExamMatrixSection, Exam, ExamSection, ExamQuestion
from app.models.class_ import Class, ClassMember
from app.models.assignment import Assignment
from app.core.security import hash_password


SUBJECTS = [
    {"name": "Toán", "code": "MATH", "description": "Môn Toán học"},
    {"name": "Vật lý", "code": "PHYS", "description": "Môn Vật lý"},
    {"name": "Hóa học", "code": "CHEM", "description": "Môn Hóa học"},
    {"name": "Ngữ văn", "code": "LIT", "description": "Môn Ngữ văn"},
    {"name": "Tiếng Anh", "code": "ENG", "description": "Môn Tiếng Anh"},
]

MATH_STRUCTURE = {
    "chapters": [
        {
            "name": "Chương 1: Hàm số và đồ thị",
            "order": 1,
            "topics": [
                {
                    "name": "Tính đơn điệu của hàm số",
                    "order": 1,
                    "lessons": [
                        {"name": "Đồng biến và nghịch biến", "order": 1},
                        {"name": "Quy tắc xét tính đơn điệu", "order": 2},
                    ],
                },
                {
                    "name": "Cực trị của hàm số",
                    "order": 2,
                    "lessons": [
                        {"name": "Khái niệm cực trị", "order": 1},
                        {"name": "Điều kiện cần và đủ để hàm số đạt cực trị", "order": 2},
                    ],
                },
                {
                    "name": "Giá trị lớn nhất và nhỏ nhất",
                    "order": 3,
                    "lessons": [
                        {"name": "GTLN, GTNN trên đoạn", "order": 1},
                        {"name": "GTLN, GTNN trên khoảng", "order": 2},
                    ],
                },
            ],
        },
        {
            "name": "Chương 2: Nguyên hàm và Tích phân",
            "order": 2,
            "topics": [
                {
                    "name": "Nguyên hàm",
                    "order": 1,
                    "lessons": [
                        {"name": "Khái niệm nguyên hàm", "order": 1},
                        {"name": "Các phương pháp tính nguyên hàm", "order": 2},
                    ],
                },
                {
                    "name": "Tích phân",
                    "order": 2,
                    "lessons": [
                        {"name": "Định nghĩa tích phân", "order": 1},
                        {"name": "Ứng dụng hình học của tích phân", "order": 2},
                    ],
                },
            ],
        },
    ]
}


async def seed():
    await init_db()

    async with AsyncSessionLocal() as db:
        # --- 1. Roles ---
        roles_data = [
            {"name": "admin", "description": "Quản trị viên hệ thống"},
            {"name": "teacher", "description": "Giáo viên biên soạn & giảng dạy"},
            {"name": "student", "description": "Học sinh làm bài & luyện tập"},
        ]
        for r_data in roles_data:
            result = await db.execute(select(Role).where(Role.name == r_data["name"]))
            if not result.scalar_one_or_none():
                db.add(Role(name=r_data["name"], description=r_data["description"]))
        await db.commit()

        # --- 2. Subjects ---
        for s_data in SUBJECTS:
            result = await db.execute(select(Subject).where(Subject.code == s_data["code"]))
            if not result.scalar_one_or_none():
                db.add(Subject(name=s_data["name"], code=s_data["code"], description=s_data["description"]))
        await db.commit()

        # --- 3. Curriculum tree for Math ---
        result = await db.execute(select(Subject).where(Subject.code == "MATH"))
        math_subject = result.scalar_one()

        result = await db.execute(select(Chapter).where(Chapter.subject_id == math_subject.id))
        if not result.scalars().all():
            for ch_data in MATH_STRUCTURE["chapters"]:
                chapter = Chapter(subject_id=math_subject.id, name=ch_data["name"], order_index=ch_data["order"])
                db.add(chapter)
                await db.flush()

                for tp_data in ch_data["topics"]:
                    topic = Topic(chapter_id=chapter.id, name=tp_data["name"], order_index=tp_data["order"])
                    db.add(topic)
                    await db.flush()

                    for ls_data in tp_data["lessons"]:
                        lesson = Lesson(topic_id=topic.id, name=ls_data["name"], order_index=ls_data["order"])
                        db.add(lesson)
                        await db.flush()

                        lo = LearningObjective(
                            lesson_id=lesson.id,
                            description=f"Học sinh có thể vận dụng {ls_data['name']}",
                            bloom_level="understand",
                        )
                        db.add(lo)
            await db.commit()

        # --- 4. Users (Admin, Teacher, Student) ---
        # Admin
        result = await db.execute(select(User).where(User.email == "admin@qbank.vn"))
        admin = result.scalar_one_or_none()
        if not admin:
            admin = User(email="admin@qbank.vn", full_name="Quản trị viên", password_hash=hash_password("Admin@123"), status="active")
            db.add(admin)
            await db.flush()
            admin_role = (await db.execute(select(Role).where(Role.name == "admin"))).scalar_one()
            db.add(UserRole(user_id=admin.id, role_id=admin_role.id))
            await db.commit()

        # Teacher
        result = await db.execute(select(User).where(User.email == "teacher@qbank.vn"))
        teacher = result.scalar_one_or_none()
        if not teacher:
            teacher = User(email="teacher@qbank.vn", full_name="Giáo viên Demo", password_hash=hash_password("Teacher@123"), status="active")
            db.add(teacher)
            await db.flush()
            teacher_role = (await db.execute(select(Role).where(Role.name == "teacher"))).scalar_one()
            db.add(UserRole(user_id=teacher.id, role_id=teacher_role.id))
            await db.commit()

        # Student
        result = await db.execute(select(User).where(User.email == "student@qbank.vn"))
        student = result.scalar_one_or_none()
        if not student:
            student = User(email="student@qbank.vn", full_name="Nguyễn Văn An (Học sinh)", password_hash=hash_password("Student@123"), status="active")
            db.add(student)
            await db.flush()
            student_role = (await db.execute(select(Role).where(Role.name == "student"))).scalar_one()
            db.add(UserRole(user_id=student.id, role_id=student_role.id))
            await db.commit()

        # --- 5. Demo Class ---
        result = await db.execute(select(Class).where(Class.code == "12A1"))
        demo_class = result.scalar_one_or_none()
        if not demo_class:
            demo_class = Class(
                code="12A1",
                name="Lớp 12A1 - Toán Chuyên",
                subject_id=math_subject.id,
                teacher_id=teacher.id,
                status="active",
                description="Lớp ôn luyện thi Toán THPT Quốc gia 2026",
            )
            db.add(demo_class)
            await db.flush()

            # Add student to class
            db.add(ClassMember(class_id=demo_class.id, user_id=student.id, role="student", status="active"))
            await db.commit()

        # --- 6. Sample Questions ---
        result = await db.execute(select(Question).where(Question.subject_id == math_subject.id))
        questions = result.scalars().all()
        if not questions:
            result = await db.execute(select(Topic).join(Chapter).where(Chapter.subject_id == math_subject.id))
            topics = result.scalars().all()
            t_id = topics[0].id if topics else None
            c_id = topics[0].chapter_id if topics else None

            sample_qs = [
                {
                    "stem": "Tính đạo hàm của hàm số $y = x^3 - 3x^2 + 2$.",
                    "type": "mcq", "bloom": "understand", "diff": "easy",
                    "rationale": "$y' = 3x^2 - 6x$",
                    "options": [
                        {"label": "A", "text": "$y' = 3x^2 - 6x$", "is_correct": True},
                        {"label": "B", "text": "$y' = 3x^2 - 3x$", "is_correct": False},
                        {"label": "C", "text": "$y' = x^2 - 6x$", "is_correct": False},
                        {"label": "D", "text": "$y' = 3x^2 - 6x + 2$", "is_correct": False},
                    ]
                },
                {
                    "stem": "Cho hàm số $y = f(x)$ có bảng biến thiên. Hàm số đồng biến trên khoảng nào?",
                    "type": "mcq", "bloom": "remember", "diff": "easy",
                    "rationale": "Dựa vào dấu của $f'(x) > 0$.",
                    "options": [
                        {"label": "A", "text": "$(0; 2)$", "is_correct": True},
                        {"label": "B", "text": "$(-\\infty; 0)$", "is_correct": False},
                        {"label": "C", "text": "$(2; +\\infty)$", "is_correct": False},
                        {"label": "D", "text": "$(-1; 1)$", "is_correct": False},
                    ]
                },
                {
                    "stem": "Tìm giá trị lớn nhất của hàm số $f(x) = -x^4 + 2x^2 + 3$ trên đoạn $[0; 2]$.",
                    "type": "mcq", "bloom": "apply", "diff": "medium",
                    "rationale": "Ta có $f'(x) = -4x^3 + 4x = 0 \\implies x=0, x=1$. So sánh $f(0)=3, f(1)=4, f(2)=-5 \\implies \\max = 4$.",
                    "options": [
                        {"label": "A", "text": "4", "is_correct": True},
                        {"label": "B", "text": "3", "is_correct": False},
                        {"label": "C", "text": "-5", "is_correct": False},
                        {"label": "D", "text": "5", "is_correct": False},
                    ]
                },
                {
                    "stem": "Đồ thị hàm số $y = \\frac{2x - 1}{x + 1}$ có đường tiệm cận đứng là:",
                    "type": "mcq", "bloom": "remember", "diff": "easy",
                    "rationale": "Nghiệm của mẫu số là $x = -1$.",
                    "options": [
                        {"label": "A", "text": "$x = -1$", "is_correct": True},
                        {"label": "B", "text": "$x = 2$", "is_correct": False},
                        {"label": "C", "text": "$y = 2$", "is_correct": False},
                        {"label": "D", "text": "$y = -1$", "is_correct": False},
                    ]
                },
                {
                    "stem": "Tính nguyên hàm $I = \\int (2x + \\sin x) dx$.",
                    "type": "mcq", "bloom": "understand", "diff": "medium",
                    "rationale": "$I = x^2 - \\cos x + C$",
                    "options": [
                        {"label": "A", "text": "$x^2 - \\cos x + C$", "is_correct": True},
                        {"label": "B", "text": "$x^2 + \\cos x + C$", "is_correct": False},
                        {"label": "C", "text": "$2 - \\cos x + C$", "is_correct": False},
                        {"label": "D", "text": "$x^2 + \\sin x + C$", "is_correct": False},
                    ]
                },
                {
                    "stem": "Phương trình $2^{2x-1} = 8$ có nghiệm là:",
                    "type": "mcq", "bloom": "understand", "diff": "easy",
                    "rationale": "$2^{2x-1} = 2^3 \\implies 2x - 1 = 3 \\implies x = 2$.",
                    "options": [
                        {"label": "A", "text": "$x = 2$", "is_correct": True},
                        {"label": "B", "text": "$x = 1$", "is_correct": False},
                        {"label": "C", "text": "$x = 3$", "is_correct": False},
                        {"label": "D", "text": "$x = 4$", "is_correct": False},
                    ]
                },
            ]

            for q_data in sample_qs:
                q = Question(
                    item_id=f"MATH-{uuid.uuid4().hex[:6].upper()}",
                    type=q_data["type"],
                    stem=q_data["stem"],
                    rationale=q_data["rationale"],
                    subject_id=math_subject.id,
                    chapter_id=c_id,
                    topic_id=t_id,
                    bloom_level=q_data["bloom"],
                    expected_difficulty=q_data["diff"],
                    status="approved",
                    created_by=teacher.id,
                )
                db.add(q)
                await db.flush()

                for idx, opt in enumerate(q_data["options"]):
                    db.add(QuestionOption(
                        question_id=q.id,
                        label=opt["label"],
                        text=opt["text"],
                        is_correct=opt["is_correct"],
                        order_index=idx,
                    ))

                db.add(QuestionVersion(
                    question_id=q.id,
                    version_number=1,
                    snapshot={"stem": q.stem, "type": q.type},
                    changed_by=teacher.id,
                ))

            await db.commit()

        # --- 7. Sample Exam & Assignment ---
        result = await db.execute(select(Assignment))
        if not result.scalars().all():
            # Create Matrix
            matrix = ExamMatrix(
                name="Ma trận đề thi Giữa kỳ I - Toán 12",
                subject_id=math_subject.id,
                total_questions=6,
                total_points=10.0,
                status="published",
                created_by=teacher.id,
            )
            db.add(matrix)
            await db.flush()

            db.add(ExamMatrixSection(
                matrix_id=matrix.id,
                name="Phần I: Trắc nghiệm khách quan",
                question_type="mcq",
                question_count=6,
                points_per_question=1.66,
                rules={"bloom_mix": {"remember": 2, "understand": 2, "apply": 2}}
            ))
            await db.flush()

            # Create Exam
            exam = Exam(
                name="Đề thi Khảo sát Chất lượng Đầu năm - Toán 12",
                matrix_id=matrix.id,
                class_id=demo_class.id,
                duration_minutes=45,
                status="published",
                created_by=teacher.id,
            )
            db.add(exam)
            await db.flush()

            exam_sec = ExamSection(exam_id=exam.id, name="Phần trắc nghiệm", order_index=0, question_type="mcq")
            db.add(exam_sec)
            await db.flush()

            # Add 6 questions to exam
            result = await db.execute(select(Question).where(Question.subject_id == math_subject.id).limit(6))
            qs = result.scalars().all()
            for idx, q_item in enumerate(qs):
                v_res = await db.execute(select(QuestionVersion).where(QuestionVersion.question_id == q_item.id))
                qv = v_res.scalars().first()
                if qv:
                    db.add(ExamQuestion(
                        exam_id=exam.id,
                        section_id=exam_sec.id,
                        question_id=q_item.id,
                        question_version_id=qv.id,
                        order_index=idx,
                        points=1.66,
                    ))

            # Create Assignment
            db.add(Assignment(
                name="Bài kiểm tra Khảo sát Toán 12 - Tháng 9",
                exam_id=exam.id,
                class_id=demo_class.id,
                duration_minutes=45,
                pass_score=5.0,
                status="published",
                created_by=teacher.id,
            ))
            await db.commit()

        print("✅ Full initial dataset seeded successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
