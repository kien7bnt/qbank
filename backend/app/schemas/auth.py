from __future__ import annotations
from pydantic import BaseModel, EmailStr, field_validator
import uuid
from datetime import datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: str = "student"  # admin | teacher | student

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Mật khẩu phải có ít nhất 6 ký tự")
        return v


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    status: str
    roles: list[str]
    avatar_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class RefreshRequest(BaseModel):
    refresh_token: str


class GoogleLoginRequest(BaseModel):
    id_token: str
    role: str = "student"  # Default role for new users

