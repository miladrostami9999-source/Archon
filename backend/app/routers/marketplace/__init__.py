from fastapi import APIRouter

from . import (
    projects, proposals, contracts, milestones, admin, chat, reviews,
    notifications, verification, members, feed,
)

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

for module in (projects, proposals, contracts, milestones, admin, chat, reviews,
               notifications, verification, members, feed):
    router.include_router(module.router)
