"""
Class Sessions & Session Materials models
Quản lý Buổi học và Tài liệu trong từng buổi học
"""
from __future__ import annotations
import uuid
from datetime import date, datetime, timezone
from typing import List, Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, BigInteger, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ClassSession(Base):
    """Buổi học trong lớp học (Ví dụ: Buổi 1 - Giới thiệu Python)"""
    __tablename__ = "class_sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    class_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    @property
    def title(self) -> str:
        return self.name

    @title.setter
    def title(self, value: str):
        self.name = value

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)  # Nội dung bài giảng / ghi chú
    
    session_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | draft | completed | archived
    
    # Optional curriculum linkages
    chapter_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True
    )
    topic_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("topics.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    # Relationships
    class_: Mapped["Class"] = relationship("Class", back_populates="sessions")  # type: ignore[name-defined]
    materials: Mapped[List["SessionMaterial"]] = relationship(
        "SessionMaterial", back_populates="session", cascade="all, delete-orphan", order_by="SessionMaterial.order_index"
    )
    assignments: Mapped[List["Assignment"]] = relationship(  # type: ignore[name-defined]
        "Assignment", back_populates="session", cascade="all, delete-orphan"
    )
    chapter: Mapped[Optional["Chapter"]] = relationship("Chapter", lazy="selectin")  # type: ignore[name-defined]
    topic: Mapped[Optional["Topic"]] = relationship("Topic", lazy="selectin")  # type: ignore[name-defined]


class SessionMaterial(Base):
    """Tài liệu đính kèm trong từng buổi học (PDF, DOCX, XLSX, PPTX, Ảnh, ZIP)"""
    __tablename__ = "session_materials"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("class_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)  # pdf, docx, xlsx, pptx, image, zip...
    file_size: Mapped[int] = mapped_column(BigInteger, default=0)  # bytes
    
    order_index: Mapped[int] = mapped_column(Integer, default=1)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)  # Học sinh trong lớp có quyền xem
    
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    # Relationships
    session: Mapped["ClassSession"] = relationship("ClassSession", back_populates="materials")
    uploader: Mapped["User"] = relationship("User", lazy="selectin")  # type: ignore[name-defined]
