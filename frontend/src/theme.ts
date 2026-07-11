import { createTheme } from '@mui/material/styles';

export const getTheme = (mode: 'light' | 'dark') => {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#1E3A8A',
        light: '#3B82F6',
        dark: '#172554',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#8B5CF6',
        light: '#A78BFA',
        dark: '#6D28D9',
        contrastText: '#ffffff',
      },
      background: {
        default: isDark ? '#0F172A' : '#F1F5F9',
        paper: isDark ? '#1E293B' : '#FFFFFF',
      },
      text: {
        primary: isDark ? '#F1F5F9' : '#0F172A',
        secondary: isDark ? '#94A3B8' : '#475569',
        disabled: isDark ? '#475569' : '#94A3B8',
      },
      divider: isDark ? '#334155' : '#E2E8F0',
      success: {
        main: '#10B981',
        light: isDark ? '#064E3B' : '#D1FAE5',
        dark: '#065F46',
        contrastText: isDark ? '#D1FAE5' : '#065F46',
      },
      error: {
        main: '#EF4444',
        light: isDark ? '#450A0A' : '#FEE2E2',
        dark: '#991B1B',
        contrastText: isDark ? '#FEE2E2' : '#991B1B',
      },
      info: {
        main: '#3B82F6',
        light: isDark ? '#1E3A5F' : '#DBEAFE',
        dark: '#1E40AF',
        contrastText: isDark ? '#DBEAFE' : '#1E40AF',
      },
      warning: {
        main: '#F59E0B',
        light: isDark ? '#451A03' : '#FEF3C7',
        dark: '#92400E',
        contrastText: isDark ? '#FEF3C7' : '#92400E',
      },
      action: {
        hover: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
        selected: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        disabled: isDark ? 'rgba(255,255,255,0.26)' : 'rgba(0,0,0,0.26)',
        disabledBackground: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
      },
    },
    typography: {
      fontFamily: [
        'Outfit',
        'Inter',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        'sans-serif',
      ].join(','),
      h1: { fontWeight: 800 },
      h2: { fontWeight: 800 },
      h3: { fontWeight: 700 },
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      body1: { fontWeight: 400 },
      body2: { fontWeight: 400 },
      button: {
        textTransform: 'none',
        fontWeight: 600,
      },
    },
    shape: {
      borderRadius: 10,
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: isDark
              ? '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)'
              : '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)',
            borderRadius: 12,
            backgroundImage: 'none',
            border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            padding: '7px 16px',
            transition: 'all 0.15s ease',
            '&:hover': {
              transform: 'translateY(-1px)',
            },
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            },
          },
        },
      },
      MuiFab: {
        styleOverrides: {
          root: {
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            boxShadow: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            borderRight: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-root': {
              backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
              color: isDark ? '#94A3B8' : '#475569',
              borderBottom: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
              fontWeight: 700,
              fontSize: '0.8rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: isDark ? '#1E293B' : '#F1F5F9',
            color: isDark ? '#F1F5F9' : '#0F172A',
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
            '& fieldset': {
              borderColor: isDark ? '#334155' : '#E2E8F0',
            },
            '&:hover fieldset': {
              borderColor: isDark ? '#475569' : '#CBD5E1',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#3B82F6',
            },
            '& .MuiInputBase-input': {
              color: isDark ? '#F1F5F9' : '#0F172A',
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: isDark ? '#64748B' : '#64748B',
            '&.Mui-focused': {
              color: '#3B82F6',
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          icon: {
            color: isDark ? '#64748B' : '#64748B',
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            color: isDark ? '#F1F5F9' : '#0F172A',
            '&:hover': {
              backgroundColor: isDark ? '#334155' : '#F1F5F9',
            },
            '&.Mui-selected': {
              backgroundColor: isDark ? '#1E3A5F' : '#DBEAFE',
              '&:hover': {
                backgroundColor: isDark ? '#1E3A5F' : '#BFDBFE',
              },
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: isDark ? '#334155' : '#E2E8F0',
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            '&.Mui-selected': {
              backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(30,58,138,0.08)',
            },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? '#334155' : '#1E293B',
            color: '#F8FAFC',
            fontSize: '0.75rem',
            borderRadius: 6,
          },
        },
      },
      MuiPagination: {
        styleOverrides: {
          root: {
            '& .MuiPaginationItem-root': {
              color: isDark ? '#94A3B8' : '#475569',
              borderColor: isDark ? '#334155' : '#E2E8F0',
              '&.Mui-selected': {
                backgroundColor: '#1E3A8A',
                color: '#ffffff',
              },
            },
          },
        },
      },
    },
  });
};
