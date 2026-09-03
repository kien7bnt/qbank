"""
Distractor Generation Agent
Generates plausible wrong answers for MCQ questions
"""
from __future__ import annotations
from typing import Optional
from datetime import datetime, timezone
import json

from pydantic import BaseModel, Field

from app.ai.orchestrator import Agent, AgentOutput, AgentStatus
from app.ai.providers.base import AIProvider


class Distractor(BaseModel):
    """A distractor option"""
    text: str = Field(..., description="Distractor text")
    reason: str = Field(..., description="Why this is a plausible distractor")
    plausibility: float = Field(0.8, description="How plausible (0.0-1.0)")


class GeneratedDistracters(BaseModel):
    """Generated distractors output"""
    distractors: list[Distractor] = Field(..., description="List of generated distractors")
    reasoning: Optional[str] = Field(None, description="Overall reasoning strategy")
    common_misconceptions: Optional[list[str]] = Field(None, description="Identified misconceptions")
    confidence: float = Field(0.85, description="Confidence in distractors")


class DistractorGenerationAgent(Agent[GeneratedDistracters]):
    """Agent for generating distractors"""
    
    async def execute(
        self,
        stem: str,
        correct_answer: str,
        context: Optional[str] = None,
        topic: Optional[str] = None,
        bloom_level: Optional[str] = None,
        num_distractors: int = 3,
        **kwargs
    ) -> AgentOutput[GeneratedDistracters]:
        """Generate distractors for a question"""
        
        start_time = datetime.now(timezone.utc)
        
        system_prompt = """Bạn là chuyên gia tạo phương án sai (distractor) cho câu hỏi trắc nghiệm.
Các phương án sai phải:
- Hợp lý và hấp dẫn những học sinh không hiểu rõ
- Dựa trên các sai lầm hoặc quan niệm sai thường gặp
- Có độ dài tương tự với đáp án đúng
- Không rõ ràng sai ngay từ đầu

Mục tiêu: Tạo những phương án sai mà học sinh có thể nhầm lẫn."""
        
        prompt = self._build_prompt(
            stem, correct_answer, context, topic, bloom_level, num_distractors
        )
        
        try:
            result = await self._call_provider(
                prompt=prompt,
                system_prompt=system_prompt,
                response_format=GeneratedDistracters,
            )
            
            from app.ai.json_utils import parse_json_from_llm
            data = parse_json_from_llm(result)
            if not data or not isinstance(data, dict):
                data = {"distractors": [], "confidence": 0.8}
            output = GeneratedDistracters(**data)
            
            execution_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            
            return AgentOutput(
                status=AgentStatus.SUCCESS,
                data=output,
                confidence=output.confidence,
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
        correct_answer: str,
        context: Optional[str],
        topic: Optional[str],
        bloom_level: Optional[str],
        num_distractors: int,
    ) -> str:
        """Build prompt for distractor generation"""
        
        prompt = f"""Tạo {num_distractors} phương án sai hợp lý cho câu hỏi này:

NỘI DUNG CÂU HỎI:
{stem}

ĐÁP ÁN ĐÚNG:
{correct_answer}"""
        
        if context:
            prompt += f"\n\nBỐI CẢNH:\n{context}"
        
        if topic:
            prompt += f"\n\nCHỦ ĐỀ: {topic}"
        
        if bloom_level:
            prompt += f"\nMỨC ĐỘ: {bloom_level}"
        
        prompt += f"""

Yêu cầu: Tạo {num_distractors} phương án sai dựa trên:
1. Những sai lầm/quan niệm sai phổ biến của học sinh
2. Các phép tính sai lầm thường gặp
3. Hiểu lầm khái niệm

Định dạng JSON:
{{
  "distractors": [
    {{
      "text": "Phương án sai 1",
      "reason": "Lý do tại sao học sinh có thể chọn cái này",
      "plausibility": 0.85
    }},
    ...
  ],
  "reasoning": "Chiến lược tạo phương án sai",
  "common_misconceptions": ["Sai lầm 1", "Sai lầm 2"],
  "confidence": 0.9
}}"""
        
        return prompt
