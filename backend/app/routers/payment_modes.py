from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas import PaymentModeCreate, PaymentModeResponse
from app.auth import get_current_user
from app.models import User
import app.crud as crud

router = APIRouter(prefix="/payment_modes", tags=["Payment Modes"])

@router.get("/", response_model=List[PaymentModeResponse])
def read_payment_modes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_user_payment_modes(db, user_id=current_user.id)

@router.post("/", response_model=PaymentModeResponse, status_code=status.HTTP_201_CREATED)
def create_payment_mode(
    payment_mode: PaymentModeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return crud.create_custom_payment_mode(db, payment_mode=payment_mode, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{payment_mode_id}", response_model=PaymentModeResponse)
def update_payment_mode(
    payment_mode_id: int,
    payment_mode: PaymentModeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return crud.update_payment_mode(db, payment_mode_id=payment_mode_id, payment_mode=payment_mode, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{payment_mode_id}", status_code=status.HTTP_200_OK)
def delete_payment_mode(
    payment_mode_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        crud.delete_payment_mode(db, payment_mode_id=payment_mode_id, user_id=current_user.id)
        return {"detail": "Payment mode deleted successfully."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
