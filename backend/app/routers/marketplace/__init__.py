from fastapi import APIRouter

from . import projects, proposals, contracts, milestones, admin, chat

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

for module in (projects, proposals, contracts, milestones, admin, chat):
    router.include_router(module.router)
