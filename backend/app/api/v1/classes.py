from __future__ import annotations
import uuid
from typing import Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.schemas.class_ import (
    ClassCreate, ClassMemberOut, ClassOut, ClassUpdate,
    JoinClassRequest, UpdateMemberRequest
)
from app.services import class_service

router = APIRouter(prefix="/classes", tags=["classes"])


def _class_to_out(c) -> ClassOut:
    return ClassOut(
        id=c.id,
        code=c.code,
        name=c.name,
        subject_id=c.subject_id,
        subject_name=c.subject.name if c.subject else None,
        teacher_id=c.teacher_id,
        teacher_name=c.teacher.full_name if c.teacher else "",
        status=c.status,
        description=c.description,
        expected_start_date=c.expected_start_date,
        expected_end_date=c.expected_end_date,
        max_students=c.max_students,
        member_count=c.member_count,
        created_at=c.created_at,
    )


@router.get("", response_model=dict)
async def list_classes(
    view: str = Query("mine", description="mine | joined"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    subject_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if view == "joined":
        items, total = await class_service.get_classes_for_student(
            db, current_user.id, page, page_size, subject_id, status, search
        )
    elif "teacher" in current_user.roles or "admin" in current_user.roles:
        items, total = await class_service.get_classes_for_teacher(
            db, current_user.id, page, page_size, subject_id, status, search
        )
    else:
        items, total = await class_service.get_classes_for_student(
            db, current_user.id, page, page_size, subject_id, status, search
        )

    return {
        "items": [_class_to_out(c) for c in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.post("", response_model=ClassOut, status_code=status.HTTP_201_CREATED)
async def create_class(
    data: ClassCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ giảng viên mới có thể tạo lớp")
    c = await class_service.create_class(db, data, current_user.id)
    return _class_to_out(c)


@router.get("/{class_id}", response_model=ClassOut)
async def get_class(
    class_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    c = await class_service.get_class(db, class_id)
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy lớp học")
    return _class_to_out(c)


@router.patch("/{class_id}", response_model=ClassOut)
async def update_class(
    class_id: uuid.UUID,
    data: ClassUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền chỉnh sửa lớp")
    is_admin = current_user.has_role("admin")
    c = await class_service.update_class(db, class_id, data, current_user.id, is_admin)
    return _class_to_out(c)


@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_class(
    class_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền xóa lớp học")
    is_admin = current_user.has_role("admin")
    deleted = await class_service.delete_class(db, class_id, current_user.id, is_admin)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy lớp học")


@router.post("/join", response_model=dict, status_code=status.HTTP_201_CREATED)
async def join_class(
    data: JoinClassRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    member = await class_service.join_class(db, data.code, current_user.id)
    return {"message": "Tham gia lớp thành công", "class_id": str(member.class_id)}


@router.get("/{class_id}/members", response_model=list[ClassMemberOut])
async def list_members(
    class_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await class_service.get_class_members(db, class_id)


@router.patch("/{class_id}/members/{user_id}", response_model=dict)
async def update_member(
    class_id: uuid.UUID,
    user_id: uuid.UUID,
    data: UpdateMemberRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền")
    member = await class_service.update_member_status(db, class_id, user_id, data.status)
    return {"message": "Cập nhật thành công", "status": member.status}


class AddMemberReq(BaseModel):
    email: str


@router.post("/{class_id}/members", response_model=ClassMemberOut, status_code=status.HTTP_201_CREATED)
async def add_member(
    class_id: uuid.UUID,
    data: AddMemberReq,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên có quyền thêm học sinh vào lớp")
    return await class_service.add_member_by_email(db, class_id, data.email)


@router.delete("/{class_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    class_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên có quyền xóa học sinh khỏi lớp")
    removed = await class_service.remove_member(db, class_id, user_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Không tìm thấy thành viên trong lớp")
