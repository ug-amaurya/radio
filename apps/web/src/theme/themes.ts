export interface ThemeDef {
  id: string;
  label: string;
  /** Preview colors for the picker: [surface, accent]. Must match the CSS in index.css. */
  swatch: [string, string];
  /** Browser UI color (mobile address bar). */
  themeColor: string;
}

// The actual palette lives in index.css as CSS variables, keyed by `data-theme`.
export const THEMES: ThemeDef[] = [
  { id: "aubergine", label: "Aubergine", swatch: ["#2b1a3d", "#a98bef"], themeColor: "#1a0c28" },
  { id: "midnight", label: "Midnight", swatch: ["#162440", "#5aa9ff"], themeColor: "#0a1120" },
  { id: "forest", label: "Forest", swatch: ["#142d24", "#5fd69b"], themeColor: "#091813" },
  { id: "sunset", label: "Sunset", swatch: ["#381825", "#ff7a90"], themeColor: "#200c14" },
  { id: "graphite", label: "Graphite", swatch: ["#202026", "#f5c542"], themeColor: "#0f0f12" },
];

export const DEFAULT_THEME = THEMES[0]!.id;
export const THEME_STORAGE_KEY = "audius-radio:theme";

export function isThemeId(value: unknown): value is string {
  return typeof value === "string" && THEMES.some((t) => t.id === value);
}
