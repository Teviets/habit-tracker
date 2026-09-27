import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { ColorSchemeName, useColorScheme } from 'react-native';

import { darkColors, lightColors, radius, ResolvedTheme, spacing, ThemeColors, ThemeMode, typography } from './tokens';

type ThemeContextValue = {
  colors: ThemeColors;
  mode: ThemeMode;
  resolvedMode: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = '@florece/theme';

function resolveTheme(mode: ThemeMode, systemMode: ColorSchemeName): ResolvedTheme {
  if (mode === 'system') return systemMode === 'dark' ? 'dark' : 'light';
  return mode;
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemMode = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'system' || stored === 'light' || stored === 'dark') setModeState(stored);
    });
  }, []);

  const setMode = (nextMode: ThemeMode) => {
    setModeState(nextMode);
    void AsyncStorage.setItem(STORAGE_KEY, nextMode);
  };

  const value = useMemo<ThemeContextValue>(() => {
    const resolvedMode = resolveTheme(mode, systemMode);
    return {
      colors: resolvedMode === 'dark' ? darkColors : lightColors,
      mode,
      resolvedMode,
      setMode,
      isDark: resolvedMode === 'dark',
      spacing,
      radius,
      typography,
    };
  }, [mode, systemMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useAppTheme must be used inside ThemeProvider');
  return context;
}
