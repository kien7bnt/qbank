from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1 import auth, classes, curriculum, questions, ai, exams, exercises, assignments, analytics, documents, sessions, rubrics, compiler, attendance


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: init DB tables
    from app.db.session import init_db
    await init_db()
    yield
    # Shutdown


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Hệ thống Ngân hàng Câu hỏi & Kiểm tra tích hợp Multi-Agent AI",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads directory for static access (attachments, document previews)
from pathlib import Path
import mimetypes
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import HTTPException

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@app.get("/api/v1/uploads/{file_path:path}")
@app.get("/api/uploads/{file_path:path}")
@app.get("/uploads/{file_path:path}")
async def serve_uploaded_file(file_path: str):
    safe_path = (UPLOAD_DIR / file_path).resolve()
    upload_root = UPLOAD_DIR.resolve()
    if not str(safe_path).startswith(str(upload_root)):
        raise HTTPException(status_code=403, detail="Truy cập bị từ chối")
    if not safe_path.is_file():
        raise HTTPException(status_code=404, detail="Tệp không tồn tại")

    mime_type, _ = mimetypes.guess_type(str(safe_path))
    if not mime_type:
        mime_type = "application/octet-stream"

    return FileResponse(
        path=str(safe_path),
        media_type=mime_type,
        filename=safe_path.name,
    )

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
app.mount("/api/v1/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="api_v1_uploads")
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="api_uploads")

# Routers
PREFIX = "/api/v1"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(classes.router, prefix=PREFIX)
app.include_router(sessions.router, prefix=PREFIX)
app.include_router(curriculum.router, prefix=PREFIX)
app.include_router(questions.router, prefix=PREFIX)
app.include_router(ai.router, prefix=PREFIX)
app.include_router(exams.router, prefix=PREFIX)
app.include_router(exercises.router, prefix=PREFIX)
app.include_router(assignments.router, prefix=PREFIX)
app.include_router(rubrics.router, prefix=PREFIX)
app.include_router(analytics.router, prefix=PREFIX)
app.include_router(documents.router, prefix=PREFIX)
app.include_router(compiler.router, prefix=PREFIX)
app.include_router(attendance.router, prefix=PREFIX)



@app.get("/")
@app.head("/")
async def root():
    return {
        "status": "online",
        "app": "Edumate API",
        "docs_url": "/docs",
        "api_v1": PREFIX,
    }



@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0", "app": settings.APP_NAME}


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)
