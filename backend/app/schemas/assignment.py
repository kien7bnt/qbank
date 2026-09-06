from __future__ import annotations
import uuid
from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel, Field


class AssignmentBase(BaseModel):
    name: str = Field(..., max_length=255)
    exam_id: uuid.UUID
    class_id: uuid.UUID
    session_id: Optional[uuid.UUID] = None
    assignment_type: str = Field(default="exam", max_length=20)  # "exam" (Bài kiểm tra) | "homework" (Bài tập)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_minutes: int = Field(default=45, ge=1)
    max_attempts: int = Field(default=1, ge=1)
    pass_score: float = Field(default=5.0, ge=0.0)
    shuffle_questions: bool = False
    shuffle_options: bool = False
    show_results: str = Field("immediately", max_length=20)


class AssignmentCreate(AssignmentBase):
    pass


class AssignmentUpdate(BaseModel):
    name: Optional[str] = None
    session_id: Optional[uuid.UUID] = None
    assignment_type: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    status: Optional[str] = None


class AssignmentOut(AssignmentBase):
    id: uuid.UUID
    status: str
    created_by: uuid.UUID
    created_at: datetime
    exam_name: Optional[str] = None
    class_name: Optional[str] = None
    session_name: Optional[str] = None
    total_submissions: int = 0
    my_attempt: Optional[Any] = None

    model_config = {"from_attributes": True}


# --- Exam Taking & Responses ---

class SaveResponseRequest(BaseModel):
    question_id: uuid.UUID
    selected_option_id: Optional[uuid.UUID] = None
    text_response: Optional[str] = None
    code_response: Optional[str] = None


class QuestionTakingOut(BaseModel):
    id: uuid.UUID
    stem: str
    type: str
    order_index: int
    points: float
    bloom_level: Optional[str] = None
    options: List[dict] = Field(default_factory=list)
    selected_option_id: Optional[uuid.UUID] = None
    text_response: Optional[str] = None
    code_response: Optional[str] = None
    coding_data: Optional[dict] = None
    essay_data: Optional[dict] = None


class ExamTakingStateOut(BaseModel):
    attempt_id: uuid.UUID
    assignment_id: uuid.UUID
    assignment_name: str
    assignment_type: str = "exam"  # "exam" | "homework"
    attempt_number: int = 1
    duration_minutes: int
    start_time: datetime
    remaining_seconds: int
    status: str
    end_time: Optional[datetime] = None
    questions: List[QuestionTakingOut] = Field(default_factory=list)


class ResponseDetailOut(BaseModel):
    question_id: uuid.UUID
    stem: str
    type: str
    points: float
    points_earned: float
    is_correct: Optional[bool] = None
    selected_option_id: Optional[uuid.UUID] = None
    correct_option_id: Optional[uuid.UUID] = None
    text_response: Optional[str] = None
    code_response: Optional[str] = None
    rationale: Optional[str] = None
    options: List[dict] = Field(default_factory=list)
    feedback: Optional[str] = None
    coding_data: Optional[dict] = None
    essay_data: Optional[dict] = None


class AttemptResultOut(BaseModel):
    attempt_id: uuid.UUID
    assignment_id: Optional[uuid.UUID] = None
    assignment_name: str
    assignment_type: str = "exam"  # "exam" | "homework"
    attempt_number: int = 1
    can_retry: bool = False
    user_name: str
    start_time: datetime
    submitted_at: Optional[datetime] = None
    score: Optional[float] = None
    max_score: float
    is_passed: Optional[bool] = None
    status: str
    total_questions: int
    correct_answers_count: int
    responses: List[ResponseDetailOut] = Field(default_factory=list)
