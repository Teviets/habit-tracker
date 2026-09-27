import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { Locale, TranslationKey, translations } from './translations';

type Params = Record<string, string | number>;
type I18nContextValue = {
  locale: Locale;
  localeTag: string;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Params) => string;
};

const STORAGE_KEY = '@florece/locale';
const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function detectLocale(): Locale {
  const deviceLocale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
  return deviceLocale.startsWith('en') ? 'en' : 'es';
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'es' || stored === 'en') setLocaleState(stored);
    });
  }, []);

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    void AsyncStorage.setItem(STORAGE_KEY, nextLocale);
  };

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    localeTag: locale === 'es' ? 'es-GT' : 'en-US',
    setLocale,
    t: (key, params) => {
      let text: string = translations[locale][key];
      if (!params) return text;
      Object.entries(params).forEach(([name, replacement]) => {
        text = text.replace(`{{${name}}}`, String(replacement));
      });
      return text;
    },
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}
