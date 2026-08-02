from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from backend.core.database import Base, engine
from backend.core.legacy_db import init_legacy_db
from backend.models import models  # noqa: F401 — ensures models are registered with Base before create_all
from backend.routers import auth, admin, legacy_api

app = FastAPI(
    title="HITS Attendance ERP",
    description="Backend Core module (Auth + DB) + Attendance/Schedule module",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auto-create tables on startup (fine for dev; use Alembic migrations for production changes)
Base.metadata.create_all(bind=engine)
init_legacy_db()

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(legacy_api.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "HITS ERP backend"}


# Serve the existing built React frontend (public/) unchanged, same as the old server.py did
_frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public")
if os.path.isdir(_frontend_dir):
    app.mount("/", StaticFiles(directory=_frontend_dir, html=True), name="frontend")
