import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Button, ButtonGroup, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  CircularProgress, Alert, Chip, Divider, LinearProgress
} from '@mui/material';
import {
  Assessment, FileDownload, PictureAsPdf, TableChart,
  TrendingUp, TrendingDown, Savings
} from '@mui/icons-material';
import api from '../services/api';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

export const Reports: React.FC = () => {
  const [period, setPeriod] = useState<Period>('monthly');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState<'pdf' | 'excel' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/summary?period=${period}`);
      setReportData(res.data);
      setError(null);
    } catch (err) {
      console.error('Failed to load report:', err);
      setError('Unable to connect to the backend.');
      setReportData({
        period,
        start_date: '',
        end_date: '',
        total_income: 0,
        total_expense: 0,
        savings: 0,
        savings_percentage: 0,
        transaction_count: 0,
        category_analysis: [],
        subcategory_analysis: [],
        payment_mode_analysis: [],
        insights: {
          highest_income_category: 'None',
          highest_income_amount: 0,
          highest_spending_category: 'None',
          highest_spending_amount: 0,
          most_frequently_used_payment_mode: 'None',
        }
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [period]);

  useEffect(() => {
    const handleTransactionChanged = () => {
      fetchReport();
    };
    window.addEventListener('transaction-changed', handleTransactionChanged);
    return () => window.removeEventListener('transaction-changed', handleTransactionChanged);
  }, [period]);

  const handleExport = async (type: 'pdf' | 'excel') => {
    setExportLoading(type);
    try {
      const endpoint = type === 'pdf' ? '/reports/export/pdf' : '/reports/export/excel';
      const mimeType = type === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const extension = type === 'pdf' ? 'pdf' : 'xlsx';

      const res = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: mimeType }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `expense_report_${new Date().toISOString().split('T')[0]}.${extension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(`Export ${type} failed:`, err);
      alert(`Export failed. Please ensure the backend server is running.`);
    } finally {
      setExportLoading(null);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const periodLabel: Record<Period, string> = {
    daily: 'Today',
    weekly: 'This Week',
    monthly: 'This Month',
    yearly: 'This Year'
  };

  return (
    <Box sx={{ pb: 10 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Assessment sx={{ color: 'primary.main', fontSize: 32 }} />
          Financial Reports
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={exportLoading === 'excel' ? <CircularProgress size={16} /> : <TableChart />}
            onClick={() => handleExport('excel')}
            disabled={exportLoading !== null}
            sx={{ borderRadius: 2, color: 'success.main', borderColor: 'success.main', '&:hover': { bgcolor: 'success.light' + '1A' } }}
          >
            Export Excel
          </Button>
          <Button
            variant="outlined"
            startIcon={exportLoading === 'pdf' ? <CircularProgress size={16} /> : <PictureAsPdf />}
            onClick={() => handleExport('pdf')}
            disabled={exportLoading !== null}
            sx={{ borderRadius: 2, color: 'error.main', borderColor: 'error.main', '&:hover': { bgcolor: 'error.light' + '1A' } }}
          >
            Export PDF
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      {/* Period Selector */}
      <Card sx={{ mb: 4, py: 1 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Report Period: <Chip label={periodLabel[period]} color="primary" size="small" sx={{ ml: 1 }} />
            </Typography>
            <ButtonGroup variant="outlined" sx={{ boxShadow: 'none' }}>
              {(['daily', 'weekly', 'monthly', 'yearly'] as Period[]).map(p => (
                <Button
                  key={p}
                  onClick={() => setPeriod(p)}
                  variant={period === p ? 'contained' : 'outlined'}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Button>
              ))}
            </ButtonGroup>
          </Box>
        </CardContent>
      </Card>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress size={50} />
        </Box>
      ) : reportData && (
        <>
          {/* KPI Summary Cards */}
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ borderTop: '4px solid', borderColor: 'success.main' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <TrendingUp sx={{ color: 'success.main' }} />
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Total Income</Typography>
                  </Box>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: 'success.main' }}>
                    {formatCurrency(reportData.total_income)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ borderTop: '4px solid', borderColor: 'error.main' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <TrendingDown sx={{ color: 'error.main' }} />
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Total Expense</Typography>
                  </Box>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: 'error.main' }}>
                    {formatCurrency(reportData.total_expense)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ borderTop: '4px solid', borderColor: 'secondary.main' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Savings sx={{ color: 'secondary.main' }} />
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Net Savings</Typography>
                  </Box>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: 'secondary.main' }}>
                    {formatCurrency(reportData.savings)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ borderTop: '4px solid', borderColor: 'info.main' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Assessment sx={{ color: 'info.main' }} />
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>Savings Rate</Typography>
                  </Box>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: 'info.main' }}>
                    {reportData.savings_percentage.toFixed(1)}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Insights Panel */}
          {reportData.insights && (
            <Card sx={{ mb: 4, background: 'linear-gradient(135deg, #1E3A8A11 0%, #8B5CF611 100%)' }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>📊 Key Insights — {periodLabel[period]}</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Highest Income Category</Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'success.main' }}>
                        {reportData.insights.highest_income_category} ({formatCurrency(reportData.insights.highest_income_amount)})
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Highest Spending Category</Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'error.main' }}>
                        {reportData.insights.highest_spending_category} ({formatCurrency(reportData.insights.highest_spending_amount)})
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Most Used Payment Method</Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {reportData.insights.most_frequently_used_payment_mode}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Total Transactions</Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {reportData.transaction_count} transactions
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* Analysis Tables */}
          <Grid container spacing={3}>
            {/* Category Analysis */}
            <Grid>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Category Analysis</Typography>
                  {reportData.category_analysis?.length === 0 ? (
                    <Typography color="text.secondary">No data for this period.</Typography>
                  ) : (
                    <>
                      {reportData.category_analysis?.map((item: any) => {
                        const total = item.type === 'income' ? reportData.total_income : reportData.total_expense;
                        const pct = total > 0 ? (item.amount / total) * 100 : 0;
                        return (
                          <Box key={`${item.category}-${item.type}`} sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip
                                  label={item.type}
                                  size="small"
                                  sx={{
                                    bgcolor: item.type === 'income' ? 'success.light' : 'error.light',
                                    color: item.type === 'income' ? 'success.dark' : 'error.dark',
                                    fontSize: '0.65rem', height: 18
                                  }}
                                />
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.category}</Typography>
                              </Box>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatCurrency(item.amount)}</Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={pct}
                              color={item.type === 'income' ? 'success' : 'error'}
                              sx={{ height: 5, borderRadius: 3 }}
                            />
                          </Box>
                        );
                      })}
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Payment Mode Analysis */}
            <Grid>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Payment Mode Analysis</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Payment Mode</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Amount</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Share</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {reportData.payment_mode_analysis?.map((item: any) => {
                          const grandTotal = reportData.total_income + reportData.total_expense;
                          const pct = grandTotal > 0 ? (item.amount / grandTotal) * 100 : 0;
                          return (
                            <TableRow key={item.payment_mode}>
                              <TableCell>{item.payment_mode}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>{formatCurrency(item.amount)}</TableCell>
                              <TableCell align="right">{pct.toFixed(1)}%</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Subcategory Breakdown */}
            {reportData.subcategory_analysis?.length > 0 && (
              <Grid>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Subcategory Breakdown</Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Subcategory</TableCell>
                            <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Amount</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {reportData.subcategory_analysis.map((item: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell>{item.category}</TableCell>
                              <TableCell>{item.subcategory}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>{formatCurrency(item.amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </>
      )}
    </Box>
  );
};
