-- PostgreSQL Database Schema for Smart Personal Expense Tracker

-- Drop tables if they exist
DROP TABLE IF EXISTS "RecurringTransactions" CASCADE;
DROP TABLE IF EXISTS "Transactions" CASCADE;
DROP TABLE IF EXISTS "UserPreferences" CASCADE;
DROP TABLE IF EXISTS "Subcategories" CASCADE;
DROP TABLE IF EXISTS "Categories" CASCADE;
DROP TABLE IF EXISTS "PaymentModes" CASCADE;
DROP TABLE IF EXISTS "Users" CASCADE;

-- Users Table
CREATE TABLE "Users" (
    "id" SERIAL PRIMARY KEY,
    "email" TEXT UNIQUE NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories Table
CREATE TABLE "Categories" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER REFERENCES "Users"("id") ON DELETE CASCADE, -- NULL means global/default category
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL CHECK ("type" IN ('income', 'expense')),
    "icon" TEXT, -- name of Material Icon
    UNIQUE ("user_id", "name", "type")
);

-- Subcategories Table
CREATE TABLE "Subcategories" (
    "id" SERIAL PRIMARY KEY,
    "category_id" INTEGER REFERENCES "Categories"("id") ON DELETE CASCADE NOT NULL,
    "name" TEXT NOT NULL,
    UNIQUE ("category_id", "name")
);

-- PaymentModes Table
CREATE TABLE "PaymentModes" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER REFERENCES "Users"("id") ON DELETE CASCADE, -- NULL means global
    "name" TEXT UNIQUE NOT NULL
);

-- Transactions Table
CREATE TABLE "Transactions" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER REFERENCES "Users"("id") ON DELETE CASCADE NOT NULL,
    "type" TEXT NOT NULL CHECK ("type" IN ('income', 'expense')),
    "date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "amount" NUMERIC NOT NULL CHECK ("amount" > 0),
    "category_id" INTEGER REFERENCES "Categories"("id") ON DELETE RESTRICT NOT NULL,
    "subcategory_id" INTEGER REFERENCES "Subcategories"("id") ON DELETE RESTRICT,
    "payment_mode_id" INTEGER REFERENCES "PaymentModes"("id") ON DELETE RESTRICT NOT NULL,
    "notes" TEXT,
    "receipt_url" TEXT,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RecurringTransactions Table
CREATE TABLE "RecurringTransactions" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER REFERENCES "Users"("id") ON DELETE CASCADE NOT NULL,
    "type" TEXT NOT NULL CHECK ("type" IN ('income', 'expense')),
    "amount" NUMERIC NOT NULL CHECK ("amount" > 0),
    "category_id" INTEGER REFERENCES "Categories"("id") ON DELETE RESTRICT NOT NULL,
    "subcategory_id" INTEGER REFERENCES "Subcategories"("id") ON DELETE RESTRICT,
    "payment_mode_id" INTEGER REFERENCES "PaymentModes"("id") ON DELETE RESTRICT NOT NULL,
    "frequency" TEXT NOT NULL CHECK ("frequency" IN ('daily', 'weekly', 'monthly', 'yearly')),
    "start_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "end_date" DATE,
    "next_due_date" DATE,
    "is_active" BOOLEAN DEFAULT TRUE,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- UserPreferences Table
