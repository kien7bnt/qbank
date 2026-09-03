import uuid
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
async def get_overview(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
) -> Dict[str, Any]:
    """Thống kê tổng quan hệ thống, phân bố Bloom, độ khó và tiến độ định cỡ"""
    return await analytics_service.get_overview_stats(db)


@router.get("/questions/{question_id}/psychometrics")
async def get_question_psychometrics(
    question_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
) -> Dict[str, Any]:
    """Tính toán chỉ số trắc lượng (Psychometrics: P-value, D-value, hiệu quả phương án nhiễu)"""
    try:
        return await analytics_service.get_question_psychometrics(db, question_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/calibrate")
async def calibrate_questions(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
) -> Dict[str, Any]:
    """Định cỡ lại toàn bộ câu hỏi trong hệ thống dựa trên dữ liệu làm bài thực tế của học sinh"""
    if not current_user.has_role("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Chỉ giáo viên mới có quyền định cỡ câu hỏi")
    return await analytics_service.calibrate_questions(db)
