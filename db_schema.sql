-- PostgreSQL Database Schema for Smart Personal Expense Tracker

-- Drop tables if they exist
DROP TABLE IF EXISTS "RecurringTransactions";
DROP TABLE IF EXISTS "Transactions";
DROP TABLE IF EXISTS "UserPreferences";
DROP TABLE IF EXISTS "Subcategories";
DROP TABLE IF EXISTS "Categories";
DROP TABLE IF EXISTS "PaymentModes";
DROP TABLE IF EXISTS "Users";

-- Users Table
CREATE TABLE "Users" (
    "id" SERIAL PRIMARY KEY,
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Categories Table
CREATE TABLE "Categories" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER REFERENCES "Users"("id") ON DELETE CASCADE, -- NULL means global/default category
    "name" VARCHAR(100) NOT NULL,
    "type" VARCHAR(20) NOT NULL CHECK ("type" IN ('income', 'expense')),
    "icon" VARCHAR(50), -- name of Material Icon
    UNIQUE ("user_id", "name", "type")
);

-- Subcategories Table
CREATE TABLE "Subcategories" (
    "id" SERIAL PRIMARY KEY,
    "category_id" INTEGER REFERENCES "Categories"("id") ON DELETE CASCADE NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    UNIQUE ("category_id", "name")
);

-- PaymentModes Table
CREATE TABLE "PaymentModes" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER REFERENCES "Users"("id") ON DELETE CASCADE, -- NULL means global
    "name" VARCHAR(100) UNIQUE NOT NULL
);

-- Transactions Table
CREATE TABLE "Transactions" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER REFERENCES "Users"("id") ON DELETE CASCADE NOT NULL,
    "type" VARCHAR(20) NOT NULL CHECK ("type" IN ('income', 'expense')),
    "date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "amount" NUMERIC(12, 2) NOT NULL CHECK ("amount" > 0),
    "category_id" INTEGER REFERENCES "Categories"("id") ON DELETE RESTRICT NOT NULL,
    "subcategory_id" INTEGER REFERENCES "Subcategories"("id") ON DELETE RESTRICT,
    "payment_mode_id" INTEGER REFERENCES "PaymentModes"("id") ON DELETE RESTRICT NOT NULL,
    "notes" TEXT,
    "receipt_url" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RecurringTransactions Table
CREATE TABLE "RecurringTransactions" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER REFERENCES "Users"("id") ON DELETE CASCADE NOT NULL,
    "type" VARCHAR(20) NOT NULL CHECK ("type" IN ('income', 'expense')),
    "amount" NUMERIC(12, 2) NOT NULL CHECK ("amount" > 0),
    "category_id" INTEGER REFERENCES "Categories"("id") ON DELETE RESTRICT NOT NULL,
    "subcategory_id" INTEGER REFERENCES "Subcategories"("id") ON DELETE RESTRICT,
    "payment_mode_id" INTEGER REFERENCES "PaymentModes"("id") ON DELETE RESTRICT NOT NULL,
    "frequency" VARCHAR(20) NOT NULL CHECK ("frequency" IN ('daily', 'weekly', 'monthly', 'yearly')),
    "start_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "end_date" DATE,
    "next_due_date" DATE,
    "is_active" BOOLEAN DEFAULT TRUE,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- UserPreferences Table
CREATE TABLE "UserPreferences" (
    "user_id" INTEGER PRIMARY KEY REFERENCES "Users"("id") ON DELETE CASCADE,
    "theme" VARCHAR(20) DEFAULT 'light' CHECK ("theme" IN ('light', 'dark')),
    "currency" VARCHAR(10) DEFAULT 'USD',
    "notifications_enabled" BOOLEAN DEFAULT TRUE,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------
-- Seed Initial Global Categories and Subcategories
-- --------------------------------------------------

-- 1. Income Categories
INSERT INTO "Categories" ("id", "user_id", "name", "type", "icon") VALUES
(1, NULL, 'Salary', 'income', 'payments'),
(2, NULL, 'Freelancing', 'income', 'work'),
(3, NULL, 'Business', 'income', 'storefront'),
(4, NULL, 'Investments', 'income', 'trending_up'),
(5, NULL, 'Gifts', 'income', 'card_giftcard'),
(6, NULL, 'Rental Income', 'income', 'real_estate_agent'),
(7, NULL, 'Others', 'income', 'more_horiz');

-- 2. Income Subcategories
INSERT INTO "Subcategories" ("category_id", "name") VALUES
(1, 'Monthly Salary'),
(1, 'Bonus'),
(1, 'Overtime'),
(2, 'Web Dev'),
(2, 'Consulting'),
(2, 'Writing'),
(3, 'Retail'),
(3, 'Services'),
(3, 'E-commerce'),
(4, 'Stocks'),
(4, 'Mutual Funds'),
(4, 'Dividends');

-- 3. Expense Categories
INSERT INTO "Categories" ("id", "user_id", "name", "type", "icon") VALUES
(8, NULL, 'Food', 'expense', 'restaurant'),
(9, NULL, 'Rent', 'expense', 'home'),
(10, NULL, 'Shopping', 'expense', 'shopping_bag'),
(11, NULL, 'Transport', 'expense', 'directions_car'),
(12, NULL, 'Bills', 'expense', 'receipt_long'),
(13, NULL, 'Entertainment', 'expense', 'sports_esports'),
(14, NULL, 'Medical', 'expense', 'medical_services'),
(15, NULL, 'Education', 'expense', 'school'),
(16, NULL, 'Travel', 'expense', 'flight'),
(17, NULL, 'Others', 'expense', 'more_horiz');

-- 4. Expense Subcategories
INSERT INTO "Subcategories" ("category_id", "name") VALUES
(8, 'Breakfast'),
(8, 'Lunch'),
(8, 'Dinner'),
(8, 'Snacks'),
(10, 'Grocery'),
(10, 'Clothing'),
(10, 'Electronics'),
(11, 'Bus'),
(11, 'Taxi'),
(11, 'Train'),
(11, 'Fuel'),
(12, 'Electricity'),
(12, 'Water'),
(12, 'Internet'),
(12, 'Phone'),
(13, 'Movies'),
(13, 'Games'),
(13, 'Music'),
(13, 'Subscriptions');

-- --------------------------------------------------
-- Seed Initial Global Payment Modes
-- --------------------------------------------------
INSERT INTO "PaymentModes" ("id", "user_id", "name") VALUES
(1, NULL, 'Cash'),
(2, NULL, 'UPI'),
(3, NULL, 'Credit Card'),
(4, NULL, 'Debit Card'),
(5, NULL, 'Bank Transfer'),
(6, NULL, 'Mobile Wallet'),
(7, NULL, 'Cheque');

-- Adjust sequences for id autoincrement since we hardcoded seed IDs
SELECT setval('public."Categories_id_seq"', 17, true);
SELECT setval('public."PaymentModes_id_seq"', 7, true);
