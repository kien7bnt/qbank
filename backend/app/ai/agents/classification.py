"""
Question Classification Agent
Classifies questions into curriculum structure and metadata
"""
from __future__ import annotations
from typing import Optional
from datetime import datetime, timezone
import json

from pydantic import BaseModel, Field

from app.ai.orchestrator import Agent, AgentOutput, AgentStatus
from app.ai.providers.base import AIProvider


class QuestionClassification(BaseModel):
    """Classification output"""
    subject: str = Field(..., description="Subject name")
    chapter: Optional[str] = Field(None, description="Chapter name")
    topic: str = Field(..., description="Topic name")
    bloom_level: str = Field(..., description="Bloom taxonomy level")
    expected_difficulty: str = Field(..., description="Difficulty level")
    question_type: str = Field(..., description="Question type: mcq, essay, coding")
    learning_objectives: Optional[list[str]] = Field(None, description="Learning objectives")
    confidence: float = Field(0.8, description="AI confidence in classification")
    reasoning: Optional[str] = Field(None, description="Reasoning behind classification")


class QuestionClassificationAgent(Agent[QuestionClassification]):
    """Agent for classifying questions"""
    
    def __init__(
        self,
        provider: AIProvider,
        curriculum_data: Optional[dict] = None,
        **kwargs
    ):
        super().__init__("classification", provider, **kwargs)
        self.curriculum_data = curriculum_data or {}
    
    async def execute(
        self,
        stem: str,
        options: Optional[list[dict]] = None,
        correct_answer: Optional[str] = None,
        essay_data: Optional[dict] = None,
        coding_data: Optional[dict] = None,
        **kwargs
    ) -> AgentOutput[QuestionClassification]:
        """Classify a question"""
        
        start_time = datetime.now(timezone.utc)
        
        system_prompt = """Bạn là chuyên gia phân loại câu hỏi giáo dục.
Phân loại câu hỏi theo:
- Cấu trúc chương trình học (Môn > Chương > Chủ đề)
- Mức độ Bloom
- Độ khó
- Loại câu hỏi
- Mục tiêu học tập

Hãy phân loại chính xác và cung cấp độ tin cậy cao."""
        
        prompt = self._build_prompt(stem, options, correct_answer, essay_data, coding_data)
        
        try:
            result = await self._call_provider(
                prompt=prompt,
                system_prompt=system_prompt,
                response_format=QuestionClassification,
            )
            
            from app.ai.json_utils import parse_json_from_llm
            data = parse_json_from_llm(result)
            if not data or not isinstance(data, dict):
                data = {
                    "subject": "General",
                    "topic": "General",
                    "bloom_level": "understand",
                    "expected_difficulty": "medium",
                    "question_type": "mcq",
                }
            classification = QuestionClassification(**data)
            
            execution_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            
            return AgentOutput(
                status=AgentStatus.SUCCESS,
                data=classification,
                confidence=classification.confidence,
                execution_time_ms=execution_time,
            )
        
        except Exception as e:
            execution_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            return AgentOutput(
                status=AgentStatus.FAILED,
                error=str(e),
                execution_time_ms=execution_time,
            )
    
    def _build_prompt(
        self,
        stem: str,
        options: Optional[list[dict]],
        correct_answer: Optional[str],
        essay_data: Optional[dict],
        coding_data: Optional[dict],
    ) -> str:
        """Build prompt for classification"""
        
        prompt = f"""Hãy phân loại câu hỏi sau:

NỘI DUNG CÂU HỎI:
{stem}"""
        
        if options:
            prompt += "\n\nCÁC PHƯƠNG ÁN:\n"
            for opt in options:
                marker = "[✓]" if opt.get("is_correct") else "[ ]"
                prompt += f"{marker} {opt.get('label', '')}: {opt.get('text', '')}\n"
        
        if correct_answer:
            prompt += f"\nĐÁP ÁN ĐÚNG: {correct_answer}"
        
        if essay_data:
            prompt += f"\nDỮ LIỆU BÀI LUẬN:\n{json.dumps(essay_data, ensure_ascii=False)}"
        
        if coding_data:
            prompt += f"\nDỮ LIỆU LẬP TRÌNH:\n{json.dumps(coding_data, ensure_ascii=False)}"
        
        prompt += """

Trả về JSON với cấu trúc:
{
  "subject": "Tên môn học",
  "chapter": "Tên chương",
  "topic": "Tên chủ đề",
  "bloom_level": "remember|understand|apply|analyze|evaluate|create",
  "expected_difficulty": "easy|medium|hard",
  "question_type": "mcq|essay|coding",
  "learning_objectives": ["Mục tiêu 1", "Mục tiêu 2"],
  "confidence": 0.85,
  "reasoning": "Lý do phân loại"
}"""
        
        return prompt
