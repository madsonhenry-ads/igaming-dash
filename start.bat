@echo off
REM DASH-IGAMING - Quick Start Script (Windows)

echo ============================================
echo DASH-IGAMING - Quick Start
echo ============================================

echo.
echo [1/5] Starting Docker Infrastructure...
cd "%~dp0infrastructure\docker"
docker-compose up -d

echo.
echo [2/5] Waiting for PostgreSQL to be ready...
timeout /t 5 /nobreak >nul

echo.
echo [3/5] Installing Dashboard Dependencies...
cd "%~dp0dashboard"
if not exist "node_modules" (
    call npm install
) else (
    echo Dashboard dependencies already installed.
)

echo.
echo [4/5] Generating Prisma Client and pushing schema...
call npm run db:generate
call npm run db:push

echo.
echo [5/5] Starting Services...
echo.
echo DASHBOARD:     Starting on http://localhost:3000
echo POSTBACK:      Starting on http://localhost:3001
echo WHATSAPP:      Starting on http://localhost:3002
echo EVOLUTION API: Running on http://localhost:8080
echo.
echo ============================================
echo Press CTRL+C to stop all services
echo ============================================

REM Start dashboard in background
start "DASH-IGAMING Dashboard" cmd /k "cd /d "%~dp0dashboard" && npm run dev"

REM Start postback in background
start "DASH-IGAMING Postback" cmd /k "cd /d "%~dp0services\postback" && npm install && npm run dev"

REM Start whatsapp in background
start "DASH-IGAMING WhatsApp" cmd /k "cd /d "%~dp0services\whatsapp" && npm install && npm run dev"

echo.
echo All services started! Check the opened windows for logs.
echo.
echo To stop all services, close all windows and run:
echo docker-compose down
echo.
pause
