from __future__ import annotations
import uuid
import io
import re
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.schemas.question import (
    BulkActionRequest,
    PaginatedQuestions,
    QuestionCreate,
    QuestionListItem,
    QuestionOut,
    QuestionUpdate,
    QuestionVersionOut,
    QuestionBatchCreateRequest,
    QuestionBatchCreateResponse,
    AddToAssessmentRequest,
    AutoGenerateAssessmentRequest,
    QuestionUsageOut,
)
from app.services import question_service

router = APIRouter(prefix="/questions", tags=["questions"])


from sqlalchemy import inspect as sa_inspect


def _safe_attr(obj, attr_name: str, fallback=None):
    try:
        insp = sa_inspect(obj)
        if attr_name in insp.unloaded:
            return fallback
        val = getattr(obj, attr_name, fallback)
        return val if val is not None else fallback
    except Exception:
        return fallback


def _safe_rel_name(obj, rel_name: str) -> Optional[str]:
    rel_obj = _safe_attr(obj, rel_name)
    if rel_obj is not None:
        try:
            return getattr(rel_obj, "name", None)
        except Exception:
            return None
    return None


def _question_to_list_item(q) -> QuestionListItem:
    sub_type = q.type
    if q.type == "mcq":
        opts = _safe_attr(q, "options", []) or []
        correct_count = sum(1 for o in opts if getattr(o, "is_correct", False))
        if len(opts) == 2 and any(getattr(o, "text", "").strip().lower() in ["đúng", "sai", "dung", "true", "false"] for o in opts):
            sub_type = "true_false"
        elif correct_count > 1:
            sub_type = "multiple_choice"
        else:
            sub_type = "single_choice"

    return QuestionListItem(
        id=q.id,
        item_id=q.item_id,
        type=q.type,
        sub_type=sub_type,
        status=q.status,
        stem_preview=(q.stem[:100] + ("..." if len(q.stem) > 100 else "")) if q.stem else "",
        bloom_level=q.bloom_level,
        expected_difficulty=q.expected_difficulty,
        actual_difficulty=getattr(q, "actual_difficulty", None),
        usage_count=getattr(q, "usage_count", 0) or 0,
        in_exercise_bank=bool(getattr(q, "in_exercise_bank", False)),
        subject_name=_safe_rel_name(q, "subject"),
        chapter_name=_safe_rel_name(q, "chapter"),
        topic_name=_safe_rel_name(q, "topic"),
        created_at=q.created_at,
    )


def _question_to_out(q) -> QuestionOut:
    from app.schemas.question import (
        EssayDataOut, CodingDataOut, QuestionOptionOut
    )
    raw_options = _safe_attr(q, "options", []) or []
    opts_out = []
    for o in raw_options:
        opts_out.append(
            QuestionOptionOut(
                id=o.id,
                question_id=o.question_id,
                label=o.label,
                text=o.text,
                is_correct=o.is_correct,
                distractor_reason=o.distractor_reason,
                order_index=o.order_index,
            )
        )

    raw_essay = _safe_attr(q, "essay_data")
    essay_data = EssayDataOut.model_validate(raw_essay) if raw_essay else None

    raw_coding = _safe_attr(q, "coding_data")
    coding_data = CodingDataOut.model_validate(raw_coding) if raw_coding else None

    return QuestionOut(
        id=q.id,
        item_id=q.item_id,
        type=q.type,
        status=q.status,
        stem=q.stem,
        rationale=q.rationale,
        subject_id=q.subject_id,
        subject_name=_safe_rel_name(q, "subject"),
        chapter_id=q.chapter_id,
        chapter_name=_safe_rel_name(q, "chapter"),
        topic_id=q.topic_id,
        topic_name=_safe_rel_name(q, "topic"),
        bloom_level=q.bloom_level,
        expected_difficulty=q.expected_difficulty,
        actual_difficulty=getattr(q, "actual_difficulty", None),
        discrimination_index=getattr(q, "discrimination_index", None),
        irt_a=getattr(q, "irt_a", None),
        irt_b=getattr(q, "irt_b", None),
        irt_c=getattr(q, "irt_c", None),
        usage_count=getattr(q, "usage_count", 0) or 0,
        in_exercise_bank=bool(getattr(q, "in_exercise_bank", False)),
        options=opts_out,
        essay_data=essay_data,
        coding_data=coding_data,
        version=q.version,
        created_by=q.created_by,
        created_at=q.created_at,
        updated_at=q.updated_at,
    )


