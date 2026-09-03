from __future__ import annotations
import uuid
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.schemas.curriculum import (
    ChapterCreate, ChapterOut,
    CurriculumTree,
    LearningObjectiveCreate, LearningObjectiveOut,
    LessonCreate, LessonOut,
    SubjectCreate, SubjectOut,
    TopicCreate, TopicOut,
)
from app.services import curriculum_service

router = APIRouter(prefix="/curriculum", tags=["curriculum"])


class DomainCreateReq(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None


class TopicCreateReq(BaseModel):
    name: str = Field(..., max_length=255)


# ─── Lĩnh Vực (Domains) & Chủ Đề (Topics) Endpoints ──────────────────────────

@router.get("/domains")
async def list_domains_with_topics(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Lấy danh sách tất cả các Lĩnh vực và Chủ đề kèm số lượng câu hỏi"""
    return await curriculum_service.list_domains_with_topics(db)


@router.post("/domains", status_code=status.HTTP_201_CREATED)
async def create_domain(
    data: DomainCreateReq,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.has_role("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Không có quyền tạo lĩnh vực")
    return await curriculum_service.create_domain(db, data.name, data.description)


@router.put("/domains/{domain_id}")
async def update_domain(
    domain_id: uuid.UUID,
    data: DomainCreateReq,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.has_role("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Không có quyền sửa lĩnh vực")
    updated = await curriculum_service.update_domain(db, domain_id, data.name, data.description)
    if not updated:
        raise HTTPException(status_code=404, detail="Không tìm thấy lĩnh vực")
    return {"status": "updated"}


@router.delete("/domains/{domain_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_domain(
    domain_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.has_role("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Không có quyền xóa lĩnh vực")
    deleted = await curriculum_service.delete_domain(db, domain_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Không tìm thấy lĩnh vực")


@router.post("/domains/{domain_id}/topics", status_code=status.HTTP_201_CREATED)
async def create_topic_under_domain(
    domain_id: uuid.UUID,
    data: TopicCreateReq,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.has_role("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Không có quyền tạo chủ đề")
    return await curriculum_service.create_topic_under_domain(db, domain_id, data.name)


@router.put("/topics/{topic_id}")
async def update_topic(
    topic_id: uuid.UUID,
    data: TopicCreateReq,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.has_role("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Không có quyền sửa chủ đề")
    updated = await curriculum_service.update_topic(db, topic_id, data.name)
    if not updated:
        raise HTTPException(status_code=404, detail="Không tìm thấy chủ đề")
    return {"status": "updated"}


@router.delete("/topics/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_topic(
    topic_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.has_role("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Không có quyền xóa chủ đề")
    deleted = await curriculum_service.delete_topic(db, topic_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Không tìm thấy chủ đề")


# ─── Legacy Curriculum Endpoints ─────────────────────────────────────────────

@router.get("/subjects", response_model=list[SubjectOut])
async def list_subjects(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    subjects = await curriculum_service.get_subjects(db)
    return [SubjectOut.model_validate(s) for s in subjects]


@router.get("/subjects/{subject_id}/tree", response_model=CurriculumTree)
async def get_subject_tree(
    subject_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tree = await curriculum_service.get_subject_tree(db, subject_id)
    if not tree:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy môn học")
    return tree
