"use client";

import { ThemeProvider } from "next-themes";
import { TypographyProvider } from "./typography-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TypographyProvider>{children}</TypographyProvider>
    </ThemeProvider>
  );
}
