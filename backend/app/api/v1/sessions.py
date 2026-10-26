"""
API Routers for Class Sessions and Session Materials
"""
from __future__ import annotations
import os
import uuid
import mimetypes
from urllib.parse import quote
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Query, status
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user, bearer_scheme
from app.core.security import decode_token
from app.models.user import User
from app.schemas.session import (
    ClassSessionCreate,
    ClassSessionUpdate,
    ClassSessionOut,
    SessionMaterialOut,
    MaterialsFromLibraryIn,
)
from app.services import session_service

router = APIRouter(tags=["sessions"])


# ─── Sessions Endpoints ───────────────────────────────────────────────────────

@router.get("/classes/{class_id}/sessions", response_model=List[ClassSessionOut])
async def list_class_sessions(
    class_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Lấy danh sách buổi học trong lớp (kèm tài liệu, bài tập và tóm tắt điểm danh)"""
    from app.services.attendance_service import compute_attendance_summary
    sessions = await session_service.list_sessions(db, class_id, current_user)
    result = []
    for s in sessions:
        out = ClassSessionOut.model_validate(s)
        out.attendance_summary = compute_attendance_summary(s.attendance_records)
        result.append(out)
    return result


@router.post("/classes/{class_id}/sessions", response_model=ClassSessionOut, status_code=status.HTTP_201_CREATED)
async def create_class_session(
    class_id: uuid.UUID,
    data: ClassSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Tạo buổi học mới trong lớp học"""
    return await session_service.create_session(db, class_id, data, current_user)


@router.get("/sessions/{session_id}", response_model=ClassSessionOut)
async def get_session_detail(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Xem chi tiết một buổi học"""
    return await session_service.get_session(db, session_id, current_user)


@router.put("/sessions/{session_id}", response_model=ClassSessionOut)
@router.patch("/sessions/{session_id}", response_model=ClassSessionOut)
async def update_class_session(
    session_id: uuid.UUID,
    data: ClassSessionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Cập nhật thông tin buổi học"""
    return await session_service.update_session(db, session_id, data, current_user)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_class_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Xóa buổi học"""
    await session_service.delete_session(db, session_id, current_user)


# ─── Materials Endpoints ─────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/materials", response_model=SessionMaterialOut, status_code=status.HTTP_201_CREATED)
async def upload_material(
    session_id: uuid.UUID,
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    is_public: bool = Form(True),
    order_index: int = Form(1),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Upload tài liệu vào buổi học (PDF, DOCX, XLSX, PPTX, Ảnh, ZIP)"""
    return await session_service.upload_session_material(
        db,
        session_id=session_id,
        file=file,
        title=title,
        description=description,
        is_public=is_public,
        order_index=order_index,
        user=current_user,
    )


@router.post("/sessions/{session_id}/materials/from-library", response_model=List[SessionMaterialOut], status_code=status.HTTP_201_CREATED)
async def add_materials_from_library(
    session_id: uuid.UUID,
    data: MaterialsFromLibraryIn,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Chọn và đính kèm tài liệu từ Kho tài liệu cá nhân vào buổi học"""
    return await session_service.add_materials_from_library(
        db,
        session_id=session_id,
        document_ids=data.document_ids,
        is_public=data.is_public,
        user=current_user,
    )


@router.get("/materials/{material_id}/download")
async def download_material(
    material_id: uuid.UUID,
    token: Optional[str] = Query(None),
    inline: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
):
    """
    Tải hoặc xem trước tài liệu buổi học.
    Hỗ trợ cả Bearer header (từ frontend axios) và token trong Query Param (từ thẻ <a> / tab mới).
    """
    # 1. Xác thực người dùng qua Header hoặc Query Param
    raw_token = credentials.credentials if credentials else token
    user = None
    if raw_token:
        try:
            payload = decode_token(raw_token)
            if payload and payload.get("type") == "access":
                user_id_str = payload.get("sub")
                if user_id_str:
                    u_id = uuid.UUID(user_id_str)
                    stmt = select(User).where(User.id == u_id)
                    res = await db.execute(stmt)
                    user = res.scalar_one_or_none()
        except Exception:
            user = None

    # 2. Lấy thông tin tài liệu & kiểm tra quyền
    if user is not None:
        material = await session_service.get_material(db, material_id, user)
    else:
        material = await session_service.get_material_raw(db, material_id)
        if not material.is_public:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Vui lòng đăng nhập để tải tài liệu này",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # 3. Định vị file thực tế trên hệ thống lưu trữ
    file_path = session_service.resolve_material_file_path(material)
    if not file_path or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File không tồn tại trên hệ thống lưu trữ")

    # 4. Xác định mime_type
    mime_type, _ = mimetypes.guess_type(material.file_name)
    if not mime_type:
        mime_type = "application/octet-stream"

    # 5. Header Content-Disposition an toàn UTF-8 RFC 5987
    disposition = "inline" if inline else "attachment"
    encoded_filename = quote(material.file_name)
    headers = {
        "Content-Disposition": f"{disposition}; filename=\"{material.file_name}\"; filename*=UTF-8''{encoded_filename}"
    }

    return FileResponse(
        path=str(file_path),
        filename=material.file_name,
        media_type=mime_type,
        headers=headers,
    )


@router.patch("/materials/{material_id}/visibility", response_model=SessionMaterialOut)
async def toggle_material_visibility(
    material_id: uuid.UUID,
    is_public: bool,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Cập nhật trạng thái hiển thị của tài liệu (Công khai / Chỉ giáo viên)"""
    return await session_service.toggle_material_visibility(db, material_id, is_public, current_user)


@router.delete("/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_material(
    material_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Xóa tài liệu khỏi buổi học"""
    await session_service.delete_material(db, material_id, current_user)
