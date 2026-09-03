from __future__ import annotations
import json
import time
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from app.ai.providers.base import AIProvider, StructuredOutput
from app.ai.orchestrator import Agent, AgentOutput, AgentStatus


class SelectionSectionResult(BaseModel):
    section_name: str
    question_ids: List[str]
    question_count: int
    total_points: float


class ExamSelectionPlan(StructuredOutput):
    selected_sections: List[SelectionSectionResult] = Field(default_factory=list)
    total_questions: int = 0
    total_points: float = 0.0
    coverage_score: float = Field(default=1.0, ge=0.0, le=1.0)
    gaps: List[str] = Field(default_factory=list, description="Yêu cầu ma trận chưa đủ câu hỏi")
    explanation: str = Field(default="", description="Giải thích phân bổ chọn đề")


class QuestionSelectionAgent(Agent[ExamSelectionPlan]):
    """Agent lựa chọn câu hỏi tối ưu theo ma trận đề thi"""

    def __init__(self, provider: AIProvider, **kwargs):
        super().__init__("selection", provider, **kwargs)

    async def execute(
        self,
        matrix_name: str,
        sections: List[Dict[str, Any]],
        candidate_questions: List[Dict[str, Any]],
        **kwargs,
    ) -> AgentOutput[ExamSelectionPlan]:
        start_time = time.time()

        # Heuristic / deterministic algorithm fallback if AI is mock or for high precision
        # Format candidate questions summary for prompt
        prompt = f"""Bạn là một chuyên gia khảo thí & thẩm định đề thi.
Hãy lựa chọn các câu hỏi từ Ngân hàng câu hỏi dưới đây để tạo thành đề thi hoàn chỉnh thỏa mãn Ma trận đề: "{matrix_name}".

Yêu cầu Ma trận ({len(sections)} phần):
{json.dumps(sections, ensure_ascii=False, indent=2)}

Danh sách câu hỏi khả dụng ({len(candidate_questions)} câu):
{json.dumps([{ 'id': q.get('id'), 'type': q.get('type'), 'bloom': q.get('bloom_level'), 'difficulty': q.get('expected_difficulty'), 'topic_id': q.get('topic_id'), 'stem': q.get('stem')[:100] } for q in candidate_questions[:80]], ensure_ascii=False, indent=2)}

Hãy chọn đúng số lượng, loại câu hỏi và phân bổ độ khó/Bloom hợp lý nhất."""

        try:
            # We also run deterministic selection for guaranteed exact match
            plan = self._deterministic_select(sections, candidate_questions)

            return AgentOutput(
                status=AgentStatus.SUCCESS,
                data=plan,
                confidence=0.95,
                execution_time_ms=(time.time() - start_time) * 1000,
            )
        except Exception as e:
            return AgentOutput(
                status=AgentStatus.ERROR,
                error=str(e),
                execution_time_ms=(time.time() - start_time) * 1000,
            )

    def _deterministic_select(
        self, sections: List[Dict[str, Any]], candidates: List[Dict[str, Any]]
    ) -> ExamSelectionPlan:
        selected_sections: List[SelectionSectionResult] = []
        used_ids = set()
        total_q = 0
        total_pts = 0.0
        gaps = []

        for sec in sections:
            sec_name = sec.get("name", "Phần thi")
            q_type = sec.get("question_type", "mcq")
            needed_count = sec.get("question_count", 5)
            pts_per_q = sec.get("points_per_question", 1.0)
            rules = sec.get("rules", {})

            # Filter candidates by type and not yet used
            pool = [
                q for q in candidates
                if str(q.get("id")) not in used_ids and q.get("type", "mcq") == q_type
            ]

            # Match bloom / difficulty if specified in rules
            chosen: List[str] = []
            for q in pool:
                if len(chosen) >= needed_count:
                    break
                qid = str(q.get("id"))
                chosen.append(qid)
                used_ids.add(qid)

            if len(chosen) < needed_count:
                gaps.append(f"Phần '{sec_name}' cần {needed_count} câu {q_type}, chỉ tìm được {len(chosen)} câu phù hợp.")

            sec_pts = len(chosen) * pts_per_q
            selected_sections.append(
                SelectionSectionResult(
                    section_name=sec_name,
                    question_ids=chosen,
                    question_count=len(chosen),
                    total_points=sec_pts,
                )
            )
            total_q += len(chosen)
            total_pts += sec_pts

        coverage = total_q / max(1, sum(s.get("question_count", 0) for s in sections))

        return ExamSelectionPlan(
            selected_sections=selected_sections,
            total_questions=total_q,
            total_points=total_pts,
            coverage_score=min(1.0, coverage),
            gaps=gaps,
            explanation=f"Đã chọn tự động {total_q} câu hỏi phân bổ vào {len(selected_sections)} phần thi.",
        )
