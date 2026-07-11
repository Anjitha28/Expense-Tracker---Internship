from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas import CategoryCreate, CategoryUpdate, CategoryResponse, SubcategoryCreate, SubcategoryResponse
from app.auth import get_current_user
from app.models import User
import app.crud as crud

router = APIRouter(prefix="/categories", tags=["Categories"])

@router.get("/", response_model=List[CategoryResponse])
def read_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_user_categories(db, user_id=current_user.id)

@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    category: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return crud.create_custom_category(db, category=category, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    category: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return crud.update_category(db, category_id=category_id, category=category, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{category_id}", status_code=status.HTTP_200_OK)
def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        crud.delete_category(db, category_id=category_id, user_id=current_user.id)
        return {"detail": "Category deleted successfully."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/subcategories", response_model=SubcategoryResponse, status_code=status.HTTP_201_CREATED)
def create_subcategory(
    subcategory: SubcategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return crud.create_custom_subcategory(db, subcategory=subcategory, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/subcategories/{subcategory_id}", status_code=status.HTTP_200_OK)
def delete_subcategory(
    subcategory_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        crud.delete_subcategory(db, subcategory_id=subcategory_id, user_id=current_user.id)
        return {"detail": "Subcategory deleted successfully."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
