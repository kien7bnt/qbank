@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo.
echo  =====================================================
echo   QBank - Dung toan bo he thong Backend & Frontend
echo  =====================================================
echo.

REM 1. Dung Backend (cong 8000)
echo [1/2] Kiem tra va tat Backend tren cong 8000...
set "FOUND_8000=0"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    set "FOUND_8000=1"
    echo       Dang tat tien trinh Backend PID %%a...
    taskkill /f /pid %%a >nul 2>&1
)
if "!FOUND_8000!"=="0" (
    echo       Khong co Backend nao dang chay tren cong 8000.
) else (
    echo       [OK] Da dung Backend thanh cong!
)

REM 2. Dung Frontend (cong 5173)
echo.
echo [2/2] Kiem tra va tat Frontend tren cong 5173...
set "FOUND_5173=0"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
    set "FOUND_5173=1"
    echo       Dang tat tien trinh Frontend PID %%a...
    taskkill /f /pid %%a >nul 2>&1
)
if "!FOUND_5173!"=="0" (
    echo       Khong co Frontend nao dang chay tren cong 5173.
) else (
    echo       [OK] Da dung Frontend thanh cong!
)

echo.
echo  =====================================================
echo   Da dung toan bo he thong QBank an toan.
echo  =====================================================
echo.
pause
