@echo off
chcp 65001 >nul 2>&1
title ScribeFlow
cd /d "%~dp0"

echo =======================================================
echo          ScribeFlow AI Copywriter Console
echo =======================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found.
    echo Please install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

if not exist "copywriter\node_modules" (
    echo [INFO] Installing dependencies, please wait...
    call npm --prefix copywriter install
)

echo [STARTING] Opening ScribeFlow in your browser...
echo [URL] http://127.0.0.1:5173
echo.
echo Tip: Keep this window open while using ScribeFlow.
echo -------------------------------------------------------
echo.

call npm --prefix copywriter run dev -- --open