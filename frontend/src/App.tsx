import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ThemeProvider, CssBaseline, Box, Drawer, AppBar, Toolbar, List, Typography,
  Divider, IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Avatar, Fab, useMediaQuery, useTheme
} from '@mui/material';
import {
  Menu as MenuIcon, Dashboard as DashboardIcon, ListAlt as LedgerIcon,
  TrendingUp as IncomeIcon, TrendingDown as ExpenseIcon,
  Assessment as ReportsIcon, Settings as SettingsIcon,
  ExitToApp as LogoutIcon, Add as AddIcon, AccountCircle
} from '@mui/icons-material';

import { AuthProvider, useAuth } from './context/AuthContext';
import { getTheme } from './theme';
import { Login } from './pages/Login';
import { SignUp } from './pages/SignUp';
import { Dashboard } from './pages/Dashboard';
import { AddTransaction } from './pages/AddTransaction';
import { Income } from './pages/Income';
import { Expense } from './pages/Expense';
import { Reports } from './pages/Reports';
import { Transactions } from './pages/Transactions';
import { Settings } from './pages/Settings';

const drawerWidth = 240;

// Protected Route Guard Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: 'background.default' }}>
        <Typography variant="h6" color="text.secondary">Loading Aura...</Typography>
      </Box>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Page title helper
const getPageTitle = (pathname: string): string => {
  const map: Record<string, string> = {
    '/': 'Dashboard',
    '/transactions': 'Transactions',
    '/income': 'Income Analytics',
    '/expense': 'Expense Analytics',
    '/reports': 'Reports',
    '/settings': 'Settings',
    '/add-transaction': 'Add Transaction',
  };
  return map[pathname] || 'Aura';
};

// Layout with Sidebar and Navbar
const MainLayout: React.FC = () => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const showFab = location.pathname !== '/add-transaction';

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Transactions', icon: <LedgerIcon />, path: '/transactions' },
    { text: 'Income Analytics', icon: <IncomeIcon />, path: '/income' },
    { text: 'Expense Analytics', icon: <ExpenseIcon />, path: '/expense' },
    { text: 'Reports', icon: <ReportsIcon />, path: '/reports' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ];

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ justifyContent: 'center', py: 2, minHeight: { xs: 56, sm: 64 } }}>
        <Typography
          variant="h5"
          sx={{ fontWeight: 800, color: theme.palette.primary.main, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <Box component="span" sx={{ bgcolor: 'primary.main', color: '#fff', px: 1, py: 0.5, borderRadius: 2, fontSize: '1.1rem' }}>A</Box>
          Aura
        </Typography>
      </Toolbar>
      <Divider />

      {/* User Quick Info */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 36, height: 36 }}>
          <AccountCircle fontSize="small" />
        </Avatar>
        <Box sx={{ overflow: 'hidden', flexGrow: 1 }}>
          <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700 }}>
            {user?.email.split('@')[0]}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontSize: '0.7rem' }}>
            {user?.email}
          </Typography>
        </Box>
      </Box>
      <Divider />

      {/* Navigation List */}
      <List sx={{ px: 1, pt: 1, flexGrow: 1 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                to={item.path}
                onClick={() => isMobile && setMobileOpen(false)}
                sx={{
                  borderRadius: 2,
                  py: 1,
                  bgcolor: isActive ? theme.palette.primary.main + '15' : 'transparent',
                  color: isActive ? theme.palette.primary.main : 'text.primary',
                  '&:hover': { bgcolor: theme.palette.primary.main + '0A' },
                }}
              >
                <ListItemIcon sx={{ color: isActive ? theme.palette.primary.main : 'text.secondary', minWidth: 38 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  slotProps={{ primary: { sx: { fontSize: '0.875rem', fontWeight: isActive ? 700 : 500 } } }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider />
      {/* Logout */}
      <List sx={{ p: 1 }}>
        <ListItem disablePadding>
          <ListItemButton
            onClick={logout}
            sx={{ borderRadius: 2, color: 'error.main', '&:hover': { bgcolor: 'error.main' + '12' } }}
          >
            <ListItemIcon sx={{ color: 'error.main', minWidth: 38 }}>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="Log Out" slotProps={{ primary: { sx: { fontSize: '0.875rem', fontWeight: 600 } } }} />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Top AppBar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', minHeight: { xs: 56, sm: 64 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 1, display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
              {getPageTitle(location.pathname)}
            </Typography>
          </Box>
          {/* Avatar on the right */}
          <Avatar sx={{ bgcolor: 'primary.main', width: 34, height: 34, fontSize: '0.85rem', cursor: 'pointer' }}>
            {user?.email.charAt(0).toUpperCase()}
          </Avatar>
        </Toolbar>
      </AppBar>

      {/* Sidebar Navigation */}
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawerContent}
        </Drawer>

        {/* Desktop Drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }} />
        <Box sx={{ flexGrow: 1, p: { xs: 2, sm: 3 }, maxWidth: '100%', overflowX: 'hidden' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/add-transaction" element={<AddTransaction />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/income" element={<Income />} />
            <Route path="/expense" element={<Expense />} />
            <Route path="/balance" element={<Navigate to="/" replace />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Box>
      </Box>

      {/* Global Floating Action Button — visible on all pages except Add Transaction */}
      {showFab && (
        <Fab
          color="primary"
          aria-label="add transaction"
          onClick={() => navigate('/add-transaction')}
          sx={{
            position: 'fixed',
            bottom: { xs: 20, sm: 30 },
            right: { xs: 20, sm: 30 },
            zIndex: 1300,
            boxShadow: '0 8px 24px rgba(30,58,138,0.4)',
            '&:hover': { transform: 'scale(1.08)', bgcolor: 'primary.dark' },
            transition: 'all 0.2s ease',
          }}
        >
          <AddIcon />
        </Fab>
      )}
    </Box>
  );
};

// Root Component
export const AppContent: React.FC = () => {
  const { themeMode } = useAuth();
  const theme = getTheme(themeMode);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </ThemeProvider>
  );
};

export const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
};

export default App;
