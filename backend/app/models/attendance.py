"""
Session Attendance model
Quản lý điểm danh học sinh theo từng buổi học
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SessionAttendance(Base):
    """Điểm danh học sinh trong buổi học"""
    __tablename__ = "session_attendance"
    __table_args__ = (
        UniqueConstraint("session_id", "student_id", name="uq_session_student"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("class_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="present"
    )  # present | absent | late
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    checked_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    # Relationships
    session: Mapped["ClassSession"] = relationship(  # type: ignore[name-defined]
        "ClassSession", back_populates="attendance_records"
    )
    student: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[student_id], lazy="selectin"
    )
    checker: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[checked_by], lazy="selectin"
    )
