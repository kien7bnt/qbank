import uuid
from typing import Optional, List, Any
from datetime import datetime
from sqlalchemy import String, ForeignKey, Integer, Boolean, Float, DateTime, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Assignment(Base):
    """Đợt giao bài kiểm tra / bài tập cho lớp học"""
    __tablename__ = "assignments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    exam_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"))
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"))
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("class_sessions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    assignment_type: Mapped[str] = mapped_column(String(20), default="assignment")  # "assignment" (luyện tập) | "exam" (đánh giá)
    
    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=45)
    
    max_attempts: Mapped[int] = mapped_column(Integer, default=1)
    pass_score: Mapped[float] = mapped_column(Float, default=5.0)
    
    shuffle_questions: Mapped[bool] = mapped_column(Boolean, default=False)
    shuffle_options: Mapped[bool] = mapped_column(Boolean, default=False)
    show_results: Mapped[str] = mapped_column(String(20), default="after_close")  # immediately, after_close, manual
    
    # Review permission toggles (for Practice / Exam)
    allow_review: Mapped[bool] = mapped_column(Boolean, default=True)
    show_correct_answer: Mapped[bool] = mapped_column(Boolean, default=True)
    show_explanation: Mapped[bool] = mapped_column(Boolean, default=True)
    
    status: Mapped[str] = mapped_column(String(20), default="published")  # draft, published, closed
    
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    exam = relationship("Exam", lazy="selectin")
    class_ = relationship("Class", lazy="selectin")
    session = relationship("ClassSession", back_populates="assignments", lazy="selectin")
    creator = relationship("User")
    attempts = relationship("ExamAttempt", back_populates="assignment", cascade="all, delete-orphan", lazy="selectin")

    @property
    def total_submissions(self) -> int:
        return len(self.attempts) if self.attempts else 0


class ExamAttempt(Base):
    """Lượt làm bài của học sinh"""
    __tablename__ = "exam_attempts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    assignment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assignments.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    
    attempt_number: Mapped[int] = mapped_column(Integer, default=1)
    
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_score: Mapped[float] = mapped_column(Float, default=10.0)
    is_passed: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    
    # Snapshot of question order for this attempt (supports shuffled per student)
    question_snapshot: Mapped[Any] = mapped_column(JSON, default=list)
    
    status: Mapped[str] = mapped_column(String(20), default="in_progress")  # in_progress, submitted, graded
    
    # Relationships
    assignment = relationship("Assignment", back_populates="attempts")
    user = relationship("User")
    responses = relationship("StudentResponse", back_populates="attempt", cascade="all, delete-orphan", lazy="selectin")


class StudentResponse(Base):
    """Câu trả lời của học sinh cho từng câu hỏi"""
    __tablename__ = "student_responses"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exam_attempts.id", ondelete="CASCADE"))
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"))
    
    selected_option_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("question_options.id"), nullable=True)
    text_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    code_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    is_correct: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    points_earned: Mapped[float] = mapped_column(Float, default=0.0)
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    attempt = relationship("ExamAttempt", back_populates="responses")
    question = relationship("Question", lazy="selectin")
    selected_option = relationship("QuestionOption", lazy="selectin")
