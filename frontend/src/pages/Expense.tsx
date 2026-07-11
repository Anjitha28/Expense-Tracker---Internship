import React, { useState, useEffect } from 'react';
import { 
  Grid, Card, CardContent, Typography, Box, Button, ButtonGroup, 
  CircularProgress, Alert, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, TextField, LinearProgress
} from '@mui/material';
import { 
  TrendingDown, CalendarToday, Category as CatIcon, Payment as PmIcon, 
  Search, ArrowUpward, ArrowDownward 
} from '@mui/icons-material';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer 
} from 'recharts';

import api from '../services/api';

export const Expense: React.FC = () => {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [summary, setSummary] = useState<any>({ today: 0, this_week: 0, this_month: 0, this_year: 0 });
  const [report, setReport] = useState<any>(null);
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Table state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchExpenseData = async () => {
    try {
      setError(null);
      
      // 1. Fetch report summary (today, week, month, year)
      const reportRes = await api.get(`/reports/summary?period=${period}`);
      setReport(reportRes.data);

      // Fetch trend data
      const trendRes = await api.get(`/dashboard/charts/cashflow?period=${period}`);
      setTrendData(trendRes.data);

      // Aggregates for Today, Week, Month, Year
      const [todayRes, weekRes, monthRes, yearRes] = await Promise.all([
        api.get('/reports/summary?period=daily'),
        api.get('/reports/summary?period=weekly'),
        api.get('/reports/summary?period=monthly'),
        api.get('/reports/summary?period=yearly')
      ]);

      setSummary({
        today: todayRes.data.total_expense,
        this_week: weekRes.data.total_expense,
        this_month: monthRes.data.total_expense,
        this_year: yearRes.data.total_expense
      });

      // 2. Fetch recent transactions
      const txRes = await api.get(`/transactions/?type=expense&limit=20`);
      setRecentTx(txRes.data.transactions);
      
    } catch (err) {
      console.error("Failed to load expense data:", err);
      setError("Unable to connect to the backend server.");
      
      setSummary({ today: 0, this_week: 0, this_month: 0, this_year: 0 });
      setReport({
        total_expense: 0,
        category_analysis: [],
        subcategory_analysis: [],
        payment_mode_analysis: [],
        insights: {
          highest_spending_category: 'None',
          highest_spending_amount: 0,
          most_frequently_used_payment_mode: 'None'
        }
      });
      setRecentTx([]);
      setTrendData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenseData();
  }, [period]);

  useEffect(() => {
    const handleTransactionChanged = () => {
      fetchExpenseData();
    };
    window.addEventListener('transaction-changed', handleTransactionChanged);
    return () => window.removeEventListener('transaction-changed', handleTransactionChanged);
  }, [period]);

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

  // Searching, sorting
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const filteredTx = recentTx
    .filter(tx => {
      const searchStr = searchQuery.toLowerCase();
      return (
        tx.category.name.toLowerCase().includes(searchStr) ||
        (tx.subcategory?.name || '').toLowerCase().includes(searchStr) ||
        (tx.notes || '').toLowerCase().includes(searchStr) ||
        tx.payment_mode.name.toLowerCase().includes(searchStr)
      );
    })
    .sort((a, b) => {
      let valA: any = a[sortBy] || '';
      let valB: any = b[sortBy] || '';

      if (sortBy === 'category') {
        valA = a.category.name;
        valB = b.category.name;
      } else if (sortBy === 'payment_mode') {
        valA = a.payment_mode.name;
        valB = b.payment_mode.name;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  return (
    <Box sx={{ pb: 10 }}>
      {error && (
        <Alert severity="warning" sx={{ mb: 4, borderRadius: 3 }}>
          {error}
        </Alert>
      )}

      {/* Title & Toggle */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', mb: 4, gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingDown sx={{ color: 'error.main', fontSize: 32 }} /> Expense Analytics
        </Typography>
        <ButtonGroup variant="contained" aria-label="outlined primary button group" sx={{ boxShadow: 'none' }}>
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(p => (
            <Button
              key={p}
              onClick={() => setPeriod(p)}
              sx={{
                bgcolor: period === p ? 'primary.main' : 'background.paper',
                color: period === p ? '#fff' : 'text.primary',
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': {
                  bgcolor: period === p ? 'primary.dark' : 'background.default',
                }
              }}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Button>
          ))}
        </ButtonGroup>
      </Box>

      {/* Expense Summary Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { label: 'Today', amount: summary.today },
          { label: 'This Week', amount: summary.this_week },
          { label: 'This Month', amount: summary.this_month },
          { label: 'This Year', amount: summary.this_year }
        ].map(item => (
          <Grid size={{xs: 6, sm: 3}} key={item.label}>
            <Card sx={{ bgcolor: 'error.light' + '0F', border: '1px solid', borderColor: 'error.light' + '33' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography color="text.secondary" variant="caption" sx={{ fontWeight: 600 }}>{item.label}</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'error.main', mt: 0.5 }}>
                  {formatCurrency(item.amount)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Main Charts & Analysis */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Trend Area Chart */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card sx={{ height: { xs: 280, sm: 320 } }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                Expense Trend
              </Typography>
              <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                {trendData.length === 0 || trendData.every((item: any) => Number(item.expense) === 0) ? (
                  <Box sx={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Typography color="text.secondary" variant="body2">No expense data available.</Typography>
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(val: any) => [`$${Number(val).toLocaleString()}`, "Expense"]} />
                      <Bar dataKey="expense" fill="#EF4444" radius={[4, 4, 0, 0]} name="Expense" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Insights Card */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ height: { xs: 'auto', lg: 320 }, display: 'flex', flexDirection: 'column' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 3 }}>
                Expense Insights
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <AvatarBox color="error.light" iconColor="error.main" icon={<CatIcon />} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">Highest Spending Category</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {report?.insights?.highest_spending_category || 'Rent'}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <AvatarBox color="info.light" iconColor="info.main" icon={<PmIcon />} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">Most Used Payment Method</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {report?.insights?.most_frequently_used_payment_mode || 'Credit Card'}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <AvatarBox color="warning.light" iconColor="warning.main" icon={<CalendarToday />} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">Monthly Savings Rate</Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'success.main' }}>
                      42.2% net savings
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Aggregators Segment (Category, Subcategory, Payment Mode distributions) */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid>
          <Card sx={{ height: 320 }}>
            <CardContent sx={{ height: '100%', overflowY: 'auto' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                Category Breakdown
              </Typography>
              {report?.category_analysis?.map((item: any) => (
                <Box key={item.category} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{item.category}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatCurrency(item.amount)}</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={item.percentage || 0} color="error" sx={{ height: 6, borderRadius: 3 }} />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        <Grid>
          <Card sx={{ height: 320 }}>
            <CardContent sx={{ height: '100%', overflowY: 'auto' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                Subcategory Breakdown
              </Typography>
              {report?.subcategory_analysis?.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No subcategory records found.</Typography>
              ) : (
                report?.subcategory_analysis?.map((item: any) => (
                  <Box key={item.subcategory} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.subcategory}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.category}</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, alignSelf: 'center' }}>
                      {formatCurrency(item.amount)}
                    </Typography>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid>
          <Card sx={{ height: 320 }}>
            <CardContent sx={{ height: '100%', overflowY: 'auto' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                Payment Method Breakdown
              </Typography>
              {report?.payment_mode_analysis?.map((item: any) => (
                <Box key={item.payment_mode} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{item.payment_mode}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatCurrency(item.amount)}</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={((item.amount / report.total_expense) * 100) || 0} color="primary" sx={{ height: 6, borderRadius: 3 }} />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Ledger List */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Recent Expense Ledger
            </Typography>
            <TextField
              size="small"
              placeholder="Search expenses..."
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
            <Table aria-label="recent expense transactions">
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  <TableCell onClick={() => handleSort('date')} sx={{ fontWeight: 700, cursor: 'pointer' }}>
                    Date {sortBy === 'date' && (sortOrder === 'asc' ? <ArrowUpward fontSize="inherit" /> : <ArrowDownward fontSize="inherit" />)}
                  </TableCell>
                  <TableCell onClick={() => handleSort('category')} sx={{ fontWeight: 700, cursor: 'pointer' }}>
                    Category {sortBy === 'category' && (sortOrder === 'asc' ? <ArrowUpward fontSize="inherit" /> : <ArrowDownward fontSize="inherit" />)}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Subcategory</TableCell>
                  <TableCell onClick={() => handleSort('payment_mode')} sx={{ fontWeight: 700, cursor: 'pointer' }}>
                    Payment Mode {sortBy === 'payment_mode' && (sortOrder === 'asc' ? <ArrowUpward fontSize="inherit" /> : <ArrowDownward fontSize="inherit" />)}
                  </TableCell>
                  <TableCell onClick={() => handleSort('amount')} sx={{ fontWeight: 700, cursor: 'pointer', textAlign: 'right' }}>
                    Amount {sortBy === 'amount' && (sortOrder === 'asc' ? <ArrowUpward fontSize="inherit" /> : <ArrowDownward fontSize="inherit" />)}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTx.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">No transactions match the filter criteria.</TableCell>
                  </TableRow>
                ) : (
                  filteredTx.map((tx) => (
                    <TableRow key={tx.id} sx={{ '&:last-child cell': { border: 0 } }}>
                      <TableCell>{tx.date}</TableCell>
                      <TableCell>{tx.category.name}</TableCell>
                      <TableCell>{tx.subcategory?.name || '-'}</TableCell>
                      <TableCell>{tx.payment_mode.name}</TableCell>
                      <TableCell align="right" sx={{ color: 'error.main', fontWeight: 600 }}>
                        {formatCurrency(tx.amount)}
                      </TableCell>
                      <TableCell>{tx.notes || '-'}</TableCell>
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

const AvatarBox: React.FC<{ color: string; iconColor: string; icon: React.ReactNode }> = ({ color, iconColor, icon }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: color,
      color: iconColor,
      borderRadius: '50%',
      width: 42,
      height: 42,
    }}
  >
    {icon}
  </Box>
);
