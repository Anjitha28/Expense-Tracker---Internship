from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func, asc, desc
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional, List

from app.models import User, Category, Subcategory, PaymentMode, Transaction, RecurringTransaction, UserPreferences
from app.schemas import (
    UserCreate, TransactionCreate, TransactionUpdate, 
    CategoryCreate, CategoryUpdate, PaymentModeCreate, SubcategoryCreate,
    RecurringTransactionCreate, RecurringTransactionUpdate, UserPreferencesUpdate
)
from app.auth import get_password_hash

# ---------------------------------------------
# User Seeding Logic
# ---------------------------------------------
def seed_user_data(db: Session, user_id: int):
    # 1. Initialize User Preferences
    pref = UserPreferences(
        user_id=user_id,
        theme="light",
        currency="USD",
        notifications_enabled=True
    )
    db.add(pref)
    
    # 2. Seed default categories
    default_categories = [
        # Income Categories
        {"name": "Salary", "type": "income", "icon": "payments", "subcategories": ["Monthly Salary", "Bonus", "Overtime"]},
        {"name": "Freelancing", "type": "income", "icon": "work", "subcategories": ["Web Dev", "Consulting", "Writing"]},
        {"name": "Business", "type": "income", "icon": "storefront", "subcategories": ["Retail", "Services", "E-commerce"]},
        {"name": "Investments", "type": "income", "icon": "trending_up", "subcategories": ["Stocks", "Mutual Funds", "Dividends"]},
        {"name": "Gifts", "type": "income", "icon": "card_giftcard", "subcategories": []},
        {"name": "Rental Income", "type": "income", "icon": "real_estate_agent", "subcategories": []},
        {"name": "Others", "type": "income", "icon": "more_horiz", "subcategories": []},
        # Expense Categories
        {"name": "Food", "type": "expense", "icon": "restaurant", "subcategories": ["Breakfast", "Lunch", "Dinner", "Snacks"]},
        {"name": "Rent", "type": "expense", "icon": "home", "subcategories": []},
        {"name": "Shopping", "type": "expense", "icon": "shopping_bag", "subcategories": ["Grocery", "Clothing", "Electronics"]},
        {"name": "Transport", "type": "expense", "icon": "directions_car", "subcategories": ["Bus", "Taxi", "Train", "Fuel"]},
        {"name": "Bills", "type": "expense", "icon": "receipt_long", "subcategories": ["Electricity", "Water", "Internet", "Phone"]},
        {"name": "Entertainment", "type": "expense", "icon": "sports_esports", "subcategories": ["Movies", "Games", "Music", "Subscriptions"]},
        {"name": "Medical", "type": "expense", "icon": "medical_services", "subcategories": []},
        {"name": "Education", "type": "expense", "icon": "school", "subcategories": []},
        {"name": "Travel", "type": "expense", "icon": "flight", "subcategories": []},
        {"name": "Others", "type": "expense", "icon": "more_horiz", "subcategories": []}
    ]

    for cat_data in default_categories:
        cat = Category(
            user_id=user_id,
            name=cat_data["name"],
            type=cat_data["type"],
            icon=cat_data["icon"]
        )
        db.add(cat)
        db.flush() # Flush to get cat.id for subcategories
        
        for sub_name in cat_data["subcategories"]:
            sub = Subcategory(
                category_id=cat.id,
                name=sub_name
            )
            db.add(sub)

    # 3. Seed default payment modes
    default_payment_modes = [
        "Cash", "UPI", "Credit Card", "Debit Card", "Bank Transfer", "Mobile Wallet", "Cheque"
    ]
    for mode_name in default_payment_modes:
        pm = PaymentMode(
            user_id=user_id,
            name=mode_name
        )
        db.add(pm)

    db.commit()

# ---------------------------------------------
# User CRUD
# ---------------------------------------------
def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()

