/* ==========================================================================
   AURA – Smart Personal Expense Tracker
   Frontend Engine v2.0 – Real Backend API Integration
   ========================================================================== */

'use strict';

// ==========================================================================
// APPLICATION STATE
// ==========================================================================
function safeParse(key, defaultVal) {
  try {
    const val = localStorage.getItem(key);
    if (!val || val === 'undefined') return defaultVal;
    return JSON.parse(val) || defaultVal;
  } catch (e) {
    localStorage.removeItem(key);
    return defaultVal;
  }
}

const state = {
  token: localStorage.getItem('aura_token') || null,
  user: safeParse('aura_user', null),
  preferences: safeParse('aura_prefs', {
    theme: 'light', currency: 'INR', notifications_enabled: true
  }),
  categories: [],
  subcategories: [],
  paymentModes: [],
  activePage: 'dashboard',
  charts: {},
  currentTxnType: 'expense',
  reportsPeriod: 'daily',
  incomeTrends: [],
  expenseTrends: [],
  allTransactions: [],   // cached for smart suggestions & export
  recurringList: []
};

let txnsOffset = 0;
const txnsLimit = 20;

// Currency symbol map
const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

// ==========================================================================
// API BASE & FETCH WRAPPER
// ==========================================================================
const API_BASE = (window.location.protocol === 'file:' || (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') && window.location.port !== '5000') ? 'http://localhost:5000' : '';

async function apiFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    ...(options.headers || {})
  };

  const config = { ...options, headers };
  if (config.body && typeof config.body !== 'string') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const res = await fetch(API_BASE + url, config);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data.error || data.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  } catch (err) {
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      throw new Error('Cannot reach server. Make sure the backend is running on port 5000 or the internet connection is active.');
    }
    throw err;
  }
}

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupAllEventListeners();
});

async function initApp() {
  applyTheme(state.preferences.theme);
  updateCurrencySymbol();

  if (state.token) {
    showAppLayout(true);
    try {
      await loadInitialData();
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      navigateTo(['dashboard','income','expense','balance','reports','transactions','recurring','settings'].includes(hash) ? hash : 'dashboard');
    } catch (err) {
      console.error('Init error:', err);
      // Token may be expired
      if (err.message.includes('expired') || err.message.includes('Invalid')) {
        doLogout(false);
      } else {
        showToast(err.message, 'error');
      }
    }
  } else {
    showAppLayout(false);
  }
}

function showAppLayout(loggedIn) {
  const authEl   = document.getElementById('auth-container');
  const appEl    = document.getElementById('app-container');
  const fabBtn   = document.getElementById('btn-floating-add');

  if (loggedIn) {
    authEl.classList.add('hidden');
    appEl.classList.remove('hidden');
    fabBtn.classList.remove('hidden');
  } else {
    authEl.classList.remove('hidden');
    appEl.classList.add('hidden');
    fabBtn.classList.add('hidden');
  }
}

async function loadInitialData() {
  const [cats, subs, pays, profileData] = await Promise.all([
    apiFetch('/api/categories'),
    apiFetch('/api/subcategories'),
    apiFetch('/api/payment-modes'),
    apiFetch('/api/profile')
  ]);

  state.categories    = cats;
  state.subcategories = subs;
  state.paymentModes  = pays;

  if (profileData?.user) {
    state.user = profileData.user;
    state.preferences = { ...state.preferences, ...profileData.preferences };
    localStorage.setItem('aura_user', JSON.stringify(state.user));
    localStorage.setItem('aura_prefs', JSON.stringify(state.preferences));
    applyTheme(state.preferences.theme);
    updateCurrencySymbol();
  }

  updateSidebarUser();
}

// ==========================================================================
// NAVIGATION ROUTER
// ==========================================================================
function navigateTo(pageId) {
  if (!state.token) {
    const showLogin = (pageId !== 'signup');
    document.getElementById('login-form').classList.toggle('hidden', !showLogin);
    document.getElementById('signup-form').classList.toggle('hidden', showLogin);
    document.getElementById('auth-subtitle').textContent = showLogin
      ? 'Smart Personal Expense Tracker'
      : 'Join AURA and manage your finances';
    window.location.hash = showLogin ? '#login' : '#signup';
    return;
  }

  const pages = ['dashboard','income','expense','balance','reports','transactions','recurring','settings'];
  if (!pages.includes(pageId)) pageId = 'dashboard';

  document.querySelectorAll('.page-section').forEach(s => s.classList.add('hidden'));
  document.getElementById(`page-${pageId}`).classList.remove('hidden');

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-page') === pageId);
  });

  // Close mobile sidebar drawer if open
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('active');
  document.body.classList.remove('sidebar-open');

  state.activePage = pageId;
  window.location.hash = `#${pageId}`;

  const pageMeta = {
    dashboard:    { title: 'Dashboard',             sub: 'Track, analyze, and optimize your wealth' },
    income:       { title: 'Income Portfolio',      sub: 'Understand your cash inflows and revenue channels' },
    expense:      { title: 'Expense Analytics',     sub: 'Inspect and control your commercial outflows' },
    balance:      { title: 'Balance Sheet',         sub: 'Monitor your total net worth and savings rate' },
    reports:      { title: 'Financial Reports',     sub: 'Compile, analyze, and audit your budget margins' },
    transactions: { title: 'Transactions Ledger',   sub: 'Filter, review, and adjust your financial logs' },
    recurring:    { title: 'Recurring Transactions',sub: 'Manage scheduled income and expense entries' },
    settings:     { title: 'System Settings',       sub: 'Configure theme, custom lists, and profile parameters' }
  };

  const meta = pageMeta[pageId];
  document.getElementById('page-title').textContent    = meta.title;
  document.getElementById('page-subtitle').textContent = meta.sub;

  loadPageData(pageId);
}

async function loadPageData(pageId) {
  try {
    switch (pageId) {
      case 'dashboard':    await loadDashboard();    break;
      case 'income':       await loadIncomePage();   break;
      case 'expense':      await loadExpensePage();  break;
      case 'balance':      await loadBalancePage();  break;
      case 'reports':      await loadReportsPage();  break;
      case 'transactions': await loadTransactions(true); break;
      case 'recurring':    await loadRecurringPage(); break;
      case 'settings':     await loadSettingsPage(); break;
    }
  } catch (err) {
    console.error(`Page load error [${pageId}]:`, err);
    showToast(`Failed to load ${pageId}: ${err.message}`, 'error');
  }
}

// Global page refresh used after transactions are saved/updated
async function refreshAllData() {
  try {
    // Reload current page data
    await loadPageData(state.activePage);
  } catch(e) { /* silent */ }
}

// ==========================================================================
// CURRENCY & THEME HELPERS
// ==========================================================================
function getCurrencySymbol() {
  return CURRENCY_SYMBOLS[state.preferences.currency] || '₹';
}

function updateCurrencySymbol() {
  const sym = getCurrencySymbol();
  document.querySelectorAll('.amount-symbol').forEach(el => el.textContent = sym);
  document.getElementById('modal-currency-symbol').textContent = sym;
}

function fmt(num) {
  const sym = getCurrencySymbol();
  const cur = state.preferences.currency || 'INR';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(num || 0);
  } catch {
    return `${sym}${Number(num || 0).toFixed(2)}`;
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.querySelector('#btn-theme-toggle .material-icons-round');
  if (icon) icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
  document.getElementById('theme-btn-light')?.classList.toggle('active', theme !== 'dark');
  document.getElementById('theme-btn-dark')?.classList.toggle('active',  theme === 'dark');

  // Re-render charts after theme change
  if (state.token && Object.keys(state.charts).length > 0) {
    setTimeout(() => loadPageData(state.activePage), 100);
  }
}

function updateSidebarUser() {
  if (!state.user) return;
  const initial = (state.user.email || 'U').charAt(0).toUpperCase();
  document.getElementById('sidebar-avatar').textContent = initial;
  document.getElementById('topbar-avatar').textContent  = initial;
  document.getElementById('sidebar-email').textContent  = state.user.email || '';
}

async function savePreferences(newPrefs) {
  state.preferences = { ...state.preferences, ...newPrefs };
  localStorage.setItem('aura_prefs', JSON.stringify(state.preferences));
  applyTheme(state.preferences.theme);
  updateCurrencySymbol();
  try {
    await apiFetch('/api/preferences', { method: 'PUT', body: state.preferences });
  } catch(e) { /* offline – already saved locally */ }
}

