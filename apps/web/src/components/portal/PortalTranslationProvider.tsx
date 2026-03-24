"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";

interface TranslationContextType {
  currentLanguage: string;
  isRTL: boolean;
  setLanguage: (code: string) => void;
  t: (key: string, params?: Record<string, string>) => string;
  tc: (sourceType: string, sourceId: string, field: string, fallback: string) => string;
  formatDate: (date: Date | string) => string;
  formatCurrency: (amount: number) => string;
  isLoading: boolean;
}

const defaultContext: TranslationContextType = {
  currentLanguage: "en",
  isRTL: false,
  setLanguage: () => {},
  t: (key) => key,
  tc: (_, __, ___, fallback) => fallback,
  formatDate: (d) => new Date(d).toLocaleDateString(),
  formatCurrency: (a) => `$${a.toFixed(2)}`,
  isLoading: false,
};

const TranslationContext = createContext<TranslationContextType>(defaultContext);

export function PortalTranslationProvider({
  children,
  portalAccountId,
  initialLanguage = "en",
}: {
  children: React.ReactNode;
  portalAccountId?: string;
  initialLanguage?: string;
}) {
  const [language, setLanguageState] = useState(initialLanguage);
  const [uiStrings, setUiStrings] = useState<Record<string, string>>({});
  const [contentCache, setContentCache] = useState<Record<string, string>>({});

  const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);
  const isRTL = RTL_LANGUAGES.has(language);

  // Load UI translations
  const { data: translations, isLoading } = trpc.translation.getUITranslations.useQuery(
    { languageCode: language },
    { enabled: language !== "en" }
  );

  useEffect(() => {
    if (translations) setUiStrings(translations);
  }, [translations]);

  // Set language on root element for RTL
  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language, isRTL]);

  const setLanguage = useCallback((code: string) => {
    setLanguageState(code);
    // Persist preference
    if (portalAccountId) {
      // Would call setClientLanguage mutation
    }
  }, [portalAccountId]);

  const t = useCallback((key: string, params?: Record<string, string>) => {
    if (language === "en") return key.split(".").pop() || key;
    let text = uiStrings[key] || key.split(".").pop() || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{{${k}}}`, v);
      }
    }
    return text;
  }, [language, uiStrings]);

  const tc = useCallback((sourceType: string, sourceId: string, field: string, fallback: string) => {
    if (language === "en") return fallback;
    const cacheKey = `${sourceType}:${sourceId}:${field}:${language}`;
    return contentCache[cacheKey] || fallback;
  }, [language, contentCache]);

  const formatDate = useCallback((date: Date | string) => {
    try {
      return new Date(date).toLocaleDateString(language === "en" ? "en-US" : language, {
        month: "long", day: "numeric", year: "numeric",
      });
    } catch {
      return new Date(date).toLocaleDateString();
    }
  }, [language]);

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat(language === "en" ? "en-US" : language, {
      style: "currency", currency: "USD",
    }).format(amount);
  }, [language]);

  return (
    <TranslationContext.Provider value={{
      currentLanguage: language, isRTL, setLanguage, t, tc,
      formatDate, formatCurrency, isLoading,
    }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  return useContext(TranslationContext);
}
