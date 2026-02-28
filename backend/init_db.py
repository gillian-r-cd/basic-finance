import os
import sys

# Add the parent directory to the path so we can import database and models
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine, Base, SessionLocal
import models.domain
from agents.prompts import seed_prompts

def init_db():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully.")
    
    print("Seeding default prompts...")
    db = SessionLocal()
    try:
        seed_prompts(db)
        print("Prompts seeded successfully.")
    finally:
        db.close()
    
    print("Database initialized successfully.")

if __name__ == "__main__":
    init_db()

