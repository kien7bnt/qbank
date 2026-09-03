from __future__ import annotations
import uuid
from typing import Optional, List
from datetime import datetime

from pydantic import BaseModel, Field


class DocumentCreate(BaseModel):
    title: str = Field(..., description="Tên tài liệu")
    description: Optional[str] = Field(None, description="Mô tả tài liệu")
    topic_tag: Optional[str] = Field(None, description="Chủ đề / Nhãn phân loại")


class DocumentOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: Optional[str] = None
    original_filename: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    file_size_kb: Optional[float] = None
    topic_tag: Optional[str] = None
    chunk_count: int
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentListItem(BaseModel):
    id: uuid.UUID
    title: str
    description: Optional[str] = None
    original_filename: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    file_size_kb: Optional[float] = None
    topic_tag: Optional[str] = None
    chunk_count: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TopicTagItem(BaseModel):
    topic_tag: str
    document_count: int
