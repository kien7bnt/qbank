"""
Pydantic Schemas for Rubrics and Essay Grading
"""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class RubricLevelCreate(BaseModel):
    score: float = Field(..., ge=0, description="Điểm tương ứng mức này")
    level_name: str = Field(..., description="Tên mức (Xuất sắc, Tốt, Đạt...)")
    description: str = Field(..., description="Mô tả tiêu chuẩn")
    order_index: int = 1


class RubricLevelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    criterion_id: uuid.UUID
    score: float
    level_name: str
    description: str
    order_index: int


class RubricCriteriaCreate(BaseModel):
    name: str = Field(..., description="Tên tiêu chí (Kiến thức, Lập luận...)")
    description: Optional[str] = None
    weight: float = Field(1.0, gt=0, description="Trọng số % (ví dụ 0.4 cho 40%)")
    max_score: float = Field(4.0, gt=0, description="Điểm tối đa của tiêu chí")
    order_index: int = 1
    levels: List[RubricLevelCreate] = []


class RubricCriteriaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    rubric_id: uuid.UUID
    name: str
    description: Optional[str] = None
    weight: float
    max_score: float
    order_index: int
    levels: List[RubricLevelOut] = []


class RubricCreate(BaseModel):
    name: str
    description: Optional[str] = None
    subject_id: Optional[uuid.UUID] = None
    total_max_score: float = 10.0
    criteria: List[RubricCriteriaCreate] = []


class RubricUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    subject_id: Optional[uuid.UUID] = None
    total_max_score: Optional[float] = None
    status: Optional[str] = None
    criteria: Optional[List[RubricCriteriaCreate]] = None


class RubricOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: Optional[str] = None
    subject_id: Optional[uuid.UUID] = None
    total_max_score: float
    status: str
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    criteria: List[RubricCriteriaOut] = []


# ─── Essay Grading Schemas ───────────────────────────────────────────────────

class CriterionEvaluation(BaseModel):
    criterion_id: Optional[str] = None
    criterion_name: str
    score: float
    max_score: float
    weight: float
    level_name: Optional[str] = None
    reason: str
    evidence: str


class EssayGradeRequest(BaseModel):
    response_id: uuid.UUID
    rubric_id: Optional[uuid.UUID] = None


class EssayGradingReviewCreate(BaseModel):
    new_score: float
    comment: Optional[str] = None
    action: str = "modify"  # accept | modify | reject


class EssayGradingReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    grading_id: uuid.UUID
    reviewer_id: uuid.UUID
    previous_score: float
    new_score: float
    comment: Optional[str] = None
    action: str
    reviewed_at: datetime


class EssayGradingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    response_id: uuid.UUID
    rubric_id: Optional[uuid.UUID] = None
    ai_score: float
    ai_feedback: Optional[str] = None
    criteria_breakdown: List[Dict[str, Any]] = []
    final_score: float
    final_feedback: Optional[str] = None
    status: str
    graded_at: datetime
    updated_at: datetime
    reviews: List[EssayGradingReviewOut] = []
