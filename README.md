# HITS ERP — Person A Module: Backend Core (Auth + DB)

This covers the foundation module: project structure, database models, and
JWT authentication with role-based access. Person B (attendance/scheduler)
and Person C (dashboards/frontend) build on top of this.

---

## Before vs After

### 1. Project Structure

**Before**
- Single file `server.py` (674 lines) — routing, DB queries, and business
  logic for every feature all mixed together using Python's raw
  `http.server` / `socketserver`.
- No separation of concerns → hard for 3 people to work on the same file
  without merge conflicts.

**After**
```
hits_erp/
├── app/
│   ├── main.py              # FastAPI app entrypoint
│   ├── core/
│   │   ├── database.py      # DB connection/session
│   │   ├── security.py      # JWT + password hashing
│   │   └── deps.py          # auth dependency + role guard
│   ├── models/models.py     # SQLAlchemy tables
│   ├── schemas/schemas.py   # Pydantic request/response shapes
│   └── routers/
│       ├── auth.py          # /auth/login
│       └── admin.py         # /admin/* (admin-only)
├── seed_admin.py             # creates first admin login
└── requirements.txt
```
Each teammate now owns their own `router` file — no more editing the same
674-line file at the same time.

---

### 2. Web Framework

**Before**
- Raw `http.server` / `socketserver.TCPServer` — manual `if path ==
  ...elif path.startswith(...)` string matching for routing.
- Single-threaded — one user at a time (fixed earlier, but still not a
  real framework).
- No input validation — bad JSON bodies could crash a handler.
- No auto-generated API docs.

**After**
- **FastAPI** — proper route decorators (`@router.post("/auth/login")`),
  built-in request validation via Pydantic, and free interactive API docs
  at `/docs` (Swagger UI) the moment the server starts.

---

### 3. Authentication

**Before**
- No authentication system in the attendance prototype — anyone could hit
  any endpoint.

**After**
- `/auth/login` issues a JWT access token (8-hour expiry) after verifying
  a bcrypt-hashed password.
- `get_current_user()` dependency decodes the token on every protected
  request.
- `require_role("ADMIN")` (or any role) can be attached to any router to
  restrict access — tested and confirmed working: requests without a
  valid token are rejected with **401 Unauthorized**, and role mismatches
  return **403 Forbidden**.

---

### 4. Database

**Before**
- SQLite only, tables created ad-hoc inside `server.py` with raw
  `CREATE TABLE IF NOT EXISTS` strings. No formal schema/relationships
  defined anywhere else.

**After**
- SQLAlchemy models with explicit relationships: `Department → Section →
  Student`, `Faculty → User`, `Timetable → Section/Subject/Faculty`.
- Works on **SQLite by default** (zero setup, good for local dev on one
  laptop) and switches to **PostgreSQL** in production just by setting
  the `DATABASE_URL` environment variable — no code changes needed.
- Passwords are hashed with bcrypt, never stored in plain text.

---

## How to Run

```bash
pip install -r requirements.txt
python seed_admin.py          # creates admin@hits.edu / admin123 (change password after first login)
uvicorn app.main:app --reload --port 8001
```

Then open `http://127.0.0.1:8001/docs` for the interactive API explorer.

**Default admin login:** `admin@hits.edu` / `admin123` — change immediately
after first login in a real deployment.

---

## What's Verified Working
- ✅ Admin login returns a valid JWT.
- ✅ `/admin/departments` (create) succeeds with a valid ADMIN token.
- ✅ Same endpoint returns `401 Unauthorized` with no token.

## Handed Off To
- **Person B (this update)**: Attendance/schedule/memo endpoints now live under `app/routers/legacy_api.py` — matches the existing React frontend's `api.js` exactly (`/api/login`, `/api/students`, `/api/schedule`, `/api/teacher/:id/schedule`, `/api/reminders`, `/api/memos`, `/api/attendance`, `/api/hod/summary`). **The existing frontend now runs against this backend with zero frontend code changes.** Verified end-to-end: frontend served at `/`, login, students, teacher schedule, attendance submission, and HOD summary all tested and returning correct data.
- **Person C**: build/extend React dashboards; `/auth/*` and `/admin/*` (new JWT-secured admin module) are available for the newer department/section/user-management features once the frontend is ready to adopt them.

## Running with Frontend
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8002
```
Then open `http://127.0.0.1:8002/` — the existing built frontend (in `public/`) loads and talks to this backend automatically, same as it did with the old `server.py`.

Default logins (seeded automatically): `teacher1` / `password`, `teacher2` / `password`, `hod1` / `password`.
