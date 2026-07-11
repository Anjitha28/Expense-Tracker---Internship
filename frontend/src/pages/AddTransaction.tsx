import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  Container, Box, Card, CardContent, Typography, Button, TextField,
  MenuItem, Grid, Divider, CircularProgress, Alert, Snackbar, InputAdornment
} from '@mui/material';
import { 
  ArrowBack, AttachMoney, CalendarToday, Category as CategoryIcon, 
  Payment as PaymentIcon, Note, CloudUpload, Restaurant, Coffee, 
  DirectionsCar, ShoppingBag, TrendingUp, TrendingDown 
} from '@mui/icons-material';

import api from '../services/api';

const schema = yup.object().shape({
  type: yup.string().oneOf(['income', 'expense']).required('Transaction type is required'),
  amount: yup.number()
    .typeError('Amount must be a number')
    .positive('Amount must be greater than zero')
    .required('Amount is required'),
  date: yup.string().required('Date is required'),
  category_id: yup.number().typeError('Please select a category').required('Category is required'),
  subcategory_id: yup.number().nullable().transform((value, originalValue) => originalValue === '' ? null : value),
  payment_mode_id: yup.number().typeError('Please select a payment mode').required('Payment mode is required'),
  notes: yup.string().optional(),
});

interface FormData {
  type: 'income' | 'expense';
  amount: number;
  date: string;
  category_id: number;
  subcategory_id: number | null;
  payment_mode_id: number;
  notes?: string;
}



