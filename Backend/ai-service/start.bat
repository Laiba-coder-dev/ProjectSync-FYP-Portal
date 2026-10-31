@echo off
title ProjectSync AI Service
echo ============================================
echo  ProjectSync Python AI Microservice
echo  Port: 8000
echo ============================================
echo.

if not exist venv (
    echo [1/3] Creating virtual environment...
    python -m venv venv
)

echo [2/3] Installing dependencies...
call venv\Scripts\activate.bat
pip install -r requirements.txt --quiet

echo [3/3] Starting AI service on http://localhost:8000
echo Press Ctrl+C to stop.
echo.
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
