"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import en from "./locales/en";
import vi from "./locales/vi";
import zh from "./locales/zh";
import type { Messages } from "./locales/en";

export type Locale = "en" | "vi" | "zh";

const MESSAGES: Record<Locale, Messages> = { en, vi, zh };
const STORAGE_KEY = "pancake-locale";

interface I18nContextValue {
  t: Messages;
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved === "en" || saved === "vi" || saved === "zh") setLocaleState(saved);
  }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <I18nContext.Provider value={{ t: MESSAGES[locale], locale, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