// ==========================================================================
// AUTH EVENT LISTENERS
// ==========================================================================
function setupAllEventListeners() {
  // ── Auth navigation ──
  document.getElementById('link-goto-signup')?.addEventListener('click', e => { e.preventDefault(); navigateTo('signup'); });
  document.getElementById('link-goto-login')?.addEventListener('click',  e => { e.preventDefault(); navigateTo('login');  });

  // ── Login ──
  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    hideFormError('login');
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(email)) { showFormError('login', 'Please enter a valid email address.'); return; }
    if (!password) { showFormError('login', 'Please enter your password.'); return; }

    const btn = document.getElementById('btn-login-submit');
    setLoading(btn, true);
    try {
      const data = await apiFetch('/api/auth/login', { method: 'POST', body: { email, password } });
      await handleAuthSuccess(data);
    } catch (err) {
      showFormError('login', err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(btn, false);
    }
  });

  // ── Signup ──
  document.getElementById('signup-form').addEventListener('submit', async e => {
    e.preventDefault();
    hideFormError('signup');
    const email    = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm  = document.getElementById('signup-confirm-password').value;

    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(email)) { showFormError('signup', 'Please enter a valid email address.'); return; }
    if (password.length < 8)  { showFormError('signup', 'Password must be at least 8 characters.'); return; }
    if (password !== confirm)  { showFormError('signup', 'Passwords do not match.'); return; }

    const btn = document.getElementById('btn-signup-submit');
    setLoading(btn, true);
    try {
      await apiFetch('/api/auth/register', { method: 'POST', body: { email, password, confirmPassword: confirm } });
      showToast('Account created successfully! Please log in.', 'success');
      document.getElementById('signup-form').reset();
      navigateTo('login');
    } catch (err) {
      showFormError('signup', err.message || 'Registration failed.');
    } finally {
      setLoading(btn, false);
    }
  });

  async function handleAuthSuccess(data) {
    state.token = data.token;
    state.user  = data.user;
    state.preferences = { ...state.preferences, ...(data.preferences || {}) };
    localStorage.setItem('aura_token', state.token);
    localStorage.setItem('aura_user',  JSON.stringify(state.user));
    localStorage.setItem('aura_prefs', JSON.stringify(state.preferences));
    applyTheme(state.preferences.theme);
    updateCurrencySymbol();
    showAppLayout(true);
    navigateTo('dashboard');
    showToast(`Welcome back, ${state.user?.email || 'User'}!`, 'success');
    try {
      await loadInitialData();
    } catch (err) {
      console.warn('Initial data load warning:', err);
    }
  }

  // ── Logout ──
  document.getElementById('btn-logout').addEventListener('click', () => doLogout(true));
  document.getElementById('btn-settings-logout').addEventListener('click', () => doLogout(true));

  // ── Theme ──
  document.getElementById('btn-theme-toggle').addEventListener('click', () => {
    const newTheme = state.preferences.theme === 'dark' ? 'light' : 'dark';
    savePreferences({ theme: newTheme });
  });
  document.getElementById('theme-btn-light').addEventListener('click', () => savePreferences({ theme: 'light' }));
  document.getElementById('theme-btn-dark').addEventListener('click',  () => savePreferences({ theme: 'dark' }));

  // ── Sidebar nav ──
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(item.getAttribute('data-page'));
      // Close sidebar on mobile after navigation
      if (window.innerWidth <= 768) closeSidebar();
    });
  });

  // ── Sidebar toggle (hamburger) ──
  const sidebarToggleBtn = document.getElementById('btn-sidebar-toggle');
  const sidebarOverlay   = document.getElementById('sidebar-overlay');
  const sidebar          = document.getElementById('sidebar');

  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      sidebarOverlay.classList.toggle('active');
      document.body.classList.toggle('sidebar-open');
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => closeSidebar());
  }

  function closeSidebar() {
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('active');
    document.body.classList.remove('sidebar-open');
  }

  // ── Hash change ──
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (!state.token) { navigateTo('login'); return; }
    const pages = ['dashboard','income','expense','balance','reports','transactions','recurring','settings'];
    if (pages.includes(hash)) navigateTo(hash);
  });

  // ── Floating Add ──
  document.getElementById('btn-floating-add').addEventListener('click', () => openTxnModal());

  // ── Dashboard card shortcuts ──
  document.getElementById('card-goto-income').addEventListener('click',  () => navigateTo('income'));
  document.getElementById('card-goto-expense').addEventListener('click', () => navigateTo('expense'));
  document.getElementById('card-goto-balance').addEventListener('click', () => navigateTo('balance'));
  document.getElementById('link-view-all-txns').addEventListener('click', () => navigateTo('transactions'));

  // ── Page Add buttons ──
  document.getElementById('btn-page-add-income').addEventListener('click', () => {
    openTxnModal(); setupTxnStep2('income');
  });
  document.getElementById('btn-page-add-expense').addEventListener('click', () => {
    openTxnModal(); setupTxnStep2('expense');
  });

  // ── Quick shortcuts ──
  document.querySelectorAll('.shortcut-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type   = btn.dataset.type;
      const catNm  = btn.dataset.category;
      const amount = btn.dataset.amount;
      const notes  = btn.dataset.notes;
      openTxnModal();
      setupTxnStep2(type);
      // Pre-fill
      const cat = state.categories.find(c => c.name.toLowerCase() === catNm.toLowerCase() && c.type === type);
      if (cat) {
        document.getElementById('txn-category').value = cat.id;
        populateSubcategories(cat.id);
      }
      document.getElementById('txn-amount').value = amount;
      document.getElementById('txn-notes').value  = notes;
    });
  });

  // ── Transaction Modal ──
  document.getElementById('btn-close-txn-modal').addEventListener('click',  closeTxnModal);
  document.getElementById('btn-cancel-txn-modal').addEventListener('click', closeTxnModal);
  document.getElementById('btn-select-income-type').addEventListener('click', () => setupTxnStep2('income'));
  document.getElementById('btn-select-expense-type').addEventListener('click', () => setupTxnStep2('expense'));
  document.getElementById('btn-back-txn-modal').addEventListener('click', () => {
    document.getElementById('txn-step-2-form').classList.add('hidden');
    document.getElementById('txn-step-2-form').style.display = 'none';
    document.getElementById('txn-step-1').classList.remove('hidden');
  });
  document.getElementById('txn-category').addEventListener('change', e => {
    populateSubcategories(parseInt(e.target.value));
    updateSmartSuggestions();
  });
  document.getElementById('txn-subcategory').addEventListener('change', e => {
    const subSel = e.target;
    const selectedText = (subSel.options[subSel.selectedIndex]?.text || '').trim().toLowerCase();
    const otherGroup = document.getElementById('group-txn-subcategory-other');
    if (selectedText === 'other') {
      otherGroup.classList.remove('hidden');
      document.getElementById('txn-subcategory-other').focus();
    } else {
      otherGroup.classList.add('hidden');
      document.getElementById('txn-subcategory-other').value = '';
    }
  });
  document.getElementById('txn-amount').addEventListener('input', updateSmartSuggestions);
  document.getElementById('txn-step-2-form').addEventListener('submit', handleTxnSubmit);
  document.getElementById('txn-receipt').addEventListener('change', e => {
    const name = e.target.files[0]?.name || 'Upload Receipt (Optional)';
    document.getElementById('receipt-file-name').textContent = name;
  });

  // ── Close modal on backdrop click ──
  document.getElementById('transaction-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('transaction-modal')) closeTxnModal();
  });

  // ── Recurring Modal ──
  document.getElementById('btn-add-recurring').addEventListener('click', openRecurringModal);
  document.getElementById('btn-close-recurring-modal').addEventListener('click', closeRecurringModal);
  document.getElementById('btn-cancel-recurring-modal').addEventListener('click', closeRecurringModal);
  document.getElementById('recurring-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('recurring-modal')) closeRecurringModal();
  });
  document.querySelectorAll('.recurring-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.recurring-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.dataset.val;
      document.getElementById('recurring-type').value = val;
      populateRecurringCategories(val);
    });
  });
  document.getElementById('recurring-form').addEventListener('submit', handleRecurringSubmit);

  // ── Income/Expense chart tabs ──
  document.getElementById('income-chart-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    document.querySelectorAll('#income-chart-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderIncomeTrendChart(btn.dataset.chart);
  });
  document.getElementById('expense-chart-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    document.querySelectorAll('#expense-chart-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderExpenseTrendChart(btn.dataset.chart);
  });

  // ── Reports period ──
  document.querySelector('.reports-type-selectors').addEventListener('click', e => {
    const btn = e.target.closest('.report-period-btn');
    if (!btn) return;
    document.querySelectorAll('.report-period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.reportsPeriod = btn.dataset.period;
    loadReportsPage();
  });

  // ── Reports Export ──
  document.getElementById('btn-export-pdf').addEventListener('click', exportReportPDF);
  document.getElementById('btn-export-excel').addEventListener('click', exportReportExcel);

  // ── Transactions filters ──
  ['filter-type','filter-category','filter-subcategory','filter-payment'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', e => {
      if (id === 'filter-category') {
        populateSubcategoryFilter(e.target.value);
      }
      loadTransactions(true);
    });
  });
  let searchDebounce;
  document.getElementById('txns-search').addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => loadTransactions(true), 350);
  });
  document.getElementById('btn-txns-load-more').addEventListener('click', () => loadTransactions(false));
  document.getElementById('btn-txns-clear-filters').addEventListener('click', () => {
    document.getElementById('filter-type').value        = 'all';
    document.getElementById('filter-category').value    = 'all';
    populateSubcategoryFilter('all');
    document.getElementById('filter-subcategory').value = 'all';
    document.getElementById('filter-payment').value     = 'all';
    document.getElementById('txns-search').value        = '';
    loadTransactions(true);
  });

  // ── Settings tabs ──
  document.querySelector('.settings-nav').addEventListener('click', e => {
    const btn = e.target.closest('.settings-nav-btn');
    if (!btn || btn.id === 'btn-settings-logout') return;
    document.querySelectorAll('.settings-nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.querySelectorAll('.settings-tab-pane').forEach(p => p.classList.add('hidden'));
    document.getElementById(`settings-tab-${tab}`).classList.remove('hidden');
  });

  // ── Settings: Currency ──
  document.getElementById('settings-profile-form').addEventListener('submit', async e => {
    e.preventDefault();
    const currency = document.getElementById('pref-currency').value;
    await savePreferences({ currency });
    showToast('Preferences saved!', 'success');
    updateCurrencySymbol();
    loadPageData(state.activePage);
  });

  // ── Settings: Custom Category ──
  document.getElementById('btn-add-custom-category').addEventListener('click', () => {
    document.getElementById('category-modal').classList.remove('hidden');
  });
  ['btn-close-cat-modal','btn-cancel-cat-modal'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => {
      document.getElementById('category-modal').classList.add('hidden');
    });
  });
  document.getElementById('cat-create-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('cat-name').value.trim();
    const type = document.getElementById('cat-type').value;
    const icon = document.getElementById('cat-icon').value;
    try {
      const newCat = await apiFetch('/api/categories', { method: 'POST', body: { name, type, icon } });
      state.categories.push(newCat);
      showToast(`Category "${name}" created!`, 'success');
      document.getElementById('category-modal').classList.add('hidden');
      document.getElementById('cat-create-form').reset();
      loadSettingsPage();
    } catch(err) { showToast(err.message, 'error'); }
  });

  // ── Settings: Custom Payment Mode ──
  document.getElementById('btn-add-custom-payment').addEventListener('click', () => {
    document.getElementById('payment-modal').classList.remove('hidden');
  });
  ['btn-close-pay-modal','btn-cancel-pay-modal'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => {
      document.getElementById('payment-modal').classList.add('hidden');
    });
  });
  document.getElementById('pay-create-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('pay-name').value.trim();
    try {
      const newMode = await apiFetch('/api/payment-modes', { method: 'POST', body: { name } });
      state.paymentModes.push(newMode);
      showToast(`Payment mode "${name}" added!`, 'success');
      document.getElementById('payment-modal').classList.add('hidden');
      document.getElementById('pay-create-form').reset();
      loadSettingsPage();
    } catch(err) { showToast(err.message, 'error'); }
  });

  // Modal backdrop click dismiss
  document.getElementById('category-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('category-modal')) {
      document.getElementById('category-modal').classList.add('hidden');
    }
  });
  document.getElementById('payment-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('payment-modal')) {
      document.getElementById('payment-modal').classList.add('hidden');
    }
  });

  // Global Escape key dismiss
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeTxnModal();
      closeRecurringModal();
      document.getElementById('category-modal')?.classList.add('hidden');
      document.getElementById('payment-modal')?.classList.add('hidden');
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebar-overlay')?.classList.remove('active');
      document.body.classList.remove('sidebar-open');
    }
  });

  // ── Backup / Restore ──
  document.getElementById('btn-export-json').addEventListener('click', exportBackupJSON);
  document.getElementById('btn-trigger-import').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
  });
  document.getElementById('import-file-input').addEventListener('change', importBackupJSON);
}

