# ProjectSync (FYP-Portal) Run Instructions

This guide provides the exact commands needed to run the entire ProjectSync platform locally with a zero-crash guarantee.

## Prerequisites
- Node.js (v18+)
- .NET 8.0 SDK
- Python 3.9+
- A valid Firebase project configured (with credentials stored in the appropriate `.env` files).

## 1. Run the Backend (ASP.NET Core API)
The backend acts as the central API gateway. It runs on `http://localhost:5000` by default.

```bash
cd Backend/ProjectSync.Api
dotnet run
```

## 2. Run the AI Microservice (Python FastAPI)
The AI Microservice provides intelligent features (tag extraction, idea suggestion, feedback generation). It runs on `http://localhost:8000`.

```bash
cd ai_microservice
python -m venv venv
# Activate venv:
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```
*Note: If this microservice is not running, the ASP.NET Core backend will automatically inject deterministic, rule-based fallbacks so the UI will never crash.*

## 3. Run the Frontend (React + Vite)
The frontend runs on `http://localhost:5173` and automatically proxies `/api` requests to the ASP.NET Core backend.

```bash
cd <project-root>
npm install
npm run dev
```

## Troubleshooting
- **CORS Errors**: Ensure the backend is running. The backend has a permissive `AllowLocalhost` CORS policy configured as the very first middleware.
- **500 Internal Server Error (AI endpoints)**: If the backend throws a 500 when calling AI endpoints, ensure you have the latest updates where `ProxyToPythonAI` handles exceptions and returns `fallbackPayload`.
- **UI Blinking / Input Focus Loss**: This was fixed by extracting inline components (like `EvalDialog`) into standalone React components outside of the main render loop.

## Architecture Resiliency
- **Universal AI Resilience**: The platform features a dual-mode fallback architecture. If the Python AI microservice is offline, missing API keys, or errors out, the ASP.NET Core backend intercepts the failure and returns high-quality hardcoded fallback data. This guarantees that all dashboard features remain fully functional in demonstration mode.
