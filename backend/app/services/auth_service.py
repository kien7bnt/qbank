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


async def authenticate_google_user(db: AsyncSession, id_token_str: str, role_name: str = "student") -> User:
    """
    Xác thực Google ID Token trực tiếp từ Google OAuth2 tokeninfo endpoint.
    Tìm tài khoản liên kết hoặc tự động tạo tài khoản người dùng mới an toàn.
    """
    import httpx
    from fastapi import HTTPException, status
    from app.models.oauth import OAuthAccount

    # 1. Verify token with Google
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token_str}")
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Google ID Token không hợp lệ hoặc đã hết hạn"
                )
            payload = resp.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Không thể kết nối đến máy chủ Google: {str(e)}"
        )

    google_sub = payload.get("sub")
    google_email = payload.get("email")
    google_name = payload.get("name") or google_email.split("@")[0]
    google_avatar = payload.get("picture")

    if not google_sub or not google_email:
        raise HTTPException(status_code=400, detail="Token không chứa thông tin định danh Google")

    # 2. Check if OAuth account already linked
    oauth_stmt = select(OAuthAccount).where(
        OAuthAccount.provider == "google",
        OAuthAccount.provider_user_id == google_sub
    )
    oauth_res = await db.execute(oauth_stmt)
    oauth_acc = oauth_res.scalar_one_or_none()

    if oauth_acc:
        user = await get_user_by_id(db, oauth_acc.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng liên kết")
        if user.status == "locked":
            raise HTTPException(status_code=403, detail="Tài khoản này đã bị khóa")
        return user

    # 3. Check if user with this email already exists
    user = await get_user_by_email(db, google_email)
    if not user:
        # Create new user
        # Get role
        r_stmt = select(Role).where(Role.name == role_name)
        r_res = await db.execute(r_stmt)
        role = r_res.scalar_one_or_none()
        if not role:
            r_stmt = select(Role).where(Role.name == "student")
            r_res = await db.execute(r_stmt)
            role = r_res.scalar_one_or_none()

        random_pwd = uuid.uuid4().hex
        user = User(
            email=google_email,
            full_name=google_name,
            password_hash=hash_password(random_pwd),
            avatar_url=google_avatar,
            status="active",
        )
        db.add(user)
        await db.flush()

        if role:
            user_role = UserRole(user_id=user.id, role_id=role.id)
            db.add(user_role)

    # 4. Link OAuth Account
    new_oauth = OAuthAccount(
        user_id=user.id,
        provider="google",
        provider_user_id=google_sub,
        email=google_email,
        avatar_url=google_avatar,
    )
    db.add(new_oauth)
    await db.commit()
    await db.refresh(user)
    return user

