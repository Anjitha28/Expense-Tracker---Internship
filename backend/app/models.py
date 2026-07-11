from sqlalchemy import Column, Integer, String, Numeric, Date, Boolean, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "Users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    preferences = relationship("UserPreferences", back_populates="user", uselist=False, cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="user", cascade="all, delete-orphan")
    payment_modes = relationship("PaymentMode", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    recurring_transactions = relationship("RecurringTransaction", back_populates="user", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "Categories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("Users.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(20), nullable=False) # 'income' or 'expense'
    icon = Column(String(50), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "name", "type", name="uq_user_category_name_type"),
    )

    # Relationships
    user = relationship("User", back_populates="categories")
    subcategories = relationship("Subcategory", back_populates="category", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="category")
    recurring_transactions = relationship("RecurringTransaction", back_populates="category")


class Subcategory(Base):
    __tablename__ = "Subcategories"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("Categories.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)

    __table_args__ = (
        UniqueConstraint("category_id", "name", name="uq_category_subcategory_name"),
    )

    # Relationships
    category = relationship("Category", back_populates="subcategories")
    transactions = relationship("Transaction", back_populates="subcategory")
    recurring_transactions = relationship("RecurringTransaction", back_populates="subcategory")


class PaymentMode(Base):
    __tablename__ = "PaymentModes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("Users.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(100), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_user_payment_mode_name"),
    )

    # Relationships
    user = relationship("User", back_populates="payment_modes")
    transactions = relationship("Transaction", back_populates="payment_mode")
    recurring_transactions = relationship("RecurringTransaction", back_populates="payment_mode")


class Transaction(Base):
    __tablename__ = "Transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("Users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(20), nullable=False) # 'income' or 'expense'
    date = Column(Date, nullable=False, server_default=func.current_date(), index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    category_id = Column(Integer, ForeignKey("Categories.id", ondelete="RESTRICT"), nullable=False, index=True)
    subcategory_id = Column(Integer, ForeignKey("Subcategories.id", ondelete="RESTRICT"), nullable=True, index=True)
    payment_mode_id = Column(Integer, ForeignKey("PaymentModes.id", ondelete="RESTRICT"), nullable=False, index=True)
    notes = Column(String, nullable=True)
    receipt_url = Column(String, nullable=True) # file path or web URL for receipt upload
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")
    subcategory = relationship("Subcategory", back_populates="transactions")
    payment_mode = relationship("PaymentMode", back_populates="transactions")


class RecurringTransaction(Base):
    __tablename__ = "RecurringTransactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("Users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(20), nullable=False) # 'income' or 'expense'
    amount = Column(Numeric(12, 2), nullable=False)
    category_id = Column(Integer, ForeignKey("Categories.id", ondelete="RESTRICT"), nullable=False, index=True)
    subcategory_id = Column(Integer, ForeignKey("Subcategories.id", ondelete="RESTRICT"), nullable=True, index=True)
    payment_mode_id = Column(Integer, ForeignKey("PaymentModes.id", ondelete="RESTRICT"), nullable=False, index=True)
    frequency = Column(String(20), nullable=False) # 'daily', 'weekly', 'monthly', 'yearly'
    start_date = Column(Date, nullable=False, server_default=func.current_date())
    end_date = Column(Date, nullable=True)
    next_due_date = Column(Date, nullable=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="recurring_transactions")
    category = relationship("Category", back_populates="recurring_transactions")
    subcategory = relationship("Subcategory", back_populates="recurring_transactions")
    payment_mode = relationship("PaymentMode", back_populates="recurring_transactions")


class UserPreferences(Base):
    __tablename__ = "UserPreferences"

    user_id = Column(Integer, ForeignKey("Users.id", ondelete="CASCADE"), primary_key=True)
    theme = Column(String(20), default="light", nullable=False) # 'light' or 'dark'
    currency = Column(String(10), default="USD", nullable=False)
    notifications_enabled = Column(Boolean, default=True, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="preferences")
