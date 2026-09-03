# 🎓 QBank - Question Bank & Multi-Agent AI System
## Phase 1 & 2 Complete Implementation

### ✅ What's Implemented

#### **Phase 1: Question Bank & Classes Management (COMPLETE)**
- ✅ Question CRUD APIs (Create, Read, Update, Delete)
- ✅ Question Filtering & Search
- ✅ Question Versioning & History
- ✅ Class Management APIs
- ✅ Class Member Management
- ✅ Curriculum Tree Structure
- ✅ Frontend Components (React + TypeScript)
- ✅ Authentication & Authorization (RBAC)

#### **Phase 2: AI Orchestrator & Multi-Agent System (COMPLETE)**
- ✅ **AI Orchestrator** - Centralized routing and execution
- ✅ **Question Generation Agent** - Auto-generate questions with curriculum context
- ✅ **Classification Agent** - Auto-classify questions into curriculum
- ✅ **Distractor Agent** - Generate plausible wrong answers for MCQ
- ✅ **Quality Review Agent** - Review questions for quality issues
- ✅ **LLM Abstraction** - Support for OpenAI, Ollama, and more
- ✅ **AI API Endpoints** - Full REST API for all AI features
- ✅ **Error Handling & Retries** - Robust error handling with automatic retries

---

## 🚀 Quick Start

### Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Configure .env
# Option 1: Use Ollama (local, free)
# AI_PROVIDER=ollama
# OLLAMA_BASE_URL=http://localhost:11434
# OLLAMA_MODEL=llama2

# Option 2: Use OpenAI (requires API key)
# AI_PROVIDER=openai
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-3.5-turbo

# Start backend
python -m uvicorn main:app --reload
# Backend at http://127.0.0.1:8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
# Frontend at http://localhost:5173
```

### API Documentation

Once backend is running:
- **Swagger UI**: http://127.0.0.1:8000/docs
- **ReDoc**: http://127.0.0.1:8000/redoc

---

## 📚 Phase 1: Question Bank APIs

### Create Question

```bash
curl -X POST http://127.0.0.1:8000/api/v1/questions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "mcq",
    "stem": "Capital of France?",
    "options": [
      {"label": "A", "text": "Paris", "is_correct": true},
      {"label": "B", "text": "Lyon", "is_correct": false}
    ],
    "bloom_level": "remember",
    "expected_difficulty": "easy"
  }'
```

### List Questions with Filters

```bash
# Get all questions
curl http://127.0.0.1:8000/api/v1/questions \
  -H "Authorization: Bearer <token>"

# Filter by bloom level and difficulty
curl 'http://127.0.0.1:8000/api/v1/questions?bloom_level=understand&difficulty=medium' \
  -H "Authorization: Bearer <token>"

# Search questions
curl 'http://127.0.0.1:8000/api/v1/questions?search=photosynthesis' \
  -H "Authorization: Bearer <token>"
```

### Get Question Detail

```bash
curl http://127.0.0.1:8000/api/v1/questions/{question_id} \
  -H "Authorization: Bearer <token>"
```

### Update Question

```bash
curl -X PATCH http://127.0.0.1:8000/api/v1/questions/{question_id} \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "stem": "Updated question text",
    "bloom_level": "understand"
  }'
```

### Delete Question

```bash
curl -X DELETE http://127.0.0.1:8000/api/v1/questions/{question_id} \
  -H "Authorization: Bearer <token>"
```

### Get Question Versions

```bash
curl http://127.0.0.1:8000/api/v1/questions/{question_id}/versions \
  -H "Authorization: Bearer <token>"
```

---

## 🤖 Phase 2: AI APIs

### 1. Generate Question with AI

```bash
curl -X POST http://127.0.0.1:8000/api/v1/ai/questions/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Biology",
    "topic": "Photosynthesis",
    "chapter": "Plant Biology",
    "bloom_level": "understand",
    "expected_difficulty": "medium",
    "question_type": "mcq",
    "learning_objectives": ["Understand photosynthesis process", "Identify key reactions"],
    "auto_save": true
  }'
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "item_id": "Q0001",
  "type": "mcq",
  "status": "draft",
  "stem": "What is the primary purpose of photosynthesis in plants?",
  "options": [
    {
      "label": "A",
      "text": "Convert light energy into chemical energy",
      "is_correct": true
    },
    {
      "label": "B",
      "text": "Break down glucose for energy",
      "is_correct": false
    }
  ],
  "bloom_level": "understand",
  "expected_difficulty": "medium",
  "confidence": 0.92
}
```

### 2. Classify Question with AI

```bash
curl -X POST http://127.0.0.1:8000/api/v1/ai/questions/classify \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "stem": "What is photosynthesis?",
    "options": [
      {"label": "A", "text": "Process of making food from light", "is_correct": true},
      {"label": "B", "text": "Process of breaking down glucose", "is_correct": false}
    ]
  }'
