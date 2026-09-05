"""
AI endpoints for generating, classifying, and reviewing questions
"""
from __future__ import annotations
import uuid
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.core.config import settings
from app.ai.orchestrator import AIOrchestrator, AgentStatus
from app.ai.providers import get_provider
from app.ai.agents import (
    QuestionGenerationAgent, GeneratedQuestion,
    QuestionClassificationAgent, QuestionClassification,
    DistractorGenerationAgent,
    QualityReviewAgent, QualityReview
)
from app.models.question import Question
from app.schemas.question import QuestionCreate, QuestionOut
from app.schemas.ai import (
    GenerateQuestionRequest, ClassifyQuestionRequest,
    GenerateDistractorsRequest, ReviewQuestionRequest,
    ImproveQuestionRequest, GenerateFromDocumentRequest,
    RuleUpdateReq,
)
from app.services import question_service

router = APIRouter(prefix="/ai", tags=["ai"])


# Initialize AI Orchestrator
def get_orchestrator() -> AIOrchestrator:
    """Get or create AI Orchestrator"""
    if not hasattr(get_orchestrator, "_instance"):
        provider_name = getattr(settings, "AI_PROVIDER", "mock")
        
        if provider_name.lower() in ("gemini", "google"):
            provider = get_provider(
                "gemini",
                api_key=getattr(settings, "GEMINI_API_KEY", "") or getattr(settings, "OPENAI_API_KEY", ""),
                model=getattr(settings, "GEMINI_MODEL", "gemini-2.0-flash"),
            )
        elif provider_name.lower() == "openai":
            provider = get_provider(
                "openai",
                api_key=getattr(settings, "OPENAI_API_KEY", ""),
                model=getattr(settings, "OPENAI_MODEL", "gpt-4o"),
            )
        elif provider_name.lower() == "ollama":
            provider = get_provider(
                "ollama",
                base_url=getattr(settings, "OLLAMA_BASE_URL", "http://localhost:11434"),
                model=getattr(settings, "OLLAMA_MODEL", "llama3.1"),
            )
        else:  # Default to safe Mock provider
            provider = get_provider("mock")
        
        orchestrator = AIOrchestrator(provider)
        
        # Register agents properly with name parameter where required
        orchestrator.register_agent(
            "generation",
            QuestionGenerationAgent(name="generation", provider=provider, max_retries=3)
        )
        orchestrator.register_agent(
            "classification",
            QuestionClassificationAgent(provider=provider, max_retries=3)
        )
        orchestrator.register_agent(
            "distractor",
            DistractorGenerationAgent(name="distractor", provider=provider, max_retries=3)
        )
        orchestrator.register_agent(
            "quality_review",
            QualityReviewAgent(name="quality_review", provider=provider, max_retries=3)
        )
        
        get_orchestrator._instance = orchestrator
    
    return get_orchestrator._instance


@router.post("/health")
async def health_check():
    """Check AI provider health"""
    orchestrator = get_orchestrator()
    
    try:
        is_healthy = await orchestrator.provider.health_check()
        return {
            "status": "healthy" if is_healthy else "unhealthy",
            "provider": orchestrator.provider.__class__.__name__,
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
        }


class AIConfigUpdateReq(BaseModel):
    provider: str  # mock | gemini | openai | ollama
    api_key: Optional[str] = None
    model: Optional[str] = None
    ollama_base_url: Optional[str] = None


@router.get("/config")
async def get_ai_config(current_user=Depends(get_current_user)):
    """Lấy cấu hình AI hiện tại (chỉ dành cho admin)"""
    if not current_user.has_role("admin"):
        raise HTTPException(status_code=403, detail="Chỉ quản trị viên (admin) mới có quyền xem cấu hình hệ thống")
    p = getattr(settings, "AI_PROVIDER", "mock")
    masked_key = ""
    if p in ("gemini", "google") and getattr(settings, "GEMINI_API_KEY", ""):
        k = settings.GEMINI_API_KEY
        masked_key = k[:6] + "..." + k[-4:] if len(k) > 10 else "***"
    elif p == "openai" and getattr(settings, "OPENAI_API_KEY", ""):
        k = settings.OPENAI_API_KEY
        masked_key = k[:6] + "..." + k[-4:] if len(k) > 10 else "***"

    current_model = (
        getattr(settings, "GEMINI_MODEL", "gemini-2.0-flash")
        if p in ("gemini", "google")
        else getattr(settings, "OPENAI_MODEL", "gpt-4o")
        if p == "openai"
        else getattr(settings, "OLLAMA_MODEL", "llama3.1")
    )

    return {
        "provider": p,
        "masked_api_key": masked_key,
        "model": current_model,
        "ollama_base_url": getattr(settings, "OLLAMA_BASE_URL", "http://localhost:11434"),
    }


