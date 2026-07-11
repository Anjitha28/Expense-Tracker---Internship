from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from datetime import datetime
from decimal import Decimal

from app.database import get_db
from app.auth import get_current_user
from app.models import User, UserPreferences, Category, Subcategory, PaymentMode, Transaction, RecurringTransaction
from app.schemas import UserPreferencesResponse, UserPreferencesUpdate
import app.crud as crud

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("/preferences", response_model=UserPreferencesResponse)
def read_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_user_preferences(db, user_id=current_user.id)

@router.put("/preferences", response_model=UserPreferencesResponse)
def update_preferences(
    pref_update: UserPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.update_user_preferences(db, user_id=current_user.id, pref_update=pref_update)

@router.get("/backup")
def backup_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Fetch preferences
    pref = crud.get_user_preferences(db, user_id=current_user.id)
    pref_data = {
        "theme": pref.theme,
        "currency": pref.currency,
        "notifications_enabled": pref.notifications_enabled
    }

    # 2. Fetch custom categories
    categories = db.query(Category).filter(Category.user_id == current_user.id).all()
    cats_data = []
    for cat in categories:
        subs = db.query(Subcategory).filter(Subcategory.category_id == cat.id).all()
        cats_data.append({
            "name": cat.name,
            "type": cat.type,
            "icon": cat.icon,
            "subcategories": [sub.name for sub in subs]
        })

    # 3. Fetch custom payment modes
    payment_modes = db.query(PaymentMode).filter(PaymentMode.user_id == current_user.id).all()
    pms_data = [pm.name for pm in payment_modes]

    # 4. Fetch transactions
    transactions = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    txs_data = []
    for tx in transactions:
        txs_data.append({
            "type": tx.type,
            "date": tx.date.strftime("%Y-%m-%d"),
            "amount": float(tx.amount),
            "category_name": tx.category.name,
            "subcategory_name": tx.subcategory.name if tx.subcategory else None,
            "payment_mode_name": tx.payment_mode.name,
            "notes": tx.notes,
            "receipt_url": tx.receipt_url
        })

    # 5. Fetch recurring transactions
    recurring = db.query(RecurringTransaction).filter(RecurringTransaction.user_id == current_user.id).all()
    recs_data = []
    for rec in recurring:
        recs_data.append({
            "type": rec.type,
            "amount": float(rec.amount),
            "frequency": rec.frequency,
            "start_date": rec.start_date.strftime("%Y-%m-%d"),
            "end_date": rec.end_date.strftime("%Y-%m-%d") if rec.end_date else None,
            "category_name": rec.category.name,
            "subcategory_name": rec.subcategory.name if rec.subcategory else None,
            "payment_mode_name": rec.payment_mode.name,
            "is_active": rec.is_active
        })

    return {
        "preferences": pref_data,
        "categories": cats_data,
        "payment_modes": pms_data,
        "transactions": txs_data,
        "recurring_transactions": recs_data
    }

@router.post("/restore")
def restore_data(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # 1. Restore Preferences
        pref_data = payload.get("preferences", {})
        if pref_data:
            pref = crud.get_user_preferences(db, user_id=current_user.id)
            pref.theme = pref_data.get("theme", pref.theme)
            pref.currency = pref_data.get("currency", pref.currency)
            pref.notifications_enabled = pref_data.get("notifications_enabled", pref.notifications_enabled)

        # To restore cleanly without SQL conflict errors, let's delete existing transaction/recurring data first.
        # However, we must preserve custom categories/payment modes if they match.
        # To make it simple and bulletproof, we will delete existing transactions, recurring, subcategories, custom categories, custom payment modes,
        # and re-insert everything from the backup.
        
        db.query(Transaction).filter(Transaction.user_id == current_user.id).delete()
        db.query(RecurringTransaction).filter(RecurringTransaction.user_id == current_user.id).delete()
        
        # Deleting subcategories requires category joins
        user_subs = db.query(Subcategory).join(Category).filter(Category.user_id == current_user.id)
        for sub in user_subs:
            db.delete(sub)
        db.flush()
        
        db.query(Category).filter(Category.user_id == current_user.id).delete()
        db.query(PaymentMode).filter(PaymentMode.user_id == current_user.id).delete()
        db.flush()

        # 2. Restore Payment Modes
        pms_map = {}
        for pm_name in payload.get("payment_modes", []):
            pm = PaymentMode(user_id=current_user.id, name=pm_name)
            db.add(pm)
            db.flush()
            pms_map[pm_name] = pm.id

        # 3. Restore Categories & Subcategories
        cats_map = {} # key: (name, type) -> val: cat_id
        subs_map = {} # key: (cat_name, sub_name, type) -> val: sub_id

        for cat_item in payload.get("categories", []):
            cat_name = cat_item["name"]
            cat_type = cat_item["type"]
            cat_icon = cat_item.get("icon", "more_horiz")
            
            cat = Category(user_id=current_user.id, name=cat_name, type=cat_type, icon=cat_icon)
            db.add(cat)
            db.flush()
            cats_map[(cat_name, cat_type)] = cat.id

            for sub_name in cat_item.get("subcategories", []):
                sub = Subcategory(category_id=cat.id, name=sub_name)
                db.add(sub)
                db.flush()
                subs_map[(cat_name, sub_name, cat_type)] = sub.id

        # Make sure default categories/payment modes map if user forgot to back them up (or backup file only had customs)
        # We can seed them if the map doesn't contain them
        db.commit()
        
        # Reload category & payment mode objects for mapping validation
        db_pms = db.query(PaymentMode).filter(PaymentMode.user_id == current_user.id).all()
        for pm in db_pms:
            pms_map[pm.name] = pm.id
            
        db_cats = db.query(Category).filter(Category.user_id == current_user.id).all()
        for cat in db_cats:
            cats_map[(cat.name, cat.type)] = cat.id
            db_subs = db.query(Subcategory).filter(Subcategory.category_id == cat.id).all()
            for sub in db_subs:
                subs_map[(cat.name, sub.name, cat.type)] = sub.id

        # Helper to get category ID safely
        def get_cat_id(name: str, type_str: str) -> int:
            return cats_map.get((name, type_str))

        # Helper to get subcategory ID safely
        def get_sub_id(cat_name: str, sub_name: Optional[str], type_str: str) -> Optional[int]:
            if not sub_name:
                return None
            return subs_map.get((cat_name, sub_name, type_str))

        # Helper to get payment mode ID safely
        def get_pm_id(name: str) -> int:
            return pms_map.get(name)

        # 4. Restore Transactions
        for tx_item in payload.get("transactions", []):
            cat_id = get_cat_id(tx_item["category_name"], tx_item["type"])
            sub_id = get_sub_id(tx_item["category_name"], tx_item["subcategory_name"], tx_item["type"])
            pm_id = get_pm_id(tx_item["payment_mode_name"])

            if not cat_id or not pm_id:
                # Skip invalid rows or write fallback
                continue

            tx = Transaction(
                user_id=current_user.id,
                type=tx_item["type"],
                date=datetime.strptime(tx_item["date"], "%Y-%m-%d").date(),
                amount=Decimal(str(tx_item["amount"])),
                category_id=cat_id,
                subcategory_id=sub_id,
                payment_mode_id=pm_id,
                notes=tx_item.get("notes"),
                receipt_url=tx_item.get("receipt_url")
            )
            db.add(tx)

        # 5. Restore Recurring Transactions
        for rec_item in payload.get("recurring_transactions", []):
            cat_id = get_cat_id(rec_item["category_name"], rec_item["type"])
            sub_id = get_sub_id(rec_item["category_name"], rec_item["subcategory_name"], rec_item["type"])
            pm_id = get_pm_id(rec_item["payment_mode_name"])

            if not cat_id or not pm_id:
                continue

            start_dt = datetime.strptime(rec_item["start_date"], "%Y-%m-%d").date()
            rec = RecurringTransaction(
                user_id=current_user.id,
                type=rec_item["type"],
                amount=Decimal(str(rec_item["amount"])),
                frequency=rec_item["frequency"],
                start_date=start_dt,
                end_date=datetime.strptime(rec_item["end_date"], "%Y-%m-%d").date() if rec_item.get("end_date") else None,
                next_due_date=crud.calculate_next_due_date(start_dt, rec_item["frequency"]),
                category_id=cat_id,
                subcategory_id=sub_id,
                payment_mode_id=pm_id,
                is_active=rec_item.get("is_active", True)
            )
            db.add(rec)

        db.commit()
        return {"detail": "Backup restored successfully."}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Error restoring backup: {str(e)}"
        )
