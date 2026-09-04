"""
Service layer for Rubrics and Grading Criteria
"""
from __future__ import annotations
import uuid
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.rubric import Rubric, RubricCriteria, RubricLevel
from app.schemas.rubric import RubricCreate, RubricUpdate


async def list_rubrics(db: AsyncSession, subject_id: Optional[uuid.UUID] = None, user=None) -> List[Rubric]:
    stmt = (
        select(Rubric)
        .options(
            selectinload(Rubric.criteria).selectinload(RubricCriteria.levels)
        )
        .order_by(Rubric.created_at.desc())
    )
    if subject_id:
        stmt = stmt.where(Rubric.subject_id == subject_id)
    res = await db.execute(stmt)
    return res.scalars().all()


async def get_rubric(db: AsyncSession, rubric_id: uuid.UUID) -> Rubric:
    stmt = (
        select(Rubric)
        .where(Rubric.id == rubric_id)
        .options(
            selectinload(Rubric.criteria).selectinload(RubricCriteria.levels)
        )
    )
    res = await db.execute(stmt)
    rubric = res.scalar_one_or_none()
    if not rubric:
        raise HTTPException(status_code=404, detail="Không tìm thấy Rubric chấm điểm")
    return rubric


async def create_rubric(db: AsyncSession, data: RubricCreate, user) -> Rubric:
    rubric = Rubric(
        name=data.name.strip(),
        description=data.description.strip() if data.description else None,
        subject_id=data.subject_id,
        total_max_score=data.total_max_score,
        created_by=user.id,
        status="active",
    )
    db.add(rubric)
    await db.flush()

    # Add criteria and levels
    for c_idx, c_data in enumerate(data.criteria, start=1):
        crit = RubricCriteria(
            rubric_id=rubric.id,
            name=c_data.name.strip(),
            description=c_data.description.strip() if c_data.description else None,
            weight=c_data.weight,
            max_score=c_data.max_score,
            order_index=c_data.order_index or c_idx,
        )
        db.add(crit)
        await db.flush()

        for l_idx, l_data in enumerate(c_data.levels, start=1):
            level = RubricLevel(
                criterion_id=crit.id,
                score=l_data.score,
                level_name=l_data.level_name.strip(),
                description=l_data.description.strip(),
                order_index=l_data.order_index or l_idx,
            )
            db.add(level)

    await db.commit()
    return await get_rubric(db, rubric.id)


async def update_rubric(db: AsyncSession, rubric_id: uuid.UUID, data: RubricUpdate, user) -> Rubric:
    rubric = await get_rubric(db, rubric_id)
    if not user.has_role("admin") and rubric.created_by != user.id:
        raise HTTPException(status_code=403, detail="Chỉ người tạo mới có quyền sửa Rubric này")

    if data.name is not None:
        rubric.name = data.name.strip()
    if data.description is not None:
        rubric.description = data.description.strip() if data.description else None
    if data.subject_id is not None:
        rubric.subject_id = data.subject_id
    if data.total_max_score is not None:
        rubric.total_max_score = data.total_max_score
    if data.status is not None:
        rubric.status = data.status

    if data.criteria is not None:
        # Replace criteria
        for old_crit in rubric.criteria:
            await db.delete(old_crit)
        await db.flush()

        for c_idx, c_data in enumerate(data.criteria, start=1):
            crit = RubricCriteria(
                rubric_id=rubric.id,
                name=c_data.name.strip(),
                description=c_data.description.strip() if c_data.description else None,
                weight=c_data.weight,
                max_score=c_data.max_score,
                order_index=c_data.order_index or c_idx,
            )
            db.add(crit)
            await db.flush()

            for l_idx, l_data in enumerate(c_data.levels, start=1):
                level = RubricLevel(
                    criterion_id=crit.id,
                    score=l_data.score,
                    level_name=l_data.level_name.strip(),
                    description=l_data.description.strip(),
                    order_index=l_data.order_index or l_idx,
                )
                db.add(level)

    await db.commit()
    return await get_rubric(db, rubric.id)


async def delete_rubric(db: AsyncSession, rubric_id: uuid.UUID, user) -> None:
    rubric = await get_rubric(db, rubric_id)
    if not user.has_role("admin") and rubric.created_by != user.id:
        raise HTTPException(status_code=403, detail="Chỉ người tạo mới có quyền xóa Rubric này")
    await db.delete(rubric)
    await db.commit()
