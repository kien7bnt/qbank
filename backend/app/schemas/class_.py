from __future__ import annotations
from datetime import date, datetime
from typing import Optional
import uuid

from pydantic import BaseModel


class ClassCreate(BaseModel):
    name: str
    subject_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    expected_start_date: Optional[date] = None
    expected_end_date: Optional[date] = None
    max_students: Optional[int] = None


class ClassUpdate(BaseModel):
    name: Optional[str] = None
    subject_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    status: Optional[str] = None
    expected_start_date: Optional[date] = None
    expected_end_date: Optional[date] = None
    max_students: Optional[int] = None


class ClassOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    subject_id: Optional[uuid.UUID] = None
    subject_name: Optional[str] = None
    teacher_id: uuid.UUID
    teacher_name: str
    status: str
    description: Optional[str] = None
    expected_start_date: Optional[date] = None
    expected_end_date: Optional[date] = None
    max_students: Optional[int] = None
    member_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ClassMemberOut(BaseModel):
    user_id: uuid.UUID
    full_name: str
    email: str
    role: str
    status: str
    joined_at: datetime

    model_config = {"from_attributes": True}


class JoinClassRequest(BaseModel):
    code: str


class UpdateMemberRequest(BaseModel):
    status: str  # active | locked
