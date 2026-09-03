#!/bin/bash
# QBank Quick Start Script
# Run this to start both backend and frontend

set -e

echo "🚀 QBank Quick Start"
echo "===================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.9+"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Start Backend
echo "📦 Starting Backend..."
cd backend
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate 2>/dev/null || . venv/Scripts/activate 2>/dev/null || true

# Install requirements if uvicorn is missing or the install marker is stale
if [ ! -f ".installed" ] || ! python - <<'PY'
import importlib.util
import sys
sys.exit(0 if importlib.util.find_spec("uvicorn") else 1)
PY
then
    echo "Installing Python dependencies..."
    pip install -q -r requirements.txt
    touch .installed
fi

# Run backend
echo "✅ Backend starting on http://127.0.0.1:8000"
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

cd ..

# Start Frontend
echo ""
echo "🎨 Starting Frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install --quiet
fi

echo "✅ Frontend starting on http://localhost:5173"
npm run dev &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

cd ..

echo ""
echo "===================="
echo "🎉 QBank is running!"
echo ""
echo "📚 Backend (API):   http://127.0.0.1:8000"
echo "📖 API Docs:        http://127.0.0.1:8000/docs"
echo "🎨 Frontend:        http://localhost:5173"
echo ""
echo "🤖 AI Configuration:"
echo "   Current: $AI_PROVIDER (check backend/.env)"
echo "   Options: ollama (local, free) or openai (cloud, requires key)"
echo ""
echo "📝 Demo Login:"
echo "   Email: admin@qbank.vn"
echo "   Password: Admin@123"
echo ""
echo "Press Ctrl+C to stop both servers..."
echo "===================="

# Wait for both processes
wait
