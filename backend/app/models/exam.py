import uuid
from typing import Optional
from datetime import datetime
from sqlalchemy import String, ForeignKey, Integer, Boolean, Float, DateTime, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class ExamMatrix(Base):
    """Ma trận đề thi"""
    __tablename__ = "exam_matrices"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    subject_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    class_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("classes.id"), nullable=True)
    
    total_questions: Mapped[int] = mapped_column(Integer, default=0)
    total_points: Mapped[float] = mapped_column(Float, default=0.0)
    
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft, published
    
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    creator = relationship("User")
    sections = relationship("ExamMatrixSection", back_populates="matrix", cascade="all, delete-orphan", lazy="selectin")
    exams = relationship("Exam", back_populates="matrix")


class ExamMatrixSection(Base):
    """Phần thi trong ma trận đề"""
    __tablename__ = "exam_matrix_sections"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    matrix_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exam_matrices.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    
    question_type: Mapped[str] = mapped_column(String(20)) # mcq, essay, coding
    question_count: Mapped[int] = mapped_column(Integer, default=1)
    points_per_question: Mapped[float] = mapped_column(Float, default=1.0)
    
    # JSON config for AI selection:
    # { "bloom_mix": {"remember": 2, "apply": 3}, "difficulty_mix": {"easy": 1, "hard": 1}, "topic_mix": {"topic_id": 2} }
    rules: Mapped[dict] = mapped_column(JSON, default=dict)

    matrix = relationship("ExamMatrix", back_populates="sections")


class Exam(Base):
    """Đề thi cụ thể được sinh ra từ ma trận"""
    __tablename__ = "exams"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    matrix_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("exam_matrices.id"), nullable=True)
    class_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("classes.id"), nullable=True)
    
    status: Mapped[str] = mapped_column(String(20), default="draft") # draft, published, active, closed
    
    duration_minutes: Mapped[int] = mapped_column(Integer, default=45)
    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    shuffle_questions: Mapped[bool] = mapped_column(Boolean, default=False)
    shuffle_options: Mapped[bool] = mapped_column(Boolean, default=False)
    show_results: Mapped[str] = mapped_column(String(20), default="after_close") # immediately, after_close, manual
    
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    matrix = relationship("ExamMatrix", back_populates="exams")
    creator = relationship("User")
    sections = relationship("ExamSection", back_populates="exam", cascade="all, delete-orphan", lazy="selectin")


class ExamSection(Base):
    """Phần thi trong đề thi thực tế"""
    __tablename__ = "exam_sections"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    exam_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    
    question_type: Mapped[str] = mapped_column(String(20))
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    exam = relationship("Exam", back_populates="sections")
    questions = relationship("ExamQuestion", back_populates="section", cascade="all, delete-orphan", lazy="selectin")


class ExamQuestion(Base):
    """Câu hỏi trong phần thi cụ thể"""
    __tablename__ = "exam_questions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    exam_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"))
    section_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exam_sections.id", ondelete="CASCADE"))
    
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id"))
    question_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("question_versions.id"))
    
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    points: Mapped[float] = mapped_column(Float, default=1.0)
    
    section = relationship("ExamSection", back_populates="questions")
    question = relationship("Question")
    question_version = relationship("QuestionVersion")
