from __future__ import annotations
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.models.user import Role, User, UserRole
from app.schemas.auth import RegisterRequest


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def authenticate_user(db: AsyncSession, email: str, password: str) -> Optional[User]:
    user = await get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


async def create_user(db: AsyncSession, data: RegisterRequest) -> User:
    # Check duplicate email
    existing = await get_user_by_email(db, data.email)
    if existing:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email đã được đăng ký"
        )

    # Get or create role
    result = await db.execute(select(Role).where(Role.name == data.role))
    role = result.scalar_one_or_none()
    if not role:
        result = await db.execute(select(Role).where(Role.name == "student"))
        role = result.scalar_one_or_none()

    user = User(
        email=data.email,
        full_name=data.full_name,
        password_hash=hash_password(data.password),
        status="active",
    )
    db.add(user)
    await db.flush()  # Get user.id

    if role:
        user_role = UserRole(user_id=user.id, role_id=role.id)
        db.add(user_role)

    await db.commit()
    await db.refresh(user)
    return user