CREATE TABLE "UserPreferences" (
    "user_id" INTEGER PRIMARY KEY REFERENCES "Users"("id") ON DELETE CASCADE,
    "theme" TEXT DEFAULT 'light' CHECK ("theme" IN ('light', 'dark')),
    "currency" TEXT DEFAULT 'USD',
    "notifications_enabled" BOOLEAN DEFAULT TRUE,
    "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
-- Salary (1)
(1, 'Basic Salary'),
(1, 'Bonus'),
(1, 'Incentives'),
(1, 'Overtime'),
(1, 'Allowances'),
(1, 'Reimbursement'),
(1, 'Other'),
-- Freelancing (2)
(2, 'Client Payment'),
(2, 'Project Payment'),
(2, 'Consulting'),
(2, 'Contract Work'),
(2, 'Other'),
-- Business (3)
(3, 'Sales'),
(3, 'Service Income'),
(3, 'Commission'),
(3, 'Business Profit'),
(3, 'Other'),
-- Investments (4)
(4, 'Stocks'),
(4, 'Mutual Funds'),
(4, 'ETFs'),
(4, 'Bonds'),
(4, 'Gold'),
(4, 'Fixed Deposit'),
(4, 'Crypto'),
(4, 'Retirement/Pension'),
(4, 'Other'),
-- Gifts (5)
(5, 'Family'),
(5, 'Friends'),
(5, 'Birthday'),
(5, 'Wedding'),
(5, 'Anniversary'),
(5, 'Festival'),
(5, 'Other'),
-- Rental Income (6)
(6, 'Residential Rent'),
(6, 'Commercial Rent'),
(6, 'Parking Rent'),
(6, 'Property Income'),
(6, 'Other'),
-- Others (7)
(7, 'Cashback'),
(7, 'Refund'),
(7, 'Payback'),
(7, 'Earnings'),
(7, 'Other');

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
-- Bills (12)
(12, 'Electricity'),
(12, 'Water'),
(12, 'Gas'),
(12, 'Internet'),
(12, 'Mobile/Phone'),
(12, 'Insurance'),
(12, 'Subscription'),
(12, 'Credit Card Bill'),
(12, 'Other'),
-- Education (15)
(15, 'Tuition Fees'),
(15, 'Course/Training'),
(15, 'Books'),
(15, 'Stationery'),
(15, 'Exam Fees'),
(15, 'Certification'),
(15, 'College/School Fees'),
(15, 'Other'),
-- Entertainment (13)
(13, 'Movies'),
(13, 'OTT/Streaming'),
(13, 'Games'),
(13, 'Events'),
(13, 'Music'),
(13, 'Hobbies'),
(13, 'Other'),
-- Food (8)
(8, 'Groceries'),
(8, 'Restaurants'),
(8, 'Food Delivery'),
(8, 'Snacks'),
(8, 'Coffee/Tea'),
(8, 'Fast Food'),
(8, 'Other'),
-- Medical (14)
(14, 'Doctor'),
(14, 'Medicines'),
(14, 'Hospital'),
(14, 'Lab Tests'),
(14, 'Dental'),
(14, 'Health Insurance'),
(14, 'Other'),
-- Others (17)
(17, 'Bank Charges'),
(17, 'Fines'),
(17, 'Donations'),
(17, 'Personal Care'),
(17, 'Miscellaneous'),
(17, 'Unexpected Expense'),
(17, 'Other'),
-- Rent (9)
(9, 'House Rent'),
(9, 'Room Rent'),
(9, 'Office Rent'),
(9, 'Maintenance'),
(9, 'Parking'),
(9, 'Other'),
-- Shopping (10)
(10, 'Clothing'),
(10, 'Electronics'),
(10, 'Home & Furniture'),
(10, 'Beauty & Cosmetics'),
(10, 'Accessories'),
(10, 'Gifts'),
(10, 'Online Shopping'),
(10, 'Other'),
-- Transport (11)
(11, 'Fuel'),
(11, 'Bus'),
(11, 'Train'),
(11, 'Taxi/Cab'),
(11, 'Auto'),
(11, 'Metro'),
(11, 'Vehicle Repair'),
(11, 'Vehicle Maintenance'),
(11, 'Parking'),
(11, 'Toll'),
(11, 'Other'),
-- Travel (16)
(16, 'Flight'),
(16, 'Train Ticket'),
(16, 'Hotel'),
(16, 'Travel Food'),
(16, 'Local Transport'),
(16, 'Sightseeing'),
(16, 'Travel Activities'),
(16, 'Travel Shopping'),
(16, 'Other');

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

-- Adjust sequences for tables that were seeded with explicit IDs
SELECT setval(pg_get_serial_sequence('"Categories"', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM "Categories";
SELECT setval(pg_get_serial_sequence('"PaymentModes"', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM "PaymentModes";
