"""
API Router for Session Attendance
Điểm danh học sinh theo buổi học
"""
from __future__ import annotations
import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.schemas.attendance import AttendanceOut, BulkAttendanceRequest
from app.services import attendance_service

router = APIRouter(tags=["attendance"])


@router.get("/sessions/{session_id}/attendance", response_model=List[AttendanceOut])
async def get_session_attendance(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Lấy danh sách điểm danh của buổi học"""
    return await attendance_service.get_attendance(db, session_id, current_user)


@router.post("/sessions/{session_id}/attendance", response_model=List[AttendanceOut])
async def save_session_attendance(
    session_id: uuid.UUID,
    body: BulkAttendanceRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Lưu/cập nhật điểm danh cho buổi học (bulk upsert)"""
    return await attendance_service.save_attendance(
        db, session_id, body.records, current_user
    )