@router.get("", response_model=PaginatedQuestions)
async def list_questions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    type: Optional[str] = None,
    status: Optional[str] = None,
    subject_id: Optional[uuid.UUID] = None,
    chapter_id: Optional[uuid.UUID] = None,
    topic_id: Optional[uuid.UUID] = None,
    bloom_level: Optional[str] = None,
    difficulty: Optional[str] = None,
    search: Optional[str] = None,
    in_exercise_bank: Optional[bool] = None,
    scope: Optional[str] = Query(None, description="mine | all"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Non-admin users only see their own questions; admin can view all or filter
    user_filter = None
    if not current_user.has_role("admin") or scope == "mine":
        user_filter = current_user.id

    items, total = await question_service.list_questions(
        db=db,
        page=page,
        page_size=page_size,
        type=type,
        status=status,
        subject_id=subject_id,
        chapter_id=chapter_id,
        topic_id=topic_id,
        bloom_level=bloom_level,
        difficulty=difficulty,
        search=search,
        created_by=user_filter,
        in_exercise_bank=in_exercise_bank,
    )
    return PaginatedQuestions(
        items=[_question_to_list_item(q) for q in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


def parse_questions_from_text(text: str) -> list[dict]:
    # Split text into question chunks by Câu 1 / Question 1 / 1.
    pattern = r"(?=(?:^|\n)\s*(?:Câu\s*\d+|Question\s*\d+|\d+\.)[:\.\s])"
    raw_chunks = re.split(pattern, text, flags=re.IGNORECASE)
    chunks = [c.strip() for c in raw_chunks if c.strip()]
    
    parsed = []
    for chunk in chunks:
        lines = [l.strip() for l in chunk.split("\n") if l.strip()]
        if not lines:
            continue
        
        first_line = lines[0]
        stem_match = re.sub(r"^(?:Câu\s*\d+|Question\s*\d+|\d+\.)[:\.\s]*", "", first_line, flags=re.IGNORECASE)
        stem_lines = [stem_match]
        options = []
        correct_labels = []
        rationale = ""
        in_options = False
        
        for line in lines[1:]:
            ans_match = re.search(r"(?:Đáp\s*án|Answer|Đ/A)[:\s]*([A-D,\s]+)", line, re.IGNORECASE)
            if ans_match:
                raw_ans = ans_match.group(1).upper()
                for char in ["A", "B", "C", "D"]:
                    if char in raw_ans:
                        correct_labels.append(char)
                continue
                
            exp_match = re.search(r"(?:Giải\s*thích|Lời\s*giải|Explanation)[:\s]*(.*)", line, re.IGNORECASE)
            if exp_match:
                rationale = exp_match.group(1).strip()
                continue
                
            opt_match = re.match(r"^([A-D])[\.\)\:\-]\s*(.*)", line, re.IGNORECASE)
            if opt_match:
                in_options = True
                label = opt_match.group(1).upper()
                opt_text = opt_match.group(2).strip()
                options.append({
                    "label": label,
                    "text": opt_text,
                    "is_correct": False
                })
            else:
                if in_options:
                    if rationale:
                        rationale += " " + line
                    elif options:
                        options[-1]["text"] += " " + line
                else:
                    stem_lines.append(line)
        
        stem = " ".join(stem_lines).strip()
        if not stem:
            stem = chunk[:100]
            
        if not correct_labels:
            correct_labels = ["A"]
            
        for opt in options:
            if opt["label"] in correct_labels:
                opt["is_correct"] = True
                
        if not options:
            parsed.append({
                "type": "essay",
                "stem": stem,
                "rationale": rationale or None,
                "bloom_level": "understand",
                "expected_difficulty": "medium",
                "options": [],
                "essay_data": {"sample_answer": rationale or "", "max_points": 10.0}
            })
        else:
            if not any(o["is_correct"] for o in options) and options:
                options[0]["is_correct"] = True
                
            parsed.append({
                "type": "mcq",
                "stem": stem,
                "rationale": rationale or None,
                "bloom_level": "understand",
                "expected_difficulty": "medium",
                "options": options
            })
    return parsed


@router.post("", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
async def create_question(
    data: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền tạo câu hỏi")
    try:
        q = await question_service.create_question(db, data, current_user.id)
        return _question_to_out(q)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lỗi khi lưu câu hỏi: {str(e)}"
        )


@router.post("/batch", response_model=QuestionBatchCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_questions_batch(
    data: QuestionBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Tạo nhiều câu hỏi cùng lúc vào ngân hàng trong 1 transaction duy nhất"""
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền tạo câu hỏi")
    try:
        return await question_service.create_questions_batch(db, data, current_user.id)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lỗi khi tạo batch câu hỏi: {str(e)}"
        )


@router.post("/parse-file")
async def parse_questions_file(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    """Upload và trích xuất danh sách câu hỏi tự động từ file Word, Text, PDF, JSON"""
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền thực hiện")
    
    filename = file.filename.lower() if file.filename else ""
    content = await file.read()
    text = ""
    
    if filename.endswith(".docx"):
        try:
            import docx
            doc = docx.Document(io.BytesIO(content))
            text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Lỗi khi đọc file DOCX: {e}")
    elif filename.endswith(".pdf"):
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content))
            text = "\n".join(p.extract_text() or "" for p in reader.pages)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Lỗi khi đọc file PDF: {e}")
    elif filename.endswith(".json"):
        try:
            data = json.loads(content.decode("utf-8"))
            if isinstance(data, list):
                return {"questions": data, "total": len(data), "raw_text": ""}
            elif isinstance(data, dict) and "questions" in data:
                return {"questions": data["questions"], "total": len(data["questions"]), "raw_text": ""}
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Lỗi khi đọc file JSON: {e}")
    else:
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            text = content.decode("latin-1", errors="ignore")
            
    questions = parse_questions_from_text(text)
    return {
        "raw_text": text[:5000],
        "questions": questions,
        "total": len(questions),
    }


@router.get("/{question_id}", response_model=QuestionOut)
async def get_question(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = await question_service.get_question(db, question_id)
    if not q:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy câu hỏi")
    return _question_to_out(q)


@router.patch("/{question_id}", response_model=QuestionOut)
async def update_question(
    question_id: uuid.UUID,
    data: QuestionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền")
    is_admin = current_user.has_role("admin")
    q = await question_service.update_question(db, question_id, data, current_user.id, is_admin=is_admin)
    return _question_to_out(q)


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền")
    is_admin = current_user.has_role("admin")
    deleted = await question_service.delete_question(db, question_id, user_id=current_user.id, is_admin=is_admin)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy câu hỏi")


@router.post("/bulk-action", response_model=dict)
async def bulk_action(
    data: BulkActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền")
    is_admin = current_user.has_role("admin")
    result = await question_service.bulk_action(db, data, current_user.id, is_admin=is_admin)
    return result


@router.get("/{question_id}/versions", response_model=list[QuestionVersionOut])
async def get_versions(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    versions = await question_service.get_question_versions(db, question_id)
    return [QuestionVersionOut.model_validate(v) for v in versions]


@router.post("/add-to-assessment", response_model=dict)
async def add_to_assessment_endpoint(
    data: AddToAssessmentRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Thêm một hoặc nhiều câu hỏi vào bài tập hoặc đề kiểm tra (tạo mới hoặc thêm vào bài có sẵn)"""
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên được thực hiện thao tác này")
    return await question_service.add_to_assessment(db, current_user.id, data)


@router.post("/auto-generate", response_model=dict)
async def auto_generate_assessment_endpoint(
    data: AutoGenerateAssessmentRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Tự động sinh bộ bài tập hoặc đề thi theo ma trận tiêu chí (Bloom, độ khó)"""
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên được thực hiện thao tác này")
    return await question_service.auto_generate_assessment(db, current_user.id, data)


@router.get("/{question_id}/usage", response_model=QuestionUsageOut)
async def get_question_usage_endpoint(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Lấy thống kê và danh sách các bài tập & đề thi đang sử dụng câu hỏi này"""
    return await question_service.get_question_usage(db, question_id)
