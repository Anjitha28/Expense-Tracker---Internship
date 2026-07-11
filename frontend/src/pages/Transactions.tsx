import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton, Chip, Pagination, CircularProgress, Alert, Tooltip,
  InputAdornment, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Grid, Divider
} from '@mui/material';
import {
  Search, FilterList, ArrowUpward, ArrowDownward, Edit, Delete,
  TrendingUp, TrendingDown, Close, FileDownload, Refresh
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface Transaction {
  id: number;
  type: 'income' | 'expense';
  date: string;
  amount: number;
  notes?: string;
  receipt_url?: string;
  category: { id: number; name: string };
  subcategory?: { id: number; name: string };
  payment_mode: { id: number; name: string };
}

export const Transactions: React.FC = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [paymentModes, setPaymentModes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPaymentMode, setFilterPaymentMode] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  });

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit,
        sort_by: sortBy,
        sort_order: sortOrder
      };
      if (search) params.search = search;
      if (filterType) params.type = filterType;
      if (filterCategory) params.category_id = filterCategory;
      if (filterPaymentMode) params.payment_mode_id = filterPaymentMode;
      if (filterStartDate) params.start_date = filterStartDate;
      if (filterEndDate) params.end_date = filterEndDate;

      const res = await api.get('/transactions/', { params });
      setTransactions(res.data.transactions || []);
      setTotal(res.data.total || 0);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch transactions:', err);
      if (!err.response) {
        setError('Cannot connect to the backend server. Please verify the FastAPI backend is running.');
      } else {
        setError(err.response?.data?.detail || 'Failed to load transactions.');
      }
      setTransactions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, sortBy, sortOrder, search, filterType, filterCategory, filterPaymentMode, filterStartDate, filterEndDate]);

  const fetchFiltersData = async () => {
    try {
      const [catRes, pmRes] = await Promise.all([
        api.get('/categories/'),
        api.get('/payment_modes/')
      ]);
      setCategories(catRes.data || []);
      setPaymentModes(pmRes.data || []);
    } catch {
      setCategories([]);
      setPaymentModes([]);
    }
  };

  useEffect(() => {
    fetchFiltersData();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Auto-refresh when a transaction is added/edited/deleted from any page
  useEffect(() => {
    const handleTransactionChanged = () => {
      fetchTransactions();
    };
    window.addEventListener('transaction-changed', handleTransactionChanged);
    return () => window.removeEventListener('transaction-changed', handleTransactionChanged);
  }, [fetchTransactions]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTransactions();
  };

  const handleClearFilters = () => {
    setSearch('');
    setFilterType('');
    setFilterCategory('');
    setFilterPaymentMode('');
    setFilterStartDate('');
    setFilterEndDate('');
    setPage(1);
  };

  const confirmDelete = (id: number) => {
    setTransactionToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!transactionToDelete) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/transactions/${transactionToDelete}`);
      setSnackbar({ open: true, message: 'Transaction deleted successfully.', severity: 'success' });
      fetchTransactions();
      window.dispatchEvent(new Event('transaction-changed'));
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.detail || 'Failed to delete transaction.', severity: 'error' });
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
      setTransactionToDelete(null);
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? <ArrowUpward fontSize="inherit" /> : <ArrowDownward fontSize="inherit" />;
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const totalPages = Math.ceil(total / limit);

  return (
    <Box sx={{ pb: 10 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Transaction Ledger
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchTransactions}
          sx={{ borderRadius: 2 }}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Search & Filter Bar */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box component="form" onSubmit={handleSearch} sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              placeholder="Search by notes, category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              size="small"
              sx={{ flexGrow: 1, minWidth: 200 }}
              slotProps={{ input: { 
                startAdornment: <InputAdornment position="start"><Search /></InputAdornment>
               } }}
            />
            <Button type="submit" variant="contained" sx={{ borderRadius: 2 }}>Search</Button>
            <Button
              variant="outlined"
              startIcon={<FilterList />}
              onClick={() => setShowFilters(!showFilters)}
              sx={{ borderRadius: 2 }}
            >
              Filters {showFilters ? '▲' : '▼'}
            </Button>
          </Box>

          {/* Advanced Filters */}
          {showFilters && (
            <Box sx={{ mt: 3 }}>
              <Divider sx={{ mb: 3 }} />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <TextField
                    select fullWidth size="small" label="Type"
                    value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="income">Income</MenuItem>
                    <MenuItem value="expense">Expense</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    select fullWidth size="small" label="Category"
                    value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
                  >
                    <MenuItem value="">All Categories</MenuItem>
                    {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    select fullWidth size="small" label="Payment Mode"
                    value={filterPaymentMode} onChange={e => { setFilterPaymentMode(e.target.value); setPage(1); }}
                  >
                    <MenuItem value="">All Modes</MenuItem>
                    {paymentModes.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <TextField
                    fullWidth size="small" type="date" label="From Date"
                    value={filterStartDate} onChange={e => { setFilterStartDate(e.target.value); setPage(1); }}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <TextField
                    fullWidth size="small" type="date" label="To Date"
                    value={filterEndDate} onChange={e => { setFilterEndDate(e.target.value); setPage(1); }}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
              </Grid>
              <Box sx={{ mt: 2 }}>
                <Button size="small" startIcon={<Close />} onClick={handleClearFilters} sx={{ color: 'text.secondary' }}>
                  Clear All Filters
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Summary Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined" sx={{ bgcolor: 'background.default' }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">Total Records</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined" sx={{ bgcolor: 'success.light' + '0F' }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">Total Income (Current View)</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>
                {formatCurrency(transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0))}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined" sx={{ bgcolor: 'error.light' + '0F' }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">Total Expense (Current View)</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main' }}>
                {formatCurrency(transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Table */}
      <Card>
        <TableContainer component={Paper} elevation={0}>
          <Table aria-label="transactions table">
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                <TableCell
                  sx={{ fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('date')}
                >
                  Date <SortIcon column="date" />
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Subcategory</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Payment Mode</TableCell>
                <TableCell
                  sx={{ fontWeight: 700, cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}
                  onClick={() => handleSort('amount')}
                >
                  Amount <SortIcon column="amount" />
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Notes</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <Box sx={{ py: 2 }}>
                      <Typography color="text.secondary" variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                        No transactions available.
                      </Typography>
                      <Typography color="text.secondary" variant="body2">
                        Start by adding your first transaction.
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map(tx => (
                  <TableRow
                    key={tx.id}
                    hover
                    sx={{ '&:last-child td': { border: 0 } }}
                  >
                    <TableCell>
                      <Chip
                        icon={tx.type === 'income' ? <TrendingUp fontSize="small" /> : <TrendingDown fontSize="small" />}
                        label={tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                        size="small"
                        sx={{
                          bgcolor: tx.type === 'income' ? 'success.light' : 'error.light',
                          color: tx.type === 'income' ? 'success.dark' : 'error.dark',
                          fontWeight: 600,
                          '& .MuiChip-icon': { color: 'inherit' }
                        }}
                      />
                    </TableCell>
                    <TableCell>{tx.date}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{tx.category.name}</TableCell>
                    <TableCell>{tx.subcategory?.name || <span style={{ color: '#94A3B8' }}>—</span>}</TableCell>
                    <TableCell>{tx.payment_mode.name}</TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 700,
                        color: tx.type === 'income' ? 'success.main' : 'error.main'
                      }}
                    >
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Tooltip title={tx.notes || ''}>
                        <span>{tx.notes || <span style={{ color: '#94A3B8' }}>—</span>}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Delete Transaction">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => confirmDelete(tx.id)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, value) => setPage(value)}
              color="primary"
              showFirstButton
              showLastButton
            />
          </Box>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Transaction</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to permanently delete this transaction? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleteLoading}
          >
            {deleteLoading ? <CircularProgress size={20} color="inherit" /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
