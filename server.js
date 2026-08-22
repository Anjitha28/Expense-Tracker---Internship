const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_fintech_key_123456';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Database
db.initDB();

// --------------------------------------------------
// Authentication Middleware
// --------------------------------------------------
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
}

// --------------------------------------------------
// API: Authentication
// --------------------------------------------------

// Register
app.post('/api/auth/register', async (req, res) => {
  const { email, password, confirmPassword } = req.body;

  // Validations
  if (!email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  // Password length validation
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must contain at least 8 characters.' });
  }

  // Password matching validation
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  try {
    // Check if user already exists
    const userCheck = await db.query('SELECT id FROM "Users" WHERE email = $1', [email]);
    if (userCheck.rowCount > 0) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert user
    const newUser = await db.query(
      'INSERT INTO "Users" (email, password) VALUES ($1, $2) RETURNING id, email',
      [email, hashedPassword]
    );
    const userId = newUser.rows[0].id;

    // Create default UserPreferences
    await db.query(
      'INSERT INTO "UserPreferences" (user_id, theme, currency, notifications_enabled) VALUES ($1, $2, $3, $4)',
      [userId, 'light', 'USD', true]
    );

    // Seed mock transactions for a rich UX immediately
    try {
      await db.query(`
        INSERT INTO "Transactions" (user_id, type, date, amount, category_id, subcategory_id, payment_mode_id, notes) VALUES
        ($1, 'income', date('now', '-10 days'), 3500.00, 1, 1, 5, 'Monthly Salary'),
        ($1, 'income', date('now', '-2 days'), 550.00, 2, 4, 2, 'Freelance Web Work'),
        ($1, 'income', date('now', '-8 days'), 120.00, 4, 10, 5, 'Stock Dividend Payout'),
        ($1, 'expense', date('now', '-9 days'), 1200.00, 9, NULL, 5, 'Apartment Rent'),
        ($1, 'expense', date('now'), 45.50, 8, 15, 4, 'Bistro Dinner'),
        ($1, 'expense', date('now'), 6.20, 8, 16, 1, 'Morning Coffee & Donut'),
        ($1, 'expense', date('now', '-3 days'), 149.00, 10, 18, 3, 'Winter Jacket Shopping'),
        ($1, 'expense', date('now', '-4 days'), 22.00, 11, 21, 6, 'Taxi office commute'),
        ($1, 'expense', date('now', '-6 days'), 85.00, 12, 26, 3, 'Broadband Internet Bill'),
        ($1, 'expense', date('now', '-1 days'), 14.99, 13, 31, 3, 'Streaming Subscription')
      `, [userId]);
    } catch (seedErr) {
      console.error('Failed to seed user mock transactions:', seedErr.message);
    }

    // Create JWT Token
    const token = jwt.sign({ id: userId, email: newUser.rows[0].email }, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      message: 'Registration successful!',
      token,
      user: { id: userId, email: newUser.rows[0].email }
    });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    let user;
    const userRes = await db.query('SELECT * FROM "Users" WHERE email = $1', [email]);
    
    if (userRes.rowCount === 0) {
      // Auto-create user for seamless access (Mock authentication)
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      const newUser = await db.query(
        'INSERT INTO "Users" (email, password) VALUES ($1, $2) RETURNING id, email',
        [email, hashedPassword]
      );
      user = { id: newUser.rows[0].id, email: newUser.rows[0].email };

      // Create default UserPreferences
      await db.query(
        'INSERT INTO "UserPreferences" (user_id, theme, currency, notifications_enabled) VALUES ($1, $2, $3, $4)',
        [user.id, 'light', 'USD', true]
      );

      // Seed mock transactions for a rich UX immediately
      try {
        await db.query(`
          INSERT INTO "Transactions" (user_id, type, date, amount, category_id, subcategory_id, payment_mode_id, notes) VALUES
          ($1, 'income', date('now', '-10 days'), 3500.00, 1, 1, 5, 'Monthly Salary'),
          ($1, 'income', date('now', '-2 days'), 550.00, 2, 4, 2, 'Freelance Web Work'),
          ($1, 'income', date('now', '-8 days'), 120.00, 4, 10, 5, 'Stock Dividend Payout'),
          ($1, 'expense', date('now', '-9 days'), 1200.00, 9, NULL, 5, 'Apartment Rent'),
          ($1, 'expense', date('now'), 45.50, 8, 15, 4, 'Bistro Dinner'),
          ($1, 'expense', date('now'), 6.20, 8, 16, 1, 'Morning Coffee & Donut'),
          ($1, 'expense', date('now', '-3 days'), 149.00, 10, 18, 3, 'Winter Jacket Shopping'),
          ($1, 'expense', date('now', '-4 days'), 22.00, 11, 21, 6, 'Taxi office commute'),
          ($1, 'expense', date('now', '-6 days'), 85.00, 12, 26, 3, 'Broadband Internet Bill'),
          ($1, 'expense', date('now', '-1 days'), 14.99, 13, 31, 3, 'Streaming Subscription')
        `, [user.id]);
      } catch (seedErr) {
        console.error('Failed to seed user mock transactions:', seedErr.message);
      }
    } else {
      user = userRes.rows[0];
      // Note: Deliberately bypassing password verification per requirements
    }

    // Fetch user preference
    const prefRes = await db.query('SELECT theme, currency, notifications_enabled FROM "UserPreferences" WHERE user_id = $1', [user.id]);
    const preferences = prefRes.rows[0] || { theme: 'light', currency: 'USD', notifications_enabled: true };

    // Create JWT Token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      message: 'Login successful!',
      token,
      user: { id: user.id, email: user.email },
      preferences
    });
  } catch (err) {
    console.error('Login error:', err.message, err.stack);
    res.status(500).json({ error: 'Server error during login.', details: err.message, stack: err.stack });
  }
});

