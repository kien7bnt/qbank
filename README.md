# QBank — Hệ Thống Ngân Hàng Câu Hỏi & Kiểm Tra

## Giới thiệu

QBank là nền tảng quản lý ngân hàng câu hỏi, bài tập và kiểm tra trực tuyến, tích hợp Multi-Agent AI. Hệ thống được thiết kế theo triết lý:

> **"AI làm phần khó, người dùng làm phần quyết định."**

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Backend | Python 3.12 + FastAPI |
| Database | PostgreSQL 16 + pgvector |
| Queue | Redis + Celery |
| AI | OpenAI / Ollama (abstracted) |

## Cài Đặt & Chạy

### Yêu cầu
- Docker & Docker Compose
- Node.js 20+
- Python 3.12+

### Cách 1: Docker Compose (Khuyến nghị)

```bash
cd qbank/docker
docker-compose up -d
```

Truy cập:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Cách 2: Chạy Local

#### Backend

```bash
cd qbank/backend

# Tạo virtualenv
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Mac/Linux

# Cài đặt deps
pip install -r requirements.txt

# Copy env
cp .env.example .env
# Chỉnh sửa .env với thông tin DB

# Chạy migration
alembic upgrade head

# Seed data
python -m app.db.init_data

# Chạy server
uvicorn main:app --reload
```

#### Frontend

```bash
cd qbank/frontend

npm install
npm run dev
```

## Tài Khoản Mặc Định

Sau khi seed data:

| Role | Email | Password |
|---|---|---|
| Admin | admin@qbank.vn | Admin@123 |

## Cấu Trúc Dự Án

```
qbank/
├── backend/          # Python FastAPI
│   ├── app/
│   │   ├── api/v1/   # Route handlers
│   │   ├── core/     # Config, security, deps
│   │   ├── models/   # SQLAlchemy models
│   │   ├── schemas/  # Pydantic schemas
│   │   ├── services/ # Business logic
│   │   ├── ai/       # Multi-Agent layer
│   │   └── db/       # Session, migrations
│   └── tests/
│
├── frontend/         # React TypeScript
│   └── src/
│       ├── features/ # Feature modules
│       ├── components/ui/  # Design system
│       ├── services/ # API clients
│       └── stores/   # Zustand state
│
└── docker/           # Docker configs
```

## Phase Roadmap

- [x] **Phase 1**: Auth, RBAC, Classes, Question Bank CRUD
- [ ] **Phase 2**: AI Agents (Generation, Classification, Distractor, Quality)
- [ ] **Phase 3**: Import, Matrix, Exam, Question Selection
- [ ] **Phase 4**: Assignments, Student Attempts, Results, Psychometrics
- [ ] **Phase 5**: AI Feedback Loop, Analytics, Adaptive Selection
