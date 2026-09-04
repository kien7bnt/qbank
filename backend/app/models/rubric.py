"""
Rubric and Essay Grading Models
Hỗ trợ chấm tự luận tự động bằng AI và đối soát / ghi đè điểm bởi giáo viên
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Rubric(Base):
    """Rubric chấm điểm tự luận"""
    __tablename__ = "rubrics"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    subject_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True
    )
    
    total_max_score: Mapped[float] = mapped_column(Float, default=10.0)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | draft | archived
    
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    # Relationships
    criteria: Mapped[List["RubricCriteria"]] = relationship(
        "RubricCriteria", back_populates="rubric", cascade="all, delete-orphan", order_by="RubricCriteria.order_index", lazy="selectin"
    )
    creator: Mapped["User"] = relationship("User", lazy="selectin")  # type: ignore[name-defined]


class RubricCriteria(Base):
    """Tiêu chí trong Rubric (Ví dụ: Kiến thức, Lập luận, Phân tích, Trình bày)"""
    __tablename__ = "rubric_criteria"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    rubric_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("rubrics.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    weight: Mapped[float] = mapped_column(Float, default=1.0)  # Trọng số % (ví dụ: 0.4 cho 40%)
    max_score: Mapped[float] = mapped_column(Float, default=4.0)  # Thang điểm tối đa của tiêu chí (ví dụ: 4)
    order_index: Mapped[int] = mapped_column(Integer, default=1)

    # Relationships
    rubric: Mapped["Rubric"] = relationship("Rubric", back_populates="criteria")
    levels: Mapped[List["RubricLevel"]] = relationship(
        "RubricLevel", back_populates="criterion", cascade="all, delete-orphan", order_by="RubricLevel.score.desc()", lazy="selectin"
    )


class RubricLevel(Base):
    """Mức điểm trong tiêu chí (Ví dụ: 4 - Xuất sắc, 3 - Tốt, 2 - Đạt, 1 - Chưa đạt, 0 - Không đạt)"""
    __tablename__ = "rubric_levels"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    criterion_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("rubric_criteria.id", ondelete="CASCADE"), nullable=False, index=True
    )
    score: Mapped[float] = mapped_column(Float, nullable=False)  # Điểm tương ứng mức này (ví dụ 4.0, 3.0...)
    level_name: Mapped[str] = mapped_column(String(100), nullable=False)  # "Xuất sắc", "Tốt", "Đạt"...
    description: Mapped[str] = mapped_column(Text, nullable=False)  # Mô tả hành vi / tiêu chuẩn cần đạt
    order_index: Mapped[int] = mapped_column(Integer, default=1)

    criterion: Mapped["RubricCriteria"] = relationship("RubricCriteria", back_populates="levels")


class EssayGrading(Base):
    """Kết quả chấm bài tự luận của học sinh bởi AI & Giáo viên"""
    __tablename__ = "essay_gradings"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    response_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("student_responses.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    rubric_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("rubrics.id", ondelete="SET NULL"), nullable=True
    )
    
    # AI Evaluation results
    ai_score: Mapped[float] = mapped_column(Float, default=0.0)
    ai_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    # JSON breakdown: [{"criterion_name": "Kiến thức", "score": 3, "max_score": 4, "weight": 0.4, "reason": "...", "evidence": "..."}]
    criteria_breakdown: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list)
    
    # Final confirmed score (Teacher score if modified, otherwise AI score)
    final_score: Mapped[float] = mapped_column(Float, default=0.0)
    final_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="ai_graded")  # ai_graded | teacher_reviewed | approved
    
    graded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    # Relationships
    response: Mapped["StudentResponse"] = relationship("StudentResponse", backref="essay_grading")  # type: ignore[name-defined]
    rubric: Mapped[Optional["Rubric"]] = relationship("Rubric", lazy="selectin")
    reviews: Mapped[List["EssayGradingReview"]] = relationship(
        "EssayGradingReview", back_populates="grading", cascade="all, delete-orphan", order_by="EssayGradingReview.reviewed_at.desc()", lazy="selectin"
    )


class EssayGradingReview(Base):
    """Lịch sử chỉnh sửa điểm và phản hồi của giáo viên (Không ghi đè mất lịch sử AI)"""
    __tablename__ = "essay_grading_reviews"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    grading_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("essay_gradings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    previous_score: Mapped[float] = mapped_column(Float, nullable=False)
    new_score: Mapped[float] = mapped_column(Float, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    action: Mapped[str] = mapped_column(String(20), default="modify")  # accept | modify | reject
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Relationships
    grading: Mapped["EssayGrading"] = relationship("EssayGrading", back_populates="reviews")
    reviewer: Mapped["User"] = relationship("User", lazy="selectin")  # type: ignore[name-defined]
