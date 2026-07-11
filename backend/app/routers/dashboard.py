from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional, List

from app.database import get_db
from app.auth import get_current_user
from app.models import User, Transaction, Category, PaymentMode, Subcategory
import app.crud as crud

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary")
def get_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Auto-trigger recurring processing whenever summary is fetched to keep it up-to-date
    crud.process_recurring_transactions(db)

    # Compute total income
    income_res = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == "income"
    ).scalar() or Decimal("0.00")

    # Compute total expense
    expense_res = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == "expense"
    ).scalar() or Decimal("0.00")

    current_balance = income_res - expense_res

    return {
        "total_income": float(income_res),
        "total_expense": float(expense_res),
        "current_balance": float(current_balance)
    }

@router.get("/charts/cashflow")
def get_cashflow_chart(
    period: str = Query("monthly", pattern="^(daily|weekly|monthly|yearly)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Group transactions by date/month/year based on period
    today = date.today()
    
    if period == "daily":
        # Last 30 days
        start_date = today - timedelta(days=29)
        group_by_field = Transaction.date
    elif period == "weekly":
        # Last 12 weeks
        start_date = today - timedelta(weeks=11)
        group_by_field = func.to_char(Transaction.date, 'IYYY-IW')
    elif period == "monthly":
        # Last 12 months
        start_date = today - timedelta(days=365)
        group_by_field = func.to_char(Transaction.date, 'YYYY-MM')
    else: # yearly
        # Last 5 years
        start_date = today - timedelta(days=365 * 5)
        group_by_field = func.to_char(Transaction.date, 'YYYY')

    # Query incomes grouped
    incomes = db.query(
        group_by_field.label("label"),
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == "income"
    ).group_by(group_by_field).all()

    # Query expenses grouped
    expenses = db.query(
        group_by_field.label("label"),
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == "expense"
    ).group_by(group_by_field).all()

    # Generate chronologically padded labels based on period
    labels = []
    if period == "daily":
        for i in range(30):
            d = start_date + timedelta(days=i)
            labels.append(d.strftime("%Y-%m-%d"))
    elif period == "weekly":
        for i in range(12):
            d = today - timedelta(weeks=11 - i)
            y, w, _ = d.isocalendar()
            labels.append(f"{y}-{w:02d}")
    elif period == "monthly":
        for i in range(12):
            m = today.month - (11 - i)
            y = today.year
            while m <= 0:
                m += 12
                y -= 1
            labels.append(f"{y:04d}-{m:02d}")
    else: # yearly
        labels = [str(today.year - (4 - i)) for i in range(5)]

    # Combine into a chart data response
    data_dict = {}
    
    for row in incomes:
        if isinstance(row.label, date):
            label = row.label.strftime("%Y-%m-%d")
        else:
            label = str(row.label) if row.label else ""
        if label:
            if label not in data_dict:
                data_dict[label] = {"label": label, "income": 0.0, "expense": 0.0}
            data_dict[label]["income"] = float(row.total)

    for row in expenses:
        if isinstance(row.label, date):
            label = row.label.strftime("%Y-%m-%d")
        else:
            label = str(row.label) if row.label else ""
        if label:
            if label not in data_dict:
                data_dict[label] = {"label": label, "income": 0.0, "expense": 0.0}
            data_dict[label]["expense"] = float(row.total)

    # Sort keys chronologically
    sorted_labels = sorted(data_dict.keys())
    
    # Recharts AreaChart requires at least 2 data points to draw a line/area.
    # If there is only 1 data point, pad it with a zero-value point from the previous period.
    if len(sorted_labels) == 1:
        single_label = sorted_labels[0]
        # Just create a dummy label for the previous period to allow rendering
        dummy_label = "Previous"
        if period == "monthly" and len(single_label) == 7:
            y, m = int(single_label[:4]), int(single_label[5:])
            m -= 1
            if m == 0:
                m = 12
                y -= 1
            dummy_label = f"{y:04d}-{m:02d}"
        
        data_dict[dummy_label] = {"label": dummy_label, "income": 0.0, "expense": 0.0}
        sorted_labels = sorted(data_dict.keys())

    chart_data = [data_dict[label] for label in sorted_labels]

    return chart_data

@router.get("/charts/category-shares")
def get_category_shares(
    type: str = Query("expense", pattern="^(income|expense)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Sum grouped by Category
    shares = db.query(
        Category.id.label("category_id"),
        Category.name.label("category_name"),
        Category.icon.label("category_icon"),
        func.sum(Transaction.amount).label("total")
    ).join(Transaction, Transaction.category_id == Category.id).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == type
    ).group_by(Category.id, Category.name, Category.icon).all()

    total_amount = sum(row.total for row in shares) or Decimal("1")
    
    return [
        {
            "category_id": row.category_id,
            "category_name": row.category_name,
            "category_icon": row.category_icon,
            "amount": float(row.total),
            "percentage": float((row.total / total_amount) * 100)
        }
        for row in shares
    ]

@router.get("/suggestions")
def get_smart_suggestions(
    amount: float = Query(..., gt=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Find historical transaction of this amount to pre-populate details
    # Look for most recent matching transaction
    tx = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.amount == Decimal(f"{amount:.2f}")
    ).order_by(Transaction.date.desc(), Transaction.id.desc()).first()

    if not tx:
        return {"suggested": False}

    category = db.query(Category).filter(Category.id == tx.category_id).first()
    payment_mode = db.query(PaymentMode).filter(PaymentMode.id == tx.payment_mode_id).first()
    subcategory = db.query(Subcategory).filter(Subcategory.id == tx.subcategory_id).first() if tx.subcategory_id else None

    sub_name = subcategory.name if subcategory else category.name

    return {
        "suggested": True,
        "type": tx.type,
        "category_id": tx.category_id,
        "category_name": category.name if category else "",
        "subcategory_id": tx.subcategory_id,
        "subcategory_name": sub_name,
        "payment_mode_id": tx.payment_mode_id,
        "payment_mode_name": payment_mode.name if payment_mode else "",
        "notes": tx.notes,
        "message": f"Is this for {sub_name} paid using {payment_mode.name if payment_mode else 'UPI'}?"
    }


@router.get("/planner")
def get_expense_planner(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate smart expense planning suggestions based on the user's
    real transaction data stored in PostgreSQL.
    """
    # Compute total income and expenses
    income_res = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == "income"
    ).scalar() or Decimal("0.00")

    expense_res = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == "expense"
    ).scalar() or Decimal("0.00")

    total_income = float(income_res)
    total_expense = float(expense_res)

    if total_income == 0 and total_expense == 0:
        return {
            "has_data": False,
            "message": "No transactions found. Add your first transaction to get personalized suggestions."
        }

    savings = total_income - total_expense
    expense_ratio = (total_expense / total_income * 100) if total_income > 0 else 0
    savings_rate = (savings / total_income * 100) if total_income > 0 else 0

    # Top spending categories
    category_shares = db.query(
        Category.name.label("category_name"),
        func.sum(Transaction.amount).label("total")
    ).join(Transaction, Transaction.category_id == Category.id).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == "expense"
    ).group_by(Category.id, Category.name).order_by(func.sum(Transaction.amount).desc()).limit(3).all()

    top_categories = [{"name": row.category_name, "amount": float(row.total)} for row in category_shares]

    # Transaction count
    tx_count = db.query(func.count(Transaction.id)).filter(
        Transaction.user_id == current_user.id
    ).scalar() or 0

    # Budget recommendations (50/30/20 rule)
    needs_budget = total_income * 0.50
    wants_budget = total_income * 0.30
    savings_target = total_income * 0.20
    spending_limit = total_income * 0.80

    # Build tips
    tips = []
    if expense_ratio > 90:
        tips.append({"type": "danger", "text": f"Critical: Your expenses are {expense_ratio:.1f}% of income. Immediate budget review needed."})
    elif expense_ratio > 70:
        tips.append({"type": "warning", "text": f"Caution: Expenses at {expense_ratio:.1f}% of income. Try to reduce non-essential spending."})
    else:
        tips.append({"type": "success", "text": f"Well done! Expense ratio is {expense_ratio:.1f}% — within a healthy range."})

    if savings_rate < 10:
        tips.append({"type": "warning", "text": f"Low savings rate ({savings_rate:.1f}%). Try to reach the recommended 20% savings target."})
    elif savings_rate >= 20:
        tips.append({"type": "success", "text": f"Excellent savings rate of {savings_rate:.1f}%! You're exceeding the 20% benchmark."})

    if top_categories:
        tips.append({"type": "info", "text": f"Your biggest spend is '{top_categories[0]['name']}'. Review if it aligns with your budget goals."})

    if total_expense > spending_limit:
        tips.append({"type": "warning", "text": f"Spending limit exceeded. Keep total expenses under {spending_limit:.0f} (80% of income)."})

    return {
        "has_data": True,
        "total_income": total_income,
        "total_expense": total_expense,
        "savings": savings,
        "expense_ratio": round(expense_ratio, 2),
        "savings_rate": round(savings_rate, 2),
        "transaction_count": tx_count,
        "budget_plan": {
            "needs_50pct": round(needs_budget, 2),
            "wants_30pct": round(wants_budget, 2),
            "savings_20pct": round(savings_target, 2),
            "spending_limit": round(spending_limit, 2)
        },
        "top_expense_categories": top_categories,
        "tips": tips
    }
