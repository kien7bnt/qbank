"""
API Routers for Class Sessions and Session Materials
"""
from __future__ import annotations
import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.schemas.session import (
    ClassSessionCreate,
    ClassSessionUpdate,
    ClassSessionOut,
    SessionMaterialOut,
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
    """Lấy danh sách buổi học trong lớp (kèm tài liệu và bài tập)"""
    return await session_service.list_sessions(db, class_id, current_user)


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


@router.get("/materials/{material_id}/download")
async def download_material(
    material_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Tải tài liệu (có xác thực quyền truy cập lớp học)"""
    material = await session_service.get_material(db, material_id, current_user)
    if not os.path.exists(material.file_path):
        raise HTTPException(status_code=404, detail="File không tồn tại trên hệ thống lưu trữ")

    return FileResponse(
        path=material.file_path,
        filename=material.file_name,
        media_type="application/octet-stream",
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
