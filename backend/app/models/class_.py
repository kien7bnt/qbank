from __future__ import annotations
import random
import string
import uuid
from datetime import date, datetime, timezone
from typing import List

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def generate_class_code(length: int = 6) -> str:
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=length))


class Class(Base):
    __tablename__ = "classes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    subject_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    expected_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expected_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    max_students: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    members: Mapped[List["ClassMember"]] = relationship(
        back_populates="class_", cascade="all, delete-orphan", lazy="selectin"
    )
    sessions: Mapped[List["ClassSession"]] = relationship(  # type: ignore[name-defined]
        "ClassSession", back_populates="class_", cascade="all, delete-orphan", order_by="ClassSession.order_index"
    )
    teacher: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[teacher_id], lazy="selectin"
    )
    subject: Mapped["Subject | None"] = relationship(  # type: ignore[name-defined]
        "Subject", foreign_keys=[subject_id], lazy="selectin"
    )

    @property
    def member_count(self) -> int:
        try:
            return len([m for m in self.members if m.status == "active"])
        except Exception:
            return 0


class ClassMember(Base):
    __tablename__ = "class_members"
    __table_args__ = (UniqueConstraint("class_id", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    class_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="student")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    class_: Mapped["Class"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship("User", lazy="selectin")  # type: ignore[name-defined]