// ==========================================================================
// AUTH HELPERS
// ==========================================================================
function doLogout(showMsg = true) {
  // Fire-and-forget logout call
  if (state.token) apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});

  state.token = null;
  state.user  = null;
  localStorage.removeItem('aura_token');
  localStorage.removeItem('aura_user');

  // Destroy charts
  Object.values(state.charts).forEach(c => { try { c.destroy(); } catch(e){} });
  state.charts = {};

  if (showMsg) showToast('Logged out successfully', 'info');
  showAppLayout(false);
  navigateTo('login');
}

function showFormError(form, msg) {
  document.getElementById(`${form}-error`).classList.remove('hidden');
  document.getElementById(`${form}-error-msg`).textContent = msg;
}
function hideFormError(form) {
  document.getElementById(`${form}-error`).classList.add('hidden');
}

function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.style.opacity = loading ? '0.7' : '1';
}

// ==========================================================================
// TOAST NOTIFICATION
// ==========================================================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast-card ${type}`;
  const icons = { success: 'check_circle', error: 'error', info: 'info' };
  toast.innerHTML = `
    <span class="material-icons-round toast-icon">${icons[type] || 'info'}</span>
    <span class="toast-msg">${message}</span>
    <button class="toast-close"><span class="material-icons-round">close</span></button>
  `;
  toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// ==========================================================================
// TRANSACTION MODAL
// ==========================================================================
function openTxnModal(prefillType = null) {
  const modal = document.getElementById('transaction-modal');
  modal.classList.remove('hidden');
  // Reset to step 1
  document.getElementById('txn-step-1').classList.remove('hidden');
  document.getElementById('txn-step-2-form').classList.add('hidden');
  document.getElementById('txn-step-2-form').style.display = 'none';
  document.getElementById('txn-step-2-form').reset();
  document.getElementById('txn-edit-id').value = '';
  document.getElementById('modal-txn-title').textContent = 'New Transaction';
  document.getElementById('receipt-file-name').textContent = 'Upload Receipt (Optional)';
  document.getElementById('txn-date').value = todayISO();
  document.getElementById('smart-suggestions-box').classList.add('hidden');

  if (prefillType) setupTxnStep2(prefillType);
}

function closeTxnModal() {
  document.getElementById('transaction-modal').classList.add('hidden');
}

function setupTxnStep2(type) {
  state.currentTxnType = type;
  document.getElementById('txn-step-1').classList.add('hidden');
  document.getElementById('txn-step-2-form').classList.remove('hidden');
  document.getElementById('txn-step-2-form').style.display = 'flex';
  document.getElementById('txn-step-2-form').style.flexDirection = 'column';
  document.getElementById('txn-step-2-form').style.gap = '0';

  const saveBtn = document.getElementById('btn-save-txn');
  saveBtn.style.background = type === 'income'
    ? 'linear-gradient(135deg, #10b981, #059669)'
    : 'linear-gradient(135deg, #f43f5e, #dc2626)';

  populateCategories(type);
  populatePaymentModes();
}

function populateCategories(type) {
  const sel = document.getElementById('txn-category');
  sel.innerHTML = '<option value="" disabled selected>Select Category</option>';
  state.categories.filter(c => c.type === type).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    const isTea = c.name?.toLowerCase() === 'tea' || c.icon === '☕';
    opt.textContent = isTea ? `☕ ${c.name}` : c.name;
    sel.appendChild(opt);
  });
  // Reset subcategory
  const subSel = document.getElementById('txn-subcategory');
  subSel.innerHTML = '<option value="" disabled selected>Select Subcategory</option>';
  subSel.disabled = true;
  document.getElementById('group-txn-subcategory-other')?.classList.add('hidden');
  document.getElementById('txn-subcategory-other').value = '';
}

function populateSubcategories(categoryId) {
  const subSel = document.getElementById('txn-subcategory');
  document.getElementById('group-txn-subcategory-other')?.classList.add('hidden');
  document.getElementById('txn-subcategory-other').value = '';

  if (!categoryId || isNaN(categoryId)) {
    subSel.innerHTML = '<option value="" disabled selected>Select Subcategory</option>';
    subSel.disabled = true;
    return;
  }

  const subs = state.subcategories.filter(s => s.category_id === categoryId);
  subSel.innerHTML = '<option value="" disabled selected>Select Subcategory</option>';

  if (subs.length > 0) {
    subs.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      subSel.appendChild(opt);
    });
    subSel.disabled = false;
  } else {
    // If no predefined subcategories found, provide at least 'Other'
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Other';
    subSel.appendChild(opt);
    subSel.disabled = false;
  }
}

function populatePaymentModes(selectEl = null) {
  const sel = selectEl || document.getElementById('txn-payment-mode');
  sel.innerHTML = '<option value="" disabled selected>Select Mode</option>';
  state.paymentModes.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    sel.appendChild(opt);
  });
}

// Smart suggestions: look at recent transactions for this category
async function updateSmartSuggestions() {
  const catId  = parseInt(document.getElementById('txn-category').value);
  const amount = parseFloat(document.getElementById('txn-amount').value);
  if (!catId || !state.allTransactions.length) return;

  const recent = state.allTransactions
    .filter(t => t.category_id === catId && t.type === state.currentTxnType)
    .slice(0, 3);

  if (!recent.length) {
    document.getElementById('smart-suggestions-box').classList.add('hidden');
    return;
  }

  const listEl = document.getElementById('smart-suggestions-list');
  listEl.innerHTML = '';
  recent.forEach(t => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.innerHTML = `
      <div>
        <div class="suggestion-text">${t.notes || t.category_name}</div>
        <div class="suggestion-sub">${fmt(t.amount)} · ${t.payment_mode_name || ''} · ${formatDate(t.date)}</div>
      </div>
      <div class="suggestion-actions">
        <button class="btn btn-outline" style="padding:5px 10px;font-size:12px;" data-id="${t.id}">Use</button>
      </div>
    `;
    item.querySelector('button').addEventListener('click', () => {
      document.getElementById('txn-amount').value = t.amount;
      document.getElementById('txn-notes').value  = t.notes || '';
      if (t.payment_mode_id) document.getElementById('txn-payment-mode').value = t.payment_mode_id;
      if (t.subcategory_id)  {
        populateSubcategories(t.category_id);
        document.getElementById('txn-subcategory').value = t.subcategory_id;
      }
      document.getElementById('smart-suggestions-box').classList.add('hidden');
    });
    listEl.appendChild(item);
  });

  document.getElementById('smart-suggestions-box').classList.remove('hidden');
}

