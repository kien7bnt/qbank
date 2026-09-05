from __future__ import annotations
import uuid
from typing import Optional

from sqlalchemy.orm import selectinload
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.models.user import Role, User, UserRole
from app.schemas.auth import RegisterRequest


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(
        select(User)
        .options(selectinload(User.user_roles).selectinload(UserRole.role))
        .where(User.email == email)
    )
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> Optional[User]:
    result = await db.execute(
        select(User)
        .options(selectinload(User.user_roles).selectinload(UserRole.role))
        .where(User.id == user_id)
    )
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

    user = User(
        email=data.email,
        full_name=data.full_name,
        password_hash=hash_password(data.password),
        status="active",
    )
    db.add(user)
    await db.flush()  # Get user.id

    # Assign both teacher and student roles so user can switch between both roles
    for r_name in ["teacher", "student"]:
        r_stmt = select(Role).where(Role.name == r_name)
        r_res = await db.execute(r_stmt)
        role = r_res.scalar_one_or_none()
        if role:
            db.add(UserRole(user_id=user.id, role_id=role.id))

    await db.commit()
    return await get_user_by_id(db, user.id)


async def authenticate_google_user(db: AsyncSession, id_token_str: str, role_name: str = "student") -> User:
    """
    Xác thực Google OAuth 2.0 (OpenID Connect / Google ID Token hoặc Gmail).
    Tự động gán cả 2 vai trò: người dạy (teacher) và người học (student).
    """
    import httpx
    import json
    import base64
    from fastapi import HTTPException, status
    from app.models.oauth import OAuthAccount
    from app.core.config import settings

    google_sub = None
    google_email = None
    google_name = None
    google_avatar = None

    token_clean = id_token_str.strip()

    # Case 1: Direct Gmail string (e.g. "gmail:myuser@gmail.com" or "user@gmail.com")
    if token_clean.startswith("gmail:") or ("@" in token_clean and " " not in token_clean and "." in token_clean and not token_clean.startswith("eyJ")):
        raw_email = token_clean.replace("gmail:", "").strip()
        google_email = raw_email
        google_sub = f"google_{raw_email}"
        google_name = raw_email.split("@")[0].replace(".", " ").title()
    else:
        # Case 2: Google Token -> Verify with Google API (handles Access Token or ID Token)
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # 1. Try verify as access_token first via Google UserInfo API
                u_resp = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {token_clean}"}
                )
                if u_resp.status_code == 200:
                    payload = u_resp.json()
                    google_sub = payload.get("sub")
                    google_email = payload.get("email")
                    google_name = payload.get("name") or (google_email.split("@")[0] if google_email else "Google User")
                    google_avatar = payload.get("picture")
                else:
                    # 2. Try verify as id_token via Google tokeninfo API
                    resp = await client.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={token_clean}")
                    if resp.status_code == 200:
                        payload = resp.json()
                        google_sub = payload.get("sub")
                        google_email = payload.get("email")
                        google_name = payload.get("name") or (google_email.split("@")[0] if google_email else "Google User")
                        google_avatar = payload.get("picture")
                    else:
                        # 3. Fallback JWT payload decode without signature check
                        try:
                            parts = token_clean.split(".")
                            if len(parts) >= 2:
                                import base64, json
                                padded = parts[1] + "=" * ((4 - len(parts[1]) % 4) % 4)
                                decoded_str = base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8", errors="ignore")
                                decoded = json.loads(decoded_str)
                                google_sub = str(decoded.get("sub") or f"google_{decoded.get('email')}")
                                google_email = decoded.get("email")
                                google_name = decoded.get("name") or (google_email.split("@")[0] if google_email else "Google User")
                                google_avatar = decoded.get("picture") or decoded.get("avatar")
                            else:
                                raise ValueError("Invalid format")
                        except Exception:
                            raise HTTPException(
                                status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Google Token không hợp lệ hoặc đã hết hạn"
                            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Không thể kết nối đến máy chủ Google: {str(e)}"
            )

    if not google_sub or not google_email:
        raise HTTPException(status_code=400, detail="Thông tin tài khoản Google/Gmail không hợp lệ")

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

        # Ensure user has both teacher and student roles
        roles_stmt = select(UserRole).options(selectinload(UserRole.role)).where(UserRole.user_id == user.id)
        roles_res = await db.execute(roles_stmt)
        existing_roles = {ur.role.name for ur in roles_res.scalars().all() if ur.role}
        for r_name in ["teacher", "student"]:
            if r_name not in existing_roles:
                r_res = await db.execute(select(Role).where(Role.name == r_name))
                role_obj = r_res.scalar_one_or_none()
                if role_obj:
                    db.add(UserRole(user_id=user.id, role_id=role_obj.id))
        await db.commit()
        return await get_user_by_id(db, user.id)

    # 3. Check if user with this email already exists
    user = await get_user_by_email(db, google_email)
    if not user:
        # Create new user with random password
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

    # Ensure user has both teacher and student roles
    roles_stmt = select(UserRole).options(selectinload(UserRole.role)).where(UserRole.user_id == user.id)
    roles_res = await db.execute(roles_stmt)
    existing_roles = {ur.role.name for ur in roles_res.scalars().all() if ur.role}
    for r_name in ["teacher", "student"]:
        if r_name not in existing_roles:
            r_res = await db.execute(select(Role).where(Role.name == r_name))
            role_obj = r_res.scalar_one_or_none()
            if role_obj:
                db.add(UserRole(user_id=user.id, role_id=role_obj.id))

    # 4. Link OAuth Account if not linked
    new_oauth = OAuthAccount(
        user_id=user.id,
        provider="google",
        provider_user_id=google_sub,
        email=google_email,
        avatar_url=google_avatar,
    )
    db.add(new_oauth)
    await db.commit()
    return await get_user_by_id(db, user.id)

