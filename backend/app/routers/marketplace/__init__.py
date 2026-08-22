from fastapi import APIRouter

from . import projects, proposals

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

for module in (projects, proposals):
    router.include_router(module.router)
