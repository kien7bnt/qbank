@echo off
REM ============================================================
REM  QBank Public Share Tunnel
REM  Tao duong link Internet cong khai (HTTPS) truc tiep tu may
REM ============================================================

echo.
echo  =====================================================
echo   QBank - Mo link Web cong khai ra Internet
echo  =====================================================
echo.

REM Kiem tra xem frontend da chay chua
netstat -ano | findstr 5173 >nul 2>&1
if errorlevel 1 (
    echo [THONG BAO] Dang khoi dong Backend va Frontend truoc...
    start /min "" cmd /c start.bat
    echo Cho 5 giay de he thong on dinh...
    ping 127.0.0.1 -n 6 >nul
)

echo.
echo Dang tao duong link HTTPS cong khai bang Pinggy/Localtunnel...
echo (Ban co the gui duong link ben duoi cho bat ky ai truy cap)
echo.
echo =====================================================

ssh -p 443 -R0:localhost:5173 -o StrictHostKeyChecking=no -o ServerAliveInterval=30 a.pinggy.io

if errorlevel 1 (
    echo.
    echo Thu phuong thuc du phong Localtunnel...
    npx --yes localtunnel --port 5173
)

echo.
pause
