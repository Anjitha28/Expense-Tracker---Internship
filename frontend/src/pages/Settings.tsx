import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Button, TextField, Switch, FormControlLabel,
  Grid, Divider, List, ListItem, ListItemText, ListItemSecondaryAction,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, Snackbar, Chip, Accordion, AccordionSummary,
  AccordionDetails, MenuItem, Avatar
} from '@mui/material';
import {
  Settings as SettingsIcon, Person, Palette, Notifications,
  Category, Payment, BackupTable, Logout, Add, Delete, Edit,
  ExpandMore, DarkMode, LightMode, Download, Upload, AccountCircle
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export const Settings: React.FC = () => {
  const { user, logout, themeMode, updateUserPreferences } = useAuth();

  const [categories, setCategories] = useState<any[]>([]);
  const [paymentModes, setPaymentModes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  });

  // New Category Dialog
  const [newCatDialog, setNewCatDialog] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('expense');
  const [newCatLoading, setNewCatLoading] = useState(false);

  // New Payment Mode Dialog
  const [newPmDialog, setNewPmDialog] = useState(false);
  const [newPmName, setNewPmName] = useState('');
  const [newPmLoading, setNewPmLoading] = useState(false);

  // Delete dialogs
  const [deleteCatDialog, setDeleteCatDialog] = useState<number | null>(null);
  const [deletePmDialog, setDeletePmDialog] = useState<number | null>(null);
  const [deleteSubDialog, setDeleteSubDialog] = useState<number | null>(null);

  // New Subcategory Dialog
  const [newSubDialog, setNewSubDialog] = useState<number | null>(null); // holds category_id
  const [newSubName, setNewSubName] = useState('');
  const [newSubLoading, setNewSubLoading] = useState(false);

  // Backup
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

  // Notification toggle
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const fetchSettingsData = async () => {
    setLoading(true);
    try {
      const [catRes, pmRes, prefRes] = await Promise.all([
        api.get('/categories/'),
        api.get('/payment_modes/'),
        api.get('/settings/preferences')
      ]);
      setCategories(catRes.data || []);
      setPaymentModes(pmRes.data || []);
      setNotificationsEnabled(prefRes.data?.notifications_enabled ?? true);
      setError(null);
    } catch (err) {
      console.error('Settings fetch failed:', err);
      setError('Could not load settings from server. Some features may be limited.');
      setCategories([
        { id: 1, name: 'Salary', type: 'income' },
        { id: 8, name: 'Food', type: 'expense' },
        { id: 9, name: 'Rent', type: 'expense' }
      ]);
      setPaymentModes([
        { id: 1, name: 'Cash' }, { id: 2, name: 'UPI' }, { id: 3, name: 'Credit Card' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsData();
  }, []);

  // Theme Toggle
  const handleThemeToggle = async () => {
    const newTheme = themeMode === 'light' ? 'dark' : 'light';
    try {
      await updateUserPreferences({ theme: newTheme });
      showSnackbar(`Switched to ${newTheme} mode`);
    } catch {
      showSnackbar('Failed to update theme', 'error');
    }
  };

  // Notifications Toggle
  const handleNotificationsToggle = async () => {
    const newVal = !notificationsEnabled;
    setNotificationsEnabled(newVal);
    try {
      await api.put('/settings/preferences', { notifications_enabled: newVal });
      showSnackbar(`Notifications ${newVal ? 'enabled' : 'disabled'}`);
    } catch {
      setNotificationsEnabled(!newVal);
      showSnackbar('Failed to update notification settings', 'error');
    }
  };

  // Add Category
  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setNewCatLoading(true);
    try {
      await api.post('/categories/', { name: newCatName.trim(), type: newCatType });
      showSnackbar('Category added successfully!');
      setNewCatDialog(false);
      setNewCatName('');
      fetchSettingsData();
    } catch (err: any) {
      showSnackbar(err.response?.data?.detail || 'Failed to add category', 'error');
    } finally {
      setNewCatLoading(false);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (id: number) => {
    try {
      await api.delete(`/categories/${id}`);
      showSnackbar('Category deleted successfully!');
      setDeleteCatDialog(null);
      fetchSettingsData();
    } catch (err: any) {
      showSnackbar(err.response?.data?.detail || 'Cannot delete category — it may be in use by existing transactions.', 'error');
      setDeleteCatDialog(null);
    }
  };

  // Add Subcategory
  const handleAddSubcategory = async () => {
    if (!newSubName.trim() || !newSubDialog) return;
    setNewSubLoading(true);
    try {
      await api.post('/categories/subcategories', { name: newSubName.trim(), category_id: newSubDialog });
      showSnackbar('Subcategory added successfully!');
      setNewSubDialog(null);
      setNewSubName('');
      fetchSettingsData();
    } catch (err: any) {
      showSnackbar(err.response?.data?.detail || 'Failed to add subcategory', 'error');
    } finally {
      setNewSubLoading(false);
    }
  };

  // Delete Subcategory
  const handleDeleteSubcategory = async (id: number) => {
    try {
      await api.delete(`/categories/subcategories/${id}`);
      showSnackbar('Subcategory deleted successfully!');
      setDeleteSubDialog(null);
      fetchSettingsData();
    } catch (err: any) {
      showSnackbar(err.response?.data?.detail || 'Cannot delete subcategory — it may be in use.', 'error');
      setDeleteSubDialog(null);
    }
  };

  // Add Payment Mode
  const handleAddPaymentMode = async () => {
    if (!newPmName.trim()) return;
    setNewPmLoading(true);
    try {
      await api.post('/payment_modes/', { name: newPmName.trim() });
      showSnackbar('Payment mode added successfully!');
      setNewPmDialog(false);
      setNewPmName('');
      fetchSettingsData();
    } catch (err: any) {
      showSnackbar(err.response?.data?.detail || 'Failed to add payment mode', 'error');
    } finally {
      setNewPmLoading(false);
    }
  };

  // Delete Payment Mode
  const handleDeletePaymentMode = async (id: number) => {
    try {
      await api.delete(`/payment_modes/${id}`);
      showSnackbar('Payment mode deleted successfully!');
      setDeletePmDialog(null);
      fetchSettingsData();
    } catch (err: any) {
      showSnackbar(err.response?.data?.detail || 'Cannot delete payment mode — it may be in use.', 'error');
      setDeletePmDialog(null);
    }
  };

  // Backup
  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await api.get('/settings/backup');
      const jsonStr = JSON.stringify(res.data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aura_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showSnackbar('Backup downloaded successfully!');
    } catch {
      showSnackbar('Backup failed. Please try again.', 'error');
    } finally {
      setBackupLoading(false);
    }
  };

  // Restore
  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreLoading(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      await api.post('/settings/restore', payload);
      showSnackbar('Data restored successfully! Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      showSnackbar(err.response?.data?.detail || 'Restore failed — invalid backup file.', 'error');
    } finally {
      setRestoreLoading(false);
      e.target.value = '';
    }
  };

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={50} />
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 10, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 4, display: 'flex', alignItems: 'center', gap: 1 }}>
        <SettingsIcon sx={{ color: 'primary.main', fontSize: 32 }} />
        Settings & Preferences
      </Typography>

      {error && <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      {/* Profile Section */}
      <Accordion defaultExpanded sx={{ mb: 2, borderRadius: '12px !important', '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Person sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Profile</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
            <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: '1.5rem' }}>
              {user?.email.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {user?.email.split('@')[0]}
              </Typography>
              <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
              <Chip
                label="Active Account"
                size="small"
                color="success"
                sx={{ mt: 1 }}
              />
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Theme & Notifications */}
      <Accordion defaultExpanded sx={{ mb: 2, borderRadius: '12px !important', '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Palette sx={{ color: 'secondary.main' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Appearance & Notifications</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Application Theme</Typography>
                <Typography variant="body2" color="text.secondary">
                  Switch between light and dark mode. Your preference is saved automatically.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                startIcon={themeMode === 'light' ? <DarkMode /> : <LightMode />}
                onClick={handleThemeToggle}
                sx={{ borderRadius: 2, minWidth: 180 }}
              >
                Switch to {themeMode === 'light' ? 'Dark' : 'Light'} Mode
              </Button>
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Budget Notifications</Typography>
                <Typography variant="body2" color="text.secondary">
                  Receive alerts when monthly spending reaches 80% of income.
                </Typography>
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationsEnabled}
                    onChange={handleNotificationsToggle}
                    color="primary"
                  />
                }
                label={notificationsEnabled ? 'Enabled' : 'Disabled'}
                labelPlacement="start"
              />
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Categories Management */}
      <Accordion sx={{ mb: 2, borderRadius: '12px !important', '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Category sx={{ color: 'warning.main' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Custom Categories</Typography>
            <Chip label={categories.length} size="small" sx={{ ml: 1 }} />
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              size="small"
              onClick={() => setNewCatDialog(true)}
              sx={{ borderRadius: 2 }}
            >
              Add Category
            </Button>
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'success.main' }}>
                Income Categories ({incomeCategories.length})
              </Typography>
              <List dense>
                {incomeCategories.map(cat => (
                  <Box key={cat.id} sx={{ mb: 1 }}>
                    <ListItem sx={{ bgcolor: 'background.default', borderRadius: 2, pl: 2 }}>
                      <ListItemText
                        primary={cat.name}
                        slotProps={{ primary: { sx: { fontWeight: 600 } } }}
                      />
                      <ListItemSecondaryAction>
                        <IconButton size="small" color="primary" onClick={() => { setNewSubDialog(cat.id); setNewSubName(''); }} title="Add subcategory">
                          <Add fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => setDeleteCatDialog(cat.id)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {cat.subcategories && cat.subcategories.length > 0 && (
                      <List dense sx={{ pl: 3 }}>
                        {cat.subcategories.map((sub: any) => (
                          <ListItem key={sub.id} sx={{ py: 0.25, px: 1 }}>
                            <ListItemText
                              primary={`— ${sub.name}`}
                              slotProps={{ primary: { sx: { fontSize: '0.82rem', color: 'text.secondary' } } }}
                            />
                            <ListItemSecondaryAction>
                              <IconButton size="small" color="error" onClick={() => setDeleteSubDialog(sub.id)} title="Delete subcategory">
                                <Delete sx={{ fontSize: 14 }} />
                              </IconButton>
                            </ListItemSecondaryAction>
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </Box>
                ))}
              </List>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'error.main' }}>
                Expense Categories ({expenseCategories.length})
              </Typography>
              <List dense>
                {expenseCategories.map(cat => (
                  <Box key={cat.id} sx={{ mb: 1 }}>
                    <ListItem sx={{ bgcolor: 'background.default', borderRadius: 2, pl: 2 }}>
                      <ListItemText
                        primary={cat.name}
                        slotProps={{ primary: { sx: { fontWeight: 600 } } }}
                      />
                      <ListItemSecondaryAction>
                        <IconButton size="small" color="primary" onClick={() => { setNewSubDialog(cat.id); setNewSubName(''); }} title="Add subcategory">
                          <Add fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => setDeleteCatDialog(cat.id)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {cat.subcategories && cat.subcategories.length > 0 && (
                      <List dense sx={{ pl: 3 }}>
                        {cat.subcategories.map((sub: any) => (
                          <ListItem key={sub.id} sx={{ py: 0.25, px: 1 }}>
                            <ListItemText
                              primary={`— ${sub.name}`}
                              slotProps={{ primary: { sx: { fontSize: '0.82rem', color: 'text.secondary' } } }}
                            />
                            <ListItemSecondaryAction>
                              <IconButton size="small" color="error" onClick={() => setDeleteSubDialog(sub.id)} title="Delete subcategory">
                                <Delete sx={{ fontSize: 14 }} />
                              </IconButton>
                            </ListItemSecondaryAction>
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </Box>
                ))}
              </List>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Payment Modes Management */}
      <Accordion sx={{ mb: 2, borderRadius: '12px !important', '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Payment sx={{ color: 'info.main' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Payment Modes</Typography>
            <Chip label={paymentModes.length} size="small" sx={{ ml: 1 }} />
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              size="small"
              onClick={() => setNewPmDialog(true)}
              sx={{ borderRadius: 2 }}
            >
              Add Payment Mode
            </Button>
          </Box>
          <List dense>
            {paymentModes.map(pm => (
              <ListItem key={pm.id} sx={{ bgcolor: 'background.default', mb: 0.5, borderRadius: 2, pl: 2 }}>
                <ListItemText
                  primary={pm.name}
                  slotProps={{ primary: { sx: { fontWeight: 500 } } }}
                />
                <ListItemSecondaryAction>
                  <IconButton size="small" color="error" onClick={() => setDeletePmDialog(pm.id)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </AccordionDetails>
      </Accordion>

      {/* Backup & Restore */}
      <Accordion sx={{ mb: 2, borderRadius: '12px !important', '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <BackupTable sx={{ color: 'success.main' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Backup & Restore</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Export all your financial data as a secure JSON backup file, or restore from a previously created backup.
            Restoring will replace all existing transaction data.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={backupLoading ? <CircularProgress size={16} /> : <Download />}
              onClick={handleBackup}
              disabled={backupLoading || restoreLoading}
              color="success"
              sx={{ borderRadius: 2 }}
            >
              {backupLoading ? 'Preparing backup...' : 'Download Backup (.json)'}
            </Button>
            <Button
              variant="outlined"
              component="label"
              startIcon={restoreLoading ? <CircularProgress size={16} /> : <Upload />}
              disabled={backupLoading || restoreLoading}
              color="warning"
              sx={{ borderRadius: 2 }}
            >
              {restoreLoading ? 'Restoring...' : 'Restore from Backup'}
              <input type="file" hidden accept=".json" onChange={handleRestoreFile} />
            </Button>
          </Box>
          <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
            ⚠️ Restoring will permanently replace all current transactions, categories, and payment modes with the backup data.
          </Alert>
        </AccordionDetails>
      </Accordion>

      {/* Logout Section */}
      <Card sx={{ bgcolor: 'error.light' + '15', border: '1px solid', borderColor: 'error.light' + '40' }}>
        <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'error.main' }}>Sign Out</Typography>
            <Typography variant="body2" color="text.secondary">
              You are logged in as {user?.email}. Signing out will clear your session.
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="error"
            startIcon={<Logout />}
            onClick={logout}
            sx={{ borderRadius: 2 }}
          >
            Sign Out
          </Button>
        </CardContent>
      </Card>

      {/* Add Category Dialog */}
      <Dialog open={newCatDialog} onClose={() => setNewCatDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add New Category</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth label="Category Name" variant="outlined"
            value={newCatName} onChange={e => setNewCatName(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            select fullWidth label="Type" value={newCatType}
            onChange={e => setNewCatType(e.target.value as 'income' | 'expense')}
          >
            <MenuItem value="income">Income</MenuItem>
            <MenuItem value="expense">Expense</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNewCatDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddCategory} disabled={!newCatName.trim() || newCatLoading}>
            {newCatLoading ? <CircularProgress size={20} color="inherit" /> : 'Add Category'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Payment Mode Dialog */}
      <Dialog open={newPmDialog} onClose={() => setNewPmDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Payment Mode</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth label="Payment Mode Name" variant="outlined"
            value={newPmName} onChange={e => setNewPmName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNewPmDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddPaymentMode} disabled={!newPmName.trim() || newPmLoading}>
            {newPmLoading ? <CircularProgress size={20} color="inherit" /> : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Category Dialog */}
      <Dialog open={deleteCatDialog !== null} onClose={() => setDeleteCatDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Category</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure? Categories currently used by transactions cannot be deleted.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteCatDialog(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteCatDialog && handleDeleteCategory(deleteCatDialog)}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Payment Mode Dialog */}
      <Dialog open={deletePmDialog !== null} onClose={() => setDeletePmDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Payment Mode</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure? Payment modes currently used by transactions cannot be deleted.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeletePmDialog(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deletePmDialog && handleDeletePaymentMode(deletePmDialog)}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Subcategory Dialog */}
      <Dialog open={newSubDialog !== null} onClose={() => setNewSubDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Subcategory</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth label="Subcategory Name" variant="outlined"
            value={newSubName} onChange={e => setNewSubName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNewSubDialog(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddSubcategory} disabled={!newSubName.trim() || newSubLoading}>
            {newSubLoading ? <CircularProgress size={20} color="inherit" /> : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Subcategory Dialog */}
      <Dialog open={deleteSubDialog !== null} onClose={() => setDeleteSubDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Subcategory</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure? Subcategories in use by transactions cannot be deleted.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteSubDialog(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteSubDialog && handleDeleteSubcategory(deleteSubDialog)}>
            Delete
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
