export const THEME_STORAGE_KEY = "theme";
export const DEFAULT_THEME = "sage" as const;
export const DARK_THEME = "dracula" as const;

export type Theme = typeof DEFAULT_THEME | typeof DARK_THEME;

export const THEME_COLORS: Record<Theme, string> = {
  sage: "#FFFDF9",
  dracula: "#282a36",
};

export function isTheme(value: string | null): value is Theme {
  return value === DEFAULT_THEME || value === DARK_THEME;
}
