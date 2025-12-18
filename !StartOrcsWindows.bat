@echo off
title ORCS Intelligence System
color 0A

echo ============================================
echo    ORCS Intelligence System - Launcher
echo ============================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please download and install Node.js from:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js found
for /f "tokens=*" %%i in ('node -v') do echo     Version: %%i
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo [INFO] Installing dependencies... This may take a few minutes.
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies!
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencies installed
    echo.
)

:: Check if PostgreSQL database is configured
if "%DATABASE_URL%"=="" (
    echo [WARNING] DATABASE_URL not set. Using default local database.
    echo.
)

echo [INFO] Starting ORCS server...
echo.
echo ============================================
echo    Access ORCS at: http://localhost:5000
echo ============================================
echo.
echo Press Ctrl+C to stop the server.
echo.

:: Wait a moment then open browser
start "" cmd /c "timeout /t 3 >nul && start http://localhost:5000"

:: Start the server
call npm run dev

pause
