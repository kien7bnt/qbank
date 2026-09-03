# 📊 TRẠNG THÁI DỰ ÁN QBANK

**Ngày cập nhật**: 2026-08-31  
**Tình trạng chung**: ⚙️ **Đang xây dựng — Phase 1**

---

## 🎯 TÓMO LẠI MASTER PROMPT

Dự án cần xây dựng hệ thống **Quản lý Ngân hàng Câu Hỏi & Kiểm Tra Đào Tạo** tích hợp **Multi-Agent AI** theo 63 yêu cầu chi tiết với triết lý:

> **Đơn giản → Nhanh → Dễ hiểu → Ít click → AI hỗ trợ → Kiểm soát dữ liệu → Mở rộng được**

---

## ✅ PHẦN ĐÃ HOÀN THÀNH

### Infrastructure & Setup
- ✅ Project structure (Backend + Frontend)
- ✅ Backend: FastAPI + SQLAlchemy + SQLite
- ✅ Frontend: React 19 + TypeScript + Tailwind CSS + Vite
- ✅ Authentication (JWT Token)
- ✅ CORS Configuration
- ✅ Dependency Injection (Database Session)
- ✅ Environment Configuration (.env)

### Database Models
- ✅ Users & Roles
- ✅ Classes & Class Members
- ✅ Subjects, Chapters, Topics, Lessons
- ✅ Learning Objectives
- ✅ Questions (Base Model)
- ✅ Question Types (MCQ, Essay, Coding — structure ready)

### API Endpoints (Hoàn thành 40%)
- ✅ Authentication
  - POST `/api/v1/auth/login`
  - POST `/api/v1/auth/logout`
  - POST `/api/v1/auth/refresh`
- ✅ Classes
  - GET `/api/v1/classes`
  - POST `/api/v1/classes`
  - GET `/api/v1/classes/{id}`
  - GET `/api/v1/classes/{id}/members`
- ✅ Curriculum (Basic)
  - GET `/api/v1/curriculum/subjects`
- ⚠️ Questions
  - GET `/api/v1/questions` — Partial
  - POST `/api/v1/questions` — Partial

### Frontend Pages
- ✅ Login Page
- ✅ Dashboard (Skeleton)
- ✅ Classes Page (Partial)
- ✅ Class Detail Page (Started)
- ✅ Question Bank Page (UI skeleton)
- ✅ Question Table (UI skeleton)
- ✅ Question Detail Drawer (Structure)

### UI Components
- ✅ Button, Input, Modal, Spinner
- ✅ Sidebar Navigation
- ✅ Empty State
- ✅ Badge (Status badge)
- ✅ Layout (Header + Sidebar)

### State Management
- ✅ Auth Store (Zustand)
- ✅ UI Store (Sidebar state)

### Database Seeding
- ✅ Demo Users (Admin, Teacher)
- ✅ Roles
- ✅ Subjects & Curriculum Structure
- ✅ Learning Objectives

---

## ❌ PHẦN CHƯA HOÀN THÀNH

### 1️⃣ PHASE 1 — Cơ Bản (30% hoàn thành)

#### Module Classes (50%)
- ❌ Join Class functionality (UI done, API incomplete)
- ❌ Class invitation/join code generation
- ❌ Class member management (add/remove students)
- ❌ Class status tracking
- ❌ Bulk student import
- ❌ Class analytics dashboard

#### Module Question Bank (20%)
- ❌ Curriculum Tree (UI skeleton only)
- ❌ Question CRUD Operations
  - ❌ Create Question form (advanced)
  - ❌ Edit Question
  - ❌ Delete Question
  - ❌ Duplicate Question
- ❌ Question Search & Filter
  - ❌ Search by stem/ID/subject/bloom/difficulty
  - ❌ Advanced filtering
- ❌ Bulk Actions
  - ❌ Select multiple questions
  - ❌ Bulk move/tag/archive
- ❌ Question Versioning
- ❌ Question Status (Draft/Review/Published)

#### Question Types (0%)
- ❌ MCQ with Multiple Choice support
- ❌ Essay Questions with Rubrics
- ❌ Coding Problems with Test Cases

