"""
main.py - FastAPI Application Entry Point
Startup: loads .env, migrates DB (finance.db → learning.db), syncs prompts, registers routers.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
from dotenv import load_dotenv

load_dotenv()

from routers import learner, plan, session, artifact, prompt
from database import SessionLocal
from agents.prompts import seed_prompts

# Migrate finance.db → learning.db (one-time, preserves existing data)
if os.path.exists("finance.db") and not os.path.exists("learning.db"):
    shutil.copy2("finance.db", "learning.db")
    print("[migration] Copied finance.db → learning.db")

app = FastAPI(title="Learning MVP Backend", version="2.0.0")

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(learner.router)
app.include_router(plan.router)
app.include_router(session.router)
app.include_router(artifact.router)
app.include_router(prompt.router)

@app.on_event("startup")
def on_startup():
    """Sync default prompts to DB and run lightweight schema migrations."""
    db = SessionLocal()
    try:
        seed_prompts(db)
        print("[startup] Prompts synced to DB.")
        # Lightweight migrations: add columns if missing
        from sqlalchemy import text
        migrations = [
            ("sessions", "verification_state", "ALTER TABLE sessions ADD COLUMN verification_state TEXT"),
            ("messages", "phase", "ALTER TABLE messages ADD COLUMN phase TEXT"),
            ("plans", "domain", "ALTER TABLE plans ADD COLUMN domain TEXT"),
            ("plans", "knowledge_map", "ALTER TABLE plans ADD COLUMN knowledge_map TEXT"),
        ]
        for table, col, sql in migrations:
            try:
                db.execute(text(sql))
                db.commit()
                print(f"[startup] Added {col} column to {table}.")
            except Exception:
                db.rollback()
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Finance MVP API is running."}

@app.get("/api/health")
def health_check():
    return {"status": "ok"}


