import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid, Card, CardContent, Typography, Box,
  CircularProgress, Alert, useTheme, Chip, Divider, LinearProgress
} from '@mui/material';
import {
  TrendingUp, TrendingDown, AccountBalance, Savings,
  Restaurant, DirectionsCar, ShoppingBag, AttachMoney, Coffee,
  LightbulbOutlined, WarningAmberOutlined, CheckCircleOutlined,
  ArrowUpward, ArrowDownward
} from '@mui/icons-material';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';

import api from '../services/api';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

// KPI Card Component
const KPICard: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  trend?: string;
  trendUp?: boolean;
}> = ({ label, value, icon, color, bgColor, trend, trendUp }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
        <Box
          sx={{
            p: 1.2,
            borderRadius: 2,
            bgcolor: bgColor,
            color: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
        {trend && (
          <Chip
            icon={trendUp ? <ArrowUpward sx={{ fontSize: '0.7rem !important' }} /> : <ArrowDownward sx={{ fontSize: '0.7rem !important' }} />}
            label={trend}
            size="small"
            sx={{ bgcolor: bgColor, color: color, fontWeight: 600, fontSize: '0.7rem' }}
          />
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, fontSize: '0.8rem' }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 800, color, lineHeight: 1.2 }}>
        {formatCurrency(value)}
      </Typography>
    </CardContent>
  </Card>
);

// Smart Expense Planner Component
const SmartPlanner: React.FC<{ summary: { total_income: number; total_expense: number; current_balance: number }; categoryShares: any[] }> = ({ summary, categoryShares }) => {
  const theme = useTheme();
  const { total_income, total_expense } = summary;

  if (total_income === 0 && total_expense === 0) return null;

  const savings = total_income - total_expense;
  const expenseRatio = total_income > 0 ? (total_expense / total_income) * 100 : 0;
  const savingsRate = total_income > 0 ? (savings / total_income) * 100 : 0;

  // Budgeting targets (50/30/20 rule)
  const recommended_needs = total_income * 0.50;
  const recommended_wants = total_income * 0.30;
  const recommended_savings_target = total_income * 0.20;

  // Suggested monthly spending limit (80% of income)
  const suggestedSpendingLimit = total_income * 0.80;
  const spendingOverLimit = total_expense > suggestedSpendingLimit;

  // Largest spending category
  const largestCategory = categoryShares.length > 0 ? categoryShares[0] : null;

  const suggestions: { icon: React.ReactNode; text: string; severity: 'success' | 'warning' | 'info' }[] = [];

  if (expenseRatio > 90) {
    suggestions.push({ icon: <WarningAmberOutlined fontSize="small" />, text: `High risk: Your expenses are ${expenseRatio.toFixed(0)}% of your income. Immediate action needed.`, severity: 'warning' });
  } else if (expenseRatio > 70) {
    suggestions.push({ icon: <WarningAmberOutlined fontSize="small" />, text: `Caution: Expenses are ${expenseRatio.toFixed(0)}% of income. Aim to stay below 70%.`, severity: 'warning' });
  } else {
    suggestions.push({ icon: <CheckCircleOutlined fontSize="small" />, text: `Great job! Your expense ratio is ${expenseRatio.toFixed(0)}% — within a healthy range.`, severity: 'success' });
  }

  if (savingsRate < 10) {
    suggestions.push({ icon: <LightbulbOutlined fontSize="small" />, text: `Try to save at least 20% of your income. Current savings rate: ${savingsRate.toFixed(1)}%.`, severity: 'info' });
  } else if (savingsRate >= 20) {
    suggestions.push({ icon: <CheckCircleOutlined fontSize="small" />, text: `Excellent! You're saving ${savingsRate.toFixed(1)}% of your income — above the recommended 20%.`, severity: 'success' });
  }

  if (largestCategory) {
    suggestions.push({ icon: <LightbulbOutlined fontSize="small" />, text: `Your biggest expense category is ${largestCategory.category_name} (${largestCategory.percentage.toFixed(1)}% of spending). Consider if this is within budget.`, severity: 'info' });
  }

  if (spendingOverLimit) {
    suggestions.push({ icon: <WarningAmberOutlined fontSize="small" />, text: `You've exceeded the suggested spending limit of ${formatCurrency(suggestedSpendingLimit)}. Try to cut discretionary expenses.`, severity: 'warning' });
  }

  const metrics = [
    { label: 'Recommended: Needs (50%)', value: recommended_needs, current: total_expense, color: theme.palette.primary.main },
    { label: 'Recommended: Wants (30%)', value: recommended_wants, current: total_expense * 0.3, color: theme.palette.warning.main },
    { label: 'Savings Target (20%)', value: recommended_savings_target, current: savings > 0 ? savings : 0, color: theme.palette.success.main },
  ];

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <LightbulbOutlined sx={{ color: 'warning.main' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Smart Expense Planner
          </Typography>
          <Chip label="AI Insights" size="small" sx={{ bgcolor: 'warning.light', color: 'warning.dark', fontWeight: 600, fontSize: '0.7rem', ml: 'auto' }} />
        </Box>

        {/* Budget Ratio Bars */}
        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          {metrics.map((m) => {
            const pct = m.value > 0 ? Math.min((m.current / m.value) * 100, 100) : 0;
            return (
              <Grid size={{ xs: 12, sm: 4 }} key={m.label}>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.72rem' }}>{m.label}</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: m.color, fontSize: '0.72rem' }}>{formatCurrency(m.value)}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    sx={{
                      height: 7,
                      borderRadius: 4,
                      bgcolor: m.color + '22',
                      '& .MuiLinearProgress-bar': { bgcolor: m.color, borderRadius: 4 }
                    }}
                  />
                </Box>
              </Grid>
            );
          })}
        </Grid>

        <Divider sx={{ mb: 2 }} />

        {/* Personalized Tips */}
        <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', fontSize: '0.7rem', display: 'block', mb: 1.5 }}>
          Personalized Recommendations
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {suggestions.map((tip, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                p: 1.5,
                borderRadius: 2,
                bgcolor: tip.severity === 'success'
                  ? 'success.light'
                  : tip.severity === 'warning'
                    ? 'warning.light'
                    : 'info.light',
                color: tip.severity === 'success'
                  ? 'success.dark'
                  : tip.severity === 'warning'
                    ? 'warning.dark'
                    : 'info.dark',
              }}
            >
              {tip.icon}
              <Typography variant="body2" sx={{ fontSize: '0.82rem', fontWeight: 500 }}>
                {tip.text}
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  const [summary, setSummary] = useState({ total_income: 0, total_expense: 0, current_balance: 0 });
  const [cashflow, setCashflow] = useState<any[]>([]);
  const [categoryShares, setCategoryShares] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      const [sumRes, flowRes, shareRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/dashboard/charts/cashflow?period=monthly'),
        api.get('/dashboard/charts/category-shares?type=expense')
      ]);

      setSummary(sumRes.data);
      setCashflow(flowRes.data);
      setCategoryShares(shareRes.data);
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      if (!err.response) {
        setError('Cannot connect to the backend server. Please verify the FastAPI backend is running on http://127.0.0.1:5000.');
      } else {
        setError('Failed to load dashboard data. Please refresh the page.');
      }

      // Reset data to empty database defaults
      setSummary({ total_income: 0, total_expense: 0, current_balance: 0 });
      setCashflow([]);
      setCategoryShares([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Auto-refresh when any transaction changes
  useEffect(() => {
    const handleTransactionChanged = () => {
      fetchDashboardData();
    };
    window.addEventListener('transaction-changed', handleTransactionChanged);
    return () => window.removeEventListener('transaction-changed', handleTransactionChanged);
  }, [fetchDashboardData]);

  const handleQuickAdd = (category: string, type: 'income' | 'expense') => {
    navigate('/add-transaction', { state: { prefilledCategory: category, prefilledType: type } });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexGrow: 1, justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress size={48} />
      </Box>
    );
  }

  const savings = summary.total_income - summary.total_expense;
  const savingsRate = summary.total_income > 0 ? ((savings / summary.total_income) * 100).toFixed(1) : '0.0';
  const isEmpty = summary.total_income === 0 && summary.total_expense === 0;

  return (
    <Box sx={{ pb: 10 }}>
      {error && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {isEmpty && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
          <strong>No transactions available.</strong> Start by clicking the <strong>+</strong> button to add your first transaction.
        </Alert>
      )}

      {/* KPI Cards Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KPICard
            label="Total Income"
            value={summary.total_income}
            icon={<TrendingUp fontSize="small" />}
            color={theme.palette.success.main}
            bgColor={theme.palette.success.light}
            trendUp
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KPICard
            label="Total Expense"
            value={summary.total_expense}
            icon={<TrendingDown fontSize="small" />}
            color={theme.palette.error.main}
            bgColor={theme.palette.error.light}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KPICard
            label="Current Balance"
            value={summary.current_balance}
            icon={<AccountBalance fontSize="small" />}
            color={theme.palette.info.main}
            bgColor={theme.palette.info.light}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KPICard
            label="Net Savings"
            value={savings}
            icon={<Savings fontSize="small" />}
            color={theme.palette.secondary.main}
            bgColor={theme.palette.secondary.light + '30'}
            trend={`${savingsRate}% rate`}
            trendUp={Number(savingsRate) > 0}
          />
        </Grid>
      </Grid>

      {/* Quick Shortcuts */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.75rem' }}>
            Quick Add
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {[
              { label: 'Food', icon: <Restaurant fontSize="small" />, category: 'Food', type: 'expense' as const },
              { label: 'Coffee', icon: <Coffee fontSize="small" />, category: 'Food', type: 'expense' as const },
              { label: 'Transport', icon: <DirectionsCar fontSize="small" />, category: 'Transport', type: 'expense' as const },
              { label: 'Shopping', icon: <ShoppingBag fontSize="small" />, category: 'Shopping', type: 'expense' as const },
              { label: 'Salary', icon: <AttachMoney fontSize="small" />, category: 'Salary', type: 'income' as const },
            ].map((shortcut) => (
              <Chip
                key={shortcut.label}
                icon={shortcut.icon}
                label={shortcut.label}
                onClick={() => handleQuickAdd(shortcut.category, shortcut.type)}
                variant="outlined"
                sx={{
                  borderRadius: 3,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.main' + '08' },
                }}
              />
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Smart Expense Planner */}
      <SmartPlanner summary={summary} categoryShares={categoryShares} />

      {/* Charts */}
      <Grid container spacing={2}>
        {/* Cashflow Area Chart */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card sx={{ height: { xs: 300, sm: 360 } }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: { xs: 2, sm: 2.5 }, pb: '16px !important' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                Income vs Expense Trends
              </Typography>
              <Box sx={{ flexGrow: 1, minHeight: 0 }}>

                {cashflow.length === 0 || cashflow.every((item) => Number(item.income) === 0 && Number(item.expense) === 0) ? (
                  <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                    <Typography color="text.secondary" variant="body2">No transaction data yet</Typography>
                    <Chip label="Add Transaction" onClick={() => navigate('/add-transaction')} size="small" color="primary" variant="outlined" sx={{ cursor: 'pointer', mt: 0.5 }} />
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cashflow} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={theme.palette.success.main} stopOpacity={0.18} />
                          <stop offset="95%" stopColor={theme.palette.success.main} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={theme.palette.error.main} stopOpacity={0.18} />
                          <stop offset="95%" stopColor={theme.palette.error.main} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme.palette.text.secondary }} />
                      <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip contentStyle={{ backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8, fontSize: 12 }} formatter={(val: any, _name: any) => [`$${Number(val).toLocaleString()}`, _name]} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      <Area type="monotone" dataKey="income" stroke={theme.palette.success.main} strokeWidth={2.5} fill="url(#incomeGrad)" dot={{ r: 3 }} activeDot={{ r: 5 }} name="Income" />
                      <Area type="monotone" dataKey="expense" stroke={theme.palette.error.main} strokeWidth={2.5} fill="url(#expenseGrad)" dot={{ r: 3 }} activeDot={{ r: 5 }} name="Expense" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Expense Category Donut */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ height: { xs: 300, sm: 360 } }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: { xs: 2, sm: 2.5 }, pb: '16px !important' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Expense Breakdown
              </Typography>
              {categoryShares.length === 0 ? (
                <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 1 }}>
                  <Typography color="text.secondary" variant="body2">No expense transactions yet</Typography>
                  <Chip label="Add Expense" onClick={() => navigate('/add-transaction')} size="small" color="primary" variant="outlined" sx={{ cursor: 'pointer', mt: 0.5 }} />
                </Box>
              ) : (
                <Box sx={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: theme.palette.background.paper,
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          formatter={(val: any, _name: any, props: any) => [`$${Number(val).toLocaleString()} (${props.payload.percentage?.toFixed(1)}%)`, props.payload.category_name]}
                        />
                        <Pie
                          data={categoryShares}
                          cx="50%"
                          cy="50%"
                          innerRadius="40%"
                          outerRadius="65%"
                          dataKey="amount"
                          nameKey="category_name"
                        >
                          {categoryShares.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                  {/* Legend */}
                  <Box sx={{ mt: 1 }}>
                    {categoryShares.slice(0, 5).map((share, index) => (
                      <Box key={share.category_name} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: COLORS[index % COLORS.length], flexShrink: 0 }} />
                          <Typography variant="caption" sx={{ fontWeight: 500 }}>{share.category_name}</Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          {share.percentage.toFixed(1)}%
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
