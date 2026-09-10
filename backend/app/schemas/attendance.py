"""
Pydantic Schemas for Session Attendance
"""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class AttendanceRecord(BaseModel):
    """Single attendance record for bulk save"""
    student_id: uuid.UUID
    status: str = "present"  # present | absent | late
    note: Optional[str] = None


class BulkAttendanceRequest(BaseModel):
    """Bulk save attendance for a session"""
    records: List[AttendanceRecord]


class AttendanceOut(BaseModel):
    """Attendance record output with student info"""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    student_id: uuid.UUID
    status: str
    note: Optional[str] = None
    checked_by: uuid.UUID
    checked_at: datetime
    student_name: Optional[str] = None
    student_email: Optional[str] = None


class AttendanceSummary(BaseModel):
    """Summary counts for attendance in a session"""
    total: int = 0
    present: int = 0
    absent: int = 0
    late: int = 0
