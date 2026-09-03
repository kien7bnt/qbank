from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1 import auth, classes, curriculum, questions, ai, exams, assignments, analytics, documents


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
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
PREFIX = "/api/v1"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(classes.router, prefix=PREFIX)
app.include_router(curriculum.router, prefix=PREFIX)
app.include_router(questions.router, prefix=PREFIX)
app.include_router(ai.router, prefix=PREFIX)
app.include_router(exams.router, prefix=PREFIX)
app.include_router(assignments.router, prefix=PREFIX)
app.include_router(analytics.router, prefix=PREFIX)
app.include_router(documents.router, prefix=PREFIX)


@app.get("/")
@app.head("/")
async def root():
    return {
        "status": "online",
        "app": "QBank API",
        "docs_url": "/docs",
        "api_v1": PREFIX,
    }



@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0", "app": settings.APP_NAME}
