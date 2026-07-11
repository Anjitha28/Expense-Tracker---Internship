from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional, List
import uuid
import os
import shutil

from app.database import get_db
from app.schemas import TransactionCreate, TransactionUpdate, TransactionResponse, PaginatedTransactionResponse
from app.auth import get_current_user
from app.models import User
import app.crud as crud
from app.config import settings

router = APIRouter(prefix="/transactions", tags=["Transactions"])

MAX_FILE_SIZE = 5 * 1024 * 1024 # 5 MB
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".pdf"}

@router.post("/upload")
def upload_receipt(
    file: UploadFile = File(...), 
    current_user: User = Depends(get_current_user)
):
    # Validate file size
    file.file.seek(0, os.SEEK_END)
    file_size = file.file.tell()
    file.file.seek(0)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="File size exceeds maximum allowed limit of 5MB."
        )

    # Validate file extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Unsupported file format. Allowed formats: PNG, JPG, JPEG, WEBP, PDF."
        )

    # Create upload directory if not exists
    os.makedirs(settings.upload_dir, exist_ok=True)

    # Make unique filename
    unique_filename = f"{uuid.uuid4()}{ext}"
    dest_path = os.path.join(settings.upload_dir, unique_filename)

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Return relative URL
    return {"receipt_url": f"/uploads/{unique_filename}"}

@router.get("/", response_model=PaginatedTransactionResponse)
def read_transactions(
    type: Optional[str] = Query(None, pattern="^(income|expense)$"),
    category_id: Optional[int] = Query(None),
    payment_mode_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("date"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    skip = (page - 1) * limit
    total, records = crud.get_user_transactions(
        db=db,
        user_id=current_user.id,
        type=type,
        category_id=category_id,
        payment_mode_id=payment_mode_id,
        start_date=start_date,
        end_date=end_date,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        skip=skip,
        limit=limit
    )
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "transactions": records
    }

@router.get("/recent", response_model=List[TransactionResponse])
def get_recent(
    limit: int = Query(5, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_recent_transactions(db, user_id=current_user.id, limit=limit)

@router.get("/{transaction_id}", response_model=TransactionResponse)
def read_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tx = crud.get_transaction(db, transaction_id=transaction_id, user_id=current_user.id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    return tx

@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    tx: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return crud.create_transaction(db, tx=tx, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int,
    tx: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return crud.update_transaction(db, transaction_id=transaction_id, tx=tx, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{transaction_id}", status_code=status.HTTP_200_OK)
def delete_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        crud.delete_transaction(db, transaction_id=transaction_id, user_id=current_user.id)
        return {"detail": "Transaction deleted successfully."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
