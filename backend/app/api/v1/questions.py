from __future__ import annotations
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.schemas.question import (
    BulkActionRequest,
    PaginatedQuestions,
    QuestionCreate,
    QuestionListItem,
    QuestionOut,
    QuestionUpdate,
    QuestionVersionOut,
)
from app.services import question_service

router = APIRouter(prefix="/questions", tags=["questions"])


def _question_to_list_item(q) -> QuestionListItem:
    return QuestionListItem(
        id=q.id,
        item_id=q.item_id,
        type=q.type,
        status=q.status,
        stem_preview=q.stem[:100] + ("..." if len(q.stem) > 100 else ""),
        bloom_level=q.bloom_level,
        expected_difficulty=q.expected_difficulty,
        subject_name=q.subject.name if q.subject else None,
        chapter_name=q.chapter.name if q.chapter else None,
        topic_name=q.topic.name if q.topic else None,
        created_at=q.created_at,
    )


def _question_to_out(q) -> QuestionOut:
    from app.schemas.question import (
        EssayDataOut, CodingDataOut, QuestionOptionOut
    )
    return QuestionOut(
        id=q.id,
        item_id=q.item_id,
        type=q.type,
        status=q.status,
        stem=q.stem,
        rationale=q.rationale,
        subject_id=q.subject_id,
        subject_name=q.subject.name if q.subject else None,
        chapter_id=q.chapter_id,
        chapter_name=q.chapter.name if q.chapter else None,
        topic_id=q.topic_id,
        topic_name=q.topic.name if q.topic else None,
        bloom_level=q.bloom_level,
        expected_difficulty=q.expected_difficulty,
        options=[
            QuestionOptionOut(
                id=o.id,
                question_id=o.question_id,
                label=o.label,
                text=o.text,
                is_correct=o.is_correct,
                distractor_reason=o.distractor_reason,
                order_index=o.order_index,
            )
            for o in q.options
        ],
        essay_data=EssayDataOut.model_validate(q.essay_data) if q.essay_data else None,
        coding_data=CodingDataOut.model_validate(q.coding_data) if q.coding_data else None,
        version=q.version,
        created_by=q.created_by,
        created_at=q.created_at,
        updated_at=q.updated_at,
    )


@router.get("", response_model=PaginatedQuestions)
async def list_questions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type: Optional[str] = None,
    status: Optional[str] = None,
    subject_id: Optional[uuid.UUID] = None,
    chapter_id: Optional[uuid.UUID] = None,
    topic_id: Optional[uuid.UUID] = None,
    bloom_level: Optional[str] = None,
    difficulty: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    items, total = await question_service.list_questions(
        db=db,
        page=page,
        page_size=page_size,
        type=type,
        status=status,
        subject_id=subject_id,
        chapter_id=chapter_id,
        topic_id=topic_id,
        bloom_level=bloom_level,
        difficulty=difficulty,
        search=search,
    )
    return PaginatedQuestions(
        items=[_question_to_list_item(q) for q in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.post("", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
async def create_question(
    data: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền tạo câu hỏi")
    q = await question_service.create_question(db, data, current_user.id)
    return _question_to_out(q)


@router.get("/{question_id}", response_model=QuestionOut)
async def get_question(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = await question_service.get_question(db, question_id)
    if not q:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy câu hỏi")
    return _question_to_out(q)


@router.patch("/{question_id}", response_model=QuestionOut)
async def update_question(
    question_id: uuid.UUID,
    data: QuestionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền")
    q = await question_service.update_question(db, question_id, data, current_user.id)
    return _question_to_out(q)


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền")
    deleted = await question_service.delete_question(db, question_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy câu hỏi")


@router.post("/bulk-action", response_model=dict)
async def bulk_action(
    data: BulkActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền")
    result = await question_service.bulk_action(db, data, current_user.id)
    return result


@router.get("/{question_id}/versions", response_model=list[QuestionVersionOut])
async def get_versions(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    versions = await question_service.get_question_versions(db, question_id)
    return [QuestionVersionOut.model_validate(v) for v in versions]
