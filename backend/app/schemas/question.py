from __future__ import annotations
from datetime import datetime
from typing import Any, List, Optional
import uuid

from pydantic import BaseModel, field_validator


class QuestionOptionIn(BaseModel):
    label: str
    text: str
    is_correct: bool
    distractor_reason: Optional[str] = None
    order_index: int = 0


class QuestionOptionOut(QuestionOptionIn):
    id: uuid.UUID
    question_id: uuid.UUID

    model_config = {"from_attributes": True}


class EssayDataIn(BaseModel):
    sample_answer: Optional[str] = None
    rubric: Optional[Any] = None
    max_points: float = 10.0


class EssayDataOut(EssayDataIn):
    model_config = {"from_attributes": True}


class CodingDataIn(BaseModel):
    problem_statement: str
    input_format: Optional[str] = None
    output_format: Optional[str] = None
    constraints: Optional[str] = None
    sample_input: Optional[str] = None
    sample_output: Optional[str] = None
    time_limit_ms: int = 1000
    memory_limit_mb: int = 256
    allowed_languages: List[str] = ["python", "cpp", "c", "java", "javascript"]
    starter_code: Optional[str] = None
    test_cases: List[dict] = []


class CodingDataOut(CodingDataIn):
    model_config = {"from_attributes": True}