#### API for Questions (0%)
- ❌ POST `/api/v1/questions` (full)
- ❌ PUT `/api/v1/questions/{id}`
- ❌ DELETE `/api/v1/questions/{id}`
- ❌ GET `/api/v1/questions/search`
- ❌ GET `/api/v1/questions/{id}`
- ❌ POST `/api/v1/questions/bulk-actions`
- ❌ GET `/api/v1/questions/versions/{id}`

---

### 2️⃣ PHASE 2 — AI Multi-Agent (0% hoàn thành)

#### AI Orchestrator (0%)
- ❌ Agent Router
- ❌ Prompt versioning
- ❌ AI Provider abstraction (OpenAI/Local/Ollama)
- ❌ Structured Output validation
- ❌ Confidence scoring
- ❌ Retry logic
- ❌ Logging & audit trail

#### Agents (0%)
1. **Generation Agent** ❌
   - Input: Subject, Grade, Topic, Bloom, Difficulty
   - Output: Question JSON with stem, options, correct answer

2. **Classification Agent** ❌
   - Input: Question text
   - Output: Subject, Chapter, Topic, Bloom, Difficulty with confidence

3. **Distractor Agent** ❌
   - Input: Correct answer + stem
   - Output: 3 plausible wrong answers with reasoning

4. **Quality Review Agent** ❌
   - Input: Full question
   - Output: Quality score, issues, suggestions

5. **Matrix Agent** ❌ (Phase 3)
   - Generate exam matrix from blueprint

6. **Selection Agent** ❌ (Phase 3)
   - Select questions matching matrix constraints

7. **Psychometric Agent** ❌ (Phase 4)
   - Calculate IF, ID after exam

#### AI APIs (0%)
- ❌ POST `/api/v1/ai/questions/generate`
- ❌ POST `/api/v1/ai/questions/classify`
- ❌ POST `/api/v1/ai/questions/distractors`
- ❌ POST `/api/v1/ai/questions/review`
- ❌ POST `/api/v1/ai/matrix/generate`
- ❌ GET `/api/v1/ai/status`

#### AI UX Components (0%)
- ❌ AI Suggestion Box (inline)
- ❌ AI Generation Modal
- ❌ Confidence Badge
- ❌ AI Loading State
- ❌ Approval/Rejection UI
- ❌ Batch AI Processing

---

### 3️⃣ PHASE 3 — Exam & Matrix (0% hoàn thành)

#### Database Models (0%)
- ❌ Exam Matrix
- ❌ Exam Matrix Rules
- ❌ Exams
- ❌ Exam Sections
- ❌ Exam Questions

#### Module Ma Trận Đề (0%)
- ❌ Create Matrix (UI)
- ❌ Matrix Editor
- ❌ Section Configuration
- ❌ Constraint Rules
- ❌ Question Selection Preview
- ❌ Matrix Save/Publish

#### Module Kiểm Tra (0%)
- ❌ Exam Creation
- ❌ Section Management
- ❌ Time Configuration
- ❌ Question Bank Selection
- ❌ Exam Publication
- ❌ Exam Access Control

#### APIs (0%)
- ❌ Matrix CRUD
- ❌ Exam CRUD
- ❌ Question Selection endpoint

---

### 4️⃣ PHASE 4 — Học Tập & Psychometrics (0% hoàn thành)

#### Database Models (0%)
- ❌ Assignments
- ❌ Student Attempts
- ❌ Student Responses
- ❌ Item Psychometrics
- ❌ Distractor Analysis

#### Module Bài Tập (0%)
- ❌ Assignment Creation
- ❌ Assignment Questions
- ❌ Student Assignment List
- ❌ Student Attempt Interface
- ❌ Attempt Review & Feedback

#### Module Kiểm Tra (Student) (0%)
- ❌ Exam Taking Interface
- ❌ Timer
- ❌ Answer Review
- ❌ Submit Exam
- ❌ Result Display
- ❌ Score Calculation

#### Psychometrics (0%)
- ❌ IF (Item Facility) Calculation
- ❌ ID (Item Discrimination) Calculation
- ❌ Distractor Effectiveness
- ❌ Psychometric Report
- ❌ Question Quality Recommendations