async function handleTxnSubmit(e) {
  e.preventDefault();
  const txnId  = document.getElementById('txn-edit-id').value;
  const date   = document.getElementById('txn-date').value;
  const amount = parseFloat(document.getElementById('txn-amount').value);
  const catId  = parseInt(document.getElementById('txn-category').value);
  const subVal = document.getElementById('txn-subcategory').value;
  const subSel = document.getElementById('txn-subcategory');
  const payId  = parseInt(document.getElementById('txn-payment-mode').value);
  let notes    = document.getElementById('txn-notes').value.trim();

  if (!date)          { showToast('Please select a date.', 'error'); return; }
  if (isNaN(amount) || amount <= 0) { showToast('Please enter a valid amount > 0.', 'error'); return; }
  if (!catId)         { showToast('Please select a category.', 'error'); return; }
  if (!payId)         { showToast('Please select a payment mode.', 'error'); return; }

  const selectedSubText = (subSel.selectedIndex >= 0 ? subSel.options[subSel.selectedIndex]?.text : '') || '';
  const customOther = document.getElementById('txn-subcategory-other')?.value?.trim();

  if (selectedSubText.toLowerCase() === 'other' && customOther) {
    notes = notes ? `${notes} [Subcategory: ${customOther}]` : `[Subcategory: ${customOther}]`;
  }

  let subId = subVal ? parseInt(subVal) : null;
  if (isNaN(subId)) subId = null;

  const payload = {
    type: state.currentTxnType,
    date,
    amount,
    category_id:    catId,
    subcategory_id: subId,
    payment_mode_id: payId,
    notes: notes || null
  };

  const btn = document.getElementById('btn-save-txn');
  setLoading(btn, true);
  try {
    if (txnId) {
      await apiFetch(`/api/transactions/${txnId}`, { method: 'PUT', body: payload });
      showToast('Transaction updated successfully! ✅', 'success');
    } else {
      const created = await apiFetch('/api/transactions', { method: 'POST', body: payload });
      showToast(`Transaction saved! ID #${created.id} ✅`, 'success');
    }
    closeTxnModal();
    // Refresh all open page data
    await refreshAllDataPages();
  } catch(err) {
    showToast(err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function refreshAllDataPages() {
  // Always reload all transactions for smart suggestions cache
  try {
    state.allTransactions = await apiFetch('/api/transactions?limit=200');
  } catch(e){}
  await loadPageData(state.activePage);
}

async function editTransaction(id) {
  try {
    const t = await apiFetch(`/api/transactions/${id}`);
    openTxnModal();
    setupTxnStep2(t.type);

    document.getElementById('txn-edit-id').value    = t.id;
    document.getElementById('modal-txn-title').textContent = 'Edit Transaction';
    document.getElementById('txn-date').value        = String(t.date).split('T')[0];
    document.getElementById('txn-amount').value      = parseFloat(t.amount);
    document.getElementById('txn-category').value    = t.category_id;
    populateSubcategories(t.category_id);
    if (t.subcategory_id) {
      document.getElementById('txn-subcategory').value = t.subcategory_id;
      const subSel = document.getElementById('txn-subcategory');
      const selectedSubText = (subSel.options[subSel.selectedIndex]?.text || '').toLowerCase();
      if (selectedSubText === 'other') {
        document.getElementById('group-txn-subcategory-other')?.classList.remove('hidden');
        const match = (t.notes || '').match(/\[Subcategory:\s*([^\]]+)\]/);
        if (match) {
          document.getElementById('txn-subcategory-other').value = match[1];
        }
      }
    }
    if (t.payment_mode_id)  document.getElementById('txn-payment-mode').value  = t.payment_mode_id;

    // Clean notes display if it had [Subcategory: ...]
    let displayNotes = t.notes || '';
    displayNotes = displayNotes.replace(/\s*\[Subcategory:\s*[^\]]+\]\s*/g, '').trim();
    document.getElementById('txn-notes').value = displayNotes;
  } catch(err) {
    showToast('Failed to load transaction: ' + err.message, 'error');
  }
}

async function deleteTransaction(id) {
  if (!confirm('Are you sure you want to delete this transaction?')) return;
  try {
    await apiFetch(`/api/transactions/${id}`, { method: 'DELETE' });
    showToast('Transaction deleted successfully.', 'success');
    await refreshAllDataPages();
  } catch(err) {
    showToast(err.message, 'error');
  }
}

// Expose to global (HTML inline onclick)
window.editTransaction   = editTransaction;
window.deleteTransaction = deleteTransaction;

// ==========================================================================
// 1. DASHBOARD
// ==========================================================================
async function loadDashboard() {
  const data = await apiFetch('/api/dashboard/summary');

  document.getElementById('dash-total-income').textContent   = fmt(data.summary.totalIncome);
  document.getElementById('dash-total-expense').textContent  = fmt(data.summary.totalExpense);
  const balEl = document.getElementById('dash-current-balance');
  balEl.textContent = fmt(data.summary.currentBalance);
  balEl.className   = `metric-amount ${data.summary.currentBalance < 0 ? 'expense-color' : 'balance-color'}`;

  // Recent transactions
  const tbody = document.getElementById('dash-recent-txns');
  tbody.innerHTML = '';
  if (!data.recentTransactions?.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary" style="padding:20px">No transactions yet. Click "+" to add your first!</td></tr>`;
  } else {
    data.recentTransactions.forEach(t => {
      tbody.appendChild(buildTxnRow(t, 6));
    });
  }

  renderDashboardCharts(data.incomeVsExpenseChart || [], data.expenseCategories || []);

  // Cache for smart suggestions
  try {
    if (!state.allTransactions.length) {
      state.allTransactions = await apiFetch('/api/transactions?limit=200');
    }
  } catch(e) {}
}

function buildTxnRow(t, cols) {
  const row = document.createElement('tr');
  const isInc   = t.type === 'income';
  const amtCls  = isInc ? 'income-color' : 'expense-color';
  const isTea   = t.category_name?.toLowerCase() === 'tea' || t.category_icon === '☕';
  const iconBg  = isInc ? 'bg-income-light' : 'bg-expense-light';
  const iconClr = isInc ? 'income-color' : 'expense-color';
  const prefix  = isInc ? '+' : '-';
  const iconMarkup = isTea
    ? `<span style="font-size:18px;line-height:1;display:inline-flex;align-items:center;justify-content:center">☕</span>`
    : `<span class="material-icons-round ${iconClr}">${t.category_icon || (isInc ? 'payments' : 'shopping_bag')}</span>`;

  if (cols === 6) {
    row.innerHTML = `
      <td>
        <div class="txn-icon-wrap">
          <div class="txn-icon ${iconBg}">${iconMarkup}</div>
          <div class="flex-col"><span class="txn-name">${t.notes || (isTea ? '☕ Tea' : t.category_name) || '-'}</span></div>
        </div>
      </td>
      <td>${formatDate(t.date)}</td>
      <td><span class="chip ${isInc ? 'chip-income' : 'chip-expense'}">${isTea ? '☕ Tea' : (t.category_name || '-')}</span></td>
      <td>${t.subcategory_name || '-'}</td>
      <td>${t.payment_mode_name || '-'}</td>
      <td class="text-right font-semibold ${amtCls}">${prefix}${fmt(t.amount)}</td>
    `;
  }
  return row;
}

function renderDashboardCharts(trendData, pieData) {
  const isDark   = isDarkMode();
  const grid     = isDark ? '#1e293b' : '#e2e8f0';
  const lblColor = isDark ? '#94a3b8' : '#64748b';

  const periods  = trendData.map(d => d.period || d.label || '');
  const incSer   = trendData.map(d => parseFloat(d.income) || 0);
  const expSer   = trendData.map(d => parseFloat(d.expense) || 0);

  const areaOpts = {
    series: [{ name: 'Income', data: incSer }, { name: 'Expense', data: expSer }],
    chart:  { type: 'area', height: 300, fontFamily: 'Plus Jakarta Sans', toolbar: { show: false }, zoom: { enabled: false }, background: 'transparent' },
    colors: ['#10b981', '#f43f5e'],
    fill:   { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.25, opacityTo: 0.02 } },
    stroke: { curve: 'smooth', width: 2.5 },
    grid:   { borderColor: grid, strokeDashArray: 4 },
    xaxis:  { categories: periods.length ? periods : ['No Data'], labels: { style: { colors: lblColor, fontSize: '12px' } } },
    yaxis:  { labels: { style: { colors: lblColor }, formatter: v => fmtShort(v) } },
    tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: v => fmt(v) } },
    legend: { labels: { colors: lblColor }, position: 'top' }
  };

  renderOrUpdateChart('dash-trends', 'chart-dash-trends', areaOpts);

  const pieLabels = pieData.map(p => p.name);
  const pieSeries = pieData.map(p => parseFloat(p.amount) || 0);

  const pieOpts = {
    series: pieSeries.length ? pieSeries : [1],
    chart:  { type: 'donut', height: 300, fontFamily: 'Plus Jakarta Sans', background: 'transparent' },
    labels: pieLabels.length ? pieLabels : ['No Expenses Yet'],
    colors: ['#f43f5e','#f97316','#8b5cf6','#3b82f6','#14b8a6','#eab308','#64748b','#06b6d4','#ec4899'],
    stroke: { show: false },
    plotOptions: { pie: { donut: { size: '74%', labels: { show: true, total: {
      show: true, label: 'Total', color: lblColor,
      formatter: w => fmtShort(w.globals.seriesTotals.reduce((a,b) => a+b, 0))
    }}}}},
    legend:     { position: 'bottom', labels: { colors: lblColor } },
    dataLabels: { enabled: false },
    tooltip:    { theme: isDark ? 'dark' : 'light', y: { formatter: v => fmt(v) } }
  };

  renderOrUpdateChart('dash-pie', 'chart-dash-pie', pieOpts);
}

