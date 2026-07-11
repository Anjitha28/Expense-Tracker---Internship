from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas import RecurringTransactionCreate, RecurringTransactionUpdate, RecurringTransactionResponse
from app.auth import get_current_user
from app.models import User
import app.crud as crud

router = APIRouter(prefix="/recurring", tags=["Recurring Transactions"])

@router.get("/", response_model=List[RecurringTransactionResponse])
def read_recurring(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Auto-trigger recurring processing whenever user checks their list
    crud.process_recurring_transactions(db)
    return crud.get_user_recurring(db, user_id=current_user.id)

@router.post("/", response_model=RecurringTransactionResponse, status_code=status.HTTP_201_CREATED)
def create_recurring(
    rec: RecurringTransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return crud.create_recurring(db, rec=rec, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{recurring_id}", response_model=RecurringTransactionResponse)
def update_recurring(
    recurring_id: int,
    rec: RecurringTransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return crud.update_recurring(db, recurring_id=recurring_id, rec=rec, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{recurring_id}", status_code=status.HTTP_200_OK)
def delete_recurring(
    recurring_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        crud.delete_recurring(db, recurring_id=recurring_id, user_id=current_user.id)
        return {"detail": "Recurring transaction deleted successfully."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/process", status_code=status.HTTP_200_OK)
def process_recurring(
    db: Session = Depends(get_db)
):
    crud.process_recurring_transactions(db)
    return {"detail": "Recurring transactions processed successfully."}
