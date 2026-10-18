"use client";

import { Palette } from "lucide-react";
import { useEffect } from "react";
import {
  DARK_THEME,
  DEFAULT_THEME,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  isTheme,
  type Theme,
} from "@/lib/theme";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === DARK_THEME ? DARK_THEME : DEFAULT_THEME;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme === DARK_THEME ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[theme]);
}

export function ThemeToggle() {
  useEffect(() => {
    applyTheme(currentTheme());
  }, []);

  function toggle() {
    const next = currentTheme() === DEFAULT_THEME ? DARK_THEME : DEFAULT_THEME;
    applyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // 隐私模式下 localStorage 可能不可用，本次切换仍然生效
    }
  }

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === THEME_STORAGE_KEY && isTheme(event.newValue)) {
        applyTheme(event.newValue);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <button
      type="button"
      className="btn btn-ghost btn-square btn-sm"
      aria-label="切换主题"
      title="切换主题"
      onClick={toggle}
    >
      <Palette className="size-4" />
    </button>
  );
}
