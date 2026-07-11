import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  Container, Box, Card, CardContent, Typography, TextField, Button,
  Link, InputAdornment, IconButton, Alert, CircularProgress
} from '@mui/material';
import { Email, Lock, Visibility, VisibilityOff, AccountBalanceWallet } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const schema = yup.object().shape({
  email: yup.string().email('Please enter a valid email').required('Email is required'),
  password: yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
  confirmPassword: yup.string()
    .oneOf([yup.ref('password')], 'Passwords must match')
    .required('Please confirm your password'),
});

type FormData = yup.InferType<typeof schema>;

export const SignUp: React.FC = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<any>({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await signUp(data.email, data.password);
      navigate('/');
    } catch (err: any) {
      if (!err.response) {
        setErrorMsg('Cannot connect to the backend server. Please verify that the FastAPI backend is running on http://127.0.0.1:5000.');
      } else {
        setErrorMsg(err.response?.data?.detail || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)',
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '50%',
              p: 2,
              mb: 2,
              backdropFilter: 'blur(10px)',
            }}
          >
            <AccountBalanceWallet sx={{ fontSize: 40, color: '#3B82F6' }} />
          </Box>
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: '#FFFFFF', fontWeight: 700, letterSpacing: '-0.5px' }}>
            AURA Finance
          </Typography>
          <Typography variant="body1" sx={{ color: '#94A3B8' }}>
            Start Managing Your Money Smarter Today
          </Typography>
        </Box>

        <Card sx={{ backdropFilter: 'blur(16px)', backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 600, color: '#0F172A', mb: 3 }}>
              Create Your Account
            </Typography>

            {errorMsg && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {errorMsg}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email Address"
                autoComplete="email"
                {...register('email')}
                error={!!errors.email}
                helperText={errors.email?.message as string}
                slotProps={{ input: { 
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email sx={{ color: '#64748B' }} />
                    </InputAdornment>
                  ),
                 } }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  }
                }}
              />

              <TextField
                margin="normal"
                required
                fullWidth
                id="password"
                label="Password (min 8 characters)"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                {...register('password')}
                error={!!errors.password}
                helperText={errors.password?.message as string}
                slotProps={{ input: { 
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock sx={{ color: '#64748B' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                 } }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  }
                }}
              />

              <TextField
                margin="normal"
                required
                fullWidth
                id="confirmPassword"
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                {...register('confirmPassword')}
                error={!!errors.confirmPassword}
                helperText={errors.confirmPassword?.message as string}
                slotProps={{ input: { 
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock sx={{ color: '#64748B' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        edge="end"
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                 } }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  }
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                sx={{
                  mt: 4,
                  mb: 2,
                  py: 1.5,
                  fontSize: '1rem',
                  fontWeight: 600,
                  backgroundColor: '#1E3A8A',
                  '&:hover': {
                    backgroundColor: '#172554',
                  },
                }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Get Started'}
              </Button>

              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Typography variant="body2" sx={{ color: '#64748B' }}>
                  Already have an account?{' '}
                  <Link component={RouterLink} to="/login" sx={{ color: '#3B82F6', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                    Sign In
                  </Link>
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};
