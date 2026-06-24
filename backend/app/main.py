from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Archon API",
    description="Business Intelligence System for Armila Design",
    version="0.1.0"
)

# CORS — اجازه اتصال از frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "system": "Archon",
        "by": "Armila Design",
        "status": "running",
        "version": "0.1.0"
    }

@app.get("/health")
def health():
    return {"status": "ok"}