import { describe, expect, it } from "vitest";
import { resolveShortcut } from "../lib/shortcuts";

const press = (key: string, target: { tagName: string; role?: string | null; isContentEditable?: boolean } | null = { tagName: "BODY" }, mods = {}) =>
  resolveShortcut({
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...mods,
    target: target && { role: null, isContentEditable: false, ...target },
  });

describe("resolveShortcut", () => {
  it("maps the plan's keys when nothing interactive is focused", () => {
    expect(press(" ")).toEqual({ type: "toggle" });
    expect(press("ArrowRight")).toEqual({ type: "seek", deltaSec: 5 });
    expect(press("ArrowLeft")).toEqual({ type: "seek", deltaSec: -5 });
    expect(press("ArrowUp")).toEqual({ type: "volume", delta: 0.05 });
    expect(press("ArrowDown")).toEqual({ type: "volume", delta: -0.05 });
    expect(press("n")).toEqual({ type: "next" });
  });

  it("leaves keys alone inside inputs, buttons, links and sliders", () => {
    expect(press(" ", { tagName: "BUTTON" })).toBeNull();
    expect(press("ArrowLeft", { tagName: "INPUT" })).toBeNull();
    expect(press("n", { tagName: "INPUT" })).toBeNull();
    expect(press("ArrowRight", { tagName: "DIV", role: "slider" })).toBeNull();
    expect(press("ArrowDown", { tagName: "DIV", role: "radio" })).toBeNull();
    expect(press(" ", { tagName: "A" })).toBeNull();
    expect(press(" ", { tagName: "DIV", isContentEditable: true })).toBeNull();
  });

  it("never steals browser or OS shortcuts", () => {
    expect(press("ArrowLeft", { tagName: "BODY" }, { altKey: true })).toBeNull();
    expect(press("n", { tagName: "BODY" }, { metaKey: true })).toBeNull();
    expect(press("ArrowRight", { tagName: "BODY" }, { ctrlKey: true })).toBeNull();
  });

  it("ignores other keys", () => {
    expect(press("a")).toBeNull();
    expect(press("Enter")).toBeNull();
  });
});