export const AddTransaction: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Prefill state from Dashboard Quick Shortcuts
  const prefilledType = location.state?.prefilledType as 'income' | 'expense' | undefined;
  const prefilledCategoryName = location.state?.prefilledCategory as string | undefined;

  const [step, setStep] = useState<1 | 2>(prefilledType ? 2 : 1);
  const [txType, setTxType] = useState<'income' | 'expense'>(prefilledType || 'expense');
  
  const [categories, setCategories] = useState<any[]>([]);
  const [paymentModes, setPaymentModes] = useState<any[]>([]);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  
  const [alertInfo, setAlertInfo] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  // React Hook Form Configuration
  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<any>({
    resolver: yupResolver(schema),
    defaultValues: {
      type: txType,
      date: new Date().toISOString().split('T')[0], // Defaults to today's date
      amount: undefined,
      category_id: undefined,
      subcategory_id: null,
      payment_mode_id: undefined,
      notes: '',
    }
  });

  const selectedCategoryId = watch('category_id');

  // Load Categories & Payment Modes from Database
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, pmRes] = await Promise.all([
          api.get('/categories/'),
          api.get('/payment_modes/')
        ]);
        setCategories(catRes.data);
        setPaymentModes(pmRes.data);
      } catch (err) {
        console.error("Failed to load categories/payment modes from backend:", err);
        setCategories([]);
        setPaymentModes([]);
      }
    };
    fetchData();
  }, []);

  // Update form type value when state changes
  useEffect(() => {
    setValue('type', txType);
  }, [txType, setValue]);

  // Handle prefilled categories (Vite navigation state matching)
  useEffect(() => {
    if (categories.length > 0 && prefilledCategoryName) {
      const match = categories.find(
        c => c.name.toLowerCase() === prefilledCategoryName.toLowerCase() && c.type === txType
      );
      if (match) {
        setValue('category_id', match.id);
      }
    }
  }, [categories, prefilledCategoryName, txType, setValue]);

  // Retrieve current categories based on chosen type
  const filteredCategories = categories.filter(c => c.type === txType);

  // Retrieve current subcategories based on chosen Category
  const selectedCategory = categories.find(c => c.id === Number(selectedCategoryId));
  const subcategories = selectedCategory?.subcategories || [];

  // Suggest prefill options based on amount entered
  const handleAmountBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const amountVal = parseFloat(e.target.value);
    if (!amountVal || isNaN(amountVal)) return;

    try {
      const res = await api.get(`/dashboard/suggestions?amount=${amountVal}`);
      if (res.data.suggested) {
        // Trigger alert prompting confirmation
        const suggestion = res.data;
        const confirm = window.confirm(
          `AURA Smart Suggestion: ${suggestion.message}\n\nDo you want to apply these details?`
        );
        if (confirm) {
          setValue('category_id', suggestion.category_id);
          // Wait a tick for Category rendering, then fill subcategory & payment mode
          setTimeout(() => {
            setValue('subcategory_id', suggestion.subcategory_id);
            setValue('payment_mode_id', suggestion.payment_mode_id);
            if (suggestion.notes) setValue('notes', suggestion.notes);
          }, 100);
        }
      }
    } catch (err) {
      console.warn("Smart suggestion fetch failed:", err);
    }
  };

  // File Upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = new FormData();
    data.append('file', file);

    setUploadingReceipt(true);
    setBackendError(null);
    try {
      const res = await api.post('/transactions/upload', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setReceiptUrl(res.data.receipt_url);
      setAlertInfo({ type: 'success', message: 'Receipt uploaded and validated successfully!' });
    } catch (err: any) {
      console.error("Upload error:", err);
      setBackendError(err.response?.data?.detail || 'File upload failed. Ensure size is < 5MB and format is PDF/PNG/JPG.');
    } finally {
      setUploadingReceipt(false);
    }
  };

  // Submit Handler
  const onSubmit = async (data: FormData) => {
    setSaveLoading(true);
    setBackendError(null);
    
    // Construct final transaction data
    const transactionData = {
      type: data.type,
      amount: data.amount,
      date: data.date,
      category_id: data.category_id,
      subcategory_id: data.subcategory_id,
      payment_mode_id: data.payment_mode_id,
      notes: data.notes,
      receipt_url: receiptUrl // Bind uploaded path
    };

    try {
      const res = await api.post('/transactions/', transactionData);
      setAlertInfo({ 
        type: 'success', 
        message: `Transaction saved successfully! ID: ${res.data.id}` 
      });
      
      // Notify all pages that data has changed so they auto-refresh
      window.dispatchEvent(new Event('transaction-changed'));
      
      // Auto-redirect to transactions page after delay
      setTimeout(() => {
        navigate('/transactions');
      }, 1200);
    } catch (err: any) {
      console.error("Save failed:", err);
      setBackendError(err.response?.data?.detail || 'An error occurred while saving. Please ensure all values are correct.');
      setSaveLoading(false);
    }
  };

  const handleShortcutClick = (categoryName: string) => {
    const match = filteredCategories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    if (match) {
      setValue('category_id', match.id);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Back Button */}
      <Box sx={{ mb: 3 }}>
        <Button 
          startIcon={<ArrowBack />} 
          onClick={() => step === 2 && !prefilledType ? setStep(1) : navigate(-1)}
          sx={{ color: 'text.secondary' }}
        >
          {step === 2 && !prefilledType ? 'Back to Selection' : 'Go Back'}
        </Button>
      </Box>

      {backendError && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>
          {backendError}
        </Alert>
      )}

      {/* Step 1: Type Selection */}
      {step === 1 && (
        <Card sx={{ textAlign: 'center', py: 4 }}>
          <CardContent>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1 }}>
              What would you like to add?
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
              Select a transaction type to display input forms
            </Typography>

            <Grid container spacing={4} sx={{ justifyContent: 'center' }}>
              <Grid>
                <Card 
                  onClick={() => { setTxType('income'); setStep(2); }}
                  sx={{ 
                    cursor: 'pointer',
                    border: '2px solid transparent',
                    transition: 'all 0.2s',
                    '&:hover': { 
                      borderColor: 'success.main',
                      transform: 'scale(1.03)',
                      boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
                    }
                  }}
                >
                  <CardContent sx={{ py: 4 }}>
                    <TrendingUp sx={{ fontSize: 50, color: 'success.main', mb: 2 }} />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>Income</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Salary, freelance earnings, investments, or gifts
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid>
                <Card 
                  onClick={() => { setTxType('expense'); setStep(2); }}
                  sx={{ 
                    cursor: 'pointer',
                    border: '2px solid transparent',
                    transition: 'all 0.2s',
                    '&:hover': { 
                      borderColor: 'error.main',
                      transform: 'scale(1.03)',
                      boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
                    }
                  }}
                >
                  <CardContent sx={{ py: 4 }}>
                    <TrendingDown sx={{ fontSize: 50, color: 'error.main', mb: 2 }} />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>Expense</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Food, bills, transport, shopping, or rent
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Input Details Form */}
      {step === 2 && (
        <Card>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              {txType === 'income' ? (
                <>
                  <TrendingUp sx={{ color: 'success.main' }} /> Record Income
                </>
              ) : (
                <>
                  <TrendingDown sx={{ color: 'error.main' }} /> Record Expense
                </>
              )}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Enter financial details. Smart defaults and suggestions are enabled.
            </Typography>
            <Divider sx={{ mb: 4 }} />

            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
              <Grid container spacing={3}>
                
                {/* Amount */}
                <Grid>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Amount *
                  </Typography>
                  <TextField
                    required
                    fullWidth
                    placeholder="0.00"
                    {...register('amount')}
                    onBlur={handleAmountBlur}
                    error={!!errors.amount}
                    helperText={errors.amount?.message as string}
                    slotProps={{ input: { 
                      startAdornment: (
                        <InputAdornment position="start">
                          <AttachMoney />
                        </InputAdornment>
                      ),
                     } }}
                  />
                </Grid>

                {/* Date */}
                <Grid>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Date *
                  </Typography>
                  <TextField
                    required
                    fullWidth
                    type="date"
                    {...register('date')}
                    error={!!errors.date}
                    helperText={errors.date?.message as string}
                    slotProps={{ input: { 
                      startAdornment: (
                        <InputAdornment position="start">
                          <CalendarToday />
                        </InputAdornment>
                      ),
                     } }}
                  />
                </Grid>

                {/* Category Shortcuts */}
                {filteredCategories.length > 0 && (
                  <Grid>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
                      Quick Select Category:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {filteredCategories.slice(0, 5).map((cat) => (
                        <Button
                          key={cat.id}
                          variant="outlined"
                          size="small"
                          onClick={() => handleShortcutClick(cat.name)}
                          sx={{ borderRadius: 8, textTransform: 'capitalize' }}
                        >
                          {cat.name}
                        </Button>
                      ))}
                    </Box>
                  </Grid>
                )}

                {/* Category Selection */}
                <Grid>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Category *
                  </Typography>
                  <Controller
                    name="category_id"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        select
                        fullWidth
                        error={!!errors.category_id}
                        helperText={errors.category_id?.message as string}
                        {...field}
                        value={field.value || ''}
                        slotProps={{ input: { 
                          startAdornment: (
                            <InputAdornment position="start">
                              <CategoryIcon />
                            </InputAdornment>
                          ),
                         } }}
                      >
                        {filteredCategories.map((option) => (
                          <MenuItem key={option.id} value={option.id}>
                            {option.name}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                </Grid>

                {/* Subcategory Selection */}
                <Grid>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Subcategory
                  </Typography>
                  <Controller
                    name="subcategory_id"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        select
                        fullWidth
                        disabled={subcategories.length === 0}
                        error={!!errors.subcategory_id}
                        helperText={errors.subcategory_id?.message as string}
                        {...field}
                        value={field.value || ''}
                        slotProps={{ input: { 
                          startAdornment: (
                            <InputAdornment position="start">
                              <CategoryIcon />
                            </InputAdornment>
                          ),
                         } }}
                      >
                        <MenuItem value=""><em>None</em></MenuItem>
                        {subcategories.map((option: any) => (
                          <MenuItem key={option.id} value={option.id}>
                            {option.name}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                </Grid>

                {/* Payment Mode */}
                <Grid>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Payment Mode *
                  </Typography>
                  <Controller
                    name="payment_mode_id"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        select
                        fullWidth
                        error={!!errors.payment_mode_id}
                        helperText={errors.payment_mode_id?.message as string}
                        {...field}
                        value={field.value || ''}
                        slotProps={{ input: { 
                          startAdornment: (
                            <InputAdornment position="start">
                              <PaymentIcon />
                            </InputAdornment>
                          ),
                         } }}
                      >
                        {paymentModes.map((option) => (
                          <MenuItem key={option.id} value={option.id}>
                            {option.name}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                </Grid>

                {/* Receipt Upload */}
                <Grid>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Receipt/Invoice Upload (Optional)
                  </Typography>
                  <Button
                    variant="outlined"
                    component="label"
                    fullWidth
                    disabled={uploadingReceipt}
                    startIcon={uploadingReceipt ? <CircularProgress size={20} /> : <CloudUpload />}
                    sx={{ py: 1.5, borderStyle: 'dashed', borderRadius: 2 }}
                  >
                    {uploadingReceipt ? 'Validating...' : receiptUrl ? 'Change Receipt' : 'Upload Receipt'}
                    <input
                      type="file"
                      hidden
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      onChange={handleFileUpload}
                    />
                  </Button>
                  {receiptUrl && (
                    <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 1, fontWeight: 500 }}>
                      Receipt linked successfully ({receiptUrl.split('/').pop()})
                    </Typography>
                  )}
                </Grid>

                {/* Notes */}
                <Grid>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Notes
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="Enter details or descriptions (optional)"
                    {...register('notes')}
                    slotProps={{ input: { 
                      startAdornment: (
                        <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                          <Note />
                        </InputAdornment>
                      ),
                     } }}
                  />
                </Grid>
              </Grid>

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4 }}>
                <Button 
                  variant="outlined" 
                  onClick={() => prefilledType ? navigate(-1) : setStep(1)}
                  disabled={saveLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={saveLoading}
                  sx={{
                    px: 4,
                    bgcolor: txType === 'income' ? 'success.main' : 'primary.main',
                    '&:hover': {
                      bgcolor: txType === 'income' ? 'success.dark' : 'primary.dark'
                    }
                  }}
                >
                  {saveLoading ? <CircularProgress size={24} color="inherit" /> : 'Save Transaction'}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Snackbar Alert */}
      <Snackbar 
        open={!!alertInfo} 
        autoHideDuration={4000} 
        onClose={() => setAlertInfo(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {alertInfo ? (
          <Alert severity={alertInfo.type} sx={{ width: '100%' }}>
            {alertInfo.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Container>
  );
};
