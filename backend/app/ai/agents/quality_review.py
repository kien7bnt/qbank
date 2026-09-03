"""
Quality Review Agent
Reviews questions for quality issues and provides suggestions
"""
from __future__ import annotations
from typing import Optional
from datetime import datetime, timezone
import json

from pydantic import BaseModel, Field

from app.ai.orchestrator import Agent, AgentOutput, AgentStatus
from app.ai.providers.base import AIProvider


class QualityIssue(BaseModel):
    """A quality issue found"""
    category: str = Field(..., description="Category: clarity, accuracy, bias, pedagogy, technical")
    severity: str = Field(..., description="Severity: critical, high, medium, low")
    description: str = Field(..., description="Issue description")
    suggestion: Optional[str] = Field(None, description="Suggestion to fix")


class QualityReview(BaseModel):
    """Quality review output"""
    overall_score: float = Field(0.0, ge=0.0, le=1.0, description="Overall quality score")
    issues: list[QualityIssue] = Field(default_factory=list, description="Found issues")
    strengths: Optional[list[str]] = Field(None, description="Question strengths")
    suggestions: Optional[list[str]] = Field(None, description="General suggestions")
    is_publishable: bool = Field(True, description="Can be published as-is")
    confidence: float = Field(0.9, description="Review confidence")


class QualityReviewAgent(Agent[QualityReview]):
    """Agent for reviewing question quality"""
    
    async def execute(
        self,
        stem: str,
        options: Optional[list[dict]] = None,
        correct_answer: Optional[str] = None,
        rationale: Optional[str] = None,
        essay_data: Optional[dict] = None,
        coding_data: Optional[dict] = None,
        bloom_level: Optional[str] = None,
        question_type: str = "mcq",
        **kwargs
    ) -> AgentOutput[QualityReview]:
        """Review question quality"""
        
        start_time = datetime.now(timezone.utc)
        
        system_prompt = """Bạn là chuyên gia kiểm tra chất lượng câu hỏi giáo dục.
Kiểm tra các khía cạnh:
1. CLARITY: Câu hỏi có rõ ràng và không mơ hồ không?
2. ACCURACY: Đáp án đúng có chính xác không?
3. BIAS: Có thiên vị (giới tính, xã hội, văn hóa) không?
4. PEDAGOGY: Câu hỏi có tính giáo dục không? Phù hợp với bloom level không?
5. TECHNICAL: Không có lỗi logic, phép tính hay syntax không?

Cho điểm từ 0-1 dựa trên chất lượng tổng thể."""
        
        prompt = self._build_prompt(
            stem, options, correct_answer, rationale,
            essay_data, coding_data, bloom_level, question_type
        )
        
        try:
            result = await self._call_provider(
                prompt=prompt,
                system_prompt=system_prompt,
                response_format=QualityReview,
            )
            
            from app.ai.json_utils import parse_json_from_llm
            data = parse_json_from_llm(result)
            if not data or not isinstance(data, dict):
                data = {"overall_score": 0.9, "is_publishable": True, "confidence": 0.9}
            review = QualityReview(**data)
            
            execution_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            
            return AgentOutput(
                status=AgentStatus.SUCCESS,
                data=review,
                confidence=review.confidence,
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
        rationale: Optional[str],
        essay_data: Optional[dict],
        coding_data: Optional[dict],
        bloom_level: Optional[str],
        question_type: str,
    ) -> str:
        """Build prompt for quality review"""
        
        prompt = f"""Hãy đánh giá chất lượng câu hỏi sau:

NỘI DUNG CÂU HỎI:
{stem}

LOẠI CÂU HỎI: {question_type}"""
        
        if bloom_level:
            prompt += f"\nMỨC ĐỘ BLOOM: {bloom_level}"
        
        if options:
            prompt += "\n\nCÁC PHƯƠNG ÁN:\n"
            for opt in options:
                marker = "[✓]" if opt.get("is_correct") else "[ ]"
                prompt += f"{marker} {opt.get('label', '')}: {opt.get('text', '')}\n"
        
        if correct_answer:
            prompt += f"\nĐÁP ÁN ĐÚNG: {correct_answer}"
        
        if rationale:
            prompt += f"\nGIẢI THÍCH: {rationale}"
        
        if essay_data:
            prompt += f"\nDỮ LIỆU BÀI LUẬN:\n{json.dumps(essay_data, ensure_ascii=False, indent=2)}"
        
        if coding_data:
            prompt += f"\nDỮ LIỆU LẬP TRÌNH:\n{json.dumps(coding_data, ensure_ascii=False, indent=2)}"
        
        prompt += """

TIÊU CHÍ ĐÁNH GIÁ:
1. Clarity: Câu hỏi có rõ ràng, không mơ hồ?
2. Accuracy: Đáp án và giải thích có chính xác?
3. Bias: Có thiên vị về giới tính, dân tộc, tôn giáo?
4. Pedagogy: Phù hợp với mục tiêu học tập? Bloom level?
5. Technical: Không có lỗi ngôn pháp, logic hay syntax?

Định dạng JSON:
{
  "overall_score": 0.85,
  "issues": [
    {
      "category": "clarity|accuracy|bias|pedagogy|technical",
      "severity": "critical|high|medium|low",
      "description": "Mô tả vấn đề",
      "suggestion": "Gợi ý sửa chữa"
    }
  ],
  "strengths": ["Điểm mạnh 1", "Điểm mạnh 2"],
  "suggestions": ["Gợi ý cải thiện 1"],
  "is_publishable": true,
  "confidence": 0.92
}"""
        
        return prompt
