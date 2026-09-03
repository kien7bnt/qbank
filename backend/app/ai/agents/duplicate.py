from __future__ import annotations
import time
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
import difflib

from app.ai.providers.base import AIProvider, StructuredOutput
from app.ai.orchestrator import Agent, AgentOutput, AgentStatus


class DuplicateMatch(BaseModel):
    matched_question_id: str
    matched_stem: str
    similarity_percentage: float = Field(..., ge=0.0, le=100.0)
    verdict: str = Field(..., description="exact_duplicate | near_duplicate | variation | unique")
    explanation: str


class DuplicateScanResult(StructuredOutput):
    target_question_id: Optional[str] = None
    matches: List[DuplicateMatch] = Field(default_factory=list)
    has_duplicates: bool = False
    recommendation: str = ""


class DuplicateDetectionAgent(Agent[DuplicateScanResult]):
    """Agent phát hiện câu hỏi trùng lặp hoặc tương tự ngữ nghĩa"""

    def __init__(self, provider: AIProvider, **kwargs):
        super().__init__("duplicate_detection", provider, **kwargs)

    async def execute(
        self,
        target_stem: str,
        candidate_questions: List[Dict[str, Any]],
        threshold: float = 0.70,
        **kwargs,
    ) -> AgentOutput[DuplicateScanResult]:
        start_time = time.time()

        matches: List[DuplicateMatch] = []
        clean_target = target_stem.strip().lower()

        for cand in candidate_questions:
            cand_stem = cand.get("stem", "").strip().lower()
            if not cand_stem or cand.get("id") == kwargs.get("target_id"):
                continue

            # Calculate string similarity ratio
            ratio = difflib.SequenceMatcher(None, clean_target, cand_stem).ratio()

            if ratio >= threshold:
                if ratio >= 0.95:
                    verdict = "exact_duplicate"
                    expl = "Nội dung câu hỏi trùng khớp gần như 100%."
                elif ratio >= 0.80:
                    verdict = "near_duplicate"
                    expl = "Câu hỏi có cùng cấu trúc và dữ kiện, chỉ thay đổi câu từ nhỏ."
                else:
                    verdict = "variation"
                    expl = "Câu hỏi tương tự về mặt chủ đề hoặc biến thể bài toán."

                matches.append(
                    DuplicateMatch(
                        matched_question_id=str(cand.get("id")),
                        matched_stem=cand.get("stem", ""),
                        similarity_percentage=round(ratio * 100, 1),
                        verdict=verdict,
                        explanation=expl,
                    )
                )

        matches.sort(key=lambda x: x.similarity_percentage, reverse=True)
        has_dupes = any(m.verdict in ("exact_duplicate", "near_duplicate") for m in matches)

        result = DuplicateScanResult(
            target_question_id=str(kwargs.get("target_id", "")),
            matches=matches,
            has_duplicates=has_dupes,
            recommendation=(
                "⚠️ Phát hiện câu hỏi trùng lặp trong ngân hàng! Khuyến nghị gộp hoặc lưu trữ câu trùng."
                if has_dupes
                else "✅ Câu hỏi có tính độc bản tốt, không trùng lặp đáng kể."
            ),
        )

        return AgentOutput(
            status=AgentStatus.SUCCESS,
            data=result,
            confidence=0.95,
            execution_time_ms=(time.time() - start_time) * 1000,
        )
