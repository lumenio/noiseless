"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface TypographySettings {
  headingWeight: number;
  headingStretch: number;
  bodyWeight: number;
  bodyStretch: number;
}

const DEFAULTS: TypographySettings = {
  headingWeight: 700,
  headingStretch: 100,
  bodyWeight: 400,
  bodyStretch: 100,
};

const CSS_VARS = [
  ["headingWeight", "--heading-font-weight", (v: number) => String(v)],
  ["headingStretch", "--heading-font-stretch", (v: number) => `${v}%`],
  ["bodyWeight", "--body-font-weight", (v: number) => String(v)],
  ["bodyStretch", "--body-font-stretch", (v: number) => `${v}%`],
] as const;

const TypographyContext = createContext<{
  settings: TypographySettings;
  updateSettings: (partial: Partial<TypographySettings>) => void;
  resetSettings: () => void;
} | null>(null);

function applyCssVars(settings: TypographySettings) {
  for (const [key, varName, format] of CSS_VARS) {
    document.documentElement.style.setProperty(varName, format(settings[key]));
  }
}

export function TypographyProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<TypographySettings>(DEFAULTS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("typography");
      if (stored) {
        const parsed = JSON.parse(stored);
        const merged = { ...DEFAULTS, ...parsed };
        setSettings(merged);
        applyCssVars(merged);
      }
    } catch {}
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyCssVars(settings);
  }, [settings, mounted]);

  const updateSettings = (partial: Partial<TypographySettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem("typography", JSON.stringify(next));
      return next;
    });
  };

  const resetSettings = () => {
    setSettings(DEFAULTS);
    localStorage.setItem("typography", JSON.stringify(DEFAULTS));
  };

  return (
    <TypographyContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </TypographyContext.Provider>
  );
}

export function useTypography() {
  const ctx = useContext(TypographyContext);
  if (!ctx) throw new Error("useTypography must be used within TypographyProvider");
  return ctx;
}