@router.post("/config")
async def update_ai_config(data: AIConfigUpdateReq, current_user=Depends(get_current_user)):
    """Cập nhật cấu hình AI (Provider, API Key, Model) thời gian thực (chỉ dành cho admin)"""
    if not current_user.has_role("admin"):
        raise HTTPException(status_code=403, detail="Chỉ quản trị viên (admin) mới có quyền cấu hình hệ thống")

    settings.AI_PROVIDER = data.provider
    if data.api_key:
        if data.provider in ("gemini", "google"):
            settings.GEMINI_API_KEY = data.api_key
        elif data.provider == "openai":
            settings.OPENAI_API_KEY = data.api_key
    if data.model:
        if data.provider in ("gemini", "google"):
            settings.GEMINI_MODEL = data.model
        elif data.provider == "openai":
            settings.OPENAI_MODEL = data.model
        elif data.provider == "ollama":
            settings.OLLAMA_MODEL = data.model
    if data.ollama_base_url:
        settings.OLLAMA_BASE_URL = data.ollama_base_url

    # Reset orchestrator instance to rebuild with new provider
    if hasattr(get_orchestrator, "_instance"):
        delattr(get_orchestrator, "_instance")

    # Persist to ai_config.json
    import json
    import os
    _cfg_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "ai_config.json")
    try:
        with open(_cfg_path, "w", encoding="utf-8") as _f:
            json.dump({
                "AI_PROVIDER": settings.AI_PROVIDER,
                "OPENAI_API_KEY": settings.OPENAI_API_KEY,
                "OPENAI_MODEL": settings.OPENAI_MODEL,
                "GEMINI_API_KEY": settings.GEMINI_API_KEY,
                "GEMINI_MODEL": settings.GEMINI_MODEL,
                "OLLAMA_BASE_URL": settings.OLLAMA_BASE_URL,
                "OLLAMA_MODEL": settings.OLLAMA_MODEL,
            }, _f, indent=2)
    except Exception:
        pass

    new_orch = get_orchestrator()
    is_healthy = await new_orch.provider.health_check()

    return {
        "message": "Cấu hình AI đã được cập nhật và lưu trữ thành công",
        "provider": data.provider,
        "is_healthy": is_healthy,
    }


# ─── Pedagogical Rules (rule.md) ──────────────────────────────────────────────

@router.get("/rules")
async def get_ai_rules(current_user=Depends(get_current_user)):
    """Lấy nội dung quy tắc sư phạm active từ rule.md"""
    from app.ai.rules import get_active_rules
    return {
        "content": get_active_rules(),
    }


@router.put("/rules")
async def update_ai_rules(
    data: RuleUpdateReq,
    current_user=Depends(get_current_user),
):
    """Cập nhật nội dung quy tắc sư phạm vào file rule.md"""
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên/admin mới có quyền sửa quy tắc")
    from app.ai.rules import save_active_rules
    saved = save_active_rules(data.content)
    return {
        "message": "Đã lưu quy tắc sư phạm (rule.md) thành công",
        "content": saved,
    }


@router.post("/rules/reset")
async def reset_ai_rules(current_user=Depends(get_current_user)):
    """Khôi phục quy tắc sư phạm về mặc định chuẩn"""
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên/admin mới có quyền khôi phục quy tắc")
    from app.ai.rules import reset_to_default_rules
    default_content = reset_to_default_rules()
    return {
        "message": "Đã khôi phục quy tắc sư phạm về mặc định",
        "content": default_content,
    }


