# Smart Personal Expense Tracker (AURA)

This is a Personal Expense Tracker with a premium, responsive fintech UI, Express REST API backend, and PostgreSQL database.

## Prerequisites
- Node.js (v18+)
- PostgreSQL database server running locally or remotely

## Setup Instructions

1. **Environment Configuration**:
   Open `.env` in the root folder and configure your PostgreSQL database connection details:
   ```env
   PORT=5000
   DB_USER=postgres
   DB_HOST=localhost
   DB_DATABASE=expense_tracker
   DB_PASSWORD=your_postgres_password
   DB_PORT=5432
   JWT_SECRET=super_secret_fintech_key_123456
   ```

2. **Run PostgreSQL**:
   Make sure PostgreSQL is running. The server is designed to automatically create the database `expense_tracker` and initialize/seed the tables and columns on first launch!

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Start the Application**:
   ```bash
   npm start
   ```

5. **Access the App**:
   Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

## Application Pages & Features
1. **Login & Registration**: Secure authentication, passwords hashed using `bcryptjs` and session tracking via JWT tokens. Seeding: newly registered accounts are automatically seeded with 10 real-time financial records to display data on charts immediately.
2. **Dashboard**: Summary metrics (Income/Expense/Balance), Quick Add buttons (one-click addition), Monthly cashflow line area chart, and Expense Category donut chart.
3. **Income Analytics**: Progress-bars for category, subcategory and payment mode distributions, period aggregations (Today, Week, Month, Year), and insights.
4. **Expense Analytics**: Parallel layout to Income, displaying category/subcategory breakdowns and insights.
5. **Balance Sheet**: Rolling balance asset timeline, savings progress target circle, and net savings ratios.
6. **Reports & Ledger**: Period reports (Daily, Weekly, Monthly, Yearly) with search filter, transaction deletion/editing, and a "View All" history expander.
7. **Settings**: Theme selection (Light/Dark mode), toggle triggers, custom category addition, custom payment mode additions, and database Backup & Restore (JSON format).