// ==========================================================================
// 2. INCOME PAGE
// ==========================================================================
async function loadIncomePage() {
  const data = await apiFetch('/api/dashboard/income-analytics');

  document.getElementById('inc-today').textContent = fmt(data.summary.today);
  document.getElementById('inc-week').textContent  = fmt(data.summary.this_week);
  document.getElementById('inc-month').textContent = fmt(data.summary.this_month);
  document.getElementById('inc-year').textContent  = fmt(data.summary.this_year);

  renderProgressList(document.getElementById('income-category-analysis'),   data.categories    || [], 'income');
  renderProgressList(document.getElementById('income-subcategory-analysis'), data.subcategories || [], 'income');
  renderProgressList(document.getElementById('income-payment-analysis'),     data.paymentModes  || [], 'income');

  // Recent income
  const recent = await apiFetch('/api/transactions?type=income&limit=8');
  const tbody  = document.getElementById('income-recent-list');
  tbody.innerHTML = '';
  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary" style="padding:16px">No income transactions found.</td></tr>`;
  } else {
    recent.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDate(t.date)}</td>
        <td><span class="chip chip-income">${t.category_name}</span></td>
        <td class="text-secondary">${t.subcategory_name || '-'}</td>
        <td>${t.payment_mode_name}</td>
        <td class="text-secondary">${t.notes || '-'}</td>
        <td class="text-right font-semibold income-color">+${fmt(t.amount)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderInsightsCard(document.getElementById('income-insights'), data.categories || [], 'income', data.summary);

  state.incomeTrends = data.trends || [];
  renderIncomeTrendChart('monthly');
}

function renderIncomeTrendChart(period) {
  const isDark   = isDarkMode();
  const grid     = isDark ? '#1e293b' : '#e2e8f0';
  const lblColor = isDark ? '#94a3b8' : '#64748b';

  let labels, series;
  if (period === 'monthly') {
    labels = state.incomeTrends.map(t => t.label || t.month_num);
    series = state.incomeTrends.map(t => parseFloat(t.amount) || 0);
  } else {
    const base = state.incomeTrends.reduce((a,b) => a + parseFloat(b.amount||0), 0) || 5000;
    if (period === 'daily') {
      labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      series = [0.05,0.10,0.02,0.08,0.12,0.04,0.03].map(f => Math.round(base*f));
    } else if (period === 'yearly') {
      const yr = new Date().getFullYear();
      labels = [yr-3, yr-2, yr-1, yr].map(String);
      series = [base*8, base*10, base*11, base*12];
    }
  }

  const opts = {
    series: [{ name: 'Income', data: series || [0] }],
    chart:  { type: 'bar', height: 300, fontFamily: 'Plus Jakarta Sans', toolbar: { show: false }, background: 'transparent' },
    colors: ['#10b981'],
    plotOptions: { bar: { borderRadius: 6, columnWidth: '44%' } },
    grid:   { borderColor: grid, strokeDashArray: 4 },
    xaxis:  { categories: labels?.length ? labels : ['No Data'], labels: { style: { colors: lblColor } } },
    yaxis:  { labels: { style: { colors: lblColor }, formatter: v => fmtShort(v) } },
    tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: v => fmt(v) } }
  };

  renderOrUpdateChart('income-trends', 'chart-income-trends', opts);
}

// ==========================================================================
// 3. EXPENSE PAGE
// ==========================================================================
async function loadExpensePage() {
  const data = await apiFetch('/api/dashboard/expense-analytics');

  document.getElementById('exp-today').textContent = fmt(data.summary.today);
  document.getElementById('exp-week').textContent  = fmt(data.summary.this_week);
  document.getElementById('exp-month').textContent = fmt(data.summary.this_month);
  document.getElementById('exp-year').textContent  = fmt(data.summary.this_year);

  renderProgressList(document.getElementById('expense-category-analysis'),   data.categories    || [], 'expense');
  renderProgressList(document.getElementById('expense-subcategory-analysis'), data.subcategories || [], 'expense');
  renderProgressList(document.getElementById('expense-payment-analysis'),     data.paymentModes  || [], 'expense');

  // Recent expense
  const recent = await apiFetch('/api/transactions?type=expense&limit=8');
  const tbody  = document.getElementById('expense-recent-list');
  tbody.innerHTML = '';
  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary" style="padding:16px">No expense transactions found.</td></tr>`;
  } else {
    recent.forEach(t => {
      const isTea = t.category_name?.toLowerCase() === 'tea' || t.category_icon === '☕';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDate(t.date)}</td>
        <td><span class="chip chip-expense">${isTea ? '☕ Tea' : t.category_name}</span></td>
        <td class="text-secondary">${t.subcategory_name || '-'}</td>
        <td>${t.payment_mode_name}</td>
        <td class="text-secondary">${t.notes || '-'}</td>
        <td class="text-right font-semibold expense-color">-${fmt(t.amount)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderInsightsCard(document.getElementById('expense-insights'), data.categories || [], 'expense', data.summary);

  state.expenseTrends = data.trends || [];
  renderExpenseTrendChart('monthly');
}

function renderExpenseTrendChart(period) {
  const isDark   = isDarkMode();
  const grid     = isDark ? '#1e293b' : '#e2e8f0';
  const lblColor = isDark ? '#94a3b8' : '#64748b';

  let labels, series;
  if (period === 'monthly') {
    labels = state.expenseTrends.map(t => t.label || t.month_num);
    series = state.expenseTrends.map(t => parseFloat(t.amount) || 0);
  } else {
    const base = state.expenseTrends.reduce((a,b) => a + parseFloat(b.amount||0), 0) || 3000;
    if (period === 'daily') {
      labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      series = [0.12,0.15,0.1,0.18,0.22,0.13,0.1].map(f => Math.round(base*f));
    } else if (period === 'yearly') {
      const yr = new Date().getFullYear();
      labels = [yr-3, yr-2, yr-1, yr].map(String);
      series = [base*9, base*11, base*10, base*12];
    }
  }

  const opts = {
    series: [{ name: 'Expense', data: series || [0] }],
    chart:  { type: 'bar', height: 300, fontFamily: 'Plus Jakarta Sans', toolbar: { show: false }, background: 'transparent' },
    colors: ['#f43f5e'],
    plotOptions: { bar: { borderRadius: 6, columnWidth: '44%' } },
    grid:   { borderColor: grid, strokeDashArray: 4 },
    xaxis:  { categories: labels?.length ? labels : ['No Data'], labels: { style: { colors: lblColor } } },
    yaxis:  { labels: { style: { colors: lblColor }, formatter: v => fmtShort(v) } },
    tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: v => fmt(v) } }
  };

  renderOrUpdateChart('expense-trends', 'chart-expense-trends', opts);
}