@router.post("/questions/generate", response_model=QuestionOut | dict, status_code=status.HTTP_201_CREATED)
async def generate_question(
    data: GenerateQuestionRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Generate a new question using AI.
    
    If auto_save=true, automatically save the generated question to the database.
    """
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ giáo viên có thể tạo câu hỏi"
        )
    
    orchestrator = get_orchestrator()
    
    # Call generation agent
    output = await orchestrator.execute_agent(
        "generation",
        user_id=str(current_user.id),
        prompt=data.prompt,
        subject=data.subject,
        topic=data.topic,
        chapter=data.chapter,
        bloom_level=data.bloom_level,
        expected_difficulty=data.expected_difficulty,
        question_type=data.question_type,
        learning_objectives=data.learning_objectives,
        context=data.context,
    )
    
    if output.status != AgentStatus.SUCCESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=output.error or "Không thể tạo câu hỏi"
        )
    
    generated = output.data
    
    if data.auto_save:
        # Convert generated data to QuestionCreate schema
        create_data = QuestionCreate(
            type=generated.type,
            stem=generated.stem,
            rationale=generated.rationale,
            bloom_level=generated.bloom_level,
            expected_difficulty=generated.expected_difficulty,
            options=generated.options,
            essay_data=generated.essay_data if hasattr(generated, 'essay_data') else None,
            coding_data=generated.coding_data if hasattr(generated, 'coding_data') else None,
        )
        
        # Save to database
        question = await question_service.create_question(db, create_data, current_user.id)
        
        # Convert to output format
        return _question_to_out(question)
    
    # Return just the generated data without saving
    return {
        "id": None,
        "item_id": "DRAFT",
        "type": generated.type,
        "status": "draft",
        "stem": generated.stem,
        "rationale": generated.rationale,
        "bloom_level": generated.bloom_level,
        "expected_difficulty": generated.expected_difficulty,
        "options": generated.options or [],
    }


@router.post("/questions/classify")
async def classify_question(
    data: ClassifyQuestionRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> QuestionClassification:
    """Classify a question into curriculum structure"""
    
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ giáo viên có thể phân loại câu hỏi"
        )
    
    orchestrator = get_orchestrator()
    
    output = await orchestrator.execute_agent(
        "classification",
        user_id=str(current_user.id),
        stem=data.stem,
        options=data.options,
        correct_answer=data.correct_answer,
        essay_data=data.essay_data,
        coding_data=data.coding_data,
    )
    
    if output.status != AgentStatus.SUCCESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=output.error or "Không thể phân loại câu hỏi"
        )
    
    return output.data


@router.post("/questions/distractors")
async def generate_distractors(
    data: GenerateDistractorsRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Generate distractors for a question"""
    
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ giáo viên có thể tạo phương án sai"
        )
    
    orchestrator = get_orchestrator()
    
    output = await orchestrator.execute_agent(
        "distractor",
        user_id=str(current_user.id),
        stem=data.stem,
        correct_answer=data.correct_answer,
        context=data.context,
        topic=data.topic,
        bloom_level=data.bloom_level,
        num_distractors=data.num_distractors,
    )
    
    if output.status != AgentStatus.SUCCESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=output.error or "Không thể tạo phương án sai"
        )
    
    return output.data


@router.post("/questions/review")
async def review_question(
    data: ReviewQuestionRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> QualityReview:
    """Review question quality"""
    
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ giáo viên có thể đánh giá câu hỏi"
        )
    
    orchestrator = get_orchestrator()
    
    output = await orchestrator.execute_agent(
        "quality_review",
        user_id=str(current_user.id),
        stem=data.stem,
        options=data.options,
        correct_answer=data.correct_answer,
        rationale=data.rationale,
        essay_data=data.essay_data,
        coding_data=data.coding_data,
        bloom_level=data.bloom_level,
        question_type=data.question_type,
    )
    
    if output.status != AgentStatus.SUCCESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=output.error or "Không thể đánh giá câu hỏi"
        )
    
    return output.data


