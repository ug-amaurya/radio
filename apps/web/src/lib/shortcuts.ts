export type ShortcutAction =
  | { type: "toggle" }
  | { type: "next" }
  | { type: "seek"; deltaSec: number }
  | { type: "volume"; delta: number };

export const SEEK_STEP_SEC = 5;
export const VOLUME_STEP = 0.05;

interface KeyInfo {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** Tag name, role and editability of the focused element. */
  target: { tagName: string; role: string | null; isContentEditable: boolean } | null;
}

// Elements that already use these keys themselves (typing, native slider arrows, Space/Enter to activate).
const OWN_KEYBOARD_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A", "SUMMARY", "DIALOG"]);
const OWN_KEYBOARD_ROLES = new Set(["slider", "radio", "switch", "textbox", "combobox", "menuitem", "tab"]);

/** Maps a key press to a player action, or null when the key should be left alone. */
export function resolveShortcut(e: KeyInfo): ShortcutAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.target) {
    if (e.target.isContentEditable) return null;
    if (OWN_KEYBOARD_TAGS.has(e.target.tagName.toUpperCase())) return null;
    if (e.target.role && OWN_KEYBOARD_ROLES.has(e.target.role)) return null;
  }
  switch (e.key) {
    case " ":
      return { type: "toggle" };
    case "n":
    case "N":
      return { type: "next" };
    case "ArrowRight":
      return { type: "seek", deltaSec: SEEK_STEP_SEC };
    case "ArrowLeft":
      return { type: "seek", deltaSec: -SEEK_STEP_SEC };
    case "ArrowUp":
      return { type: "volume", delta: VOLUME_STEP };
    case "ArrowDown":
      return { type: "volume", delta: -VOLUME_STEP };
    default:
      return null;
  }
}
