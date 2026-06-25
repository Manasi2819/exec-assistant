"""
Executive AI Assistant — FastAPI Application Entry Point
"""
from __future__ import annotations
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.llm_router import get_active_provider
from app.api.v1 import router as api_v1_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    provider = get_active_provider()
    print(f"🚀 Executive AI Assistant starting...")
    print(f"   LLM Provider: {provider.upper() if provider != 'none' else '⚠️  NONE — set OPENAI_API_KEY or GOOGLE_API_KEY'}")
    print(f"   Environment: {settings.app_env}")
    yield
    print("Executive AI Assistant shutting down.")


app = FastAPI(
    title="Executive AI Assistant",
    description="AI-powered executive assistant — email intelligence, calendar, meeting prep, transcripts.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/openapi.json",
)

# ── CORS ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Trace ID middleware ───────────────────────────────────────
@app.middleware("http")
async def add_trace_id(request: Request, call_next):
    trace_id = request.headers.get("X-Trace-ID", str(uuid.uuid4()))
    request.state.trace_id = trace_id
    response = await call_next(request)
    response.headers["X-Trace-ID"] = trace_id
    return response


# ── Health check ──────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    return {
        "status": "ok",
        "app": "Executive AI Assistant",
        "llm_provider": get_active_provider(),
        "version": "1.0.0",
    }


@app.get("/", tags=["Root"])
async def root():
    return {"message": "Executive AI Assistant API", "docs": "/api/v1/docs"}


# ── API Routes ────────────────────────────────────────────────
app.include_router(api_v1_router, prefix="/api/v1")