```

Response:
```json
{
  "subject": "Biology",
  "chapter": "Plant Physiology",
  "topic": "Photosynthesis",
  "bloom_level": "understand",
  "expected_difficulty": "easy",
  "question_type": "mcq",
  "learning_objectives": ["Understand photosynthesis basics"],
  "confidence": 0.85,
  "reasoning": "The question directly addresses photosynthesis definition..."
}
```

### 3. Generate Distractors with AI

```bash
curl -X POST http://127.0.0.1:8000/api/v1/ai/questions/distractors \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "stem": "What is the primary purpose of photosynthesis?",
    "correct_answer": "Convert light energy into chemical energy",
    "topic": "Photosynthesis",
    "bloom_level": "understand",
    "num_distractors": 3
  }'
```

Response:
```json
{
  "distractors": [
    {
      "text": "Break down glucose to release energy",
      "reason": "Students often confuse photosynthesis with cellular respiration",
      "plausibility": 0.88
    },
    {
      "text": "Transport water from roots to leaves",
      "reason": "Common misconception about plant processes",
      "plausibility": 0.82
    },
    {
      "text": "Regulate body temperature in plants",
      "reason": "Students may think photosynthesis has thermal role",
      "plausibility": 0.75
    }
  ],
  "common_misconceptions": [
    "Confusing photosynthesis with cellular respiration",
    "Thinking photosynthesis is just water transport"
  ],
  "confidence": 0.89
}
```

### 4. Review Question Quality with AI

```bash
curl -X POST http://127.0.0.1:8000/api/v1/ai/questions/review \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "stem": "What is the primary purpose of photosynthesis?",
    "options": [
      {"label": "A", "text": "Convert light to chemical energy", "is_correct": true},
      {"label": "B", "text": "Break down glucose", "is_correct": false},
      {"label": "C", "text": "Transport water", "is_correct": false}
    ],
    "rationale": "Photosynthesis converts light energy into chemical energy stored in glucose",
    "bloom_level": "understand",
    "question_type": "mcq"
  }'
```

Response:
```json
{
  "overall_score": 0.88,
  "issues": [
    {
      "category": "clarity",
      "severity": "low",
      "description": "Question could be more specific about which organism",
      "suggestion": "Add 'in plants' to make it clearer"
    }
  ],
  "strengths": [
    "Clear, concise question text",
    "Appropriate for understand level",
    "Good distractors based on common misconceptions"
  ],
  "suggestions": [
    "Consider adding more context about why this matters",
    "Could ask about specific molecules involved"
  ],
  "is_publishable": true,
  "confidence": 0.91
}
```

### 5. Review Existing Question

```bash
curl -X POST http://127.0.0.1:8000/api/v1/ai/questions/{question_id}/review \
  -H "Authorization: Bearer <token>"
```

### 6. Check AI Provider Health

```bash
curl http://127.0.0.1:8000/api/v1/ai/health \
  -H "Authorization: Bearer <token>"
```

Response:
```json
{
  "status": "healthy",
  "provider": "OllamaProvider"
}
```

---

## 🏗️ Architecture

### Backend Structure

```
backend/
├── app/
│   ├── ai/                          # Phase 2: AI Infrastructure
│   │   ├── orchestrator.py          # Main orchestrator & agent base
│   │   ├── providers/               # LLM providers
│   │   │   └── base.py              # OpenAI, Ollama, etc.
│   │   └── agents/                  # Specific agents
│   │       ├── generation.py        # Generate questions
│   │       ├── classification.py    # Classify questions
│   │       ├── distractor.py        # Generate distractors
│   │       └── quality_review.py    # Review quality
│   ├── api/v1/
│   │   ├── questions.py            # Phase 1: Question CRUD
│   │   ├── classes.py              # Phase 1: Classes CRUD
│   │   ├── curriculum.py           # Phase 1: Curriculum tree
│   │   └── ai.py                   # Phase 2: AI endpoints
│   ├── models/                      # SQLAlchemy models
│   ├── schemas/                     # Pydantic validators
│   ├── services/                    # Business logic
│   └── core/                        # Config, security, etc.
├── requirements.txt
└── main.py
```

### Frontend Structure

```
frontend/
├── src/
│   ├── features/
│   │   ├── question-bank/          # Phase 1: Questions UI
│   │   │   ├── QuestionBankPage
│   │   │   ├── QuestionTable
│   │   │   ├── CreateQuestionModal
│   │   │   ├── QuestionDetailDrawer
│   │   │   └── CurriculumTree
│   │   ├── classes/                # Phase 1: Classes UI
│   │   ├── ai/                     # Phase 2: AI UI (planned)
│   │   └── ...
│   ├── services/api.ts             # API client
│   ├── stores/                     # Zustand stores
│   └── components/ui/              # Shared UI components
```

---

## 🔐 Authentication

### Login (Get Token)

```bash
curl -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@qbank.vn",
    "password": "Admin@123"
  }'
```

Response:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@qbank.vn",
    "full_name": "Admin User",
    "roles": ["admin"]
  }
}
```

### Using Token

