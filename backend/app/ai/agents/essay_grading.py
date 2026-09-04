"""
AI Essay Grading Agent & Deterministic Scoring Engine
Chấm bài tự luận theo Rubric, Đáp án mẫu, Learning Objective và Bloom Level
"""
from __future__ import annotations
import json
import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.ai.orchestrator import Agent, AgentOutput, AgentStatus
from app.ai.providers.base import AIProvider

logger = logging.getLogger(__name__)


class CriterionEvalResult(BaseModel):
    criterion_name: str
    score: float = Field(..., ge=0, description="Mức điểm đạt được theo thang đo của tiêu chí")
    max_score: float = Field(..., gt=0, description="Điểm tối đa của tiêu chí")
    level_name: Optional[str] = None
    reason: str = Field(..., description="Lập luận sư phạm giải thích vì sao đạt mức điểm này")
    evidence: str = Field(..., description="Dẫn chứng cụ thể trích xuất từ bài làm của sinh viên")


class EssayEvaluationPayload(BaseModel):
    criteria_evaluations: List[CriterionEvalResult]
    overall_feedback: str
    strengths: List[str] = []
    areas_for_improvement: List[str] = []
    final_score: float = 0.0
    breakdown: List[Dict[str, Any]] = []


def calculate_deterministic_score(
    evaluations: List[CriterionEvalResult],
    weights: Dict[str, float],
    question_max_points: float = 10.0,
) -> tuple[float, List[Dict[str, Any]]]:
    """
    Thuật toán tính điểm tất định (Deterministic Python Scoring Engine):
    - Điểm cuối cùng = Tổng ( (Điểm đạt / Điểm tối đa) * Trọng số ) / Tổng trọng số * Điểm tối đa của câu
    - Đảm bảo LLM chỉ phân tích tiêu chí, hệ thống Backend quyết định điểm số và làm tròn.
    """
    if not evaluations:
        return 0.0, []

    total_weight = 0.0
    weighted_ratio_sum = 0.0
    breakdown = []

    for ev in evaluations:
        w = weights.get(ev.criterion_name, 1.0)
        total_weight += w
        ratio = min(max(ev.score / max(ev.max_score, 1e-6), 0.0), 1.0)
        weighted_ratio_sum += ratio * w

        breakdown.append({
            "criterion_name": ev.criterion_name,
            "score": round(ev.score, 2),
            "max_score": round(ev.max_score, 2),
            "weight": round(w, 2),
            "level_name": ev.level_name or "",
            "reason": ev.reason,
            "evidence": ev.evidence,
        })

    if total_weight <= 0:
        total_weight = 1.0

    final_calculated_score = (weighted_ratio_sum / total_weight) * question_max_points
    # Chặn trần / sàn và làm tròn 2 chữ số thập phân
    final_score = round(min(max(final_calculated_score, 0.0), question_max_points), 2)

    return final_score, breakdown


