import { createTheme } from '@mui/material/styles';

/**
 * Custom MUI Theme for LMS
 * Priority: Noto Sans Devanagari (Marathi) -> Hind -> Roboto
 */
const theme = createTheme({
  typography: {
    fontFamily: [
      'Noto Sans Devanagari',
      'Hind',
      'Inter',
      '"Segoe UI"',
      'Roboto',
      'Helvetica',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        @font-face {
          font-family: 'Noto Sans Devanagari';
          font-style: normal;
          font-display: swap;
          font-weight: 400;
        }
      `,
    },
  },
});

export default theme;
