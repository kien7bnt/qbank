from __future__ import annotations
from typing import List, Optional
import uuid

from pydantic import BaseModel


class SubjectCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None


class SubjectOut(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    description: Optional[str] = None
    is_active: bool

    model_config = {"from_attributes": True}


class ChapterCreate(BaseModel):
    subject_id: uuid.UUID
    name: str
    order_index: int = 0
    description: Optional[str] = None


class ChapterOut(BaseModel):
    id: uuid.UUID
    subject_id: uuid.UUID
    name: str
    order_index: int
    description: Optional[str] = None

    model_config = {"from_attributes": True}


class TopicCreate(BaseModel):
    chapter_id: uuid.UUID
    name: str
    order_index: int = 0


class TopicOut(BaseModel):
    id: uuid.UUID
    chapter_id: uuid.UUID
    name: str
    order_index: int

    model_config = {"from_attributes": True}


class LessonCreate(BaseModel):
    topic_id: uuid.UUID
    name: str
    order_index: int = 0


class LessonOut(BaseModel):
    id: uuid.UUID
    topic_id: uuid.UUID
    name: str
    order_index: int

    model_config = {"from_attributes": True}


class LearningObjectiveCreate(BaseModel):
    lesson_id: uuid.UUID
    description: str
    bloom_level: str


class LearningObjectiveOut(BaseModel):
    id: uuid.UUID
    lesson_id: uuid.UUID
    description: str
    bloom_level: str

    model_config = {"from_attributes": True}


# Nested tree structures
class LearningObjectiveNode(LearningObjectiveOut):
    pass


class LessonNode(LessonOut):
    learning_objectives: List[LearningObjectiveNode] = []


class TopicNode(TopicOut):
    lessons: List[LessonNode] = []


class ChapterNode(ChapterOut):
    topics: List[TopicNode] = []


class CurriculumTree(BaseModel):
    subject: SubjectOut
    chapters: List[ChapterNode] = []
