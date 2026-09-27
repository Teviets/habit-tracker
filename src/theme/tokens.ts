export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const shared = {
  primary: '#2E8067',
  primaryStrong: '#173F35',
  primarySoft: '#DFF4E9',
  accent: '#FF8D73',
  accentSoft: '#FFE5DE',
  lavender: '#8D83CF',
  lavenderSoft: '#ECE9FA',
  yellow: '#F2C94C',
  success: '#45A77C',
  danger: '#D95757',
};

export const lightColors = {
  ...shared,
  background: '#F6F8F3',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceMuted: '#ECF2EA',
  text: '#18312A',
  textSecondary: '#66756F',
  border: '#DCE6DF',
  tabBar: '#FFFFFF',
  overlay: 'rgba(24, 49, 42, 0.08)',
  white: '#FFFFFF',
};

export const darkColors = {
  ...shared,
  primary: '#64C9A4',
  primaryStrong: '#215E4E',
  primarySoft: '#183A31',
  accent: '#FFA48F',
  accentSoft: '#492B27',
  lavender: '#AAA1EA',
  lavenderSoft: '#302D4A',
  background: '#0D1714',
  surface: '#15231F',
  surfaceRaised: '#1B2D27',
  surfaceMuted: '#21332D',
  text: '#F0F7F3',
  textSecondary: '#A7B8B1',
  border: '#2C4039',
  tabBar: '#14221E',
  overlay: 'rgba(0, 0, 0, 0.28)',
  white: '#FFFFFF',
};

export type ThemeColors = typeof lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  full: 999,
} as const;

export const typography = {
  hero: 34,
  title: 26,
  heading: 20,
  body: 16,
  small: 14,
  caption: 12,
} as const;