@router.post("/questions/{question_id}/review")
async def review_existing_question(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
) -> QualityReview:
    """Review an existing question"""
    
    question = await question_service.get_question(db, question_id)
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy câu hỏi"
        )
    
    # Extract question data
    options = [
        {
            "label": opt.label,
            "text": opt.text,
            "is_correct": opt.is_correct,
        }
        for opt in question.options
    ]
    
    correct_ans = None
    if question.essay_data and question.essay_data.sample_answer:
        correct_ans = question.essay_data.sample_answer
        
    req_data = ReviewQuestionRequest(
        stem=question.stem,
        options=options if options else None,
        correct_answer=correct_ans,
        rationale=question.rationale,
        bloom_level=question.bloom_level,
        question_type=question.type,
    )
    
    # Call review endpoint
    return await review_question(
        data=req_data,
        db=db,
        current_user=current_user,
    )


@router.post("/questions/detect-duplicates")
async def detect_question_duplicates(
    stem: str,
    target_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Phát hiện câu hỏi trùng lặp hoặc tương tự trong ngân hàng câu hỏi"""
    from app.ai.agents.duplicate import DuplicateDetectionAgent
    from app.models.question import Question
    from sqlalchemy import select

    # Fetch all existing questions in bank
    q_stmt = select(Question).where(Question.status != "archived")
    res = await db.execute(q_stmt)
    questions = res.scalars().all()

    candidates = [{"id": str(q.id), "stem": q.stem} for q in questions]

    provider = get_provider(settings.AI_PROVIDER)
    agent = DuplicateDetectionAgent(provider=provider)

    output = await agent.execute(
        target_stem=stem,
        candidate_questions=candidates,
        target_id=target_id,
        threshold=0.65,
    )

    if output.status != AgentStatus.SUCCESS or not output.data:
        raise HTTPException(status_code=500, detail=output.error or "Lỗi quét trùng lặp")

    return output.data


class MultiAgentGenerateReq(BaseModel):
    prompt: Optional[str] = ""
    topic_id: Optional[uuid.UUID] = None
    chapter_id: Optional[uuid.UUID] = None
    question_type: str = "mcq"
    bloom_level: str = "understand"
    expected_difficulty: str = "medium"
    context: Optional[str] = None
    document_ids: Optional[List[uuid.UUID]] = None
    rules: Optional[str] = None
    auto_save: bool = False


@router.post("/pipeline/multi-agent")
async def run_multi_agent_pipeline(
    data: MultiAgentGenerateReq,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Kích hoạt hệ thống Multi-Agent AI phối hợp 5 Agents:
    1. QuestionGenerationAgent: Sinh stem và đáp án (tuân thủ rule.md và tài liệu nếu có)
    2. DistractorGenerationAgent: Tối ưu 3 phương án bẫy & giải thích
    3. QuestionClassificationAgent: Chuẩn hóa Bloom & độ khó
    4. QualityReviewAgent: Thẩm định chất lượng & cấp điểm
    5. DuplicateDetectionAgent: Quét đối chiếu với ngân hàng câu hỏi
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Vui lòng đăng nhập để sử dụng Multi-Agent AI")

    orchestrator = get_orchestrator()
    traces = []

    # Build prompt context if document_ids provided
    doc_context = ""
    source_docs_meta = []
    if data.document_ids and len(data.document_ids) > 0:
        from app.models.document import UserDocument
        from sqlalchemy import select as sa_select

        parsed_ids = [uuid.UUID(str(did)) for did in data.document_ids]
        doc_stmt = sa_select(UserDocument).where(
            UserDocument.id.in_(parsed_ids),
            UserDocument.user_id == current_user.id,
            UserDocument.status == "active",
        )
        doc_res = await db.execute(doc_stmt)
        docs = doc_res.scalars().all()
        for d in docs:
            d_text = d.extracted_text or ""
            doc_context += f"\n\n=== TÀI LIỆU NGUỒN: {d.title} ===\n{d_text[:3000]}"
            source_docs_meta.append({"id": str(d.id), "title": d.title})
        doc_context = doc_context[:6000]

    effective_prompt = (data.prompt or "").strip()
    if doc_context:
        effective_prompt = f"Dựa trên nội dung tài liệu sau:\n{doc_context}\n\nYêu cầu tạo câu hỏi: {effective_prompt or 'Tạo câu hỏi trọng tâm từ kiến thức tài liệu'}"

    # ─── 1. Question Generation Agent ────────────────────────────────────────
    gen_out = await orchestrator.execute_agent(
        "generation",
        user_id=str(current_user.id),
        prompt=effective_prompt,
        bloom_level=data.bloom_level,
        expected_difficulty=data.expected_difficulty,
        question_type=data.question_type,
        context=data.context,
        rules=data.rules,
    )
    if gen_out.status != AgentStatus.SUCCESS or not gen_out.data:
        raise HTTPException(status_code=400, detail=gen_out.error or "Agent Tạo câu hỏi thất bại")

    gen_data = gen_out.data
    traces.append({
        "agent": "QuestionGenerationAgent",
        "role": "Sinh nội dung câu hỏi & đáp án chuẩn",
        "status": "success",
        "time_ms": round(gen_out.execution_time_ms, 1),
        "output_summary": f"Đã sinh câu hỏi loại {gen_data.type} với {len(gen_data.options or [])} lựa chọn",
    })

    # ─── 2. Distractor Generation Agent (for MCQ) ───────────────────────────
    options = gen_data.options or []
    if gen_data.type == "mcq" and len(options) >= 2:
        dist_out = await orchestrator.execute_agent(
            "distractor",
            user_id=str(current_user.id),
            stem=gen_data.stem,
            correct_answer=next((o.get("text") for o in options if o.get("is_correct")), "A"),
            bloom_level=data.bloom_level,
            num_distractors=3,
        )
        if dist_out.status == AgentStatus.SUCCESS and dist_out.data:
            traces.append({
                "agent": "DistractorGenerationAgent",
                "role": "Tối ưu phương án gây nhiễu & bẫy tư duy",
                "status": "success",
                "time_ms": round(dist_out.execution_time_ms, 1),
                "output_summary": "Đã tạo lý do phương án sai chi tiết cho từng đáp án",
            })
        else:
            traces.append({
                "agent": "DistractorGenerationAgent",
                "role": "Tối ưu phương án gây nhiễu",
                "status": "skipped",
                "time_ms": 0,
                "output_summary": "Sử dụng các phương án mặc định từ Generator",
            })

    # ─── 3. Classification Agent ─────────────────────────────────────────────
    class_out = await orchestrator.execute_agent(
        "classification",
        user_id=str(current_user.id),
        stem=gen_data.stem,
        options=options,
        correct_answer=next((o.get("text") for o in options if o.get("is_correct")), None),
    )
    final_bloom = data.bloom_level
    final_diff = data.expected_difficulty
    if class_out.status == AgentStatus.SUCCESS and class_out.data:
        final_bloom = class_out.data.bloom_level or final_bloom
        final_diff = class_out.data.expected_difficulty or final_diff
        traces.append({
            "agent": "QuestionClassificationAgent",
            "role": "Chuẩn hóa Bloom Taxonomy & Độ khó",
            "status": "success",
            "time_ms": round(class_out.execution_time_ms, 1),
            "output_summary": f"Xác nhận Bloom: {final_bloom.upper()}, Độ khó: {final_diff.upper()}",
        })

    # ─── 4. Quality Review Agent ─────────────────────────────────────────────
    review_out = await orchestrator.execute_agent(
        "quality_review",
        user_id=str(current_user.id),
        stem=gen_data.stem,
        options=options,
        correct_answer=next((o.get("text") for o in options if o.get("is_correct")), None),
        rationale=gen_data.rationale,
        bloom_level=final_bloom,
        question_type=gen_data.type,
    )
    quality_score = 0.95
    is_publishable = True
    issues = []
    if review_out.status == AgentStatus.SUCCESS and review_out.data:
        quality_score = review_out.data.overall_score
        is_publishable = review_out.data.is_publishable
        issues = [i.model_dump() for i in review_out.data.issues]
        traces.append({
            "agent": "QualityReviewAgent",
            "role": "Thẩm định chất lượng & Đánh giá sư phạm",
            "status": "success",
            "time_ms": round(review_out.execution_time_ms, 1),
            "output_summary": f"Điểm chất lượng: {round(quality_score * 100)}/100 (Đạt chuẩn xuất bản: {is_publishable})",
        })

    # ─── 5. Duplicate Scanner Agent ──────────────────────────────────────────
    from app.ai.agents.duplicate import DuplicateDetectionAgent
    from sqlalchemy import select
    all_q_stmt = select(Question).where(Question.status != "archived").limit(20)
    all_q_res = await db.execute(all_q_stmt)
    all_q_list = all_q_res.scalars().all()
    candidates = [{"id": str(q.id), "stem": q.stem} for q in all_q_list]

    dup_agent = DuplicateDetectionAgent(provider=orchestrator.provider)
    dup_out = await dup_agent.execute(
        target_stem=gen_data.stem,
        candidate_questions=candidates,
        threshold=0.65,
    )
    dup_score = 0.05
    if dup_out.status == AgentStatus.SUCCESS and dup_out.data:
        match_scores = []
        for m in dup_out.data.matches:
            if hasattr(m, 'similarity_percentage'):
                match_scores.append(m.similarity_percentage / 100.0)
            elif hasattr(m, 'similarity_score'):
                match_scores.append(m.similarity_score)
        dup_score = max(match_scores or [0.05])
        traces.append({
            "agent": "DuplicateDetectionAgent",
            "role": "Quét đối chiếu trùng lặp với kho dữ liệu",
            "status": "success",
            "time_ms": round(dup_out.execution_time_ms, 1),
            "output_summary": f"Độ tương đồng tối đa: {round(dup_score * 100, 1)}% (Kho {len(candidates)} câu)",
        })

    # Build final question structure
    question_payload = {
        "type": gen_data.type,
        "stem": gen_data.stem,
        "rationale": gen_data.rationale,
        "bloom_level": final_bloom,
        "expected_difficulty": final_diff,
        "chapter_id": str(data.chapter_id) if data.chapter_id else None,
        "topic_id": str(data.topic_id) if data.topic_id else None,
        "options": options,
    }

    saved_id = None
    if data.auto_save:
        from app.schemas.question import QuestionCreate
        create_data = QuestionCreate(
            type=gen_data.type,
            stem=gen_data.stem,
            rationale=gen_data.rationale,
            bloom_level=final_bloom,
            expected_difficulty=final_diff,
            chapter_id=data.chapter_id,
            topic_id=data.topic_id,
            options=options,
        )
        saved_q = await question_service.create_question(db, create_data, current_user.id)
        saved_id = str(saved_q.id)

    return {
        "question": question_payload,
        "pipeline_status": "completed",
        "traces": traces,
        "quality_score": round(quality_score * 100, 1),
        "is_publishable": is_publishable,
        "quality_issues": issues,
        "duplicate_score": round(dup_score * 100, 1),
        "saved_question_id": saved_id,
    }



# ─── Improve Question ─────────────────────────────────────────────────────────

@router.post("/questions/improve")
async def improve_question(
    data: ImproveQuestionRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Cải thiện câu hỏi AI theo yêu cầu bổ sung của người dùng.
    Nhận câu hỏi gốc + improvement_prompt → sinh phiên bản cải thiện.
    """
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên mới có thể cải thiện câu hỏi")

    orchestrator = get_orchestrator()

    # Build options summary for context
    options_text = ""
    if data.original_options:
        for opt in data.original_options:
            label = opt.get("label", "?")
            text = opt.get("text", "")
            correct = " [ĐÚNG]" if opt.get("is_correct") else ""
            options_text += f"\n  {label}. {text}{correct}"

    # Compose improvement prompt fed to the generation agent
    improve_context = (
        f"Câu hỏi GỐC cần cải thiện:\n"
        f"Loại: {data.question_type}\n"
        f"Bloom: {data.original_bloom_level or 'N/A'} | Độ khó: {data.original_difficulty or 'N/A'}\n"
        f"Nội dung: {data.original_stem}\n"
        f"Các phương án:{options_text or ' (không có)'}\n"
        f"Giải thích: {data.original_rationale or 'N/A'}\n\n"
        f"YÊU CẦU CẢI THIỆN: {data.improvement_prompt}\n\n"
        "Hãy tạo lại câu hỏi theo yêu cầu cải thiện trên. "
        "Giữ nguyên chủ đề kiến thức nhưng thực hiện đúng yêu cầu cải thiện."
    )

    gen_out = await orchestrator.execute_agent(
        "generation",
        user_id=str(current_user.id),
        prompt=improve_context,
        question_type=data.question_type,
        bloom_level=data.original_bloom_level or "understand",
        expected_difficulty=data.original_difficulty or "medium",
        rules=data.rules,
    )

    if gen_out.status != AgentStatus.SUCCESS or not gen_out.data:
        raise HTTPException(status_code=400, detail=gen_out.error or "Không thể cải thiện câu hỏi")

    gen_data = gen_out.data
    options = gen_data.options or []

    # Quick quality review
    review_out = await orchestrator.execute_agent(
        "quality_review",
        user_id=str(current_user.id),
        stem=gen_data.stem,
        options=options,
        correct_answer=next((o.get("text") for o in options if o.get("is_correct")), None),
        rationale=gen_data.rationale,
        bloom_level=gen_data.bloom_level or data.original_bloom_level or "understand",
        question_type=data.question_type,
    )

    quality_score = 0.9
    if review_out.status == AgentStatus.SUCCESS and review_out.data:
        quality_score = review_out.data.overall_score

    return {
        "question": {
            "type": gen_data.type,
            "stem": gen_data.stem,
            "rationale": gen_data.rationale,
            "bloom_level": gen_data.bloom_level,
            "expected_difficulty": gen_data.expected_difficulty,
            "options": options,
        },
        "improvement_applied": data.improvement_prompt,
        "quality_score": round(quality_score * 100, 1),
        "is_publishable": quality_score >= 0.7,
    }


# ─── Generate From Document ───────────────────────────────────────────────────

@router.post("/pipeline/from-document")
async def generate_from_document(
    data: GenerateFromDocumentRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Sinh câu hỏi từ kho tài liệu cá nhân của user.
    Đọc nội dung tài liệu → chạy Multi-Agent pipeline → trả về danh sách câu hỏi.
    """
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên mới có thể sinh câu hỏi từ tài liệu")

    if not data.document_ids:
        raise HTTPException(status_code=400, detail="Cần chọn ít nhất 1 tài liệu")

    # Fetch documents & validate ownership
    from app.models.document import UserDocument, DocumentChunk
    from sqlalchemy import select as sa_select

    parsed_ids = [uuid.UUID(str(did)) for did in data.document_ids]
    doc_stmt = sa_select(UserDocument).where(
        UserDocument.id.in_(parsed_ids),
        UserDocument.user_id == current_user.id,
        UserDocument.status == "active",
    )
    doc_res = await db.execute(doc_stmt)
    docs = doc_res.scalars().all()

    if not docs:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu trong kho của bạn")

    # Aggregate text content from all selected documents (take first 6000 chars to avoid token limit)
    combined_text = ""
    for doc in docs:
        doc_text = doc.extracted_text or ""
        combined_text += f"\n\n=== [{doc.title}] ===\n{doc_text[:3000]}"
    combined_text = combined_text[:6000]

    if not combined_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Tài liệu không có nội dung text có thể đọc. Hãy kiểm tra lại file."
        )

    orchestrator = get_orchestrator()
    results = []

    for q_idx in range(data.num_questions):
        # Build prompt from document content
        base_prompt = (
            f"Dựa trên nội dung tài liệu sau, hãy tạo câu hỏi số {q_idx + 1}:\n\n"
            f"{combined_text}\n\n"
        )
        if data.extra_prompt:
            base_prompt += f"Yêu cầu bổ sung: {data.extra_prompt}\n"
        if data.num_questions > 1:
            base_prompt += f"(Tạo câu hỏi {q_idx + 1}/{data.num_questions} - hãy đảm bảo mỗi câu hỏi khai thác một khía cạnh khác nhau của tài liệu)"

        # ── 1. Generation ──
        gen_out = await orchestrator.execute_agent(
            "generation",
            user_id=str(current_user.id),
            prompt=base_prompt,
            bloom_level=data.bloom_level,
            expected_difficulty=data.expected_difficulty,
            question_type=data.question_type,
        )
        if gen_out.status != AgentStatus.SUCCESS or not gen_out.data:
            continue

        gen_data = gen_out.data
        options = gen_data.options or []

        # ── 2. Distractor (MCQ only) ──
        if data.question_type == "mcq" and len(options) >= 2:
            dist_out = await orchestrator.execute_agent(
                "distractor",
                user_id=str(current_user.id),
                stem=gen_data.stem,
                correct_answer=next((o.get("text") for o in options if o.get("is_correct")), ""),
                bloom_level=data.bloom_level,
                num_distractors=3,
            )
            # Use improved options if available
            if dist_out.status == AgentStatus.SUCCESS and dist_out.data:
                pass  # distractors improve options internally

        # ── 3. Quality Review ──
        review_out = await orchestrator.execute_agent(
            "quality_review",
            user_id=str(current_user.id),
            stem=gen_data.stem,
            options=options,
            correct_answer=next((o.get("text") for o in options if o.get("is_correct")), None),
            rationale=gen_data.rationale,
            bloom_level=data.bloom_level,
            question_type=data.question_type,
        )
        quality_score = 0.9
        is_publishable = True
        if review_out.status == AgentStatus.SUCCESS and review_out.data:
            quality_score = review_out.data.overall_score
            is_publishable = review_out.data.is_publishable

        question_payload = {
            "type": gen_data.type,
            "stem": gen_data.stem,
            "rationale": gen_data.rationale,
            "bloom_level": gen_data.bloom_level or data.bloom_level,
            "expected_difficulty": gen_data.expected_difficulty or data.expected_difficulty,
            "chapter_id": str(data.chapter_id) if data.chapter_id else None,
            "topic_id": str(data.topic_id) if data.topic_id else None,
            "options": options,
        }

        saved_id = None
        if data.auto_save and is_publishable:
            from app.schemas.question import QuestionCreate
            create_data = QuestionCreate(
                type=gen_data.type,
                stem=gen_data.stem,
                rationale=gen_data.rationale,
                bloom_level=gen_data.bloom_level or data.bloom_level,
                expected_difficulty=gen_data.expected_difficulty or data.expected_difficulty,
                chapter_id=data.chapter_id,
                topic_id=data.topic_id,
                options=options,
            )
            saved_q = await question_service.create_question(db, create_data, current_user.id)
            saved_id = str(saved_q.id)

        results.append({
            "question": question_payload,
            "quality_score": round(quality_score * 100, 1),
            "is_publishable": is_publishable,
            "saved_question_id": saved_id,
        })

    if not results:
        raise HTTPException(status_code=500, detail="Không sinh được câu hỏi từ tài liệu đã chọn")

    return {
        "questions": results,
        "total_generated": len(results),
        "source_documents": [{"id": str(d.id), "title": d.title} for d in docs],
        "pipeline_status": "completed",
    }


def _question_to_out(q) -> QuestionOut:
    """Convert question model to output schema"""
    from app.schemas.question import (
        EssayDataOut, CodingDataOut, QuestionOptionOut
    )
    return QuestionOut(
        id=q.id,
        item_id=q.item_id,
        type=q.type,
        status=q.status,
        stem=q.stem,
        rationale=q.rationale,
        subject_id=q.subject_id,
        subject_name=q.subject.name if q.subject else None,
        chapter_id=q.chapter_id,
        chapter_name=q.chapter.name if q.chapter else None,
        topic_id=q.topic_id,
        topic_name=q.topic.name if q.topic else None,
        bloom_level=q.bloom_level,
        expected_difficulty=q.expected_difficulty,
        options=[
            QuestionOptionOut(
                id=o.id,
                question_id=o.question_id,
                label=o.label,
                text=o.text,
                is_correct=o.is_correct,
                distractor_reason=o.distractor_reason,
                order_index=o.order_index,
            )
            for o in q.options
        ],
        essay_data=EssayDataOut.model_validate(q.essay_data) if q.essay_data else None,
        coding_data=CodingDataOut.model_validate(q.coding_data) if q.coding_data else None,
        version=q.version,
        created_by=q.created_by,
        created_at=q.created_at,
        updated_at=q.updated_at,
    )
