import { useEffect, useId, useRef, useState } from "react";
import { THEMES } from "../../theme/themes";
import { useThemeStore } from "../../theme/themeStore";

const swatchBg = (swatch: [string, string]) => ({ background: `linear-gradient(135deg, ${swatch[0]} 50%, ${swatch[1]} 50%)` });

/** The theme options as a radio list; used in the popover and on the Profile page. */
export function ThemeList() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  return (
    <div role="radiogroup" aria-label="Theme" className="space-y-0.5">
      {THEMES.map((t) => {
        const selected = t.id === theme;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(t.id)}
            className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition ${
              selected ? "bg-ink-600 text-white" : "text-white/80 hover:bg-ink-600/60"
            }`}
          >
            <span className="h-5 w-5 shrink-0 rounded-full" style={swatchBg(t.swatch)} aria-hidden="true" />
            <span className="flex-1">{t.label}</span>
            {selected && <span aria-hidden="true" className="text-lilac">✓</span>}
          </button>
        );
      })}
    </div>
  );
}

/** One swatch showing the current theme; click to open a popover with the full list. */
export function ThemePicker() {
  const theme = useThemeStore((s) => s.theme);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();
  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0]!;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={popoverId}
        aria-label={`Theme: ${current.label}. Change theme`}
        title="Change theme"
        onClick={() => setOpen((o) => !o)}
        className="h-7 w-7 rounded-full ring-2 ring-white/20 ring-offset-2 ring-offset-ink-900 transition hover:ring-white/60"
        style={swatchBg(current.swatch)}
      />

      {open && (
        <div
          id={popoverId}
          className="absolute right-0 top-full z-30 mt-3 w-48 rounded-2xl bg-ink-700 p-2 shadow-card ring-1 ring-white/10"
        >
          <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-white/50">Theme</p>
          <ThemeList />
        </div>
      )}
    </div>
  );
}
