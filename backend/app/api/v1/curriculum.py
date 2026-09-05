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
    user_id = None if current_user.has_role("admin") else current_user.id
    return await curriculum_service.list_domains_with_topics(db, user_id=user_id)


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


# ─── Full Tree & Node Management Endpoints ────────────────────────────────────

@router.get("/tree")
async def get_full_tree(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Lấy toàn bộ cây Ngân hàng Câu hỏi kèm số lượng câu hỏi động tại từng cấp"""
    return await curriculum_service.get_full_curriculum_tree(db)


class NodeCreateReq(BaseModel):
    node_type: str = Field(..., description="subject | chapter | topic | lesson")
    name: str = Field(..., max_length=255)
    code: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    order_index: int = 1


@router.post("/nodes", status_code=status.HTTP_201_CREATED)
async def create_node(
    data: NodeCreateReq,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Tạo mới một node trong cây ngân hàng câu hỏi"""
    if not current_user.has_role("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên/admin mới có quyền tạo node")

    nt = data.node_type.lower()
    if nt == "subject":
        from app.models.curriculum import Subject
        sub = Subject(name=data.name.strip(), code=data.code or data.name[:4].upper(), description=data.description)
        db.add(sub)
        await db.commit()
        return {"id": str(sub.id), "name": sub.name, "type": "subject"}
    elif nt == "chapter":
        if not data.parent_id:
            # Assign to first subject or create default
            sub = await curriculum_service.get_default_subject(db)
            data.parent_id = sub.id
        from app.models.curriculum import Chapter
        ch = Chapter(name=data.name.strip(), subject_id=data.parent_id, description=data.description, order_index=data.order_index)
        db.add(ch)
        await db.commit()
        return {"id": str(ch.id), "name": ch.name, "type": "chapter"}
    elif nt == "topic":
        if not data.parent_id:
            raise HTTPException(status_code=400, detail="Chủ đề cần thuộc về một Chương (parent_id)")
        from app.models.curriculum import Topic
        tp = Topic(name=data.name.strip(), chapter_id=data.parent_id, order_index=data.order_index)
        db.add(tp)
        await db.commit()
        return {"id": str(tp.id), "name": tp.name, "type": "topic"}
    elif nt == "lesson":
        if not data.parent_id:
            raise HTTPException(status_code=400, detail="Bài học cần thuộc về một Chủ đề (parent_id)")
        from app.models.curriculum import Lesson
        ls = Lesson(name=data.name.strip(), topic_id=data.parent_id, order_index=data.order_index)
        db.add(ls)
        await db.commit()
        return {"id": str(ls.id), "name": ls.name, "type": "lesson"}
    else:
        raise HTTPException(status_code=400, detail=f"Loại node không hợp lệ: {data.node_type}")


@router.delete("/nodes/{node_type}/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_node(
    node_type: str,
    node_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Xóa node trong cây ngân hàng câu hỏi"""
    if not current_user.has_role("admin", "teacher"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên/admin mới có quyền xóa node")
    success = await curriculum_service.delete_curriculum_node(db, node_type.lower(), node_id)
    if not success:
        raise HTTPException(status_code=404, detail="Không tìm thấy node để xóa")