#### APIs (0%)
- ❌ Assignment CRUD
- ❌ Student Attempt CRUD
- ❌ Psychometric Calculation
- ❌ Results Endpoint

---

### 5️⃣ PHASE 5 — Advanced Features (0% hoàn thành)

- ❌ AI Feedback Loop & Improvement
- ❌ Bulk Import (Excel/PDF/Word)
- ❌ Adaptive Question Selection
- ❌ Analytics & Dashboard
- ❌ Duplicate Detection
- ❌ Question Recommendation
- ❌ Bulk AI Processing

---

## 📁 FILE STRUCTURE STATUS

```
✅ backend/
   ✅ app/
      ✅ models/          — Question, User, Class, Curriculum (80%)
      ✅ schemas/         — Pydantic models (60%)
      ✅ services/        — Business logic (40%)
      ⚠️  api/v1/          — Endpoints (40%)
      ⚠️  core/           — Security, config (80%)
      ✅ db/              — Database setup (90%)
      ❌ ai/              — AI Orchestrator & Agents (0%)
         ❌ agents/       — Agent implementations (0%)
         ❌ providers/    — LLM providers (0%)
      ❌ workers/         — Background jobs (0%)

✅ frontend/
   ✅ src/
      ✅ app/             — Pages & Layout (60%)
      ✅ components/      — UI Components (70%)
      ✅ features/        — Feature modules (40%)
      ✅ stores/          — State Management (80%)
      ✅ services/        — API Client (50%)
      ❌ hooks/           — Custom hooks (0%)
      ❌ types/           — TypeScript types (30%)
```

---

## 🚀 KHUYẾN NGHỊ BƯỚC TIẾP THEO

### NGAY LẬP TỨC (Tiếp tục Phase 1)

**Priority 1 — Question Bank Core (1-2 ngày)**
1. Hoàn thành Question CRUD API
2. Curriculum Tree UI (expand/collapse/search)
3. Question Create Form (progressive disclosure)
4. Question Detail View
5. Question List & Search

**Priority 2 — Classes Module (1 ngày)**
1. Join Class functionality
2. Class member management
3. Student list view
4. Class invitation/join code

**Priority 3 — Support APIs (1 ngày)**
1. Curriculum endpoints (subjects/chapters/topics)
2. Learning objectives endpoint
3. Search & filter endpoints

### SAU ĐÓ (Phase 2 — AI, 3-5 ngày)

1. Setup AI Orchestrator framework
2. LLM Provider abstraction
3. Implement Generation Agent
4. Implement Classification Agent
5. Implement Distractor Agent
6. Implement Quality Agent
7. UI for AI suggestions

---

## 📊 ĐIỂM CẦN LƯU Ý

### Những gì ĐÃ làm đúng ✅
- Kiến trúc sạch (models/schemas/services/api tách biệt)
- Database migration-ready (SQLAlchemy)
- Authentication hoàn chỉnh
- UI component library đã có
- Tailwind design consistent

### Những gì CẦN SỬA ⚠️
- Question model chưa complete (missing psychometrics fields)
- Questions API chưa có search/filter
- Curriculum Tree UI là skeleton
- AI layer hoàn toàn empty
- Import functionality chưa có
- No background job queue setup
- Psychometrics fields chưa trong DB

### Kiến trúc AI chưa được xây dựng ❌
- Không có Orchestrator
- Không có Agent base class
- Không có LLM provider abstraction
- Không có structured output validation
- Không có confidence scoring

---

## 💡 TRẠNG THÁI CUỐI CÙNG

**Dự án hiện tại ở**: **Cuối Phase 1**
- Core infrastructure: ✅ 85%
- Question Bank: ⚠️ 20%
- Classes: ⚠️ 50%
- AI Orchestrator: ❌ 0%
- Testing & Deployment: ❌ 0%

**Để có MVP hoàn chỉnh cần**: 5-7 ngày làm việc (đội 2 người)

---

**Bước tiếp theo**: Xác nhận yêu cầu ưu tiên và bắt đầu từ Question Bank CRUD.
