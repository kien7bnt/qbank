@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

REM =====================================================
REM  Edumate Quick Start Script for Windows
REM =====================================================

echo.
echo  =====================================================
echo   Edumate - He thong Quan ly Ngan hang Cau hoi & Khao thi
echo  =====================================================
echo.

set "BASE_DIR=%~dp0"

REM -----------------------------------------------------
REM  KIEM TRA PYTHON
REM -----------------------------------------------------
set "PY_CMD="
where python >nul 2>&1 && set "PY_CMD=python"
if not defined PY_CMD (
    where py >nul 2>&1 && set "PY_CMD=py"
)
if not defined PY_CMD (
    echo [LOI] Python chua duoc cai dat hoac chua duoc them vao PATH.
    echo Vui long cai dat Python 3.10+ tai https://www.python.org/
    pause
    exit /b 1
)

REM -----------------------------------------------------
REM  KIEM TRA NODE.JS
REM -----------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
    echo [LOI] Node.js chua duoc cai dat hoac chua duoc them vao PATH.
    echo Vui long cai dat Node.js tai https://nodejs.org/
    pause
    exit /b 1
)

REM =====================================================
REM  1. DON DEP TIEN TRINH CU (GIAI PHONG PORT)
REM =====================================================
echo [1/4] Kiem tra va giai phong port 8000 va 5173 neu dang chay...

powershell -NoProfile -Command "try { Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction Stop | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } } catch {}" >nul 2>&1
powershell -NoProfile -Command "try { Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction Stop | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } } catch {}" >nul 2>&1

REM =====================================================
REM  2. CHUAN BI VA KHOI DONG BACKEND
REM =====================================================
echo [2/4] Chuan bi moi truong va khoi dong Backend...
cd /d "%BASE_DIR%backend"

REM Tao virtual environment neu chua co
if not exist "venv\Scripts\activate.bat" (
    echo       Khoi tao virtual environment venv...
    %PY_CMD% -m venv venv
)

REM Kich hoat virtual environment
call venv\Scripts\activate.bat

REM Kiem tra dependencies co ban cua backend
python -c "import uvicorn, fastapi, sqlalchemy, aiosqlite" >nul 2>&1
if errorlevel 1 (
    echo       Cai dat hoac cap nhat thu vien backend...
    pip install -r requirements.txt
)

REM Tao thu muc uploads neu chua co
if not exist "uploads" mkdir uploads
if not exist "uploads\sessions" mkdir uploads\sessions

REM Khoi tao database tables truoc khi bat server
python -c "import asyncio; from app.db.session import init_db; asyncio.run(init_db())" >nul 2>&1

REM Khoi dong backend trong cua so rieng
start "Edumate Backend (Port 8000)" cmd /k "chcp 65001 >nul && call venv\Scripts\activate.bat && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo       Dang khoi dong Backend - doi 3 giay...
ping 127.0.0.1 -n 4 >nul

REM =====================================================
REM  3. CHUAN BI VA KHOI DONG FRONTEND
REM =====================================================
echo [3/4] Chuan bi va khoi dong Frontend...
cd /d "%BASE_DIR%frontend"

if not exist "node_modules" (
    echo       Dang cai dat npm dependencies...
    call npm install
)

REM Khoi dong frontend trong cua so rieng
start "Edumate Frontend (Port 5173)" cmd /k "chcp 65001 >nul && npm run dev"

echo       Dang khoi dong Frontend - doi 3 giay...
ping 127.0.0.1 -n 4 >nul

REM =====================================================
REM  4. MO TRINH DUYET
REM =====================================================
echo [4/4] Mo trinh duyet web...
start http://localhost:5173

cd /d "%BASE_DIR%"

echo.
echo  =====================================================
echo   Edumate da khoi dong thanh cong!
echo  =====================================================
echo   Frontend    : http://localhost:5173
echo   Backend API : http://127.0.0.1:8000
echo   API Docs    : http://127.0.0.1:8000/docs
echo.
echo   Tai khoan demo:
echo     Email   : admin@qbank.vn
echo     Password: Admin@123
echo.
echo   Luu y:
echo     - Khong tat cac cua so 'Edumate Backend' va 'Edumate Frontend'.
echo     - De dung he thong, chi can dong cac cua so do.
echo  =====================================================
echo.
pause
