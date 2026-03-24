"use client";

import { createContext, useContext } from "react";

export interface PortalTheme {
  practiceArea: string;
  colorPrimary: string;
  colorSecondary: string;
  colorAccent: string;
  colorBackground: string;
  colorSurface: string;
  colorText: string;
  colorMuted: string;
  gradientStart?: string;
  gradientEnd?: string;
  fontFamily: string;
  borderRadius: string;
  tone: string;
  welcomeHeading?: string;
  welcomeSubtext?: string;
  terminology: Record<string, string>;
  statusLabels?: any[];
  documentCategories?: string[];
  quickActions?: Array<{ label: string; icon: string; href?: string }>;
  faqItems?: Array<{ q: string; a: string }>;
}

const DEFAULT_THEME: PortalTheme = {
  practiceArea: "general",
  colorPrimary: "#1E40AF",
  colorSecondary: "#3B82F6",
  colorAccent: "#F59E0B",
  colorBackground: "#F8FAFC",
  colorSurface: "#FFFFFF",
  colorText: "#111827",
  colorMuted: "#6B7280",
  fontFamily: "Inter",
  borderRadius: "8px",
  tone: "professional",
  welcomeHeading: "Your Case Portal",
  welcomeSubtext: "Welcome to your secure client portal. Track your case, communicate with your attorney, and access important documents.",
  terminology: {},
  quickActions: [
    { label: "Message Attorney", icon: "MessageCircle" },
    { label: "Upload Documents", icon: "Upload" },
    { label: "View Checklist", icon: "CheckSquare" },
  ],
};

const ThemeContext = createContext<PortalTheme>(DEFAULT_THEME);

export function PortalThemeProvider({ theme, children }: { theme?: Partial<PortalTheme>; children: React.ReactNode }) {
  const merged = { ...DEFAULT_THEME, ...theme, terminology: { ...DEFAULT_THEME.terminology, ...theme?.terminology } };

  return (
    <ThemeContext.Provider value={merged}>
      <div
        style={{
          "--portal-primary": merged.colorPrimary,
          "--portal-secondary": merged.colorSecondary,
          "--portal-accent": merged.colorAccent,
          "--portal-bg": merged.colorBackground,
          "--portal-surface": merged.colorSurface,
          "--portal-text": merged.colorText,
          "--portal-muted": merged.colorMuted,
          "--portal-radius": merged.borderRadius,
          fontFamily: merged.fontFamily,
        } as React.CSSProperties}
        className="min-h-screen"
        style-background={merged.colorBackground}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function usePortalTheme() {
  return useContext(ThemeContext);
}

export function t(term: string, theme: PortalTheme): string {
  return theme.terminology[term] || term;
}
