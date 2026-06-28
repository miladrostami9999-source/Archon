from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.models.database import init_db
from app.routers import companies
from app.routers import auth

load_dotenv()

app = FastAPI(
    title="Archon API",
    description="Business Intelligence System for Armila Design",
    version="0.2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()

app.include_router(companies.router)
app.include_router(auth.router)

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
