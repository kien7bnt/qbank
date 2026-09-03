"""
Question Generation Agent
Generates new questions based on curriculum context
"""
from __future__ import annotations
from typing import Optional
from datetime import datetime, timezone
import json

from pydantic import BaseModel, Field

from app.ai.orchestrator import Agent, AgentOutput, AgentStatus
from app.ai.providers.base import AIProvider


class GeneratedQuestion(BaseModel):
    """Generated question output"""
    stem: str = Field(..., description="Question text")
    type: str = Field(..., description="Question type: mcq, essay, coding")
    options: Optional[list[dict]] = Field(None, description="MCQ options with text and is_correct")
    correct_answer: Optional[str] = Field(None, description="Correct answer for essay/coding")
    rationale: Optional[str] = Field(None, description="Explanation of correct answer")
    bloom_level: str = Field(..., description="Bloom taxonomy level")
    expected_difficulty: str = Field(..., description="Difficulty: easy, medium, hard")
    learning_objectives: Optional[list[str]] = Field(None, description="Learning objectives")
    confidence: float = Field(0.9, description="AI confidence in generated question")


class QuestionGenerationAgent(Agent[GeneratedQuestion]):
    """Agent for generating questions"""
    
    async def execute(
        self,
        prompt: Optional[str] = None,
        subject: Optional[str] = None,
        topic: Optional[str] = None,
        chapter: Optional[str] = None,
        bloom_level: Optional[str] = None,
        expected_difficulty: Optional[str] = None,
        question_type: str = "mcq",
        learning_objectives: Optional[list[str]] = None,
        context: Optional[str] = None,
        rules: Optional[str] = None,
        **kwargs
    ) -> AgentOutput[GeneratedQuestion]:
        """Generate a question based on prompt or curriculum context"""
        
        start_time = datetime.now(timezone.utc)
        
        # Load active pedagogical rules if not specified
        if not rules:
            try:
                from app.ai.rules import get_active_rules
                rules = get_active_rules()
            except Exception:
                rules = None

        # Build prompt
        system_prompt = """Bạn là một chuyên gia giáo dục tạo câu hỏi học tập chất lượng cao.
Câu hỏi phải:
- Rõ ràng và không mơ hồ
- Tuân theo Bloom taxonomy
- Phù hợp với trình độ học sinh
- Có đáp án đúng và lý giải
- Với MCQ: tạo các phương án sai hợp lý (distractor)

Trả về JSON với cấu trúc xác định."""
        
        user_prompt = self._build_prompt(
            prompt_text=prompt,
            subject=subject,
            topic=topic,
            chapter=chapter,
            bloom_level=bloom_level,
            expected_difficulty=expected_difficulty,
            question_type=question_type,
            learning_objectives=learning_objectives,
            context=context,
            rules=rules,
        )
        
        try:
            # Call LLM
            result = await self._call_provider(
                prompt=user_prompt,
                system_prompt=system_prompt,
                response_format=GeneratedQuestion,
            )
            
            from app.ai.json_utils import parse_json_from_llm
            data = parse_json_from_llm(result)
            if not data or not isinstance(data, dict) or "stem" not in data:
                raise ValueError("Mô hình AI trả về dữ liệu không đúng định dạng câu hỏi.")
            question = GeneratedQuestion(**data)
            
            execution_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            
            return AgentOutput(
                status=AgentStatus.SUCCESS,
                data=question,
                confidence=question.confidence,
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
        prompt_text: Optional[str],
        subject: Optional[str],
        topic: Optional[str],
        chapter: Optional[str],
        bloom_level: Optional[str],
        expected_difficulty: Optional[str],
        question_type: str,
        learning_objectives: Optional[list[str]],
        context: Optional[str],
        rules: Optional[str] = None,
    ) -> str:
        """Build prompt for question generation"""
        
        bloom_desc = {
            "remember": "Nhớ/Nhận biết",
            "understand": "Hiểu/Thông hiểu",
            "apply": "Vận dụng",
            "analyze": "Phân tích",
            "evaluate": "Đánh giá",
            "create": "Sáng tạo",
        }
        diff_desc = {
            "easy": "Dễ",
            "medium": "Trung bình",
            "hard": "Khó",
        }
        type_desc = {
            "mcq": "Trắc nghiệm (MCQ)",
            "essay": "Tự luận (Essay)",
            "coding": "Lập trình (Coding)",
        }
        
        lines = ["Tạo một câu hỏi mới với các thông tin sau:"]
        
        if prompt_text:
            lines.append(f"Yêu cầu nội dung / Prompt: {prompt_text}")
        if subject:
            lines.append(f"Môn học: {subject}")
        if chapter:
            lines.append(f"Chương: {chapter}")
        if topic:
            lines.append(f"Chủ đề: {topic}")
            
        lines.append(f"Loại câu hỏi: {type_desc.get(question_type, question_type)}")
        
        if bloom_level:
            lines.append(f"Trình độ Bloom: {bloom_desc.get(bloom_level, bloom_level)} ({bloom_level})")
        
        if expected_difficulty:
            lines.append(f"Độ khó: {diff_desc.get(expected_difficulty, expected_difficulty)} ({expected_difficulty})")
        
        if learning_objectives:
            lines.append(f"Mục tiêu học tập: {', '.join(learning_objectives)}")
        
        if context:
            lines.append(f"Bối cảnh: {context}")

        if rules and rules.strip():
            lines.append(f"\n--- BỘ QUY TẮC SƯ PHẠM BẮT BUỘC (RULE.MD) ---\n{rules.strip()}\nHÃY TUÂN THỦ NGHIÊM NGẶT TẤT CẢ CÁC QUY TẮC TRÊN KHI TẠO CÂU HỎI VÀ CÁC PHƯƠNG ÁN.\n--- HẾT QUY TẮC ---\n")
        
        lines.append("""
Yêu cầu định dạng JSON (trong <output> tags):
{
  "stem": "Nội dung câu hỏi",
  "type": "mcq|essay|coding",
  "options": [
    {"label": "A", "text": "Phương án A", "is_correct": true, "distractor_reason": "Giải thích nếu sai hoặc lý do"},
    {"label": "B", "text": "Phương án B", "is_correct": false, "distractor_reason": "Lý do sai"},
    {"label": "C", "text": "Phương án C", "is_correct": false, "distractor_reason": "Lý do sai"},
    {"label": "D", "text": "Phương án D", "is_correct": false, "distractor_reason": "Lý do sai"}
  ],
  "correct_answer": "Đáp án đúng (nếu essay/coding)",
  "rationale": "Giải thích tại sao đó là đáp án đúng và phương pháp giải chi tiết",
  "bloom_level": "remember|understand|apply|analyze|evaluate|create",
  "expected_difficulty": "easy|medium|hard",
  "learning_objectives": ["Mục tiêu 1", "Mục tiêu 2"],
  "confidence": 0.95
}

Hãy tạo câu hỏi trong <output> tags.""")
        
        return "\n".join(lines)
