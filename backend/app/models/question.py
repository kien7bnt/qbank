from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    item_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # mcq | essay | coding
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    stem: Mapped[str] = mapped_column(Text, nullable=False)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Curriculum references
    subject_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    chapter_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True, index=True
    )
    topic_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("topics.id", ondelete="SET NULL"), nullable=True
    )
    lesson_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("lessons.id", ondelete="SET NULL"), nullable=True
    )
    learning_objective_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("learning_objectives.id", ondelete="SET NULL"), nullable=True
    )

    # Test properties & Psychometrics
    bloom_level: Mapped[str | None] = mapped_column(String(30), nullable=True)
    expected_difficulty: Mapped[str | None] = mapped_column(String(20), nullable=True)
    actual_difficulty: Mapped[float | None] = mapped_column(Float, nullable=True)  # Item Facility (IF 0.0 - 1.0)
    discrimination_index: Mapped[float | None] = mapped_column(Float, nullable=True)  # Item Discrimination (ID -1.0 to 1.0)

    # IRT parameters (Item Response Theory 2PL / 3PL)
    irt_a: Mapped[float | None] = mapped_column(Float, nullable=True)  # Discrimination (0.0 to 2.5)
    irt_b: Mapped[float | None] = mapped_column(Float, nullable=True)  # Difficulty (-3.0 to 3.0)
    irt_c: Mapped[float | None] = mapped_column(Float, nullable=True)  # Guessing (0.0 to 0.5)

    # Usage tracking
    usage_count: Mapped[int] = mapped_column(Integer, default=0)

    # Exercise Bank membership
    in_exercise_bank: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    # Versioning
    version: Mapped[int] = mapped_column(Integer, default=1)

    # Ownership
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    # Relationships
    options: Mapped[list["QuestionOption"]] = relationship(
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="QuestionOption.order_index",
        lazy="selectin",
    )
    essay_data: Mapped["QuestionEssay | None"] = relationship(
        back_populates="question", cascade="all, delete-orphan", uselist=False, lazy="selectin"
    )
    coding_data: Mapped["QuestionCoding | None"] = relationship(
        back_populates="question", cascade="all, delete-orphan", uselist=False, lazy="selectin"
    )
    versions: Mapped[list["QuestionVersion"]] = relationship(
        back_populates="question", cascade="all, delete-orphan"
    )

    # Joined references (not FK — just for eager loading names)
    subject: Mapped["Subject | None"] = relationship(  # type: ignore[name-defined]
        "Subject", foreign_keys=[subject_id], lazy="selectin"
    )
    chapter: Mapped["Chapter | None"] = relationship(  # type: ignore[name-defined]
        "Chapter", foreign_keys=[chapter_id], lazy="selectin"
    )
    topic: Mapped["Topic | None"] = relationship(  # type: ignore[name-defined]
        "Topic", foreign_keys=[topic_id], lazy="selectin"
    )
    creator: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[created_by], lazy="selectin"
    )


class QuestionOption(Base):
    __tablename__ = "question_options"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column(String(5), nullable=False)  # A, B, C, D
    text: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
    distractor_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    question: Mapped["Question"] = relationship(back_populates="options")


class QuestionEssay(Base):
    __tablename__ = "question_essays"

    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), primary_key=True
    )
    rubric_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("rubrics.id", ondelete="SET NULL"), nullable=True
    )
    sample_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    rubric: Mapped[Any] = mapped_column(JSON, nullable=True)  # Legacy or quick rubric json
    max_points: Mapped[float] = mapped_column(Float, default=10.0)

    question: Mapped["Question"] = relationship(back_populates="essay_data")
    rubric_entity: Mapped[Optional["Rubric"]] = relationship("Rubric", lazy="selectin")  # type: ignore[name-defined]


class QuestionCoding(Base):
    __tablename__ = "question_codings"

    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), primary_key=True
    )
    problem_statement: Mapped[str] = mapped_column(Text, nullable=False)
    input_format: Mapped[str | None] = mapped_column(Text, nullable=True)
    output_format: Mapped[str | None] = mapped_column(Text, nullable=True)
    constraints: Mapped[str | None] = mapped_column(Text, nullable=True)
    sample_input: Mapped[str | None] = mapped_column(Text, nullable=True)
    sample_output: Mapped[str | None] = mapped_column(Text, nullable=True)
    time_limit_ms: Mapped[int] = mapped_column(Integer, default=1000)
    memory_limit_mb: Mapped[int] = mapped_column(Integer, default=256)
    allowed_languages: Mapped[Any] = mapped_column(JSON, default=list)
    starter_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    test_cases: Mapped[Any] = mapped_column(JSON, default=list)

    question: Mapped["Question"] = relationship(back_populates="coding_data")


class QuestionVersion(Base):
    __tablename__ = "question_versions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot: Mapped[Any] = mapped_column(JSON, nullable=False)  # Full question data
    changed_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    question: Mapped["Question"] = relationship(back_populates="versions")
