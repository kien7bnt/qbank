"""
Pydantic Schemas for Class Sessions and Session Materials
"""
from __future__ import annotations
import uuid
from datetime import date, datetime
from typing import List, Optional, Union
from pydantic import BaseModel, ConfigDict, model_validator


class SessionMaterialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    title: str
    description: Optional[str] = None
    file_name: str
    file_type: str
    file_size: int
    order_index: int
    is_public: bool
    uploaded_by: uuid.UUID
    created_at: datetime


class SessionMaterialCreate(BaseModel):
    title: str
    description: Optional[str] = None
    is_public: bool = True
    order_index: int = 1


class SessionAssignmentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    assignment_type: str = "exam"  # "homework" | "exam"
    duration_minutes: int = 45
    max_attempts: int = 1
    pass_score: float = 5.0
    status: str = "published"
    created_at: datetime
    exam_id: Optional[uuid.UUID] = None
    class_id: Optional[uuid.UUID] = None
    session_id: Optional[uuid.UUID] = None
    total_submissions: Optional[int] = 0

    @model_validator(mode="after")
    def normalize_type(self) -> SessionAssignmentSummary:
        if self.assignment_type in ["assignment", "homework"]:
            self.assignment_type = "homework"
        else:
            self.assignment_type = "exam"
        return self


class ClassSessionCreate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    session_date: Optional[Union[date, datetime, str]] = None
    order_index: int = 1
    status: Optional[str] = "planned"
    chapter_id: Optional[uuid.UUID] = None
    topic_id: Optional[uuid.UUID] = None

    @model_validator(mode="after")
    def populate_name_or_title(self):
        if not self.name and self.title:
            self.name = self.title
        elif not self.title and self.name:
            self.title = self.name
        if not self.name:
            raise ValueError("Tên hoặc tiêu đề buổi học không được để trống")
        return self


class ClassSessionUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    session_date: Optional[Union[date, datetime, str]] = None
    order_index: Optional[int] = None
    status: Optional[str] = None
    chapter_id: Optional[uuid.UUID] = None
    topic_id: Optional[uuid.UUID] = None

    @model_validator(mode="after")
    def populate_name_or_title(self):
        if self.title and not self.name:
            self.name = self.title
        elif self.name and not self.title:
            self.title = self.name
        return self


class ClassSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    class_id: uuid.UUID
    name: str
    title: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    session_date: Optional[Union[date, str]] = None
    order_index: int
    status: str
    chapter_id: Optional[uuid.UUID] = None
    topic_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

    materials: List[SessionMaterialOut] = []
    assignments: List[SessionAssignmentSummary] = []

    @model_validator(mode="after")
    def populate_title(self):
        if not self.title and self.name:
            self.title = self.name
        elif not self.name and self.title:
            self.name = self.title
        return self

