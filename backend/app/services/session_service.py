"""
Service layer for Class Sessions and Session Materials
"""
from __future__ import annotations
import os
import uuid
import shutil
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.session import ClassSession, SessionMaterial
from app.models.class_ import Class, ClassMember
from app.models.document import UserDocument
from app.schemas.session import ClassSessionCreate, ClassSessionUpdate, SessionMaterialCreate

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = BACKEND_DIR / "uploads" / "sessions"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_MATERIAL_EXTENSIONS = {
    "pdf", "docx", "doc", "xlsx", "xls", "pptx", "ppt",
    "png", "jpg", "jpeg", "gif", "webp", "zip", "txt", "md"
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


async def check_class_access(db: AsyncSession, class_id: uuid.UUID, user, require_teacher: bool = False) -> Class:
    stmt = select(Class).where(Class.id == class_id)
    res = await db.execute(stmt)
    class_obj = res.scalar_one_or_none()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Không tìm thấy lớp học")
    
    if user.has_role("admin"):
        return class_obj
    
    if class_obj.teacher_id == user.id:
        return class_obj
    
    if require_teacher:
        raise HTTPException(status_code=403, detail="Chỉ giáo viên của lớp mới có quyền thực hiện thao tác này")
    
    # Check student membership
    member_stmt = select(ClassMember).where(
        ClassMember.class_id == class_id,
        ClassMember.user_id == user.id,
        ClassMember.status == "active"
    )
    m_res = await db.execute(member_stmt)
    if not m_res.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Bạn không thuộc lớp học này")
    
    return class_obj


async def list_sessions(db: AsyncSession, class_id: uuid.UUID, user) -> List[ClassSession]:
    await check_class_access(db, class_id, user, require_teacher=False)
    stmt = (
        select(ClassSession)
        .where(ClassSession.class_id == class_id)
        .options(selectinload(ClassSession.materials), selectinload(ClassSession.assignments))
        .order_by(ClassSession.order_index)
    )
    res = await db.execute(stmt)
    return res.scalars().all()


async def get_session(db: AsyncSession, session_id: uuid.UUID, user) -> ClassSession:
    stmt = (
        select(ClassSession)
        .where(ClassSession.id == session_id)
        .options(selectinload(ClassSession.materials), selectinload(ClassSession.assignments))
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Không tìm thấy buổi học")
    
    await check_class_access(db, session.class_id, user, require_teacher=False)
    return session


async def create_session(db: AsyncSession, class_id: uuid.UUID, data: ClassSessionCreate, user) -> ClassSession:
    await check_class_access(db, class_id, user, require_teacher=True)
    
    session_name = (data.title or data.name or "").strip()
    if not session_name:
        session_name = "Buổi học mới"

    parsed_date = None
    if data.session_date:
        if isinstance(data.session_date, date) and not isinstance(data.session_date, datetime):
            parsed_date = data.session_date
        elif isinstance(data.session_date, datetime):
            parsed_date = data.session_date.date()
        elif isinstance(data.session_date, str):
            try:
                clean_str = data.session_date.split("T")[0].strip()
                if clean_str:
                    parsed_date = date.fromisoformat(clean_str)
            except Exception:
                parsed_date = None

    session = ClassSession(
        class_id=class_id,
        name=session_name,
        description=data.description.strip() if data.description else None,
        content=data.content,
        session_date=parsed_date,
        order_index=data.order_index,
        chapter_id=data.chapter_id,
        topic_id=data.topic_id,
        status=data.status or "planned",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return await get_session(db, session.id, user)


async def update_session(db: AsyncSession, session_id: uuid.UUID, data: ClassSessionUpdate, user) -> ClassSession:
    session = await get_session(db, session_id, user)
    await check_class_access(db, session.class_id, user, require_teacher=True)
    
    new_name = (data.title or data.name or "").strip()
    if new_name:
        session.name = new_name
    if data.description is not None:
        session.description = data.description.strip() if data.description else None
    if data.content is not None:
        session.content = data.content
    if data.session_date is not None:
        if isinstance(data.session_date, date) and not isinstance(data.session_date, datetime):
            session.session_date = data.session_date
        elif isinstance(data.session_date, datetime):
            session.session_date = data.session_date.date()
        elif isinstance(data.session_date, str):
            try:
                clean_str = data.session_date.split("T")[0].strip()
                session.session_date = date.fromisoformat(clean_str) if clean_str else None
            except Exception:
                pass
    if data.order_index is not None:
        session.order_index = data.order_index
    if data.status is not None:
        session.status = data.status
    if data.chapter_id is not None:
        session.chapter_id = data.chapter_id
    if data.topic_id is not None:
        session.topic_id = data.topic_id
        
    await db.commit()
    return await get_session(db, session_id, user)


async def delete_session(db: AsyncSession, session_id: uuid.UUID, user) -> None:
    session = await get_session(db, session_id, user)
    await check_class_access(db, session.class_id, user, require_teacher=True)
    
    await db.delete(session)
    await db.commit()


# ─── Materials Management ───────────────────────────────────────────────────

async def upload_session_material(
    db: AsyncSession,
    session_id: uuid.UUID,
    file: UploadFile,
    title: str,
    description: Optional[str],
    is_public: bool,
    order_index: int,
    user,
) -> SessionMaterial:
    session = await get_session(db, session_id, user)
    await check_class_access(db, session.class_id, user, require_teacher=True)
    
    original_filename = file.filename or "file"
    ext = original_filename.rsplit(".", 1)[-1].lower() if "." in original_filename else ""
    if ext not in ALLOWED_MATERIAL_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Định dạng file .{ext} không được hỗ trợ. Cho phép: {', '.join(sorted(ALLOWED_MATERIAL_EXTENSIONS))}"
        )
        
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Dung lượng file vượt quá giới hạn (Tối đa 50MB)")
        
    material_id = uuid.uuid4()
    session_dir = UPLOAD_DIR / str(session_id)
    session_dir.mkdir(parents=True, exist_ok=True)
    save_path = session_dir / f"{material_id}.{ext}"
    
    with open(save_path, "wb") as f:
        f.write(content)
        
    material = SessionMaterial(
        id=material_id,
        session_id=session_id,
        title=title.strip() if title else original_filename,
        description=description.strip() if description else None,
        file_path=f"uploads/sessions/{session_id}/{material_id}.{ext}",
        file_name=original_filename,
        file_type=ext,
        file_size=len(content),
        order_index=order_index,
        is_public=is_public,
        uploaded_by=user.id,
    )
    db.add(material)
    await db.commit()
    await db.refresh(material)
    return material


async def add_materials_from_library(
    db: AsyncSession,
    session_id: uuid.UUID,
    document_ids: List[uuid.UUID],
    is_public: bool,
    user,
) -> List[SessionMaterial]:
    """
    Đính kèm tài liệu từ Kho tài liệu cá nhân vào buổi học.
    Sao chép tệp tin vào thư mục buổi học để đảm bảo tính độc lập dữ liệu lớp học.
    """
    session = await get_session(db, session_id, user)
    await check_class_access(db, session.class_id, user, require_teacher=True)

    if not document_ids:
        raise HTTPException(status_code=400, detail="Vui lòng chọn ít nhất một tài liệu")

    # Lấy danh sách tài liệu từ user_documents
    stmt = select(UserDocument).where(
        UserDocument.id.in_(document_ids),
        UserDocument.status == "active",
    )
    res = await db.execute(stmt)
    docs = res.scalars().all()
    if not docs:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu nào hợp lệ trong kho")

    session_dir = UPLOAD_DIR / str(session_id)
    session_dir.mkdir(parents=True, exist_ok=True)

    # Lấy order_index lớn nhất hiện có
    order_stmt = select(func.coalesce(func.max(SessionMaterial.order_index), 0)).where(
        SessionMaterial.session_id == session_id
    )
    max_order = (await db.execute(order_stmt)).scalar() or 0

    added_materials: List[SessionMaterial] = []
    for doc in docs:
        material_id = uuid.uuid4()
        ext = (doc.file_type or "bin").lower().strip()
        save_path = session_dir / f"{material_id}.{ext}"

        # Tìm và sao chép tệp gốc
        file_copied = False
        doc_raw_p = Path(doc.file_path) if doc.file_path else None
        if doc_raw_p and doc_raw_p.is_file():
            shutil.copy2(doc_raw_p, save_path)
            file_copied = True
        else:
            # Thử đường dẫn tương đối từ backend
            if doc.file_path:
                backend_doc_p = (BACKEND_DIR / str(doc.file_path).replace("\\", "/")).resolve()
                if backend_doc_p.is_file():
                    shutil.copy2(backend_doc_p, save_path)
                    file_copied = True

            if not file_copied:
                # Thử tìm trong uploads/doc_user_id
                doc_uploads_dir = BACKEND_DIR / "uploads" / str(doc.user_id)
                cand = doc_uploads_dir / f"{doc.id}.{ext}"
                if cand.is_file():
                    shutil.copy2(cand, save_path)
                    file_copied = True

        # Nếu không có tệp nhị phân nhưng có extracted_text thì tạo file txt/md dự phòng
        if not file_copied:
            if doc.extracted_text:
                with open(save_path, "w", encoding="utf-8") as f:
                    f.write(doc.extracted_text)
            else:
                with open(save_path, "wb") as f:
                    f.write(b"")

        file_size = save_path.stat().st_size if save_path.is_file() else (doc.file_size or 0)
        max_order += 1

        material = SessionMaterial(
            id=material_id,
            session_id=session_id,
            title=doc.title,
            description=doc.description,
            file_path=f"uploads/sessions/{session_id}/{material_id}.{ext}",
            file_name=doc.original_filename or f"{doc.title}.{ext}",
            file_type=ext,
            file_size=file_size,
            order_index=max_order,
            is_public=is_public,
            uploaded_by=user.id,
        )
        db.add(material)
        added_materials.append(material)

    await db.commit()
    for mat in added_materials:
        await db.refresh(mat)

    return added_materials


def resolve_material_file_path(material: SessionMaterial) -> Optional[Path]:
    """
    Xác định đường dẫn file thực tế trên ổ cứng, hỗ trợ:
    - Đường dẫn tuyệt đối
    - Đường dẫn tương đối từ backend/
    - Cấu trúc chuẩn uploads/sessions/{session_id}/{material_id}.{ext}
    - Tìm kiếm theo ID file trong thư mục uploads/sessions
    """
    if not material:
        return None

    raw_path_str = (material.file_path or "").replace("\\", "/")
    raw_p = Path(raw_path_str)

    # 1. Thử trực tiếp raw_path
    if raw_p.is_file():
        return raw_p

    # 2. Thử tương đối từ BACKEND_DIR
    backend_p = (BACKEND_DIR / raw_path_str).resolve()
    if backend_p.is_file():
        return backend_p

    # 3. Thử cấu trúc chuẩn uploads/sessions/{session_id}/{material_id}.ext
    ext = material.file_type or (material.file_name.rsplit(".", 1)[-1].lower() if "." in material.file_name else "")
    std_p = UPLOAD_DIR / str(material.session_id) / f"{material.id}.{ext}"
    if std_p.is_file():
        return std_p

    # 4. Thử theo tên file gốc trong session_id
    orig_p = UPLOAD_DIR / str(material.session_id) / material.file_name
    if orig_p.is_file():
        return orig_p

    # 5. Thử tên file trực tiếp trong UPLOAD_DIR
    if raw_p.name:
        direct_name_p = UPLOAD_DIR / raw_p.name
        if direct_name_p.is_file():
            return direct_name_p

    # 6. Tìm kiếm đệ quy theo material.id trong UPLOAD_DIR
    try:
        for found in UPLOAD_DIR.rglob(f"{material.id}*"):
            if found.is_file():
                return found
    except Exception:
        pass

    return None


async def get_material_raw(db: AsyncSession, material_id: uuid.UUID) -> SessionMaterial:
    """Lấy thông tin tài liệu không cần user (để kiểm tra is_public)"""
    stmt = select(SessionMaterial).where(SessionMaterial.id == material_id)
    res = await db.execute(stmt)
    material = res.scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")
    return material


async def get_material(db: AsyncSession, material_id: uuid.UUID, user) -> SessionMaterial:
    material = await get_material_raw(db, material_id)
    session = await get_session(db, material.session_id, user)
    return material


async def toggle_material_visibility(db: AsyncSession, material_id: uuid.UUID, is_public: bool, user) -> SessionMaterial:
    material = await get_material(db, material_id, user)
    session = await get_session(db, material.session_id, user)
    await check_class_access(db, session.class_id, user, require_teacher=True)
    
    material.is_public = is_public
    await db.commit()
    await db.refresh(material)
    return material


async def delete_material(db: AsyncSession, material_id: uuid.UUID, user) -> None:
    material = await get_material(db, material_id, user)
    session = await get_session(db, material.session_id, user)
    await check_class_access(db, session.class_id, user, require_teacher=True)
    
    file_on_disk = resolve_material_file_path(material)
    if file_on_disk and file_on_disk.is_file():
        try:
            file_on_disk.unlink(missing_ok=True)
        except Exception:
            pass
            
    await db.delete(material)
    await db.commit()
