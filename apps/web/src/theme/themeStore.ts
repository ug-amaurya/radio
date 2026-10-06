import { create } from "zustand";
import { DEFAULT_THEME, isThemeId, THEMES, THEME_STORAGE_KEY } from "./themes";

function readStored(): string {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME; // storage blocked (private mode, etc.)
  }
}

function apply(id: string): void {
  document.documentElement.dataset.theme = id;
  const color = THEMES.find((t) => t.id === id)?.themeColor;
  if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
}

interface ThemeState {
  theme: string;
  setTheme: (id: string) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: readStored(),
  setTheme: (id) => {
    if (!isThemeId(id)) return;
    apply(id);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      /* preference just won't persist */
    }
    set({ theme: id });
  },
}));

/** Applies the saved theme on startup (index.html also does this earlier, to avoid a flash). */
export function initTheme(): void {
  apply(useThemeStore.getState().theme);
}
