import os
import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from app.models.database import init_db
from app.routers import companies
from app.routers import auth
from app.routers import marketplace
from app.routers import google_oauth

load_dotenv()

app = FastAPI(
    title="Archon API",
    description="Business Intelligence System for Armila Design",
    version="0.2.0"
)

# CORS — allowed origins come from .env (comma-separated).
# Falls back to localhost dev ports if not set, so local development
# keeps working without any extra configuration.
_origins_env = os.getenv("ALLOWED_ORIGINS", "")
if _origins_env:
    ALLOWED_ORIGINS = [o.strip() for o in _origins_env.split(",") if o.strip()]
else:
    ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()
    from app.services import digest_scheduler
    digest_scheduler.start()


@app.on_event("shutdown")
def shutdown():
    from app.services import digest_scheduler
    digest_scheduler.shutdown()

app.include_router(companies.router)
app.include_router(auth.router)
app.include_router(marketplace.router)
app.include_router(google_oauth.router)


@app.exception_handler(Exception)
async def log_unhandled_exceptions(request: Request, exc: Exception):
    """Every unhandled 500 lands in the platform diagnostics log, so the admin
    can see what broke, where, and when — without needing server console access."""
    from app.models.database import SessionLocal
    from app.services.platform_log import log_event

    db = SessionLocal()
    try:
        log_event(
            db, "error", f"{request.method} {request.url.path}",
            str(exc), traceback.format_exc(),
        )
        db.commit()
    except Exception:
        pass
    finally:
        db.close()
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

@app.get("/")
def root():
    return {
        "system": "Archon",
        "by": "Armila Design",
        "status": "running",
        "version": "0.2.0"
    }

@app.get("/health")
def health():
    return {"status": "ok"}
