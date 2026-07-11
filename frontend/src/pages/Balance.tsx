import React, { useState, useEffect } from 'react';
import { 
  Grid, Card, CardContent, Typography, Box, CircularProgress, 
  Alert, Table, TableBody, TableCell, TableContainer, TableHead, 
  TableRow, Paper, TextField, useTheme 
} from '@mui/material';
import { 
  AccountBalance, Savings, Assessment, Search, ShowChart 
} from '@mui/icons-material';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';

import api from '../services/api';

const COLORS = ['#8B5CF6', '#E2E8F0'];

export const Balance: React.FC = () => {
  const theme = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [summary, setSummary] = useState({ total_income: 0, total_expense: 0, current_balance: 0 });
  const [trendData, setTrendData] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchBalanceData = async () => {
    try {
      setError(null);
      
      const [sumRes, trendRes, txRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/dashboard/charts/cashflow?period=monthly'),
        api.get('/transactions/?limit=30')
      ]);

      setSummary(sumRes.data);
      
      // Calculate running balance on trend data
      let currentBal = 0;
      const formattedTrend = trendRes.data.map((item: any) => {
        currentBal += (item.income - item.expense);
        return {
          ...item,
          balance: currentBal
        };
      });
      setTrendData(formattedTrend);

      // Construct historical balance checklist
      let runningBal = sumRes.data.current_balance;
      const historyList = txRes.data.transactions.map((tx: any) => {
        const item = {
          ...tx,
          resulting_balance: runningBal
        };
        // Revert transaction impact to find previous balance
        if (tx.type === 'income') {
          runningBal -= tx.amount;
        } else {
          runningBal += tx.amount;
        }
        return item;
      });
      setHistory(historyList);

    } catch (err) {
      console.error("Failed to load balance data:", err);
      setError("Unable to connect to the backend server.");
      
      setSummary({ total_income: 0, total_expense: 0, current_balance: 0 });
      setTrendData([]);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalanceData();
  }, []);

  useEffect(() => {
    const handleTransactionChanged = () => {
      fetchBalanceData();
    };
    window.addEventListener('transaction-changed', handleTransactionChanged);
    return () => window.removeEventListener('transaction-changed', handleTransactionChanged);
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexGrow: 1, justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={50} />
      </Box>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  // Savings Metrics
  const savings = summary.total_income - summary.total_expense;
  const savingsRate = summary.total_income > 0 ? (savings / summary.total_income) * 100 : 0;
  const expenseRatio = summary.total_income > 0 ? (summary.total_expense / summary.total_income) * 100 : 0;

  // Pie chart data for savings progress towards a standard 30% savings threshold
  const savingsGoalPercent = Math.min(Math.max(savingsRate, 0), 100);
  const pieData = [
    { name: 'Saved', value: savingsGoalPercent },
    { name: 'Remaining', value: 100 - savingsGoalPercent }
  ];

  const filteredHistory = history.filter(tx => {
    const searchStr = searchQuery.toLowerCase();
    return (
      tx.category.name.toLowerCase().includes(searchStr) ||
      (tx.notes || '').toLowerCase().includes(searchStr) ||
      tx.type.toLowerCase().includes(searchStr)
    );
  });

  return (
    <Box sx={{ pb: 6 }}>
      {error && (
        <Alert severity="warning" sx={{ mb: 4, borderRadius: 3 }}>
          {error}
        </Alert>
      )}

      {/* Page Title */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountBalance sx={{ color: 'info.main', fontSize: 32 }} /> Balance Sheet
        </Typography>
      </Box>

      {/* KPI Balance Summary */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid>
          <Card sx={{ bgcolor: 'info.main', color: '#fff', height: 160 }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', justify: 'center', height: '100%' }}>
              <Typography sx={{ fontWeight: 500, opacity: 0.85 }}>Current Balance</Typography>
              <Typography variant="h3" sx={{ fontWeight: 800, mt: 1.5 }}>
                {formatCurrency(summary.current_balance)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid>
          <Card sx={{ height: 160 }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 700 }}>
                Savings Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Total Earnings</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>{formatCurrency(summary.total_income)}</Typography>
                </Grid>
                <Grid>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Total Outflow</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main' }}>{formatCurrency(summary.total_expense)}</Typography>
                </Grid>
                <Grid>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Net Savings</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'secondary.main' }}>{formatCurrency(savings)}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts & Health Check */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Trend Area Chart */}
        <Grid>
          <Card sx={{ height: 350 }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Historical Balance Trend
              </Typography>
              <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                {trendData.filter(d => d.income > 0 || d.expense > 0).length === 0 ? (
                  <Box sx={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Typography color="text.secondary" variant="body2">No balance history available.</Typography>
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="balance" stroke={theme.palette.info.main} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Balance" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Savings Progress Circle */}
        <Grid>
          <Card sx={{ height: 350 }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, alignSelf: 'flex-start' }}>
                Savings Progress
              </Typography>
              <Box sx={{ position: 'relative', width: '100%', height: 180, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={75}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                    >
                      <Cell fill={theme.palette.secondary.main} />
                      <Cell fill={theme.palette.divider} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: 'secondary.main' }}>
                    {savingsGoalPercent.toFixed(0)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Savings Rate</Typography>
                </Box>
              </Box>
              <Typography variant="body2" color="text.secondary" align="center" sx={{ fontWeight: 500, px: 2 }}>
                {savingsRate >= 30 ? '🎉 You are exceeding the recommended 30% savings threshold!' : '💡 Try to minimize shopping/food to reach a 30% savings rate.'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Financial Health Card */}
        <Grid>
          <Card sx={{ height: 350 }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 3 }}>
                Financial Health Indicators
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5, flexGrow: 1, justify: 'center' }}>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Savings Rate</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>{savingsRate.toFixed(1)}%</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Box sx={{ flexGrow: 1, height: 8, borderRadius: 4, bgcolor: savingsRate > 30 ? 'success.main' : 'warning.main' }} />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Healthy target is &gt; 30%. Your rate represents net left-over funds.
                  </Typography>
                </Box>

                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Expense-to-Income Ratio</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: expenseRatio < 70 ? 'success.main' : 'error.main' }}>{expenseRatio.toFixed(1)}%</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Box sx={{ flexGrow: 1, height: 8, borderRadius: 4, bgcolor: expenseRatio < 70 ? 'success.main' : 'error.main' }} />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Target is keeping expenses under 70% of total incoming cash.
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Balance Statement History */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Asset Timeline Ledger
            </Typography>
            <TextField
              size="small"
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{ input: { 
                startAdornment: (
                  <Search sx={{ color: 'text.secondary', mr: 1 }} />
                ),
               } }}
              sx={{ minWidth: 200 }}
            />
          </Box>

          <TableContainer component={Paper} variant="outlined" sx={{ border: 'none' }}>
            <Table aria-label="balance statement history table">
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Transaction Type</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Amount</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Resulting Balance</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">No timeline history recorded.</TableCell>
                  </TableRow>
                ) : (
                  filteredHistory.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.category.name}</TableCell>
                      <TableCell sx={{ textTransform: 'capitalize', color: row.type === 'income' ? 'success.main' : 'error.main', fontWeight: 500 }}>
                        {row.type}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: row.type === 'income' ? 'success.main' : 'error.main' }}>
                        {row.type === 'income' ? '+' : '-'}{formatCurrency(row.amount)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatCurrency(row.resulting_balance)}
                      </TableCell>
                      <TableCell>{row.notes || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};
