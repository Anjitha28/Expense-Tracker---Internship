from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

from app.database import get_db
from app.auth import get_current_user
from app.models import User, Transaction, Category, PaymentMode, Subcategory
from app.utils.export_helpers import export_to_excel, export_to_pdf

router = APIRouter(prefix="/reports", tags=["Reports"])

def get_report_date_range(period: str) -> (date, date):
    today = date.today()
    if period == "daily":
        start = today
        end = today
    elif period == "weekly":
        # Start of current week (Monday)
        start = today - timedelta(days=today.weekday())
        end = today
    elif period == "monthly":
        start = today.replace(day=1)
        end = today
    elif period == "yearly":
        start = today.replace(month=1, day=1)
        end = today
    else:
        raise ValueError("Invalid period. Allowed: daily, weekly, monthly, yearly.")
    return start, end

@router.get("/summary")
def get_report_summary(
    period: str = Query("monthly", pattern="^(daily|weekly|monthly|yearly)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        start_date, end_date = get_report_date_range(period)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Aggregate income
    total_income = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == "income",
        Transaction.date >= start_date,
        Transaction.date <= end_date
    ).scalar() or Decimal("0.00")

    # Aggregate expense
    total_expense = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == "expense",
        Transaction.date >= start_date,
        Transaction.date <= end_date
    ).scalar() or Decimal("0.00")

    # Savings
    savings = total_income - total_expense
    savings_percentage = 0.0
    if total_income > 0:
        savings_percentage = float((savings / total_income) * 100)

    # Category analysis
    category_summary = db.query(
        Category.name.label("category"),
        Category.type.label("type"),
        func.sum(Transaction.amount).label("amount")
    ).join(Transaction, Transaction.category_id == Category.id).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start_date,
        Transaction.date <= end_date
    ).group_by(Category.name, Category.type).all()

    # Subcategory analysis
    subcategory_summary = db.query(
        Subcategory.name.label("subcategory"),
        Category.name.label("category"),
        func.sum(Transaction.amount).label("amount")
    ).join(Transaction, Transaction.subcategory_id == Subcategory.id).join(Category, Transaction.category_id == Category.id).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start_date,
        Transaction.date <= end_date
    ).group_by(Subcategory.name, Category.name).all()

    # Payment Mode analysis
    payment_mode_summary = db.query(
        PaymentMode.name.label("payment_mode"),
        func.sum(Transaction.amount).label("amount")
    ).join(Transaction, Transaction.payment_mode_id == PaymentMode.id).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start_date,
        Transaction.date <= end_date
    ).group_by(PaymentMode.name).all()

    # Transaction list in this period
    tx_list = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start_date,
        Transaction.date <= end_date
    ).order_by(Transaction.date.desc()).all()

    # Format summaries
    category_analysis = [{"category": row.category, "type": row.type, "amount": float(row.amount)} for row in category_summary]
    subcategory_analysis = [{"subcategory": row.subcategory, "category": row.category, "amount": float(row.amount)} for row in subcategory_summary]
    payment_mode_analysis = [{"payment_mode": row.payment_mode, "amount": float(row.amount)} for row in payment_mode_summary]

    # Generate insights
    highest_expense_cat = "N/A"
    highest_expense_amt = 0.0
    expense_cats = [c for c in category_analysis if c["type"] == "expense"]
    if expense_cats:
        top_exp = max(expense_cats, key=lambda x: x["amount"])
        highest_expense_cat = top_exp["category"]
        highest_expense_amt = top_exp["amount"]

    highest_income_cat = "N/A"
    highest_income_amt = 0.0
    income_cats = [c for c in category_analysis if c["type"] == "income"]
    if income_cats:
        top_inc = max(income_cats, key=lambda x: x["amount"])
        highest_income_cat = top_inc["category"]
        highest_income_amt = top_inc["amount"]

    most_frequent_pm = "N/A"
    if payment_mode_analysis:
        top_pm = max(payment_mode_analysis, key=lambda x: x["amount"])
        most_frequent_pm = top_pm["payment_mode"]

    insights = {
        "highest_spending_category": highest_expense_cat,
        "highest_spending_amount": highest_expense_amt,
        "highest_income_category": highest_income_cat,
        "highest_income_amount": highest_income_amt,
        "most_frequently_used_payment_mode": most_frequent_pm,
    }

    return {
        "period": period,
        "start_date": start_date,
        "end_date": end_date,
        "total_income": float(total_income),
        "total_expense": float(total_expense),
        "savings": float(savings),
        "savings_percentage": savings_percentage,
        "category_analysis": category_analysis,
        "subcategory_analysis": subcategory_analysis,
        "payment_mode_analysis": payment_mode_analysis,
        "insights": insights,
        "transaction_count": len(tx_list)
    }

def get_export_raw_data(db: Session, user_id: int, start_date: Optional[date], end_date: Optional[date]) -> list:
    query = db.query(Transaction).filter(Transaction.user_id == user_id)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
        
    records = query.order_by(Transaction.date.desc()).all()
    
    data = []
    for tx in records:
        data.append({
            "date": tx.date.strftime("%Y-%m-%d"),
            "type": tx.type,
            "category": tx.category.name,
            "subcategory": tx.subcategory.name if tx.subcategory else "",
            "payment_mode": tx.payment_mode.name,
            "amount": float(tx.amount),
            "notes": tx.notes or ""
        })
    return data

@router.get("/export/excel")
def export_excel(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    transactions_data = get_export_raw_data(db, current_user.id, start_date, end_date)
    excel_file = export_to_excel(transactions_data)
    
    headers = {
        'Content-Disposition': f'attachment; filename="ledger_export_{date.today()}.xlsx"'
    }
    return StreamingResponse(
        excel_file,
        headers=headers,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

@router.get("/export/pdf")
def export_pdf(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    transactions_data = get_export_raw_data(db, current_user.id, start_date, end_date)
    pdf_file = export_to_pdf(transactions_data, current_user.email)
    
    headers = {
        'Content-Disposition': f'attachment; filename="ledger_export_{date.today()}.pdf"'
    }
    return StreamingResponse(
        pdf_file,
        headers=headers,
        media_type="application/pdf"
    )
