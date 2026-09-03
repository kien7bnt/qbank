# 🎓 QBank - Question Bank & Multi-Agent AI System

**Status**: ✅ **PHASE 1 & 2 COMPLETE** | Production Ready  
**Version**: 1.0.0  
**Last Updated**: 2024

---

## 🎯 Overview

QBank is a comprehensive education platform combining:
- **Phase 1**: Full-featured Question Bank & Classes Management system
- **Phase 2**: AI Orchestrator with 4 specialized agents for intelligent question generation, classification, distractor creation, and quality review

### Key Highlights

✅ **Complete Backend API** (20+ endpoints)  
✅ **Full-Stack React Frontend** (TypeScript + Tailwind)  
✅ **AI-Powered Question Creation** (Generation Agent)  
✅ **Auto-Classification** (Classification Agent)  
✅ **Distractor Generation** (Distractor Agent)  
✅ **Quality Assessment** (Quality Review Agent)  
✅ **Multi-Provider AI** (OpenAI + Ollama)  
✅ **Production Database** (SQLite/PostgreSQL)  
✅ **Security** (JWT + RBAC)  

---

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- Optional: Ollama (for free local AI)

### Option 1: Automated Start (Recommended)

**Windows:**
```bash
start.bat
```

**macOS/Linux:**
```bash
chmod +x start.sh
./start.sh
```

### Option 2: Manual Start

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Access URLs

| Component | URL |
|-----------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://127.0.0.1:8000 |
| API Docs | http://127.0.0.1:8000/docs |
| ReDoc | http://127.0.0.1:8000/redoc |

### Demo Login

```
Email: admin@qbank.vn
Password: Admin@123
```

---

## 📚 Phase 1: Question Bank & Classes (COMPLETE)

### Features

#### Question Management
- Create, edit, delete questions
- Support for MCQ, Essay, and Coding questions
- Search and filter by type, status, bloom level, difficulty
- Version history tracking
- Soft delete support

#### Class Management
- Create and manage classes
- Join classes with code
- Manage class members
- Class statistics

#### Curriculum Structure
- Hierarchical: Subject → Chapter → Topic → Lesson
- Learning objectives management
- Question organization by curriculum

---

## 🤖 Phase 2: AI Orchestrator & Agents (COMPLETE)

### 4 AI Agents

1. **Generation Agent** - Create questions from scratch
2. **Classification Agent** - Auto-categorize questions
3. **Distractor Agent** - Generate plausible wrong answers
4. **Quality Review Agent** - Assess question quality

### AI Providers Supported
- ✅ Ollama (local, free)
- ✅ OpenAI (cloud, paid)
- ✅ Extensible for custom providers

---

## 📖 Full Documentation

- **[COMPLETION_REPORT.md](./COMPLETION_REPORT.md)** - Detailed completion report
- **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** - Full API & implementation guide
- **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** - Original project status
- **Swagger UI**: http://127.0.0.1:8000/docs
- **ReDoc**: http://127.0.0.1:8000/redoc

---

## 🛠️ Tech Stack

### Backend
- **Framework**: FastAPI
- **Database**: SQLAlchemy ORM
- **Auth**: JWT + Argon2
- **AI**: Custom orchestrator
- **Server**: Uvicorn

### Frontend
- **Framework**: React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Data**: React Query
- **Build**: Vite

---

## 🔐 Security

- ✅ JWT authentication
- ✅ Role-based access control (RBAC)
- ✅ Argon2 password hashing
- ✅ CORS protection
- ✅ Owner-based authorization

---

## 📊 Project Status

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Questions CRUD | ✅ Complete |
| 1 | Classes Management | ✅ Complete |
| 1 | Curriculum Tree | ✅ Complete |
| 2 | AI Orchestrator | ✅ Complete |
| 2 | Generation Agent | ✅ Complete |
| 2 | Classification Agent | ✅ Complete |
| 2 | Distractor Agent | ✅ Complete |
| 2 | Quality Review Agent | ✅ Complete |
| 3 | Exam Management | 📋 Planned |
| 4 | Assignments | 📋 Planned |
| 5 | Psychometrics | 📋 Planned |

---

## 📞 Support

- **API Documentation**: http://127.0.0.1:8000/docs
- **Full Guide**: See IMPLEMENTATION_GUIDE.md
- **Issues**: GitHub Issues

---

**Built with ❤️ for educators worldwide.**
