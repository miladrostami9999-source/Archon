from fastapi import APIRouter

from . import projects, proposals, contracts

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

for module in (projects, proposals, contracts):
    router.include_router(module.router)
