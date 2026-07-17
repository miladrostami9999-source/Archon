from fastapi import APIRouter

from . import core, notes, contacts, campaigns, ai, analytics, import_export, tasks, reports, map, email, backup

router = APIRouter(prefix="/companies", tags=["companies"])

for module in (core, notes, contacts, campaigns, ai, analytics, import_export, tasks, reports, map, email, backup):
    router.include_router(module.router)
