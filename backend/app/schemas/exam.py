from __future__ import annotations
import uuid
from typing import Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field


class ExamMatrixSectionBase(BaseModel):
    name: str = Field(..., max_length=255)
    question_type: str = Field(..., max_length=20)
    question_count: int = Field(default=1, ge=1)
    points_per_question: float = Field(default=1.0, ge=0.1)
    rules: dict[str, Any] = Field(default_factory=dict)


class ExamMatrixSectionCreate(ExamMatrixSectionBase):
    pass


class ExamMatrixSectionOut(ExamMatrixSectionBase):
    id: uuid.UUID
    matrix_id: uuid.UUID

    model_config = {"from_attributes": True}


class ExamMatrixBase(BaseModel):
    name: str = Field(..., max_length=255)
    subject_id: Optional[str] = None
    class_id: Optional[uuid.UUID] = None
    total_questions: int = Field(default=0, ge=0)
    total_points: float = Field(default=0.0, ge=0.0)


class ExamMatrixCreate(ExamMatrixBase):
    sections: list[ExamMatrixSectionCreate] = Field(default_factory=list)


class ExamMatrixUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    sections: Optional[list[ExamMatrixSectionCreate]] = None


class ExamMatrixOut(ExamMatrixBase):
    id: uuid.UUID
    status: str
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    sections: list[ExamMatrixSectionOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


# --- Exam ---

class ExamSectionBase(BaseModel):
    name: str = Field(..., max_length=255)
    order_index: int = 0
    question_type: str = Field(..., max_length=20)
    instructions: Optional[str] = None


class ExamSectionOut(ExamSectionBase):
    id: uuid.UUID
    exam_id: uuid.UUID

    model_config = {"from_attributes": True}


class ExamBase(BaseModel):
    name: str = Field(..., max_length=255)
    matrix_id: Optional[uuid.UUID] = None
    class_id: Optional[uuid.UUID] = None
    duration_minutes: int = Field(default=45, ge=1)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    shuffle_questions: bool = False
    shuffle_options: bool = False
    show_results: str = Field("after_close", max_length=20)


class ExamCreate(ExamBase):
    pass


class ExamUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    duration_minutes: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    shuffle_questions: Optional[bool] = None
    shuffle_options: Optional[bool] = None
    show_results: Optional[str] = None


class ExamOut(ExamBase):
    id: uuid.UUID
    status: str
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    sections: list[ExamSectionOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class AutoSelectRequest(BaseModel):
    pass


class GenerateExamRequest(BaseModel):
    name: str
    class_id: Optional[uuid.UUID] = None


class CreateExamFromQuestionsRequest(BaseModel):
    name: str = Field(..., max_length=255)
    class_id: Optional[uuid.UUID] = None
    duration_minutes: int = Field(default=45, ge=1)
    question_ids: list[uuid.UUID] = Field(..., min_length=1)
    points_per_question: Optional[float] = None
    shuffle_questions: bool = False
    shuffle_options: bool = False
