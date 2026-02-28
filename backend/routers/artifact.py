from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db

router = APIRouter(prefix="/api/artifacts", tags=["artifacts"])

@router.get("/")
def get_artifacts():
    return {"message": "Artifacts endpoint"}

