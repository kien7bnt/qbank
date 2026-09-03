from __future__ import annotations
import asyncio
from typing import Optional

from app.ai.providers.base import AIProvider, StructuredOutput


class MockProvider(AIProvider):
    """Mock AI Provider for development and testing"""

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        response_format: Optional[type[StructuredOutput]] = None,
    ) -> str | dict:
        # Simulate network latency
        await asyncio.sleep(1.5)

        # Detect the type of request based on the response format name or prompt content
        format_name = response_format.__name__ if response_format else ""

        if "GeneratedQuestion" in format_name or "Tạo một câu hỏi" in prompt or "Prompt:" in prompt or "Yêu cầu nội dung" in prompt:
            # Extract question type accurately from prompt line
            q_type = "mcq"
            for line in prompt.splitlines():
                if line.startswith("Loại câu hỏi:"):
                    if "coding" in line.lower() or "lập trình" in line.lower():
                        q_type = "coding"
                    elif "essay" in line.lower() or "tự luận" in line.lower():
                        q_type = "essay"
                    else:
                        q_type = "mcq"
                    break
            
            # Extract bloom and difficulty from prompt line
            bloom = "understand"
            for line in prompt.splitlines():
                if line.startswith("Trình độ Bloom:"):
                    for b in ["remember", "understand", "apply", "analyze", "evaluate", "create"]:
                        if b in line.lower():
                            bloom = b
                            break
                    break
                    
            difficulty = "medium"
            for line in prompt.splitlines():
                if line.startswith("Độ khó:"):
                    for d in ["easy", "medium", "hard"]:
                        if d in line.lower():
                            difficulty = d
                            break
                    break

            lower_prompt = prompt.lower()
            if "lớp 3" in lower_prompt or "lop 3" in lower_prompt or "tiểu học" in lower_prompt:
                stem = "Một cửa hàng có 45kg gạo, đã bán được 1/5 số gạo đó. Hỏi cửa hàng còn lại bao nhiêu ki-lô-gam gạo?"
                options = [
                    {"label": "A", "text": "36 kg", "is_correct": True, "distractor_reason": "Tính đúng: 45 - 9 = 36 kg"},
                    {"label": "B", "text": "9 kg", "is_correct": False, "distractor_reason": "Nhầm với số gạo đã bán"},
                    {"label": "C", "text": "40 kg", "is_correct": False, "distractor_reason": "Tính sai phép trừ"},
                    {"label": "D", "text": "25 kg", "is_correct": False, "distractor_reason": "Ước lượng sai"}
                ]
                rationale = "Số gạo đã bán là: $45 : 5 = 9\\text{ (kg)}$. Số gạo còn lại là: $45 - 9 = 36\\text{ (kg)}$."
                learning_objs = ["Giải bài toán có lời văn liên quan đến phân số của một số"]
            elif q_type == "coding":
                stem = "Viết hàm `find_second_largest(nums: list[int]) -> int` để tìm giá trị lớn thứ hai trong mảng số nguyên không rỗng."
                options = []
                rationale = "Duyệt qua mảng và duy trì 2 biến `max1`, `max2` để cập nhật độ phức tạp O(n)."
                learning_objs = ["Kỹ năng xử lý mảng và thuật toán tìm kiếm"]
            elif q_type == "essay":
                stem = f"Hãy trình bày và giải thích nội dung chính liên quan đến yêu cầu: {prompt.splitlines()[1] if len(prompt.splitlines()) > 1 else 'chủ đề đã cho'}."
                options = []
                rationale = "Cần nêu rõ định nghĩa, bản chất vấn đề và ví dụ minh họa cụ thể."
                learning_objs = ["Phân tích và tổng hợp kiến thức chuyên môn"]
            else:
                stem = "Tính nguyên hàm của hàm số $f(x) = 2x + 3$ trên tập số thực $\\mathbb{R}$."
                options = [
                    {"label": "A", "text": "$x^2 + 3x + C$", "is_correct": True, "distractor_reason": "Công thức nguyên hàm chính xác"},
                    {"label": "B", "text": "$x^2 + 3x$", "is_correct": False, "distractor_reason": "Thiếu hằng số C"},
                    {"label": "C", "text": "$2x^2 + 3x + C$", "is_correct": False, "distractor_reason": "Tính sai hệ số bậc 2"},
                    {"label": "D", "text": "$2 + C$", "is_correct": False, "distractor_reason": "Nhầm sang phép tính đạo hàm"}
                ]
                rationale = "Theo công thức nguyên hàm cơ bản: $\\int (2x + 3)dx = x^2 + 3x + C$."
                learning_objs = ["Tính nguyên hàm của đa thức cơ bản"]

            return {
                "stem": stem,
                "type": q_type,
                "options": options,
                "correct_answer": "36 kg" if q_type != "mcq" else None,
                "rationale": rationale,
                "bloom_level": bloom,
                "expected_difficulty": difficulty,
                "learning_objectives": learning_objs,
                "confidence": 0.95
            }
        
        elif "QuestionClassification" in format_name or "Hãy phân loại câu hỏi sau" in prompt:
            return {
                "subject": "Toán",
                "chapter": "Tích phân",
                "topic": "Nguyên hàm cơ bản",
                "bloom_level": "understand",
                "expected_difficulty": "medium",
                "question_type": "mcq",
                "learning_objectives": ["Xác định nguyên hàm"],
                "confidence": 0.88,
                "reasoning": "Câu hỏi yêu cầu hiểu và áp dụng công thức nguyên hàm cơ bản."
            }

        elif "GeneratedDistracters" in format_name or "Tạo 3 phương án sai" in prompt:
            return {
                "distractors": [
                    {"text": "Phương án nhiễu 1", "reason": "Học sinh thường quên đổi dấu", "plausibility": 0.8},
                    {"text": "Phương án nhiễu 2", "reason": "Áp dụng sai công thức", "plausibility": 0.75},
                    {"text": "Phương án nhiễu 3", "reason": "Nhầm lẫn khái niệm", "plausibility": 0.9}
                ],
                "reasoning": "Dựa trên các lỗi sai thường gặp khi làm bài.",
                "common_misconceptions": ["Quên đổi dấu", "Sai công thức"],
                "confidence": 0.9
            }
            
        elif "QualityReview" in format_name or "đánh giá chất lượng câu hỏi" in prompt:
            return {
                "overall_score": 0.9,
                "issues": [
                    {
                        "category": "clarity",
                        "severity": "low",
                        "description": "Nội dung câu hỏi hơi ngắn gọn.",
                        "suggestion": "Có thể thêm câu dẫn đầy đủ hơn."
                    }
                ],
                "strengths": ["Rõ ràng", "Đáp án chính xác"],
                "suggestions": ["Mở rộng thêm context nếu cần"],
                "is_publishable": True,
                "confidence": 0.95
            }

        return {"message": "Mock data"}

    async def health_check(self) -> bool:
        return True
