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
        system_prompt = """Bạn là một chuyên gia khảo thí và sư phạm cao cấp chuyên thiết kế câu hỏi kiểm tra đánh giá chuẩn mực.
YÊU CẦU CỐT LÕI:
1. TUÂN THỦ NGHIÊM NGẶT mức độ Bloom và độ khó được yêu cầu:
   - Nếu yêu cầu "Vận dụng cao" (analyze/evaluate/create) và độ khó "Khó" (hard): BẮT BUỘC bài toán phải đòi hỏi học sinh phân tích, suy luận qua nhiều bước logic (tối thiểu 3-4 bước giải), vận dụng kiến thức chuyên sâu hoặc giải bài toán nâng cao đòi hỏi phương pháp đặc thù (giả thiết tạm, tỉ số nâng cao, suy luận ngược, phân tích mối quan hệ gián tiếp, cực trị). TUYỆT ĐỐI KHÔNG sinh câu hỏi chỉ áp dụng công thức một cách trực tiếp máy móc hoặc bài toán thông hiểu đơn giản.
   - Nếu yêu cầu "Vận dụng" (apply): Tình huống có lời văn quen thuộc, áp dụng kiến thức vào giải bài toán 2-3 bước.
   - Nếu yêu cầu "Thông hiểu" (understand): Giải thích, mô tả, áp dụng 1 bước công thức cơ bản.
   - Nếu yêu cầu "Nhận biết" (remember): Nhận biết định nghĩa, khái niệm, công thức trực tiếp.
2. Với câu hỏi trắc nghiệm (MCQ): Các phương án gây nhiễu (distractor) phải cực kỳ hợp lý, phản ánh đúng các sai lầm ngộ nhận tư duy phổ biến của học sinh.
3. Lời giải chi tiết (rationale) phải rõ ràng từng bước, chuẩn xác về mặt khoa học và phương pháp.
4. Trả về JSON với cấu trúc xác định trong cặp thẻ <output>...</output>."""
        
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
            "remember": "Nhận biết (Remember) - Nhớ, nhắc lại định nghĩa, công thức, khái niệm cơ bản. Chỉ cần 1 bước tư duy nhận diện trực tiếp.",
            "understand": "Thông hiểu (Understand) - Hiểu bản chất, giải thích, tóm tắt, áp dụng trực tiếp 1 công thức quen thuộc để tính toán trực diện.",
            "apply": "Vận dụng (Apply) - Áp dụng kiến thức đã học vào tình huống cụ thể quen thuộc, bài toán có lời văn từ 2-3 bước giải thông thường.",
            "analyze": "Vận dụng cao (Analyze) - ĐÒI HỎI PHÂN TÍCH VÀ SUY LUẬN SÂU: Học sinh phải phân tích dữ kiện đa chiều, thực hiện chuỗi 3-4 bước lập luận logic, kết hợp các phương pháp tư duy nâng cao (như giả thiết tạm, tỉ số nâng cao, suy ngược, ẩn số phức hợp, tính chất hình học nâng cao). TUYỆT ĐỐI KHÔNG sinh bài tập áp dụng công thức máy móc!",
            "evaluate": "Đánh giá (Evaluate / Vận dụng cao) - Đánh giá, phản biện, so sánh các giải pháp, tìm lỗi sai tinh vi hoặc chứng minh mệnh đề.",
            "create": "Sáng tạo (Create / Vận dụng cao) - Mô hình hóa, đề xuất giải pháp mới, thiết kế thuật toán hoặc bài toán tổng hợp mới lạ.",
        }
        diff_desc = {
            "easy": "Dễ - Học sinh trung bình/yếu làm được, trực diện, không có bẫy.",
            "medium": "Trung bình - Đòi hỏi nắm vững kiến thức, cẩn thận qua 2-3 bước giải.",
            "hard": "Khó - Dành cho học sinh khá/giỏi, tính phân loại cao, nhiều bước lập luận chặt chẽ, có bẫy tư duy tinh tế.",
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
            b_info = bloom_desc.get(bloom_level, bloom_level)
            lines.append(f"\n★ YÊU CẦU MỨC ĐỘ BLOOM BẮT BUỘC: {b_info}")
            lines.append(f"  -> Lưu ý quan trọng: Câu hỏi PHẢI ĐẠT CHÍNH XÁC mức độ '{bloom_level}'. Trong JSON kết quả, thuộc tính 'bloom_level' PHẢI LÀ '{bloom_level}'. Tuyệt đối không tự ý hạ xuống mức thấp hơn!")
        
        if expected_difficulty:
            d_info = diff_desc.get(expected_difficulty, expected_difficulty)
            lines.append(f"★ YÊU CẦU ĐỘ KHÓ BẮT BUỘC: {d_info}")
            lines.append(f"  -> Lưu ý quan trọng: Câu hỏi PHẢI ĐẠT CHÍNH XÁC độ khó '{expected_difficulty}'. Trong JSON kết quả, thuộc tính 'expected_difficulty' PHẢI LÀ '{expected_difficulty}'.")
        
        if learning_objectives:
            lines.append(f"Mục tiêu học tập: {', '.join(learning_objectives)}")
        
        if context:
            lines.append(f"Bối cảnh: {context}")

        if rules and rules.strip():
            lines.append(f"\n--- BỘ QUY TẮC SƯ PHẠM BẮT BUỘC (RULE.MD) ---\n{rules.strip()}\nHÃY TUÂN THỦ NGHIÊM NGẶT TẤT CẢ CÁC QUY TẮC TRÊN KHI TẠO CÂU HỎI VÀ CÁC PHƯƠNG ÁN.\n--- HẾT QUY TẮC ---\n")
        
        bloom_val = bloom_level if bloom_level else "remember|understand|apply|analyze|evaluate|create"
        diff_val = expected_difficulty if expected_difficulty else "easy|medium|hard"
        lines.append(f"""
Yêu cầu định dạng JSON (trong <output> tags):
{{
  "stem": "Nội dung câu hỏi",
  "type": "mcq|essay|coding",
  "options": [
    {{"label": "A", "text": "Phương án A", "is_correct": true, "distractor_reason": "Giải thích nếu sai hoặc lý do"}},
    {{"label": "B", "text": "Phương án B", "is_correct": false, "distractor_reason": "Lý do sai"}},
    {{"label": "C", "text": "Phương án C", "is_correct": false, "distractor_reason": "Lý do sai"}},
    {{"label": "D", "text": "Phương án D", "is_correct": false, "distractor_reason": "Lý do sai"}}
  ],
  "correct_answer": "Đáp án đúng (nếu essay/coding)",
  "rationale": "Giải thích tại sao đó là đáp án đúng và phương pháp giải chi tiết từng bước",
  "bloom_level": "{bloom_val}",
  "expected_difficulty": "{diff_val}",
  "learning_objectives": ["Mục tiêu 1", "Mục tiêu 2"],
  "confidence": 0.95
}}

Hãy tạo câu hỏi trong <output> tags.""")
        
        return "\n".join(lines)