def create_user(db: Session, user: UserCreate) -> User:
    hashed_password = get_password_hash(user.password)
    db_user = User(email=user.email, password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Automatically seed details
    seed_user_data(db, db_user.id)
    db.refresh(db_user)
    return db_user

def get_user_preferences(db: Session, user_id: int) -> UserPreferences:
    pref = db.query(UserPreferences).filter(UserPreferences.user_id == user_id).first()
    if not pref:
        pref = UserPreferences(user_id=user_id, theme="light", currency="USD", notifications_enabled=True)
        db.add(pref)
        db.commit()
        db.refresh(pref)
    return pref

def update_user_preferences(db: Session, user_id: int, pref_update: UserPreferencesUpdate) -> UserPreferences:
    pref = get_user_preferences(db, user_id)
    update_data = pref_update.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(pref, key, val)
    db.commit()
    db.refresh(pref)
    return pref

# ---------------------------------------------
# Category & Subcategory CRUD
# ---------------------------------------------
def get_user_categories(db: Session, user_id: int) -> List[Category]:
    return db.query(Category).filter(Category.user_id == user_id).all()

def create_custom_category(db: Session, category: CategoryCreate, user_id: int) -> Category:
    # Check for duplicate
    dup = db.query(Category).filter(
        Category.user_id == user_id,
        func.lower(Category.name) == func.lower(category.name),
        Category.type == category.type
    ).first()
    if dup:
        raise ValueError("Category with this name and type already exists.")
        
    db_cat = Category(
        user_id=user_id,
        name=category.name,
        type=category.type,
        icon=category.icon or "more_horiz"
    )
    db.add(db_cat)
    db.commit()
    db.refresh(db_cat)
    return db_cat

def update_category(db: Session, category_id: int, category: CategoryUpdate, user_id: int) -> Category:
    db_cat = db.query(Category).filter(Category.id == category_id, Category.user_id == user_id).first()
    if not db_cat:
        raise ValueError("Category not found.")
    
    update_data = category.model_dump(exclude_unset=True)
    if "name" in update_data:
        # Check duplicate
        dup = db.query(Category).filter(
            Category.user_id == user_id,
            Category.id != category_id,
            func.lower(Category.name) == func.lower(update_data["name"]),
            Category.type == db_cat.type
        ).first()
        if dup:
            raise ValueError("Category with this name already exists.")

    for key, val in update_data.items():
        setattr(db_cat, key, val)
    db.commit()
    db.refresh(db_cat)
    return db_cat

def delete_category(db: Session, category_id: int, user_id: int) -> bool:
    db_cat = db.query(Category).filter(Category.id == category_id, Category.user_id == user_id).first()
    if not db_cat:
        raise ValueError("Category not found.")
        
    # Check if category is used in transactions
    tx_count = db.query(Transaction).filter(Transaction.category_id == category_id).count()
    rec_count = db.query(RecurringTransaction).filter(RecurringTransaction.category_id == category_id).count()
    if tx_count > 0 or rec_count > 0:
        raise ValueError("Cannot delete category as it is currently being used by existing transactions.")
        
    db.delete(db_cat)
    db.commit()
    return True

def create_custom_subcategory(db: Session, subcategory: SubcategoryCreate, user_id: int) -> Subcategory:
    # Ensure category belongs to user
    cat = db.query(Category).filter(Category.id == subcategory.category_id, Category.user_id == user_id).first()
    if not cat:
        raise ValueError("Category not found.")
        
    dup = db.query(Subcategory).filter(
        Subcategory.category_id == subcategory.category_id,
        func.lower(Subcategory.name) == func.lower(subcategory.name)
    ).first()
    if dup:
        raise ValueError("Subcategory already exists under this category.")
        
    db_sub = Subcategory(category_id=subcategory.category_id, name=subcategory.name)
    db.add(db_sub)
    db.commit()
    db.refresh(db_sub)
    return db_sub

def delete_subcategory(db: Session, subcategory_id: int, user_id: int) -> bool:
    sub = db.query(Subcategory).join(Category).filter(
        Subcategory.id == subcategory_id,
        Category.user_id == user_id
    ).first()
    if not sub:
        raise ValueError("Subcategory not found.")
        
    tx_count = db.query(Transaction).filter(Transaction.subcategory_id == subcategory_id).count()
    rec_count = db.query(RecurringTransaction).filter(RecurringTransaction.subcategory_id == subcategory_id).count()
    if tx_count > 0 or rec_count > 0:
        raise ValueError("Cannot delete subcategory as it is currently being used by existing transactions.")
        
    db.delete(sub)
    db.commit()
    return True

# ---------------------------------------------
# Payment Mode CRUD
# ---------------------------------------------
def get_user_payment_modes(db: Session, user_id: int) -> List[PaymentMode]:
    return db.query(PaymentMode).filter(PaymentMode.user_id == user_id).all()

def create_custom_payment_mode(db: Session, payment_mode: PaymentModeCreate, user_id: int) -> PaymentMode:
    dup = db.query(PaymentMode).filter(
        PaymentMode.user_id == user_id,
        func.lower(PaymentMode.name) == func.lower(payment_mode.name)
    ).first()
    if dup:
        raise ValueError("Payment mode already exists.")
        
    db_pm = PaymentMode(user_id=user_id, name=payment_mode.name)
    db.add(db_pm)
    db.commit()
    db.refresh(db_pm)
    return db_pm

def update_payment_mode(db: Session, payment_mode_id: int, payment_mode: PaymentModeCreate, user_id: int) -> PaymentMode:
    db_pm = db.query(PaymentMode).filter(PaymentMode.id == payment_mode_id, PaymentMode.user_id == user_id).first()
    if not db_pm:
        raise ValueError("Payment mode not found.")
        
    dup = db.query(PaymentMode).filter(
        PaymentMode.user_id == user_id,
        PaymentMode.id != payment_mode_id,
        func.lower(PaymentMode.name) == func.lower(payment_mode.name)
    ).first()
    if dup:
        raise ValueError("Payment mode with this name already exists.")
        
    db_pm.name = payment_mode.name
    db.commit()
    db.refresh(db_pm)
    return db_pm

def delete_payment_mode(db: Session, payment_mode_id: int, user_id: int) -> bool:
    db_pm = db.query(PaymentMode).filter(PaymentMode.id == payment_mode_id, PaymentMode.user_id == user_id).first()
    if not db_pm:
        raise ValueError("Payment mode not found.")
        
    tx_count = db.query(Transaction).filter(Transaction.payment_mode_id == payment_mode_id).count()
    rec_count = db.query(RecurringTransaction).filter(RecurringTransaction.payment_mode_id == payment_mode_id).count()
    if tx_count > 0 or rec_count > 0:
        raise ValueError("Cannot delete payment mode as it is currently being used by existing transactions.")
        
    db.delete(db_pm)
    db.commit()
    return True

# ---------------------------------------------
# Transaction CRUD
# ---------------------------------------------
def get_transaction(db: Session, transaction_id: int, user_id: int) -> Optional[Transaction]:
    return db.query(Transaction).filter(Transaction.id == transaction_id, Transaction.user_id == user_id).first()

def create_transaction(db: Session, tx: TransactionCreate, user_id: int) -> Transaction:
    # Verify Category & Subcategory & Payment Mode ownership
    cat = db.query(Category).filter(Category.id == tx.category_id, Category.user_id == user_id).first()
    if not cat:
        raise ValueError("Invalid category selected.")
    if cat.type != tx.type:
        raise ValueError(f"Category type '{cat.type}' does not match transaction type '{tx.type}'.")
        
    pm = db.query(PaymentMode).filter(PaymentMode.id == tx.payment_mode_id, PaymentMode.user_id == user_id).first()
    if not pm:
        raise ValueError("Invalid payment mode selected.")
        
    if tx.subcategory_id:
        sub = db.query(Subcategory).filter(Subcategory.id == tx.subcategory_id, Subcategory.category_id == tx.category_id).first()
        if not sub:
            raise ValueError("Invalid subcategory selected.")
            
    db_tx = Transaction(
        user_id=user_id,
        type=tx.type,
        amount=tx.amount,
        date=tx.date,
        category_id=tx.category_id,
        subcategory_id=tx.subcategory_id,
        payment_mode_id=tx.payment_mode_id,
        notes=tx.notes,
        receipt_url=tx.receipt_url
    )
    db.add(db_tx)
    db.commit()
    db.refresh(db_tx)
    return db_tx

def update_transaction(db: Session, transaction_id: int, tx: TransactionUpdate, user_id: int) -> Transaction:
    db_tx = get_transaction(db, transaction_id, user_id)
    if not db_tx:
        raise ValueError("Transaction not found.")
        
    update_data = tx.model_dump(exclude_unset=True)
    
    # Run validations for fields if they are being updated
    target_type = update_data.get("type", db_tx.type)
    target_cat_id = update_data.get("category_id", db_tx.category_id)
    target_sub_id = update_data.get("subcategory_id", db_tx.subcategory_id)
    target_pm_id = update_data.get("payment_mode_id", db_tx.payment_mode_id)
    
    if "category_id" in update_data or "type" in update_data:
        cat = db.query(Category).filter(Category.id == target_cat_id, Category.user_id == user_id).first()
        if not cat:
            raise ValueError("Invalid category selected.")
        if cat.type != target_type:
            raise ValueError(f"Category type '{cat.type}' does not match transaction type '{target_type}'.")
            
    if "payment_mode_id" in update_data:
        pm = db.query(PaymentMode).filter(PaymentMode.id == target_pm_id, PaymentMode.user_id == user_id).first()
        if not pm:
            raise ValueError("Invalid payment mode selected.")
            
    if "subcategory_id" in update_data and target_sub_id is not None:
        sub = db.query(Subcategory).filter(Subcategory.id == target_sub_id, Subcategory.category_id == target_cat_id).first()
        if not sub:
            raise ValueError("Invalid subcategory selected.")
            
    for key, val in update_data.items():
        setattr(db_tx, key, val)
        
    db.commit()
    db.refresh(db_tx)
    return db_tx

def delete_transaction(db: Session, transaction_id: int, user_id: int) -> bool:
    db_tx = get_transaction(db, transaction_id, user_id)
    if not db_tx:
        raise ValueError("Transaction not found.")
    db.delete(db_tx)
    db.commit()
    return True

def get_user_transactions(
    db: Session,
    user_id: int,
    type: Optional[str] = None,
    category_id: Optional[int] = None,
    payment_mode_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    search: Optional[str] = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    skip: int = 0,
    limit: int = 100
):
    query = db.query(Transaction).filter(Transaction.user_id == user_id)
    
    if type:
        query = query.filter(Transaction.type == type)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if payment_mode_id:
        query = query.filter(Transaction.payment_mode_id == payment_mode_id)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    if search:
        query = query.join(Category).outerjoin(Subcategory).filter(
            or_(
                Transaction.notes.ilike(f"%{search}%"),
                Category.name.ilike(f"%{search}%"),
                Subcategory.name.ilike(f"%{search}%")
            )
        )
        
    # Sorting
    order_column = getattr(Transaction, sort_by, Transaction.date)
    if sort_order == "asc":
        query = query.order_by(asc(order_column))
    else:
        query = query.order_by(desc(order_column))
        
    total = query.count()
    records = query.offset(skip).limit(limit).all()
    
    return total, records

def get_recent_transactions(db: Session, user_id: int, limit: int = 5) -> List[Transaction]:
    return db.query(Transaction).filter(Transaction.user_id == user_id).order_by(desc(Transaction.date), desc(Transaction.id)).limit(limit).all()

# ---------------------------------------------
# Recurring Transaction CRUD
# ---------------------------------------------
def calculate_next_due_date(start_date: date, frequency: str) -> date:
    if frequency == "daily":
        return start_date + timedelta(days=1)
    elif frequency == "weekly":
        return start_date + timedelta(weeks=1)
    elif frequency == "monthly":
        # Add 1 month safely
        year = start_date.year + (start_date.month // 12)
        month = (start_date.month % 12) + 1
        day = min(start_date.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
        return date(year, month, day)
    elif frequency == "yearly":
        # Add 1 year safely
        year = start_date.year + 1
        day = min(start_date.day, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28) if start_date.month == 2 and start_date.day == 29 else start_date.day
        return date(year, start_date.month, day)
    return start_date

def create_recurring(db: Session, rec: RecurringTransactionCreate, user_id: int) -> RecurringTransaction:
    # Verify categories & payment mode
    cat = db.query(Category).filter(Category.id == rec.category_id, Category.user_id == user_id).first()
    if not cat:
        raise ValueError("Invalid category selected.")
    pm = db.query(PaymentMode).filter(PaymentMode.id == rec.payment_mode_id, PaymentMode.user_id == user_id).first()
    if not pm:
        raise ValueError("Invalid payment mode selected.")
        
    next_due = calculate_next_due_date(rec.start_date, rec.frequency)
    
    db_rec = RecurringTransaction(
        user_id=user_id,
        type=rec.type,
        amount=rec.amount,
        frequency=rec.frequency,
        start_date=rec.start_date,
        end_date=rec.end_date,
        next_due_date=next_due,
        category_id=rec.category_id,
        subcategory_id=rec.subcategory_id,
        payment_mode_id=rec.payment_mode_id,
        is_active=True
    )
    db.add(db_rec)
    db.commit()
    db.refresh(db_rec)
    return db_rec

def get_user_recurring(db: Session, user_id: int) -> List[RecurringTransaction]:
    return db.query(RecurringTransaction).filter(RecurringTransaction.user_id == user_id).all()

def update_recurring(db: Session, recurring_id: int, rec: RecurringTransactionUpdate, user_id: int) -> RecurringTransaction:
    db_rec = db.query(RecurringTransaction).filter(RecurringTransaction.id == recurring_id, RecurringTransaction.user_id == user_id).first()
    if not db_rec:
        raise ValueError("Recurring transaction not found.")
        
    update_data = rec.model_dump(exclude_unset=True)
    
    # Validations
    target_freq = update_data.get("frequency", db_rec.frequency)
    target_start = update_data.get("start_date", db_rec.start_date)
    
    for key, val in update_data.items():
        setattr(db_rec, key, val)
        
    if "frequency" in update_data or "start_date" in update_data:
        db_rec.next_due_date = calculate_next_due_date(target_start, target_freq)
        
    db.commit()
    db.refresh(db_rec)
    return db_rec

def delete_recurring(db: Session, recurring_id: int, user_id: int) -> bool:
    db_rec = db.query(RecurringTransaction).filter(RecurringTransaction.id == recurring_id, RecurringTransaction.user_id == user_id).first()
    if not db_rec:
        raise ValueError("Recurring transaction not found.")
    db.delete(db_rec)
    db.commit()
    return True

# Scheduler Logic to Process Recurring Transactions and Insert regular Transactions
def process_recurring_transactions(db: Session):
    today = date.today()
    # Query all active recurring transactions that are due or overdue
    due_recs = db.query(RecurringTransaction).filter(
        RecurringTransaction.is_active == True,
        RecurringTransaction.next_due_date <= today
    ).all()
    
    for rec in due_recs:
        # Create normal transaction
        tx = Transaction(
            user_id=rec.user_id,
            type=rec.type,
            amount=rec.amount,
            date=rec.next_due_date, # Use the actual date it was due
            category_id=rec.category_id,
            subcategory_id=rec.subcategory_id,
            payment_mode_id=rec.payment_mode_id,
            notes=f"Recurring Auto-Generation ({rec.frequency.capitalize()})"
        )
        db.add(tx)
        
        # Calculate next due date
        next_due = calculate_next_due_date(rec.next_due_date, rec.frequency)
        
        # If end_date exists and next due date is past end_date, deactivate it
        if rec.end_date and next_due > rec.end_date:
            rec.is_active = False
            rec.next_due_date = None
        else:
            rec.next_due_date = next_due
            
        db.flush()
    db.commit()