```bash
curl http://127.0.0.1:8000/api/v1/questions \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc..."
```

### Demo Credentials

```
Admin:
  Email: admin@qbank.vn
  Password: Admin@123
  Roles: admin, teacher

Teacher:
  Email: teacher@qbank.vn
  Password: Teacher@123
  Roles: teacher
```

---

## 🧪 Testing Phase 2 AI

### Using Ollama (Free, Local)

1. **Install Ollama**: https://ollama.ai
2. **Download model**:
   ```bash
   ollama pull llama2  # or mistral, neural-chat, etc.
   ```
3. **Update .env**:
   ```
   AI_PROVIDER=ollama
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=llama2
   ```
4. **Run Ollama** (background):
   ```bash
   ollama serve
   ```

### Using OpenAI

1. **Get API key**: https://platform.openai.com/api-keys
2. **Update .env**:
   ```
   AI_PROVIDER=openai
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-3.5-turbo
   ```

### Test AI Endpoints

```bash
# 1. Check health
curl http://127.0.0.1:8000/api/v1/ai/health \
  -H "Authorization: Bearer <token>"

# 2. Generate question
curl -X POST http://127.0.0.1:8000/api/v1/ai/questions/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Biology",
    "topic": "Photosynthesis",
    "question_type": "mcq",
    "auto_save": false
  }'

# 3. Classify existing question
curl -X POST http://127.0.0.1:8000/api/v1/ai/questions/classify \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "stem": "What is DNA?",
    "options": [
      {"label": "A", "text": "Molecule carrying genetic info", "is_correct": true}
    ]
  }'
```

---

## 📊 Database Schema

### Key Tables

- **users** - User accounts with roles
- **roles** - Role definitions (admin, teacher, student)
- **questions** - Questions with metadata
- **question_options** - MCQ options
- **question_essay** - Essay question data
- **question_coding** - Coding question data
- **question_versions** - Version history
- **classes** - Class/course management
- **class_members** - Class enrollment
- **subjects, chapters, topics, lessons** - Curriculum hierarchy

---

## 🔄 Workflow: Creating Questions with AI

### Scenario: Teacher creates a Biology question

1. **Teacher clicks "Create with AI"**
2. **Select parameters**:
   - Subject: Biology
   - Topic: Photosynthesis
   - Bloom Level: Understand
   - Question Type: MCQ
3. **AI Generation Agent generates**:
   - Question stem
   - 4 MCQ options with correct answer marked
   - Rationale
   - Confidence score (0.92)
4. **AI Classification Agent auto-fills**:
   - Subject: ✓ Biology
   - Chapter: ✓ Plant Physiology
   - Topic: ✓ Photosynthesis
   - Bloom: ✓ Understand
5. **AI Quality Review Agent checks**:
   - ✓ Clear and specific
   - ✓ Appropriate difficulty
   - ✓ No bias
   - Overall Score: 0.88/1.0
6. **AI Distractor Agent suggests improvements**:
   - Replace option B with better distractor
   - Confidence: 0.85
7. **Teacher reviews and publishes**
   - Question saved to database
   - Ready to use in exams

---

## 🚦 Project Status

| Phase | Feature | Status | Endpoint |
|-------|---------|--------|----------|
| 1 | Question CRUD | ✅ Complete | `/api/v1/questions` |
| 1 | Filtering & Search | ✅ Complete | `?search=`, `?bloom_level=` |
| 1 | Question Versioning | ✅ Complete | `/api/v1/questions/{id}/versions` |
| 1 | Classes Management | ✅ Complete | `/api/v1/classes` |
| 1 | Curriculum Tree | ✅ Complete | `/api/v1/curriculum` |
| 1 | Frontend UI | ✅ Complete | React Components |
| 2 | AI Orchestrator | ✅ Complete | Core system |
| 2 | Generation Agent | ✅ Complete | `POST /api/v1/ai/questions/generate` |
| 2 | Classification Agent | ✅ Complete | `POST /api/v1/ai/questions/classify` |
| 2 | Distractor Agent | ✅ Complete | `POST /api/v1/ai/questions/distractors` |
| 2 | Quality Review Agent | ✅ Complete | `POST /api/v1/ai/questions/review` |
| 3 | Exam Management | ⏳ Planned | Phase 3 |
| 4 | Assignments | ⏳ Planned | Phase 4 |
| 5 | Psychometrics | ⏳ Planned | Phase 5 |

---

## 📝 Next Steps (Phase 3+)

- [ ] Exam creation & administration
- [ ] Assignment management
- [ ] AI grading & feedback
- [ ] Psychometric analysis (item analysis, Cronbach's alpha)
- [ ] Analytics & reporting dashboard
- [ ] Mobile app
- [ ] Real-time collaboration

---

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes following existing patterns
3. Test with: `pytest` (backend) / `npm test` (frontend)
4. Push and create PR

---

## 📞 Support

- **API Docs**: http://127.0.0.1:8000/docs
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions

---

**Built with ❤️ for educators and students everywhere.**