class QuestionCreate(BaseModel):
    type: str  # mcq | essay | coding
    stem: str
    rationale: Optional[str] = None
    subject_id: Optional[uuid.UUID] = None
    chapter_id: Optional[uuid.UUID] = None
    topic_id: Optional[uuid.UUID] = None
    lesson_id: Optional[uuid.UUID] = None
    learning_objective_id: Optional[uuid.UUID] = None
    bloom_level: Optional[str] = None
    expected_difficulty: Optional[str] = None
    # Exercise bank
    in_exercise_bank: Optional[bool] = False
    # MCQ
    options: Optional[List[QuestionOptionIn]] = None
    # Essay
    essay_data: Optional[EssayDataIn] = None
    # Coding
    coding_data: Optional[CodingDataIn] = None

    @field_validator("subject_id", "chapter_id", "topic_id", "lesson_id", "learning_objective_id", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator("type", mode="before")
    @classmethod
    def normalize_type(cls, v):
        if isinstance(v, str):
            v_lower = v.strip().lower()
            if v_lower in ["mcq", "single_choice", "multiple_choice", "true_false"]:
                return "mcq"
            if v_lower in ["essay", "tu_luan"]:
                return "essay"
            if v_lower in ["coding", "code"]:
                return "coding"
            return v_lower
        return v


class QuestionBatchCreateRequest(BaseModel):
    subject_id: Optional[uuid.UUID] = None
    chapter_id: Optional[uuid.UUID] = None
    topic_id: Optional[uuid.UUID] = None
    questions: List[QuestionCreate]

    @field_validator("subject_id", "chapter_id", "topic_id", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class QuestionBatchCreateResponse(BaseModel):
    total_created: int
    created_ids: List[uuid.UUID] = []
    message: str


class QuestionUpdate(BaseModel):
    stem: Optional[str] = None
    rationale: Optional[str] = None
    status: Optional[str] = None
    subject_id: Optional[uuid.UUID] = None
    chapter_id: Optional[uuid.UUID] = None
    topic_id: Optional[uuid.UUID] = None
    lesson_id: Optional[uuid.UUID] = None
    learning_objective_id: Optional[uuid.UUID] = None
    bloom_level: Optional[str] = None
    expected_difficulty: Optional[str] = None
    options: Optional[List[QuestionOptionIn]] = None
    essay_data: Optional[EssayDataIn] = None
    coding_data: Optional[CodingDataIn] = None

    @field_validator("subject_id", "chapter_id", "topic_id", "lesson_id", "learning_objective_id", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class QuestionOut(BaseModel):
    id: uuid.UUID
    item_id: str
    type: str
    status: str
    stem: str
    rationale: Optional[str] = None
    subject_id: Optional[uuid.UUID] = None
    subject_name: Optional[str] = None
    chapter_id: Optional[uuid.UUID] = None
    chapter_name: Optional[str] = None
    topic_id: Optional[uuid.UUID] = None
    topic_name: Optional[str] = None
    bloom_level: Optional[str] = None
    expected_difficulty: Optional[str] = None
    actual_difficulty: Optional[float] = None
    discrimination_index: Optional[float] = None
    irt_a: Optional[float] = None
    irt_b: Optional[float] = None
    irt_c: Optional[float] = None
    usage_count: int = 0
    in_exercise_bank: bool = False
    options: List[QuestionOptionOut] = []
    essay_data: Optional[EssayDataOut] = None
    coding_data: Optional[CodingDataOut] = None
    version: int
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class QuestionListItem(BaseModel):
    id: uuid.UUID
    item_id: str
    type: str
    sub_type: Optional[str] = None  # single_choice | multiple_choice | true_false | essay | coding
    status: str
    stem_preview: str  # Truncated to 100 chars
    bloom_level: Optional[str] = None
    expected_difficulty: Optional[str] = None
    actual_difficulty: Optional[float] = None
    discrimination_index: Optional[float] = None
    irt_a: Optional[float] = None
    irt_b: Optional[float] = None
    irt_c: Optional[float] = None
    is_calibrated: bool = False
    response_count: int = 0
    usage_count: int = 0
    in_exercise_bank: bool = False
    subject_id: Optional[uuid.UUID] = None
    chapter_id: Optional[uuid.UUID] = None
    topic_id: Optional[uuid.UUID] = None
    subject_name: Optional[str] = None
    chapter_name: Optional[str] = None
    topic_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Question Usage & Assessment Operations Schemas ──────────────────────────

class AssessmentReference(BaseModel):
    id: uuid.UUID
    name: str
    type: str  # "exercise" | "exam"
    status: str
    created_at: datetime
    class_name: Optional[str] = None
    question_count: int = 0


class QuestionUsageOut(BaseModel):
    question_id: uuid.UUID
    item_id: str
    stem_preview: str
    usage_count: int
    attempt_count: int = 0
    correct_count: int = 0
    actual_difficulty: Optional[float] = None
    discrimination_index: Optional[float] = None
    irt_a: Optional[float] = None
    irt_b: Optional[float] = None
    irt_c: Optional[float] = None
    assessments: List[AssessmentReference] = []


class AddToAssessmentRequest(BaseModel):
    target_type: str = "exercise"  # "exercise" | "exam"
    mode: str = "new"              # "new" | "existing"
    assessment_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    class_id: Optional[uuid.UUID] = None
    duration_minutes: Optional[int] = 45
    question_ids: List[uuid.UUID]


class AutoGenerateAssessmentRequest(BaseModel):
    target_type: str = "exercise"  # "exercise" | "exam"
    name: str
    class_id: Optional[uuid.UUID] = None
    chapter_id: Optional[uuid.UUID] = None
    topic_id: Optional[uuid.UUID] = None
    total_questions: int = 10
    duration_minutes: int = 45
    bloom_mix: dict[str, int] = {}       # e.g. {"remember": 3, "understand": 3, "apply": 2, "analyze": 2}
    difficulty_mix: dict[str, int] = {}  # e.g. {"easy": 4, "medium": 4, "hard": 2}
    question_types: List[str] = ["mcq"]


class PaginatedQuestions(BaseModel):
    items: List[QuestionListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class BulkActionRequest(BaseModel):
    question_ids: List[uuid.UUID]
    action: str  # archive | change_bloom | change_difficulty | change_status
    payload: dict = {}


class QuestionVersionOut(BaseModel):
    id: uuid.UUID
    version_number: int
    snapshot: Any
    changed_by: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}