// Logout (Implemented primarily client-side, but API endpoint returns success)
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logout successful' });
});


// --------------------------------------------------
// API: Categories and Subcategories
// --------------------------------------------------

// Get Categories (includes global and user specific)
app.get('/api/categories', authenticateToken, async (req, res) => {
  try {
    const categories = await db.query(
      'SELECT * FROM "Categories" WHERE user_id IS NULL OR user_id = $1 ORDER BY type, name',
      [req.user.id]
    );
    res.json(categories.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get Subcategories
app.get('/api/subcategories', authenticateToken, async (req, res) => {
  try {
    const subcategories = await db.query(
      `SELECT s.id, s.category_id, s.name, c.type 
       FROM "Subcategories" s 
       JOIN "Categories" c ON s.category_id = c.id 
       WHERE c.user_id IS NULL OR c.user_id = $1 
       ORDER BY s.name`,
      [req.user.id]
    );
    res.json(subcategories.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch subcategories' });
  }
});

// Create Category (custom user categories)
app.post('/api/categories', authenticateToken, async (req, res) => {
  const { name, type, icon } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: 'Category name and type are required' });
  }

  try {
    // Check duplicate
    const check = await db.query(
      'SELECT id FROM "Categories" WHERE (user_id IS NULL OR user_id = $1) AND LOWER(name) = LOWER($2) AND type = $3',
      [req.user.id, name, type]
    );
    if (check.rowCount > 0) {
      return res.status(400).json({ error: 'Category already exists' });
    }

    const newCategory = await db.query(
      'INSERT INTO "Categories" (user_id, name, type, icon) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, name, type, icon || 'star']
    );
    res.status(201).json(newCategory.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Create Subcategory
app.post('/api/subcategories', authenticateToken, async (req, res) => {
  const { category_id, name } = req.body;
  if (!category_id || !name) {
    return res.status(400).json({ error: 'Category ID and subcategory name are required' });
  }

  try {
    // Verify category belongs to user/global
    const catCheck = await db.query(
      'SELECT id FROM "Categories" WHERE id = $1 AND (user_id IS NULL OR user_id = $2)',
      [category_id, req.user.id]
    );
    if (catCheck.rowCount === 0) {
      return res.status(403).json({ error: 'Access denied to category' });
    }

    // Check duplicate subcategory
    const subCheck = await db.query(
      'SELECT id FROM "Subcategories" WHERE category_id = $1 AND LOWER(name) = LOWER($2)',
      [category_id, name]
    );
    if (subCheck.rowCount > 0) {
      return res.status(400).json({ error: 'Subcategory already exists for this category' });
    }

    const newSub = await db.query(
      'INSERT INTO "Subcategories" (category_id, name) VALUES ($1, $2) RETURNING *',
      [category_id, name]
    );
    res.status(201).json(newSub.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to create subcategory' });
  }
});


// --------------------------------------------------
// API: Payment Modes
// --------------------------------------------------

// Get Payment Modes
app.get('/api/payment-modes', authenticateToken, async (req, res) => {
  try {
    const modes = await db.query(
      'SELECT * FROM "PaymentModes" WHERE user_id IS NULL OR user_id = $1 ORDER BY name',
      [req.user.id]
    );
    res.json(modes.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch payment modes' });
  }
});

// Create Custom Payment Mode
app.post('/api/payment-modes', authenticateToken, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Payment mode name is required' });

  try {
    const check = await db.query(
      'SELECT id FROM "PaymentModes" WHERE (user_id IS NULL OR user_id = $1) AND LOWER(name) = LOWER($2)',
      [req.user.id, name]
    );
    if (check.rowCount > 0) {
      return res.status(400).json({ error: 'Payment mode already exists' });
    }

    const newMode = await db.query(
      'INSERT INTO "PaymentModes" (user_id, name) VALUES ($1, $2) RETURNING *',
      [req.user.id, name]
    );
    res.status(201).json(newMode.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to create payment mode' });
  }
});


// --------------------------------------------------
// API: Transactions
// --------------------------------------------------

// Get Transaction Detail
app.get('/api/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.*, c.name as category_name, s.name as subcategory_name, p.name as payment_mode_name
       FROM "Transactions" t
       JOIN "Categories" c ON t.category_id = c.id
       LEFT JOIN "Subcategories" s ON t.subcategory_id = s.id
       JOIN "PaymentModes" p ON t.payment_mode_id = p.id
       WHERE t.id = $1 AND t.user_id = $2`,
      [req.params.id, req.user.id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch transaction details' });
  }
});

// Create Transaction
app.post('/api/transactions', authenticateToken, async (req, res) => {
  const { type, date, amount, category_id, subcategory_id, payment_mode_id, notes, receipt_url } = req.body;

  if (!type || !amount || !category_id || !payment_mode_id) {
    return res.status(400).json({ error: 'Type, amount, category, and payment mode are required.' });
  }

  if (amount <= 0) {
    return res.status(400).json({ error: 'Amount must be greater than zero.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO "Transactions" (user_id, type, date, amount, category_id, subcategory_id, payment_mode_id, notes, receipt_url)
       VALUES ($1, $2, COALESCE($3, date('now')), $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.id, type, date || null, amount, category_id, subcategory_id || null, payment_mode_id, notes || null, receipt_url || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create transaction error:', err.message);
    res.status(500).json({ error: 'Failed to create transaction.' });
  }
});

// Update Transaction
app.put('/api/transactions/:id', authenticateToken, async (req, res) => {
  const { type, date, amount, category_id, subcategory_id, payment_mode_id, notes, receipt_url } = req.body;
  const transId = req.params.id;

  if (!type || !amount || !category_id || !payment_mode_id) {
    return res.status(400).json({ error: 'Type, amount, category, and payment mode are required.' });
  }

  if (amount <= 0) {
    return res.status(400).json({ error: 'Amount must be greater than zero.' });
  }

  try {
    // Verify ownership
    const check = await db.query('SELECT id FROM "Transactions" WHERE id = $1 AND user_id = $2', [transId, req.user.id]);
    if (check.rowCount === 0) {
      return res.status(403).json({ error: 'Access denied or transaction not found.' });
    }

    const result = await db.query(
      `UPDATE "Transactions"
       SET type = $1, date = $2, amount = $3, category_id = $4, subcategory_id = $5, payment_mode_id = $6, notes = $7, receipt_url = $8
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [type, date, amount, category_id, subcategory_id || null, payment_mode_id, notes || null, receipt_url || null, transId, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update transaction error:', err.message);
    res.status(500).json({ error: 'Failed to update transaction.' });
  }
});

// Delete Transaction
app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
  const transId = req.params.id;
  try {
    const check = await db.query('SELECT id FROM "Transactions" WHERE id = $1 AND user_id = $2', [transId, req.user.id]);
    if (check.rowCount === 0) {
      return res.status(403).json({ error: 'Access denied or transaction not found.' });
    }

    await db.query('DELETE FROM "Transactions" WHERE id = $1 AND user_id = $2', [transId, req.user.id]);
    res.json({ message: 'Transaction deleted successfully.' });
  } catch (err) {
    console.error('Delete transaction error:', err.message);
    res.status(500).json({ error: 'Failed to delete transaction.' });
  }
});

// Get Recent Transactions (supporting offset & limits, or search filters)
app.get('/api/transactions', authenticateToken, async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const type = req.query.type; // filter: 'income' or 'expense'

  try {
    let sql = `
      SELECT t.*, c.name as category_name, c.icon as category_icon, s.name as subcategory_name, p.name as payment_mode_name
      FROM "Transactions" t
      JOIN "Categories" c ON t.category_id = c.id
      LEFT JOIN "Subcategories" s ON t.subcategory_id = s.id
      JOIN "PaymentModes" p ON t.payment_mode_id = p.id
      WHERE t.user_id = $1
    `;
    const params = [req.user.id];

    if (type === 'income' || type === 'expense') {
      sql += ` AND t.type = $2`;
      params.push(type);
    }

    sql += ` ORDER BY t.date DESC, t.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});


// --------------------------------------------------
// API: Dashboard Summary & Analytics
// --------------------------------------------------

// Summary stats
app.get('/api/dashboard/summary', authenticateToken, async (req, res) => {
  try {
    // Total income/expense
    const sumRes = await db.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
       FROM "Transactions" 
       WHERE user_id = $1`,
      [req.user.id]
    );
    
    const totalIncome = parseFloat(sumRes.rows[0].income);
    const totalExpense = parseFloat(sumRes.rows[0].expense);
    const currentBalance = totalIncome - totalExpense;

    // Recent 5 transactions
    const recentRes = await db.query(
      `SELECT t.*, c.name as category_name, c.icon as category_icon, s.name as subcategory_name, p.name as payment_mode_name
       FROM "Transactions" t
       JOIN "Categories" c ON t.category_id = c.id
       LEFT JOIN "Subcategories" s ON t.subcategory_id = s.id
       JOIN "PaymentModes" p ON t.payment_mode_id = p.id
       WHERE t.user_id = $1
       ORDER BY t.date DESC, t.id DESC
       LIMIT 5`,
      [req.user.id]
    );

    // Expense Category Pie Chart Data
    const categoryRes = await db.query(
      `SELECT c.name, COALESCE(SUM(t.amount), 0) as amount
       FROM "Transactions" t
       JOIN "Categories" c ON t.category_id = c.id
       WHERE t.user_id = $1 AND t.type = 'expense'
       GROUP BY c.name
       ORDER BY amount DESC`,
      [req.user.id]
    );

    // Income vs Expense chart (by month, last 6 months)
    const chartRes = await db.query(
      `SELECT 
         strftime('%m-%Y', date) as period,
         strftime('%Y%m', date) as sort_key,
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
       FROM "Transactions"
       WHERE user_id = $1 AND date >= date('now', '-6 months')
       GROUP BY period, sort_key
       ORDER BY sort_key ASC`,
      [req.user.id]
    );

    res.json({
      summary: {
        totalIncome,
        totalExpense,
        currentBalance
      },
      recentTransactions: recentRes.rows,
      expenseCategories: categoryRes.rows,
      incomeVsExpenseChart: chartRes.rows
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

// Income analytics
app.get('/api/dashboard/income-analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Summaries
    const summary = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN date = date('now') THEN amount ELSE 0 END), 0) as today,
         COALESCE(SUM(CASE WHEN date >= date('now', 'weekday 0', '-7 days') THEN amount ELSE 0 END), 0) as this_week,
         COALESCE(SUM(CASE WHEN date >= date('now', 'start of month') THEN amount ELSE 0 END), 0) as this_month,
         COALESCE(SUM(CASE WHEN date >= date('now', 'start of year') THEN amount ELSE 0 END), 0) as this_year
       FROM "Transactions"
       WHERE user_id = $1 AND type = 'income'`,
      [userId]
    );

    // Category breakdown
    const categories = await db.query(
      `SELECT c.name, COALESCE(SUM(t.amount), 0) as amount
       FROM "Transactions" t
       JOIN "Categories" c ON t.category_id = c.id
       WHERE t.user_id = $1 AND t.type = 'income'
       GROUP BY c.name ORDER BY amount DESC`,
      [userId]
    );

    // Subcategory breakdown
    const subcategories = await db.query(
      `SELECT s.name, COALESCE(SUM(t.amount), 0) as amount
       FROM "Transactions" t
       JOIN "Subcategories" s ON t.subcategory_id = s.id
       WHERE t.user_id = $1 AND t.type = 'income'
       GROUP BY s.name ORDER BY amount DESC`,
      [userId]
    );

    // Payment Mode breakdown
    const paymentModes = await db.query(
      `SELECT p.name, COALESCE(SUM(t.amount), 0) as amount
       FROM "Transactions" t
       JOIN "PaymentModes" p ON t.payment_mode_id = p.id
       WHERE t.user_id = $1 AND t.type = 'income'
       GROUP BY p.name ORDER BY amount DESC`,
      [userId]
    );

    // Chart trend by months (current year)
    const trends = await db.query(
      `SELECT 
         strftime('%m', date) as label,
         strftime('%m', date) as month_num,
         COALESCE(SUM(amount), 0) as amount
       FROM "Transactions"
       WHERE user_id = $1 AND type = 'income' AND strftime('%Y', date) = strftime('%Y', 'now')
       GROUP BY label, month_num
       ORDER BY month_num ASC`,
      [userId]
    );

    res.json({
      summary: summary.rows[0],
      categories: categories.rows,
      subcategories: subcategories.rows,
      paymentModes: paymentModes.rows,
      trends: trends.rows
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch income analytics' });
  }
});

// Expense analytics
app.get('/api/dashboard/expense-analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Summaries
    const summary = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN date = date('now') THEN amount ELSE 0 END), 0) as today,
         COALESCE(SUM(CASE WHEN date >= date('now', 'weekday 0', '-7 days') THEN amount ELSE 0 END), 0) as this_week,
         COALESCE(SUM(CASE WHEN date >= date('now', 'start of month') THEN amount ELSE 0 END), 0) as this_month,
         COALESCE(SUM(CASE WHEN date >= date('now', 'start of year') THEN amount ELSE 0 END), 0) as this_year
       FROM "Transactions"
       WHERE user_id = $1 AND type = 'expense'`,
      [userId]
    );

    // Category breakdown
    const categories = await db.query(
      `SELECT c.name, COALESCE(SUM(t.amount), 0) as amount
       FROM "Transactions" t
       JOIN "Categories" c ON t.category_id = c.id
       WHERE t.user_id = $1 AND t.type = 'expense'
       GROUP BY c.name ORDER BY amount DESC`,
      [userId]
    );

    // Subcategory breakdown
    const subcategories = await db.query(
      `SELECT s.name, COALESCE(SUM(t.amount), 0) as amount
       FROM "Transactions" t
       JOIN "Subcategories" s ON t.subcategory_id = s.id
       WHERE t.user_id = $1 AND t.type = 'expense'
       GROUP BY s.name ORDER BY amount DESC`,
      [userId]
    );

    // Payment Mode breakdown
    const paymentModes = await db.query(
      `SELECT p.name, COALESCE(SUM(t.amount), 0) as amount
       FROM "Transactions" t
       JOIN "PaymentModes" p ON t.payment_mode_id = p.id
       WHERE t.user_id = $1 AND t.type = 'expense'
       GROUP BY p.name ORDER BY amount DESC`,
      [userId]
    );

    // Chart trend by months (current year)
    const trends = await db.query(
      `SELECT 
         strftime('%m', date) as label,
         strftime('%m', date) as month_num,
         COALESCE(SUM(amount), 0) as amount
       FROM "Transactions"
       WHERE user_id = $1 AND type = 'expense' AND strftime('%Y', date) = strftime('%Y', 'now')
       GROUP BY label, month_num
       ORDER BY month_num ASC`,
      [userId]
    );

    res.json({
      summary: summary.rows[0],
      categories: categories.rows,
      subcategories: subcategories.rows,
      paymentModes: paymentModes.rows,
      trends: trends.rows
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch expense analytics' });
  }
});

// Balance analytics
app.get('/api/dashboard/balance-analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Summaries
    const sumRes = await db.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense
       FROM "Transactions"
       WHERE user_id = $1`,
      [userId]
    );
    const totalIncome = parseFloat(sumRes.rows[0].total_income);
    const totalExpense = parseFloat(sumRes.rows[0].total_expense);
    const savings = totalIncome - totalExpense;
    const savingsPercentage = totalIncome > 0 ? Math.round((savings / totalIncome) * 100) : 0;

    // Monthly trends (last 6 months)
    const monthlyTrends = await db.query(
      `SELECT 
         strftime('%m-%Y', date) as label,
         strftime('%Y%m', date) as sort_key,
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
       FROM "Transactions"
       WHERE user_id = $1 AND date >= date('now', '-6 months')
       GROUP BY label, sort_key
       ORDER BY sort_key ASC`,
      [userId]
    );

    // Calculate rolling balance trend
    let balance = 0;
    const balanceHistory = monthlyTrends.rows.map(row => {
      const inc = parseFloat(row.income);
      const exp = parseFloat(row.expense);
      balance += (inc - exp);
      return {
        label: row.label,
        income: inc,
        expense: exp,
        balance: balance
      };
    });

    res.json({
      summary: {
        totalIncome,
        totalExpense,
        savings,
        savingsPercentage,
        currentBalance: savings
      },
      balanceHistory
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch balance analytics' });
  }
});


// --------------------------------------------------
// API: Reports
// --------------------------------------------------

// Subroutine to gather report data
async function fetchReportData(userId, startDateSql, endDateSql = "date('now')") {
  const sumRes = await db.query(
    `SELECT 
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense
     FROM "Transactions" 
     WHERE user_id = $1 AND date >= ${startDateSql} AND date <= ${endDateSql}`,
    [userId]
  );
  
  const transRes = await db.query(
    `SELECT t.*, c.name as category_name, s.name as subcategory_name, p.name as payment_mode_name
     FROM "Transactions" t
     JOIN "Categories" c ON t.category_id = c.id
     LEFT JOIN "Subcategories" s ON t.subcategory_id = s.id
     JOIN "PaymentModes" p ON t.payment_mode_id = p.id
     WHERE t.user_id = $1 AND t.date >= ${startDateSql} AND t.date <= ${endDateSql}
     ORDER BY t.date DESC, t.id DESC`,
    [userId]
  );

  const categoryBreakdown = await db.query(
    `SELECT c.name, c.type, COALESCE(SUM(t.amount), 0) as amount
     FROM "Transactions" t
     JOIN "Categories" c ON t.category_id = c.id
     WHERE t.user_id = $1 AND t.date >= ${startDateSql} AND t.date <= ${endDateSql}
     GROUP BY c.name, c.type
     ORDER BY amount DESC`,
    [userId]
  );

  return {
    summary: {
      income: parseFloat(sumRes.rows[0].total_income),
      expense: parseFloat(sumRes.rows[0].total_expense),
      savings: parseFloat(sumRes.rows[0].total_income) - parseFloat(sumRes.rows[0].total_expense)
    },
    transactions: transRes.rows,
    categoryBreakdown: categoryBreakdown.rows
  };
}

// Daily Report
app.get('/api/reports/daily', authenticateToken, async (req, res) => {
  try {
    const data = await fetchReportData(req.user.id, "date('now')");
    res.json(data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to load daily report' });
  }
});

// Weekly Report
app.get('/api/reports/weekly', authenticateToken, async (req, res) => {
  try {
    const data = await fetchReportData(req.user.id, "date('now', 'weekday 0', '-7 days')");
    res.json(data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to load weekly report' });
  }
});

// Monthly Report
app.get('/api/reports/monthly', authenticateToken, async (req, res) => {
  try {
    const data = await fetchReportData(req.user.id, "date('now', 'start of month')");
    res.json(data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to load monthly report' });
  }
});

// Yearly Report
app.get('/api/reports/yearly', authenticateToken, async (req, res) => {
  try {
    const data = await fetchReportData(req.user.id, "date('now', 'start of year')");
    res.json(data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to load yearly report' });
  }
});


// --------------------------------------------------
// API: Recurring Transactions
// --------------------------------------------------

// Get recurring transactions
app.get('/api/recurring', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, c.name as category_name, s.name as subcategory_name, p.name as payment_mode_name
       FROM "RecurringTransactions" r
       JOIN "Categories" c ON r.category_id = c.id
       LEFT JOIN "Subcategories" s ON r.subcategory_id = s.id
       JOIN "PaymentModes" p ON r.payment_mode_id = p.id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch recurring transactions' });
  }
});

// Create recurring transaction
app.post('/api/recurring', authenticateToken, async (req, res) => {
  const { type, amount, category_id, subcategory_id, payment_mode_id, frequency, start_date, end_date } = req.body;
  if (!type || !amount || !category_id || !payment_mode_id || !frequency) {
    return res.status(400).json({ error: 'Type, amount, category, payment mode, and frequency are required.' });
  }

  try {
    const nextDue = start_date || new Date().toISOString().split('T')[0];
    const result = await db.query(
      `INSERT INTO "RecurringTransactions" (user_id, type, amount, category_id, subcategory_id, payment_mode_id, frequency, start_date, end_date, next_due_date, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
       RETURNING *`,
      [req.user.id, type, amount, category_id, subcategory_id || null, payment_mode_id, frequency, start_date || null, end_date || null, nextDue]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to create recurring transaction' });
  }
});

// Update recurring transaction
app.put('/api/recurring/:id', authenticateToken, async (req, res) => {
  const recId = req.params.id;
  const { type, amount, category_id, subcategory_id, payment_mode_id, frequency, start_date, end_date, is_active } = req.body;

  try {
    const check = await db.query('SELECT id FROM "RecurringTransactions" WHERE id = $1 AND user_id = $2', [recId, req.user.id]);
    if (check.rowCount === 0) {
      return res.status(404).json({ error: 'Recurring transaction not found' });
    }

    const result = await db.query(
      `UPDATE "RecurringTransactions"
       SET type = $1, amount = $2, category_id = $3, subcategory_id = $4, payment_mode_id = $5, frequency = $6, start_date = $7, end_date = $8, is_active = $9
       WHERE id = $10 AND user_id = $11
       RETURNING *`,
      [type, amount, category_id, subcategory_id || null, payment_mode_id, frequency, start_date, end_date, is_active, recId, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to update recurring transaction' });
  }
});

// Delete recurring transaction
app.delete('/api/recurring/:id', authenticateToken, async (req, res) => {
  const recId = req.params.id;
  try {
    const check = await db.query('SELECT id FROM "RecurringTransactions" WHERE id = $1 AND user_id = $2', [recId, req.user.id]);
    if (check.rowCount === 0) {
      return res.status(404).json({ error: 'Recurring transaction not found' });
    }

    await db.query('DELETE FROM "RecurringTransactions" WHERE id = $1 AND user_id = $2', [recId, req.user.id]);
    res.json({ message: 'Recurring transaction deleted' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to delete recurring transaction' });
  }
});


// --------------------------------------------------
// API: Preferences & Profile
// --------------------------------------------------

// Get UserPreferences
app.get('/api/preferences', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT theme, currency, notifications_enabled FROM "UserPreferences" WHERE user_id = $1', [req.user.id]);
    if (result.rowCount === 0) {
      return res.json({ theme: 'light', currency: 'USD', notifications_enabled: true });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch user preferences' });
  }
});

// Update UserPreferences
app.put('/api/preferences', authenticateToken, async (req, res) => {
  const { theme, currency, notifications_enabled } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO "UserPreferences" (user_id, theme, currency, notifications_enabled, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE
       SET theme = COALESCE($2, "UserPreferences".theme),
           currency = COALESCE($3, "UserPreferences".currency),
           notifications_enabled = COALESCE($4, "UserPreferences".notifications_enabled),
           updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.user.id, theme, currency, notifications_enabled]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Get Profile Info
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT id, email, created_at FROM "Users" WHERE id = $1', [req.user.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Combine with preferences
    const prefResult = await db.query('SELECT theme, currency, notifications_enabled FROM "UserPreferences" WHERE user_id = $1', [req.user.id]);
    const prefs = prefResult.rows[0] || { theme: 'light', currency: 'USD', notifications_enabled: true };

    res.json({
      user: result.rows[0],
      preferences: prefs
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to fetch profile info' });
  }
});


// Serve Single Page App index.html for all other routes (HTML5 history routing support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel Serverless Functions
module.exports = app;
