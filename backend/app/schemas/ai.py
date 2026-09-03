from __future__ import annotations
import uuid
from typing import Optional, List
from pydantic import BaseModel, Field


class GenerateQuestionRequest(BaseModel):
    prompt: Optional[str] = Field(None, description="Prompt yêu cầu tạo câu hỏi")
    subject: Optional[str] = Field(None, description="Môn học")
    topic: Optional[str] = Field(None, description="Chủ đề")
    chapter: Optional[str] = Field(None, description="Chương")
    bloom_level: Optional[str] = Field(None, description="Mức độ Bloom")
    expected_difficulty: Optional[str] = Field(None, description="Độ khó dự kiến")
    question_type: str = Field("mcq", description="Loại câu hỏi")
    learning_objectives: Optional[list[str]] = Field(None, description="Mục tiêu học tập")
    context: Optional[str] = Field(None, description="Bối cảnh/Hạn chế")
    auto_save: bool = Field(False, description="Tự động lưu vào DB")


class ClassifyQuestionRequest(BaseModel):
    stem: str
    options: Optional[list[dict]] = None
    correct_answer: Optional[str] = None
    essay_data: Optional[dict] = None
    coding_data: Optional[dict] = None


class GenerateDistractorsRequest(BaseModel):
    stem: str
    correct_answer: str
    context: Optional[str] = None
    topic: Optional[str] = None
    bloom_level: Optional[str] = None
    num_distractors: int = 3


class ReviewQuestionRequest(BaseModel):
    stem: str
    options: Optional[list[dict]] = None
    correct_answer: Optional[str] = None
    rationale: Optional[str] = None
    essay_data: Optional[dict] = None
    coding_data: Optional[dict] = None
    bloom_level: Optional[str] = None
    question_type: str = "mcq"


# ─── Improve Question ─────────────────────────────────────────────────────────

class ImproveQuestionRequest(BaseModel):
    """Cải thiện câu hỏi AI theo yêu cầu bổ sung của người dùng"""
    # Câu hỏi gốc
    original_stem: str = Field(..., description="Nội dung câu hỏi gốc")
    original_options: Optional[list[dict]] = Field(None, description="Các phương án gốc")
    original_rationale: Optional[str] = Field(None, description="Giải thích gốc")
    original_bloom_level: Optional[str] = Field(None, description="Mức Bloom gốc")
    original_difficulty: Optional[str] = Field(None, description="Độ khó gốc")
    question_type: str = Field("mcq", description="Loại câu hỏi")
    # Yêu cầu cải thiện của người dùng
    improvement_prompt: str = Field(
        ...,
        description="Yêu cầu cải thiện câu hỏi, ví dụ: 'Làm câu hỏi khó hơn', 'Thêm bẫy về dấu âm'",
    )
    rules: Optional[str] = Field(None, description="Quy tắc sư phạm tùy biến (nếu có)")


# ─── Generate From Document ───────────────────────────────────────────────────

class GenerateFromDocumentRequest(BaseModel):
    """Sinh câu hỏi từ kho tài liệu cá nhân của user"""
    document_ids: List[uuid.UUID] = Field(
        ..., description="Danh sách ID tài liệu cần dùng làm ngữ liệu"
    )
    question_type: str = Field("mcq", description="Loại câu hỏi")
    bloom_level: str = Field("understand", description="Mức độ Bloom")
    expected_difficulty: str = Field("medium", description="Độ khó")
    num_questions: int = Field(1, ge=1, le=5, description="Số câu hỏi cần sinh (tối đa 5)")
    extra_prompt: Optional[str] = Field(
        None, description="Yêu cầu bổ sung, ví dụ: 'Tập trung vào chương 3'"
    )
    topic_id: Optional[uuid.UUID] = Field(None, description="Gắn vào chủ đề trong NCHQ")
    chapter_id: Optional[uuid.UUID] = Field(None, description="Gắn vào chương trong NCHQ")
    auto_save: bool = Field(False, description="Tự động lưu vào NCHQ sau khi sinh")
    rules: Optional[str] = Field(None, description="Quy tắc sư phạm tùy biến (nếu có)")


# ─── Rules Management ─────────────────────────────────────────────────────────

class RuleUpdateReq(BaseModel):
    content: str = Field(..., description="Nội dung file rule.md (Markdown)")

