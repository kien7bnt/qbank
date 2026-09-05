from __future__ import annotations
from typing import Annotated, Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import AsyncSessionLocal

bearer_scheme = HTTPBearer(auto_error=False)


async def get_db() -> AsyncSession:  # type: ignore[misc]
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


DBDep = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: DBDep,
):
    from app.models.user import User, UserRole, Role
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    import uuid

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Không thể xác thực thông tin đăng nhập",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise credentials_exception

    payload = decode_token(credentials.credentials)
    if payload is None or payload.get("type") != "access":
        raise credentials_exception

    user_id_str: str | None = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise credentials_exception

    stmt = (
        select(User)
        .options(selectinload(User.user_roles).selectinload(UserRole.role))
        .where(User.id == user_id)
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception
    if user.status == "locked":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị khóa",
        )

    # Auto-ensure user has both teacher and student roles if teacher is missing
    existing_roles = {ur.role.name for ur in user.user_roles if ur.role}
    if "teacher" not in existing_roles:
        for r_name in ["teacher", "student"]:
            if r_name not in existing_roles:
                r_res = await db.execute(select(Role).where(Role.name == r_name))
                role_obj = r_res.scalar_one_or_none()
                if role_obj:
                    db.add(UserRole(user_id=user.id, role_id=role_obj.id))
        await db.commit()
        # Reload user with updated roles
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

    return user


CurrentUser = Annotated[object, Depends(get_current_user)]


def require_roles(*roles: str) -> Callable:
    async def checker(current_user=Depends(get_current_user)):
        user_roles = [ur.role.name for ur in current_user.user_roles]
        if not any(r in user_roles for r in roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền thực hiện thao tác này",
            )
        return current_user
    return checker