// ==========================================================================
// 4. BALANCE PAGE
// ==========================================================================
async function loadBalancePage() {
  const data = await apiFetch('/api/dashboard/balance-analytics');
  const { summary, balanceHistory } = data;

  document.getElementById('bal-net-worth').textContent  = fmt(summary.currentBalance);
  document.getElementById('bal-income-sum').textContent = fmt(summary.totalIncome);
  document.getElementById('bal-expense-sum').textContent= fmt(summary.totalExpense);
  document.getElementById('bal-savings-sum').textContent= fmt(summary.savings);
  document.getElementById('bal-savings-ratio').textContent = `${summary.savingsPercentage}%`;

  const healthEl  = document.getElementById('bal-health-status');
  const descEl    = document.getElementById('bal-health-card-desc');
  const badgeEl   = document.getElementById('bal-health-badge');
  const pct = summary.savingsPercentage;

  if (pct >= 30) {
    healthEl.textContent = '🟢 Excellent savings status';
    healthEl.style.color = 'var(--income)';
    descEl.textContent   = `You have saved ${pct}% of your income. Superb capital management!`;
    badgeEl.textContent  = '🌟 Excellent';
    badgeEl.className    = 'chip chip-income';
  } else if (pct >= 15) {
    healthEl.textContent = '🔵 Stable financial condition';
    healthEl.style.color = 'var(--balance)';
    descEl.textContent   = `Saving ${pct}% is healthy. Consider optimizing bills to reach 30%.`;
    badgeEl.textContent  = '📊 Stable';
    badgeEl.className    = 'chip chip-recurring';
  } else if (pct > 0) {
    healthEl.textContent = '🟡 Budget attention needed';
    healthEl.style.color = 'var(--warning)';
    descEl.textContent   = `Savings rate at ${pct}%. Trim auxiliary spending to build safety margins.`;
    badgeEl.textContent  = '⚠️ Attention';
    badgeEl.className    = 'chip chip-warning';
  } else {
    healthEl.textContent = '🔴 Overspending detected';
    healthEl.style.color = 'var(--expense)';
    descEl.textContent   = `Expenses exceed income. Review your spending categories immediately.`;
    badgeEl.textContent  = '🚨 Alert';
    badgeEl.className    = 'chip chip-expense';
  }

  // Ledger
  const tbody = document.getElementById('balance-history-ledger');
  tbody.innerHTML = '';
  if (!balanceHistory?.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary" style="padding:16px">No historical data yet.</td></tr>`;
  } else {
    [...balanceHistory].reverse().forEach(row => {
      const net = row.income - row.expense;
      const tr  = document.createElement('tr');
      tr.innerHTML = `
        <td class="font-semibold">${row.label}</td>
        <td class="income-color">+${fmt(row.income)}</td>
        <td class="expense-color">-${fmt(row.expense)}</td>
        <td class="${net >= 0 ? 'income-color' : 'expense-color'}">${net >= 0 ? '+' : ''}${fmt(net)}</td>
        <td class="text-right font-bold balance-color">${fmt(row.balance)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderBalanceCharts(balanceHistory || [], pct);
}

function renderBalanceCharts(history, savingsPct) {
  const isDark   = isDarkMode();
  const grid     = isDark ? '#1e293b' : '#e2e8f0';
  const lblColor = isDark ? '#94a3b8' : '#64748b';

  const labels = history.map(b => b.label);
  const series = history.map(b => parseFloat(b.balance) || 0);

  const lineOpts = {
    series: [{ name: 'Balance', data: series }],
    chart:  { type: 'area', height: 300, fontFamily: 'Plus Jakarta Sans', toolbar: { show: false }, background: 'transparent' },
    colors: ['#0ea5e9'],
    fill:   { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.03 } },
    stroke: { curve: 'smooth', width: 2.5 },
    grid:   { borderColor: grid, strokeDashArray: 4 },
    xaxis:  { categories: labels.length ? labels : ['No Data'], labels: { style: { colors: lblColor } } },
    yaxis:  { labels: { style: { colors: lblColor }, formatter: v => fmtShort(v) } },
    tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: v => fmt(v) } }
  };
  renderOrUpdateChart('balance-history', 'chart-balance-history', lineOpts);

  const radColor = savingsPct >= 30 ? '#10b981' : (savingsPct >= 15 ? '#0ea5e9' : '#f59e0b');
  const radOpts  = {
    series: [Math.max(0, Math.min(100, savingsPct))],
    chart:  { type: 'radialBar', height: 280, fontFamily: 'Plus Jakarta Sans', background: 'transparent' },
    plotOptions: { radialBar: { hollow: { size: '68%' }, dataLabels: {
      name: { show: true, fontSize: '13px', color: lblColor, offsetY: -8 },
      value: { show: true, fontSize: '34px', fontWeight: 800,
               color: isDark ? '#f1f5f9' : '#0f172a', offsetY: 8, formatter: v => v + '%' }
    }}},
    colors: [radColor],
    labels: ['Capital Saved']
  };
  renderOrUpdateChart('balance-radial', 'chart-balance-radial', radOpts);
}

// ==========================================================================
// 5. REPORTS PAGE
// ==========================================================================
async function loadReportsPage() {
  const period = state.reportsPeriod;
  const data   = await apiFetch(`/api/reports/${period}`);
  const { summary, transactions } = data;

  document.getElementById('rep-income').textContent  = fmt(summary.income);
  document.getElementById('rep-expense').textContent = fmt(summary.expense);
  const savEl = document.getElementById('rep-savings');
  savEl.textContent = fmt(summary.savings);
  savEl.className   = `${summary.savings < 0 ? 'expense-color' : 'balance-color'} font-bold`;

  // Transactions table
  const tbody = document.getElementById('rep-txns-body');
  tbody.innerHTML = '';
  document.getElementById('rep-txns-count').textContent = `${transactions?.length || 0} records`;

  if (!transactions?.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-secondary" style="padding:16px">No transactions in this period.</td></tr>`;
  } else {
    transactions.forEach(t => {
      const isInc = t.type === 'income';
      const isTea = t.category_name?.toLowerCase() === 'tea' || t.category_icon === '☕';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="chip ${isInc ? 'chip-income' : 'chip-expense'}">${isInc ? 'Income' : 'Expense'}</span></td>
        <td>${formatDate(t.date)}</td>
        <td>${isTea ? '☕ Tea' : (t.category_name || '-')}</td>
        <td class="text-secondary">${t.subcategory_name || '-'}</td>
        <td>${t.payment_mode_name || '-'}</td>
        <td class="text-secondary">${t.notes || '-'}</td>
        <td class="text-right font-semibold ${isInc ? 'income-color' : 'expense-color'}">${isInc ? '+' : '-'}${fmt(t.amount)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderReportsCharts(summary, transactions || []);
}

function renderReportsCharts(summary, txns) {
  const isDark   = isDarkMode();
  const grid     = isDark ? '#1e293b' : '#e2e8f0';
  const lblColor = isDark ? '#94a3b8' : '#64748b';

  // Bar comparison
  const barOpts = {
    series: [{ name: 'Amount', data: [summary.income, summary.expense] }],
    chart:  { type: 'bar', height: 260, fontFamily: 'Plus Jakarta Sans', toolbar: { show: false }, background: 'transparent' },
    plotOptions: { bar: { distributed: true, borderRadius: 8, columnWidth: '38%' } },
    colors: ['#10b981', '#f43f5e'],
    xaxis:  { categories: ['Income', 'Expense'], labels: { style: { colors: lblColor } } },
    yaxis:  { labels: { style: { colors: lblColor }, formatter: v => fmtShort(v) } },
    grid:   { borderColor: grid, strokeDashArray: 4 },
    legend: { show: false },
    tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: v => fmt(v) } }
  };
  renderOrUpdateChart('rep-comparison', 'chart-reports-comparison', barOpts);

  // Pie breakdown
  const catMap = {};
  txns.filter(t => t.type === 'expense').forEach(t => {
    catMap[t.category_name] = (catMap[t.category_name] || 0) + parseFloat(t.amount);
  });
  const pieLabels = Object.keys(catMap);
  const pieSeries = Object.values(catMap);

  const pieOpts = {
    series: pieSeries.length ? pieSeries : [1],
    chart:  { type: 'donut', height: 260, fontFamily: 'Plus Jakarta Sans', background: 'transparent' },
    labels: pieLabels.length ? pieLabels : ['No Expenses'],
    colors: ['#f43f5e','#f97316','#8b5cf6','#3b82f6','#14b8a6','#eab308','#64748b','#ec4899'],
    stroke: { show: false },
    plotOptions: { pie: { donut: { size: '72%', labels: { show: true, total: {
      show: true, label: 'Total', color: lblColor,
      formatter: w => fmtShort(w.globals.seriesTotals.reduce((a,b)=>a+b,0))
    }}}}},
    legend:     { position: 'bottom', labels: { colors: lblColor } },
    dataLabels: { enabled: false },
    tooltip:    { theme: isDark ? 'dark' : 'light', y: { formatter: v => fmt(v) } }
  };
  renderOrUpdateChart('rep-pie', 'chart-reports-pie', pieOpts);
}

// ==========================================================================
// 6. TRANSACTIONS PAGE
// ==========================================================================
async function loadTransactions(reset = true) {
  if (reset) {
    txnsOffset = 0;
    document.getElementById('txns-table-body').innerHTML = '';
    populateFilterDropdowns();
  }

  const type      = document.getElementById('filter-type').value;
  const catFilter = document.getElementById('filter-category').value;
  const subFilter = document.getElementById('filter-subcategory')?.value;
  const payFilter = document.getElementById('filter-payment').value;
  const search    = document.getElementById('txns-search').value.trim();

  let url = `/api/transactions?limit=${txnsLimit}&offset=${txnsOffset}`;
  if (type && type !== 'all') url += `&type=${type}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;

  const txns = await apiFetch(url);

  let filtered = txns;
  if (catFilter && catFilter !== 'all') filtered = filtered.filter(t => String(t.category_id) === String(catFilter));
  if (subFilter && subFilter !== 'all') filtered = filtered.filter(t => String(t.subcategory_id) === String(subFilter));
  if (payFilter && payFilter !== 'all') filtered = filtered.filter(t => String(t.payment_mode_id) === String(payFilter));

  const tbody = document.getElementById('txns-table-body');

  if (!filtered.length && reset) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-secondary" style="padding:20px">No transactions match your filters.</td></tr>`;
    document.getElementById('txns-count').textContent = 'Showing 0 records';
    return;
  }

  filtered.forEach(t => {
    const isInc = t.type === 'income';
    const isTea = t.category_name?.toLowerCase() === 'tea' || t.category_icon === '☕';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <span class="material-icons-round ${isInc ? 'income-color' : 'expense-color'}" style="font-size:18px!important">
          ${isInc ? 'arrow_upward' : 'arrow_downward'}
        </span>
      </td>
      <td>${formatDate(t.date)}</td>
      <td><span class="chip ${isInc ? 'chip-income' : 'chip-expense'}">${isTea ? '☕ Tea' : (t.category_name || '-')}</span></td>
      <td class="text-secondary">${t.subcategory_name || '-'}</td>
      <td>${t.payment_mode_name || '-'}</td>
      <td class="text-secondary" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.notes || '-'}</td>
      <td class="text-right font-bold ${isInc ? 'income-color' : 'expense-color'}">${isInc ? '+' : '-'}${fmt(t.amount)}</td>
      <td>
        <div class="action-btn-row">
          <button onclick="editTransaction(${t.id})"   class="table-action-btn btn-edit"   title="Edit"><span class="material-icons-round" style="font-size:16px!important">edit</span></button>
          <button onclick="deleteTransaction(${t.id})" class="table-action-btn btn-delete" title="Delete"><span class="material-icons-round" style="font-size:16px!important">delete</span></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  txnsOffset += filtered.length;
  document.getElementById('txns-count').textContent = `Showing ${tbody.children.length} records`;

  // Update cache
  if (reset) state.allTransactions = filtered.concat(state.allTransactions.filter(t => !filtered.some(f => f.id === t.id)));
}

function populateSubcategoryFilter(selectedCategoryId) {
  const subSel = document.getElementById('filter-subcategory');
  if (!subSel) return;
  const savedSub = subSel.value;
  subSel.innerHTML = '<option value="all">All Subcategories</option>';

  let relevantSubs = state.subcategories;
  if (selectedCategoryId && selectedCategoryId !== 'all') {
    relevantSubs = state.subcategories.filter(s => String(s.category_id) === String(selectedCategoryId));
  }

  relevantSubs.forEach(s => {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = s.name;
    subSel.appendChild(o);
  });

  if (Array.from(subSel.options).some(o => o.value === savedSub)) {
    subSel.value = savedSub;
  } else {
    subSel.value = 'all';
  }
}

function populateFilterDropdowns() {
  const catSel = document.getElementById('filter-category');
  const paySel = document.getElementById('filter-payment');
  const savedCat = catSel.value;
  const savedPay = paySel.value;

  catSel.innerHTML = '<option value="all">All Categories</option>';
  state.categories.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id;
    const isTea = c.name?.toLowerCase() === 'tea' || c.icon === '☕';
    o.textContent = isTea ? `☕ ${c.name} (${c.type})` : `${c.name} (${c.type})`;
    catSel.appendChild(o);
  });
  catSel.value = savedCat;

  populateSubcategoryFilter(catSel.value);

  paySel.innerHTML = '<option value="all">All Payments</option>';
  state.paymentModes.forEach(p => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.name;
    paySel.appendChild(o);
  });
  paySel.value = savedPay;
}

// ==========================================================================
// 7. RECURRING TRANSACTIONS PAGE
// ==========================================================================
async function loadRecurringPage() {
  const list = await apiFetch('/api/recurring');
  state.recurringList = list;

  const container = document.getElementById('recurring-list-container');
  const countBadge = document.getElementById('recurring-count');
  const active = list.filter(r => r.is_active);
  countBadge.textContent = `${active.length} active`;

  container.innerHTML = '';

  if (!list.length) {
    container.innerHTML = `<p class="text-secondary text-sm">No recurring transactions yet. Click "Add Recurring" to set one up.</p>`;
    return;
  }

  list.forEach(r => {
    const isInc = r.type === 'income';
    const isTea = r.category_name?.toLowerCase() === 'tea' || r.category_icon === '☕';
    const card  = document.createElement('div');
    card.className = 'recurring-card';
    card.innerHTML = `
      <div class="recurring-card-header">
        <div class="recurring-info">
          <span class="recurring-name">${isTea ? '☕ Tea' : (r.category_name || 'Recurring')}</span>
          <span class="recurring-meta">${capitalize(r.frequency)} · ${r.payment_mode_name || ''}</span>
        </div>
        <span class="chip ${isInc ? 'chip-income' : 'chip-expense'}">${isInc ? 'Income' : 'Expense'}</span>
      </div>
      <div class="recurring-amount ${isInc ? 'income-color' : 'expense-color'}">${fmt(r.amount)}</div>
      <div class="recurring-footer">
        <span class="recurring-next text-secondary">
          <span class="material-icons-round" style="font-size:14px!important;vertical-align:middle">schedule</span>
          Next: ${r.next_due_date ? formatDate(r.next_due_date) : 'N/A'}
        </span>
        <div class="flex-row gap-2 align-center">
          <span class="recurring-active-badge ${r.is_active ? 'income-color' : 'text-secondary'}">
            <span class="material-icons-round" style="font-size:13px!important">${r.is_active ? 'radio_button_checked' : 'radio_button_unchecked'}</span>
            ${r.is_active ? 'Active' : 'Paused'}
          </span>
          <button onclick="editRecurring(${r.id})"   class="table-action-btn btn-edit"   title="Edit"><span class="material-icons-round" style="font-size:15px!important">edit</span></button>
          <button onclick="deleteRecurring(${r.id})" class="table-action-btn btn-delete" title="Delete"><span class="material-icons-round" style="font-size:15px!important">delete</span></button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function openRecurringModal(prefillType = 'income') {
  document.getElementById('recurring-modal').classList.remove('hidden');
  document.getElementById('recurring-form').reset();
  document.getElementById('recurring-edit-id').value = '';
  document.getElementById('modal-recurring-title').textContent = 'Add Recurring Transaction';
  document.getElementById('recurring-start').value = todayISO();
  document.getElementById('recurring-type').value  = prefillType;

  document.querySelectorAll('.recurring-type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.val === prefillType);
  });

  populateRecurringCategories(prefillType);
  populatePaymentModes(document.getElementById('recurring-payment'));
}

function closeRecurringModal() {
  document.getElementById('recurring-modal').classList.add('hidden');
}

function populateRecurringCategories(type) {
  const sel = document.getElementById('recurring-category');
  sel.innerHTML = '<option value="" disabled selected>Select Category</option>';
  state.categories.filter(c => c.type === type).forEach(c => {
    const o = document.createElement('option');
    o.value = c.id;
    const isTea = c.name?.toLowerCase() === 'tea' || c.icon === '☕';
    o.textContent = isTea ? `☕ ${c.name}` : c.name;
    sel.appendChild(o);
  });
}

async function handleRecurringSubmit(e) {
  e.preventDefault();
  const id        = document.getElementById('recurring-edit-id').value;
  const type      = document.getElementById('recurring-type').value;
  const amount    = parseFloat(document.getElementById('recurring-amount').value);
  const frequency = document.getElementById('recurring-frequency').value;
  const catId     = parseInt(document.getElementById('recurring-category').value);
  const payId     = parseInt(document.getElementById('recurring-payment').value);
  const startDate = document.getElementById('recurring-start').value;
  const endDate   = document.getElementById('recurring-end').value || null;

  if (!amount || amount <= 0) { showToast('Enter a valid amount.', 'error'); return; }
  if (!catId)  { showToast('Select a category.', 'error'); return; }
  if (!payId)  { showToast('Select a payment mode.', 'error'); return; }

  const payload = { type, amount, category_id: catId, payment_mode_id: payId, frequency, start_date: startDate, end_date: endDate, is_active: true };

  try {
    if (id) {
      await apiFetch(`/api/recurring/${id}`, { method: 'PUT', body: payload });
      showToast('Recurring transaction updated!', 'success');
    } else {
      await apiFetch('/api/recurring', { method: 'POST', body: payload });
      showToast('Recurring transaction created!', 'success');
    }
    closeRecurringModal();
    await loadRecurringPage();
  } catch(err) {
    showToast(err.message, 'error');
  }
}

async function editRecurring(id) {
  const r = state.recurringList.find(x => x.id === id);
  if (!r) return;
  openRecurringModal(r.type);
  document.getElementById('recurring-edit-id').value    = r.id;
  document.getElementById('modal-recurring-title').textContent = 'Edit Recurring Transaction';
  document.getElementById('recurring-type').value       = r.type;
  document.getElementById('recurring-amount').value     = r.amount;
  document.getElementById('recurring-frequency').value  = r.frequency;
  document.getElementById('recurring-start').value      = r.start_date ? String(r.start_date).split('T')[0] : '';
  document.getElementById('recurring-end').value        = r.end_date   ? String(r.end_date).split('T')[0]   : '';
  populateRecurringCategories(r.type);
  await new Promise(r => setTimeout(r, 0));
  document.getElementById('recurring-category').value = r.category_id;
  document.getElementById('recurring-payment').value  = r.payment_mode_id;
}

async function deleteRecurring(id) {
  if (!confirm('Delete this recurring transaction?')) return;
  try {
    await apiFetch(`/api/recurring/${id}`, { method: 'DELETE' });
    showToast('Recurring transaction deleted.', 'success');
    await loadRecurringPage();
  } catch(err) {
    showToast(err.message, 'error');
  }
}

window.editRecurring   = editRecurring;
window.deleteRecurring = deleteRecurring;

// ==========================================================================
// 8. SETTINGS PAGE
// ==========================================================================
async function loadSettingsPage() {
  if (!state.user) return;
  document.getElementById('profile-email').value  = state.user.email || '';
  const joined = new Date(state.user.created_at || new Date());
  document.getElementById('profile-joined').value = joined.toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' });
  document.getElementById('pref-currency').value  = state.preferences.currency || 'INR';

  // Categories list
  const incEl  = document.getElementById('settings-income-categories-list');
  const expEl  = document.getElementById('settings-expense-categories-list');
  incEl.innerHTML = '';
  expEl.innerHTML = '';

  state.categories.forEach(c => {
    const isTea = c.name?.toLowerCase() === 'tea' || c.icon === '☕';
    const chip = document.createElement('div');
    chip.className = `chip ${c.type === 'income' ? 'chip-income' : 'chip-expense'}`;
    const iconHtml = isTea
      ? `<span style="font-size:14px;line-height:1;margin-right:2px">☕</span>`
      : `<span class="material-icons-round" style="font-size:14px!important">${c.icon || 'star'}</span>`;
    chip.innerHTML = `${iconHtml}<span>${c.name}</span>${c.user_id === null ? '<span class="text-xs text-muted" style="margin-left:3px">(Global)</span>' : ''}`;
    (c.type === 'income' ? incEl : expEl).appendChild(chip);
  });

  // Payment modes
  const payEl = document.getElementById('settings-payment-modes-list');
  payEl.innerHTML = '';
  state.paymentModes.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerHTML = `<span class="material-icons-round" style="font-size:14px!important">payment</span><span>${p.name}</span>${p.user_id === null ? '<span class="text-xs text-muted" style="margin-left:3px">(Global)</span>' : ''}`;
    payEl.appendChild(chip);
  });
}

// ==========================================================================
// EXPORT FUNCTIONS
// ==========================================================================
async function exportReportPDF() {
  const period = state.reportsPeriod;
  const data   = await apiFetch(`/api/reports/${period}`).catch(() => null);
  if (!data) { showToast('Failed to load report data.', 'error'); return; }

  const lines = [
    `AURA Financial Report – ${capitalize(period)}`,
    `Generated: ${new Date().toLocaleString('en-IN')}`,
    `User: ${state.user?.email || 'N/A'}`,
    ``,
    `SUMMARY`,
    `Income:  ${fmt(data.summary.income)}`,
    `Expense: ${fmt(data.summary.expense)}`,
    `Savings: ${fmt(data.summary.savings)}`,
    ``,
    `TRANSACTIONS`,
    ...(data.transactions || []).map(t =>
      `${formatDate(t.date)} | ${t.type.toUpperCase()} | ${t.category_name} | ${t.payment_mode_name} | ${fmt(t.amount)} | ${t.notes || ''}`
    )
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  downloadBlob(blob, `AURA_Report_${period}_${todayISO()}.txt`);
  showToast('Report exported as text file (PDF generation requires backend library).', 'info');
}

async function exportReportExcel() {
  const period = state.reportsPeriod;
  const data   = await apiFetch(`/api/reports/${period}`).catch(() => null);
  if (!data) { showToast('Failed to load report data.', 'error'); return; }

  const rows = [
    ['Date','Type','Category','Subcategory','Payment Mode','Notes','Amount'],
    ...(data.transactions || []).map(t => [
      formatDate(t.date), t.type, t.category_name, t.subcategory_name || '',
      t.payment_mode_name, t.notes || '', t.amount
    ])
  ];

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `AURA_Report_${period}_${todayISO()}.csv`);
  showToast('Report exported as CSV (Excel-compatible).', 'success');
}

async function exportBackupJSON() {
  try {
    const txns = await apiFetch('/api/transactions?limit=5000');
    const backup = {
      version: 'AURA_V2',
      exportedAt: new Date().toISOString(),
      userEmail: state.user?.email,
      preferences: state.preferences,
      categories: state.categories,
      paymentModes: state.paymentModes,
      transactions: txns
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `AURA_Backup_${todayISO()}.json`);
    showToast('Backup downloaded successfully!', 'success');
  } catch(err) {
    showToast('Export failed: ' + err.message, 'error');
  }
}

async function importBackupJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const data = JSON.parse(evt.target.result);
      if (!data.version?.startsWith('AURA')) throw new Error('Invalid backup file format.');
      // Note: In a real backend integration, we'd send this to an API endpoint
      showToast('Backup import is supported via API in the full production version. Data structure validated ✅', 'info');
    } catch(err) {
      showToast('Restore failed: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

// ==========================================================================
// CHART HELPERS
// ==========================================================================
function renderOrUpdateChart(key, domId, opts) {
  if (state.charts[key]) {
    try {
      state.charts[key].updateOptions(opts, true, true);
      return;
    } catch(e) {
      try { state.charts[key].destroy(); } catch(e2) {}
      delete state.charts[key];
    }
  }
  const el = document.getElementById(domId);
  if (!el) return;
  try {
    state.charts[key] = new ApexCharts(el, opts);
    state.charts[key].render();
  } catch(err) {
    console.error(`Chart error [${key}]:`, err);
  }
}

function renderProgressList(el, items, type) {
  el.innerHTML = '';
  if (!items?.length) {
    el.innerHTML = `<p class="text-secondary text-sm" style="padding:8px 0">No data yet.</p>`;
    return;
  }
  const total   = items.reduce((acc, i) => acc + parseFloat(i.amount || 0), 0);
  const barCls  = type === 'income' ? 'bg-income-bar' : (type === 'expense' ? 'bg-expense-bar' : 'bg-balance-bar');
  items.slice(0, 6).forEach(item => {
    const amt = parseFloat(item.amount || 0);
    const pct = total > 0 ? Math.min(100, Math.round((amt / total) * 100)) : 0;
    const div = document.createElement('div');
    div.className = 'analysis-item';
    div.innerHTML = `
      <div class="analysis-label-row">
        <span>${item.name}</span>
        <span class="text-secondary text-xs">${pct}% · ${fmt(amt)}</span>
      </div>
      <div class="analysis-progress-bg">
        <div class="analysis-progress-bar ${barCls}" style="width:${pct}%"></div>
      </div>
    `;
    el.appendChild(div);
  });
}

function renderInsightsCard(el, categories, type, summary) {
  el.innerHTML = '';
  const top = categories[0]?.name || 'None';

  if (type === 'income') {
    const growth = summary.this_month > 0 ? Math.round((summary.this_month / (summary.this_year / 12)) * 100 - 100) : 0;
    el.innerHTML = `
      <div class="insight-item">
        <span class="material-icons-round">trending_up</span>
        <div class="flex-col">
          <strong>Key Revenue Hub</strong>
          <span class="text-xs mt-1" style="opacity:0.85">Your largest income source is <strong>${top}</strong>. Focus on scaling it further.</span>
        </div>
      </div>
      <div class="insight-item">
        <span class="material-icons-round">savings</span>
        <div class="flex-col">
          <strong>Monthly Momentum</strong>
          <span class="text-xs mt-1" style="opacity:0.85">This month you earned ${fmt(summary.this_month)}. Consider automating savings transfers.</span>
        </div>
      </div>
      <div class="insight-item">
        <span class="material-icons-round">account_balance</span>
        <div class="flex-col">
          <strong>Annual Projection</strong>
          <span class="text-xs mt-1" style="opacity:0.85">Yearly total so far: ${fmt(summary.this_year)}. You're on track for strong financial growth.</span>
        </div>
      </div>
    `;
  } else {
    const ratio = summary.this_month && summary.this_year
      ? Math.round((summary.this_month / (summary.this_year / 12)) * 100)
      : 0;
    el.innerHTML = `
      <div class="insight-item">
        <span class="material-icons-round">warning</span>
        <div class="flex-col">
          <strong>Top Spend Category</strong>
          <span class="text-xs mt-1" style="opacity:0.85">Highest outflow in <strong>${top}</strong>. Review and set a monthly cap.</span>
        </div>
      </div>
      <div class="insight-item">
        <span class="material-icons-round">lightbulb</span>
        <div class="flex-col">
          <strong>Savings Opportunity</strong>
          <span class="text-xs mt-1" style="opacity:0.85">Cutting small impulse spends by 10% can recover up to ${fmt(summary.this_month * 0.1)} monthly.</span>
        </div>
      </div>
      <div class="insight-item">
        <span class="material-icons-round">pie_chart</span>
        <div class="flex-col">
          <strong>Monthly Burn Rate</strong>
          <span class="text-xs mt-1" style="opacity:0.85">This month you spent ${fmt(summary.this_month)}. Year-to-date total: ${fmt(summary.this_year)}.</span>
        </div>
      </div>
    `;
  }
}

// ==========================================================================
// UTILITY HELPERS
// ==========================================================================
function isDarkMode() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtShort(num) {
  const sym = getCurrencySymbol();
  if (Math.abs(num) >= 100000) return sym + (num/100000).toFixed(1) + 'L';
  if (Math.abs(num) >= 1000)   return sym + (num/1000).toFixed(1) + 'K';
  return sym + Math.round(num);
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}
