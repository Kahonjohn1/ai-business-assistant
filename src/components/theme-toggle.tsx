import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "theme";
const THEME_LIGHT = "light" as const;
const THEME_DARK = "dark" as const;

type Theme = typeof THEME_LIGHT | typeof THEME_DARK;

function readSavedTheme(): Theme | null {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === THEME_LIGHT || saved === THEME_DARK ? saved : null;
  } catch {
    return null;
  }
}

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? THEME_DARK : THEME_LIGHT;
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === THEME_DARK);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  const removeSystemListenerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const saved = readSavedTheme();
    setTheme(saved ?? getSystemTheme());

    if (saved !== null) return;

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => {
      const next: Theme = event.matches ? THEME_DARK : THEME_LIGHT;
      setTheme(next);
      applyTheme(next);
    };

    mql.addEventListener("change", onChange);
    removeSystemListenerRef.current = () => mql.removeEventListener("change", onChange);

    return () => {
      mql.removeEventListener("change", onChange);
      removeSystemListenerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (theme !== null) {
      applyTheme(theme);
    }
  }, [theme]);

  const isDark = theme === THEME_DARK;

  const handleCheckedChange = (checked: boolean) => {
    const next: Theme = checked ? THEME_DARK : THEME_LIGHT;
    setTheme(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      void localStorage;
    }
    removeSystemListenerRef.current?.();
    removeSystemListenerRef.current = null;
  };

  return (
    <div className="flex items-center gap-2">
      <Sun
        aria-hidden="true"
        className={cn(
          "size-4 transition-colors",
          isDark ? "text-muted-foreground" : "text-foreground",
        )}
      />
      <Switch
        checked={isDark}
        onCheckedChange={handleCheckedChange}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      />
      <Moon
        aria-hidden="true"
        className={cn(
          "size-4 transition-colors",
          isDark ? "text-foreground" : "text-muted-foreground",
        )}
      />
    </div>
  );
}
