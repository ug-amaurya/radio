import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, isThemeId, THEMES } from "../theme/themes";

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const VARS = ["ink-950", "ink-900", "ink-800", "ink-700", "ink-600", "ink-500", "accent", "accent-300", "accent-600", "mint"];

describe("themes", () => {
  it("has unique ids and a valid default", () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
    expect(isThemeId(DEFAULT_THEME)).toBe(true);
    expect(isThemeId("nope")).toBe(false);
  });

  it.each(THEMES.map((t) => t.id))("defines every palette variable for %s", (id) => {
    const block = css.match(new RegExp(`\\[data-theme="${id}"\\]\\s*\\{([^}]*)\\}`))?.[1];
    expect(block, `missing CSS block for ${id}`).toBeDefined();
    for (const v of VARS) expect(block).toMatch(new RegExp(`--c-${v}:\\s*\\d+ \\d+ \\d+;`));
  });
});
