
# ARCHON CRM — Context for New Chat

## Project Info
- Name: Archon by Armila Design
- GitHub: https://github.com/miladrostami9999-source/Archon.git
- Local: C:\Users\Milad Rostami\archon\
- Stack: FastAPI + SQLite + Next.js 14 + Claude API

## Start Commands
# Backend
cd C:\Users\Milad Rostami\archon\backend
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000

# Frontend  
cd C:\Users\Milad Rostami\archon\frontend
npm run dev

## URLs
- Frontend: http://localhost:3000
- Backend docs: http://localhost:8000/docs
- Database: C:\Users\Milad Rostami\archon\database\archon.db

## Current Status
Phase 3 in progress. Completed:
- Dark/Light theme with Sidebar
- Daily Tasks (EN/FA, personal tasks, delete confirm)
- Sort & Advanced Filter with popup
- Notification Bell
- Import/Export CSV
- Quick Actions (right-click)
- Admin Panel page
- Analytics upgraded
- Auto Backup (daily 10:00)
- Opportunity Score formula
- Delete Confirmation Modal
- Follow-up Reminder
- Smart Search + AI Search

## Remaining Phase 3
- Export CSV (done, in admin)
- Weekly AI Report
- Pagination
- Multi-user / Collaboration
- Market Intelligence Map

## File Structure
frontend/app/
  page.tsx          — Dashboard (Home)
  tasks/page.tsx    — Daily Tasks
  analytics/page.tsx — Analytics
  admin/page.tsx    — Admin Panel
  add/page.tsx      — Add Company
  edit/page.tsx     — Edit Company
  import/page.tsx   — Import CSV
  company/[id]/page.tsx — Company Detail
  components/Sidebar.tsx — Sidebar with theme

backend/app/
  main.py
  routers/companies.py  — all endpoints
  services/claude.py    — Claude AI functions
  models/database.py    — SQLAlchemy models

## Important Notes
- Milad has no coding background — always provide COMPLETE files for copy-paste
- Never ask to edit specific lines — always write full file
- Python indent errors are common — always provide complete file rewrites
- Database path hardcoded: C:\Users\Milad Rostami\archon
- Claude API key in backend/.env as CLAUDE_API_KEY
- python-multipart required for CSV upload
- Daily tasks clear requires manual DB query

## UI Design
- Dark theme default: bg #0F1117, sidebar #161B27, accent #4F7BF7
- Light theme: bg #F4F6FA, sidebar #FFFFFF
- Theme saved in localStorage key: archon-theme
- All pages use Sidebar component from app/components/Sidebar.tsx
- Sidebar width: 224px (ml-56 in Tailwind)

## SaaS Plans (Future)
- Basic: /mo
- Professional: /mo  
- Agency: /mo
- Target: architectural visualizers/freelancers
