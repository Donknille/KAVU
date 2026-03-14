import { useEffect, type ReactNode } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

function ThemeMetaSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      return;
    }

    metaTheme.setAttribute("content", resolvedTheme === "dark" ? "#0d1420" : "#173d66");
  }, [resolvedTheme]);

  return null;
}

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="meisterplaner-theme"
    >
      <ThemeMetaSync />
      {children}
    </NextThemesProvider>
  );
}
