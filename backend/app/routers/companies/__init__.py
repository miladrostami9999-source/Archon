from fastapi import APIRouter

from . import (
    core, notes, contacts, campaigns, ai, analytics, import_export, tasks,
    reports, map, email, backup, discovery,
)

router = APIRouter(prefix="/companies", tags=["companies"])

# `discovery` is registered before `core` so its literal /discovery/* paths win
# over core's /{company_id} catch-all.
for module in (discovery, core, notes, contacts, campaigns, ai, analytics,
               import_export, tasks, reports, map, email, backup):
    router.include_router(module.router)
