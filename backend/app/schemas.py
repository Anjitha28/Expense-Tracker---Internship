from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict
from typing import Optional, List, Annotated
from datetime import date as DateType, datetime
from decimal import Decimal

# ---------------------------------------------
# Preferences Schemas
# ---------------------------------------------
class UserPreferencesBase(BaseModel):
    theme: str = Field(default="light", pattern="^(light|dark)$")
    currency: str = Field(default="USD")
    notifications_enabled: bool = Field(default=True)

class UserPreferencesUpdate(BaseModel):
    theme: Optional[str] = Field(None, pattern="^(light|dark)$")
    currency: Optional[str] = None
    notifications_enabled: Optional[bool] = None

class UserPreferencesResponse(UserPreferencesBase):
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------
# User Schemas
# ---------------------------------------------
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters long")

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    created_at: datetime
    preferences: Optional[UserPreferencesResponse] = None

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None


# ---------------------------------------------
# Subcategory Schemas
# ---------------------------------------------
class SubcategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

class SubcategoryCreate(SubcategoryBase):
    category_id: int

class SubcategoryResponse(SubcategoryBase):
    id: int
    category_id: int

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------
# Category Schemas
# ---------------------------------------------
class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: str = Field(..., pattern="^(income|expense)$")
    icon: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    icon: Optional[str] = None

class CategoryResponse(CategoryBase):
    id: int
    user_id: Optional[int] = None
    subcategories: List[SubcategoryResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------
# Payment Mode Schemas
# ---------------------------------------------
class PaymentModeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

class PaymentModeCreate(PaymentModeBase):
    pass

class PaymentModeResponse(PaymentModeBase):
    id: int
    user_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------
# Transaction Schemas
# ---------------------------------------------
class TransactionBase(BaseModel):
    type: str = Field(..., pattern="^(income|expense)$")
    amount: Decimal = Field(..., gt=0, description="Amount must be greater than zero")
    date: DateType = Field(default_factory=DateType.today)
    notes: Optional[str] = None
    category_id: int
    subcategory_id: Optional[int] = None
    payment_mode_id: int
    receipt_url: Optional[str] = None

class TransactionCreate(TransactionBase):
    pass

class TransactionUpdate(BaseModel):
    type: Optional[str] = Field(None, pattern="^(income|expense)$")
    amount: Optional[Decimal] = Field(None, gt=0)
    date: Optional[DateType] = None
    notes: Optional[str] = None
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    payment_mode_id: Optional[int] = None
    receipt_url: Optional[str] = None

class TransactionResponse(BaseModel):
    id: int
    user_id: int
    type: str
    date: DateType
    amount: Decimal
    notes: Optional[str] = None
    receipt_url: Optional[str] = None
    created_at: datetime
    category: CategoryResponse
    subcategory: Optional[SubcategoryResponse] = None
    payment_mode: PaymentModeResponse

    model_config = ConfigDict(from_attributes=True)


class PaginatedTransactionResponse(BaseModel):
    total: int
    page: int
    limit: int
    transactions: List[TransactionResponse]


# ---------------------------------------------
# Recurring Transaction Schemas
# ---------------------------------------------
class RecurringTransactionBase(BaseModel):
    type: str = Field(..., pattern="^(income|expense)$")
    amount: Decimal = Field(..., gt=0)
    frequency: str = Field(..., pattern="^(daily|weekly|monthly|yearly)$")
    start_date: DateType = Field(default_factory=DateType.today)
    end_date: Optional[DateType] = None
    category_id: int
    subcategory_id: Optional[int] = None
    payment_mode_id: int

class RecurringTransactionCreate(RecurringTransactionBase):
    pass

class RecurringTransactionUpdate(BaseModel):
    type: Optional[str] = Field(None, pattern="^(income|expense)$")
    amount: Optional[Decimal] = Field(None, gt=0)
    frequency: Optional[str] = Field(None, pattern="^(daily|weekly|monthly|yearly)$")
    start_date: Optional[DateType] = None
    end_date: Optional[DateType] = None
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    payment_mode_id: Optional[int] = None
    is_active: Optional[bool] = None

class RecurringTransactionResponse(BaseModel):
    id: int
    user_id: int
    type: str
    amount: Decimal
    frequency: str
    start_date: DateType
    end_date: Optional[DateType] = None
    next_due_date: Optional[DateType] = None
    is_active: bool
    created_at: datetime
    category: CategoryResponse
    subcategory: Optional[SubcategoryResponse] = None
    payment_mode: PaymentModeResponse

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------
# Dashboard & Analytics Schemas
# ---------------------------------------------
class DashboardSummary(BaseModel):
    total_income: Decimal
    total_expense: Decimal
    current_balance: Decimal

class CategoryShare(BaseModel):
    category_id: int
    category_name: str
    amount: Decimal
    percentage: float

class MonthlyTrendPoint(BaseModel):
    month: str # e.g. "2026-07"
    income: Decimal
    expense: Decimal
    balance: Decimal
