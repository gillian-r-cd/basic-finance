from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db

router = APIRouter(prefix="/api/admin/prompts", tags=["prompts"])

@router.get("/")
def get_prompts():
    return {"message": "Prompts endpoint"}

@router.put("/{role}")
def update_prompt(role: str):
    return {"message": f"Prompt for {role} updated"}