class EssayGradingAgent(Agent[EssayEvaluationPayload]):
    """
    Agent chuyên trách phân tích và chấm bài tự luận của học sinh
    """

    def __init__(self, name: str = "essay_grading", provider: Optional[AIProvider] = None, max_retries: int = 2):
        super().__init__(name=name, provider=provider, max_retries=max_retries)

    async def execute(self, **kwargs) -> AgentOutput[EssayEvaluationPayload]:
        return await self.run(**kwargs)

    async def run(self, **kwargs) -> AgentOutput[EssayEvaluationPayload]:
        question_stem = kwargs.get("stem", "")
        sample_answer = kwargs.get("sample_answer", "")
        student_answer = kwargs.get("student_answer", "")
        bloom_level = kwargs.get("bloom_level", "understand")
        question_max_points = float(kwargs.get("max_points", 10.0))
        rubric_data = kwargs.get("rubric_data", [])

        if not student_answer or not student_answer.strip():
            payload = EssayEvaluationPayload(
                criteria_evaluations=[],
                overall_feedback="Học sinh chưa nhập câu trả lời cho câu hỏi tự luận này.",
                strengths=[],
                areas_for_improvement=["Cần hoàn thành câu trả lời."],
                final_score=0.0,
                breakdown=[],
            )
            return AgentOutput(
                status=AgentStatus.SUCCESS,
                data=payload,
            )

        prompt = self._build_prompt(
            stem=question_stem,
            sample_answer=sample_answer,
            student_answer=student_answer,
            bloom_level=bloom_level,
            rubric_data=rubric_data,
        )

        try:
            if not self.provider:
                from app.ai.providers import get_provider
                self.provider = get_provider("mock")

            raw_response = await self.provider.generate(prompt)
            payload = self._parse_response(raw_response)

            # Map weights
            weights_map = {}
            for c in rubric_data:
                weights_map[c.get("name", "")] = float(c.get("weight", 1.0))

            final_score, breakdown = calculate_deterministic_score(
                evaluations=payload.criteria_evaluations,
                weights=weights_map,
                question_max_points=question_max_points,
            )
            payload.final_score = final_score
            payload.breakdown = breakdown

            return AgentOutput(
                status=AgentStatus.SUCCESS,
                data=payload,
            )
        except Exception as e:
            logger.error(f"EssayGradingAgent failed: {e}", exc_info=True)
            return AgentOutput(
                status=AgentStatus.FAILED,
                error=str(e),
            )


    def _build_prompt(
        self,
        stem: str,
        sample_answer: str,
        student_answer: str,
        bloom_level: str,
        rubric_data: List[Dict[str, Any]],
    ) -> str:
        rubric_text = ""
        if rubric_data:
            for c in rubric_data:
                rubric_text += f"\n- Tiêu chí: {c.get('name')}\n  Mô tả: {c.get('description', '')}\n  Thang điểm tối đa: {c.get('max_score', 4)}\n  Các mức điểm:\n"
                for lv in c.get("levels", []):
                    rubric_text += f"    * Mức {lv.get('score')} điểm ({lv.get('level_name')}): {lv.get('description')}\n"
        else:
            rubric_text = """
- Tiêu chí: Kiến thức & Độ chính xác
  Thang điểm tối đa: 4
  Các mức điểm:
    * Mức 4: Đúng và đủ toàn bộ kiến thức trọng tâm
    * Mức 3: Đúng phần lớn kiến thức, thiếu ý phụ
    * Mức 2: Đúng một phần kiến thức cơ bản
    * Mức 1: Hiểu sai nhiều hoặc lạc đề
    * Mức 0: Không trả lời hoặc hoàn toàn sai
- Tiêu chí: Lập luận & Diễn đạt
  Thang điểm tối đa: 4
  Các mức điểm:
    * Mức 4: Lập luận chặt chẽ, mạch lạc, rõ ràng
    * Mức 3: Lập luận tương đối tốt, còn lỗi diễn đạt nhỏ
    * Mức 2: Lập luận còn lủng củng
    * Mức 1: Diễn đạt khó hiểu
    * Mức 0: Không có lập luận
"""

        return f"""
Bạn là Chuyên gia Khảo thí và Giám khảo Đánh giá Sư phạm chuẩn Quốc tế.
Nhiệm vụ của bạn là đánh giá câu trả lời Tự luận của học sinh dựa trên Đề bài, Đáp án mẫu, Mức độ nhận thức Bloom và Rubric tiêu chí.

---
### 1. ĐỀ BÀI CÂU HỎI:
{stem}

### 2. MỨC ĐỘ NHẬN THỨC (BLOOM):
{bloom_level}

### 3. ĐÁP ÁN MẪU / HƯỚNG DẪN CHẤM:
{sample_answer or "Không có đáp án mẫu riêng, đánh giá theo kiến thức chuẩn của đề bài."}

### 4. BÀI LÀM CỦA HỌC SINH:
\"\"\"{student_answer}\"\"\"

### 5. RUBRIC TIÊU CHÍ CHẤM:
{rubric_text}

---
### NGUYÊN TẮC ĐÁNH GIÁ NGHIÊM NGẶT:
1. KHÔNG được đánh giá chung chung hoặc cảm tính ("thấy hay cho 8 điểm").
2. Đối với MỖI tiêu chí trong Rubric, bạn phải:
   - Xác định mức điểm đạt được (`score`) tương ứng với thang điểm và mô tả mức trong Rubric.
   - Nêu rõ `reason` (Lý do sư phạm tại sao học sinh đạt mức này).
   - Nêu rõ `evidence` (Trích dẫn trực tiếp câu từ hoặc chỉ rõ phần thiếu trong bài làm của học sinh).
3. Đưa ra nhận xét tổng thể (`overall_feedback`), điểm mạnh (`strengths`) và điểm cần cải thiện (`areas_for_improvement`).

---
### ĐỊNH DẠNG JSON TRẢ VỀ (BẮT BUỘC):
Chỉ trả về JSON thuần túy, không kèm markdown ngoài JSON:
{{
  "criteria_evaluations": [
    {{
      "criterion_name": "Tên tiêu chí chính xác trong Rubric",
      "score": 3.0,
      "max_score": 4.0,
      "level_name": "Tên mức điểm (ví dụ: Tốt)",
      "reason": "Giải thích chi tiết",
      "evidence": "Trích dẫn câu văn của học sinh làm bằng chứng"
    }}
  ],
  "overall_feedback": "Nhận xét sư phạm tổng thể mang tính xây dựng",
  "strengths": ["Điểm làm tốt 1", "Điểm làm tốt 2"],
  "areas_for_improvement": ["Điểm cần bổ sung 1", "Điểm cần khắc phục 2"]
}}
"""

    def _parse_response(self, raw_text: str) -> EssayEvaluationPayload:
        text = raw_text.strip()
        if "```json" in text:
            text = text.split("```json", 1)[1].split("```", 1)[0].strip()
        elif "```" in text:
            text = text.split("```", 1)[1].split("```", 1)[0].strip()

        data = json.loads(text)
        return EssayEvaluationPayload.model_validate(data)
