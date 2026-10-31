@echo off
title ProjectSync Localhost Launcher
echo ========================================================
echo  Starting ProjectSync Full Stack...
echo ========================================================
echo.

echo Starting Python AI Microservice (Port 8000)...
start "ProjectSync AI Service" cmd /c "cd Backend\ai-service && call start.bat"
timeout /t 5 /nobreak >nul

echo Starting C# ASP.NET Core Backend (Port 5000)...
start "ProjectSync C# API" cmd /c "cd Backend\ProjectSync.Api && dotnet run"
timeout /t 5 /nobreak >nul

echo Starting React Vite Frontend...
start "ProjectSync Frontend" cmd /c "npm run dev"

echo.
echo All services have been launched in separate windows!
echo - AI Service: http://localhost:8000
echo - Backend API: http://localhost:5000
echo - Frontend: http://localhost:5173
echo.
pause
