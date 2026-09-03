@echo off
REM =====================================================
REM  QBank Quick Start Script for Windows
REM =====================================================

echo.
echo  =====================================================
echo   QBank - Multi-Agent AI Question Studio
echo  =====================================================
echo.

REM -- Kiem tra Python --
where python >nul 2>&1
if errorlevel 1 (
    echo [LOI] Python chua duoc cai hoac chua duoc them vao PATH.
    pause
    exit /b 1
)

REM -- Kiem tra Node.js --
where node >nul 2>&1
if errorlevel 1 (
    echo [LOI] Node.js chua duoc cai hoac chua duoc them vao PATH.
    pause
    exit /b 1
)

set "BASE_DIR=%~dp0"

REM =====================================================
REM  1. BACKEND
REM =====================================================
echo [1/3] Chuan bi va khoi dong Backend...
cd /d "%BASE_DIR%backend"

if not exist "venv\Scripts\activate.bat" (
    echo       Tao virtual environment...
    python -m venv venv
)

if not exist "uploads" mkdir uploads

REM Khoi dong backend trong cua so rieng
start "QBank Backend" cmd /k "call venv\Scripts\activate.bat && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

REM Dung ping de doi 3 giay (an toan tuyet doi tren moi phien ban Windows)
ping 127.0.0.1 -n 4 >nul

REM =====================================================
REM  2. FRONTEND
REM =====================================================
echo [2/3] Chuan bi va khoi dong Frontend...
cd /d "%BASE_DIR%frontend"

if not exist "node_modules" (
    echo       Dang cai dat npm dependencies...
    call npm install
)

REM Khoi dong frontend trong cua so rieng
start "QBank Frontend" cmd /k "npm run dev"

REM Doi 2 giay truoc khi mo trinh duyet
ping 127.0.0.1 -n 3 >nul

REM =====================================================
REM  3. MO TRINH DUYET
REM =====================================================
echo [3/3] Mo trinh duyet web...
start http://localhost:5173

cd /d "%BASE_DIR%"

echo.
echo  =====================================================
echo   QBank da khoi dong thanh cong!
echo  =====================================================
echo   Frontend    : http://localhost:5173
echo   Backend API : http://127.0.0.1:8000
echo   API Docs    : http://127.0.0.1:8000/docs
echo.
echo   Dang nhap demo:
echo     Email   : admin@qbank.vn
echo     Password: Admin@123
echo.
echo   Tinh nang moi:
echo     - Quy tac su pham AI (rule.md)
echo     - Sinh cau hoi tu kho tai lieu & prompt tap trung
echo     - Cai thien cau hoi theo yeu cau
echo.
echo   Dong cac cua so Backend / Frontend de dung server.
echo  =====================================================
echo.
pause
