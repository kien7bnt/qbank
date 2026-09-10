"""
Service layer for Session Attendance
Điểm danh học sinh theo buổi học
"""
from __future__ import annotations
import uuid
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import SessionAttendance
from app.models.session import ClassSession
from app.models.class_ import Class, ClassMember
from app.schemas.attendance import AttendanceRecord, AttendanceOut, AttendanceSummary
from app.services.session_service import check_class_access, get_session


async def get_attendance(
    db: AsyncSession, session_id: uuid.UUID, user
) -> List[AttendanceOut]:
    """Lấy danh sách điểm danh của buổi học"""
    session = await get_session(db, session_id, user)

    stmt = (
        select(SessionAttendance)
        .where(SessionAttendance.session_id == session_id)
        .order_by(SessionAttendance.checked_at)
    )
    res = await db.execute(stmt)
    records = res.scalars().all()

    result = []
    for r in records:
        result.append(AttendanceOut(
            id=r.id,
            session_id=r.session_id,
            student_id=r.student_id,
            status=r.status,
            note=r.note,
            checked_by=r.checked_by,
            checked_at=r.checked_at,
            student_name=r.student.full_name if r.student else None,
            student_email=r.student.email if r.student else None,
        ))
    return result


async def save_attendance(
    db: AsyncSession,
    session_id: uuid.UUID,
    records: List[AttendanceRecord],
    user,
) -> List[AttendanceOut]:
    """Lưu/cập nhật điểm danh cho buổi học (upsert bulk)"""
    session = await get_session(db, session_id, user)
    await check_class_access(db, session.class_id, user, require_teacher=True)

    # Validate statuses
    valid_statuses = {"present", "absent", "late"}
    for r in records:
        if r.status not in valid_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"Trạng thái '{r.status}' không hợp lệ. Cho phép: present, absent, late"
            )

    # Get existing records for this session
    existing_stmt = select(SessionAttendance).where(
        SessionAttendance.session_id == session_id
    )
    existing_res = await db.execute(existing_stmt)
    existing_map = {r.student_id: r for r in existing_res.scalars().all()}

    # Upsert each record
    for record in records:
        if record.student_id in existing_map:
            # Update existing
            att = existing_map[record.student_id]
            att.status = record.status
            att.note = record.note
            att.checked_by = user.id
        else:
            # Insert new
            att = SessionAttendance(
                session_id=session_id,
                student_id=record.student_id,
                status=record.status,
                note=record.note,
                checked_by=user.id,
            )
            db.add(att)

    await db.commit()

    # Return updated list
    return await get_attendance(db, session_id, user)


def compute_attendance_summary(attendance_records) -> dict:
    """Tính tóm tắt điểm danh từ danh sách records (dùng trong serialization)"""
    total = len(attendance_records) if attendance_records else 0
    present = sum(1 for r in (attendance_records or []) if r.status == "present")
    absent = sum(1 for r in (attendance_records or []) if r.status == "absent")
    late = sum(1 for r in (attendance_records or []) if r.status == "late")
    return {"total": total, "present": present, "absent": absent, "late": late}
