from __future__ import annotations
import random
import string
import uuid
from typing import Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.class_ import Class, ClassMember
from app.models.user import User
from app.schemas.class_ import ClassCreate, ClassMemberOut, ClassUpdate


def _generate_code(length: int = 6) -> str:
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=length))


async def _unique_code(db: AsyncSession) -> str:
    for _ in range(20):
        code = _generate_code()
        result = await db.execute(select(Class).where(Class.code == code))
        if not result.scalar_one_or_none():
            return code
    raise RuntimeError("Không thể tạo mã lớp duy nhất")


async def get_classes_for_teacher(
    db: AsyncSession,
    teacher_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
    subject_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
) -> Tuple[list[Class], int]:
    query = (
        select(Class)
        .options(selectinload(Class.members), selectinload(Class.subject))
        .where(Class.teacher_id == teacher_id)
    )
    if subject_id:
        query = query.where(Class.subject_id == subject_id)
    if status:
        query = query.where(Class.status == status)
    if search:
        query = query.where(Class.name.ilike(f"%{search}%"))

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(Class.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return result.scalars().all(), total


async def get_classes_for_student(
    db: AsyncSession,
    student_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
    subject_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
) -> Tuple[list[Class], int]:
    query = (
        select(Class)
        .join(ClassMember, ClassMember.class_id == Class.id)
        .options(selectinload(Class.members), selectinload(Class.subject))
        .where(ClassMember.user_id == student_id)
        .where(ClassMember.status == "active")
    )
    if subject_id:
        query = query.where(Class.subject_id == subject_id)
    if status:
        query = query.where(Class.status == status)
    if search:
        query = query.where(Class.name.ilike(f"%{search}%"))

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(Class.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return result.scalars().all(), total


async def create_class(
    db: AsyncSession, data: ClassCreate, teacher_id: uuid.UUID
) -> Class:
    code = await _unique_code(db)
    class_ = Class(
        code=code,
        name=data.name,
        subject_id=data.subject_id,
        teacher_id=teacher_id,
        description=data.description,
        expected_start_date=data.expected_start_date,
        expected_end_date=data.expected_end_date,
        max_students=data.max_students,
        status="active",
    )
    db.add(class_)
    await db.flush()

    # Add teacher as member
    member = ClassMember(class_id=class_.id, user_id=teacher_id, role="teacher", status="active")
    db.add(member)

    await db.commit()
    loaded_class = await get_class(db, class_.id)
    return loaded_class or class_


async def get_class(db: AsyncSession, class_id: uuid.UUID) -> Optional[Class]:
    result = await db.execute(
        select(Class)
        .options(selectinload(Class.members).selectinload(ClassMember.user), selectinload(Class.subject))
        .where(Class.id == class_id)
    )
    return result.scalar_one_or_none()


async def update_class(
    db: AsyncSession,
    class_id: uuid.UUID,
    data: ClassUpdate,
    user_id: uuid.UUID,
    is_admin: bool = False,
) -> Class:
    class_ = await get_class(db, class_id)
    if not class_:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy lớp học")
    if not is_admin and class_.teacher_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền chỉnh sửa lớp này")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(class_, field, value)

    await db.commit()
    loaded_class = await get_class(db, class_id)
    return loaded_class or class_


async def delete_class(
    db: AsyncSession,
    class_id: uuid.UUID,
    user_id: uuid.UUID,
    is_admin: bool = False,
) -> bool:
    class_ = await get_class(db, class_id)
    if not class_:
        return False
    if not is_admin and class_.teacher_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền xóa lớp học này")

    from app.models.exam import Exam, ExamMatrix
    from sqlalchemy import update as sql_update

    # 1. Unlink any exams or exam matrices referencing this class
    await db.execute(sql_update(Exam).where(Exam.class_id == class_id).values(class_id=None))
    await db.execute(sql_update(ExamMatrix).where(ExamMatrix.class_id == class_id).values(class_id=None))

    # 2. Delete class (cascades to class_members, class_sessions, session_materials, assignments)
    await db.delete(class_)
    await db.commit()
    return True


async def join_class(
    db: AsyncSession, code: str, student_id: uuid.UUID
) -> ClassMember:
    # Find class by code
    result = await db.execute(select(Class).where(Class.code == code.upper()))
    class_ = result.scalar_one_or_none()
    if not class_:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mã lớp không tồn tại")
    if class_.status != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lớp học không còn hoạt động")

    # Check student status
    result = await db.execute(select(User).where(User.id == student_id))
    student = result.scalar_one_or_none()
    if student and student.status == "locked":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tài khoản đã bị khóa")

    # Check already joined
    result = await db.execute(
        select(ClassMember)
        .where(ClassMember.class_id == class_.id, ClassMember.user_id == student_id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        if existing.status == "locked":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn đã bị khóa khỏi lớp này")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bạn đã tham gia lớp này")

    # Check capacity
    if class_.max_students:
        count_result = await db.execute(
            select(func.count()).where(
                ClassMember.class_id == class_.id, ClassMember.status == "active"
            )
        )
        if count_result.scalar_one() >= class_.max_students:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lớp học đã đầy")

    member = ClassMember(
        class_id=class_.id, user_id=student_id, role="student", status="active"
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


async def get_class_members(db: AsyncSession, class_id: uuid.UUID) -> list[ClassMemberOut]:
    result = await db.execute(
        select(ClassMember)
        .options(selectinload(ClassMember.user))
        .where(ClassMember.class_id == class_id)
        .order_by(ClassMember.joined_at)
    )
    members = result.scalars().all()
    return [
        ClassMemberOut(
            user_id=m.user_id,
            full_name=m.user.full_name,
            email=m.user.email,
            role=m.role,
            status=m.status,
            joined_at=m.joined_at,
        )
        for m in members
    ]


async def update_member_status(
    db: AsyncSession, class_id: uuid.UUID, user_id: uuid.UUID, new_status: str
) -> ClassMember:
    result = await db.execute(
        select(ClassMember).where(
            ClassMember.class_id == class_id, ClassMember.user_id == user_id
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thành viên")
    member.status = new_status
    await db.commit()
    await db.refresh(member)
    return member


async def add_member_by_email(db: AsyncSession, class_id: uuid.UUID, email: str) -> ClassMemberOut:
    user_res = await db.execute(select(User).where(User.email == email.strip().lower()))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Không tìm thấy tài khoản với email {email}")

    existing_res = await db.execute(
        select(ClassMember).where(ClassMember.class_id == class_id, ClassMember.user_id == user.id)
    )
    existing = existing_res.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Học sinh đã có trong lớp này")

    member = ClassMember(class_id=class_id, user_id=user.id, role="student", status="active")
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return ClassMemberOut(
        user_id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=member.role,
        status=member.status,
        joined_at=member.joined_at,
    )


async def remove_member(db: AsyncSession, class_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    stmt = delete(ClassMember).where(ClassMember.class_id == class_id, ClassMember.user_id == user_id)
    res = await db.execute(stmt)
    await db.commit()
    return res.rowcount > 0
