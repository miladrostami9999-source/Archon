from fastapi import APIRouter

from . import projects, proposals, contracts, milestones, admin

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

for module in (projects, proposals, contracts, milestones, admin):
    router.include_router(module.router)
