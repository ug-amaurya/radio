import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast, useToastStore } from "../stores/toastStore";

beforeEach(() => {
  vi.useFakeTimers();
  useToastStore.setState({ toasts: [] });
});
afterEach(() => vi.useRealTimers());

describe("toastStore", () => {
  it("shows a message once even if it fires repeatedly", () => {
    toast.error("Audius is busy");
    toast.error("Audius is busy");
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("auto-dismisses after a few seconds", () => {
    toast.info("Saved");
    vi.advanceTimersByTime(6001);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("keeps only the newest three", () => {
    for (const m of ["a", "b", "c", "d"]) toast.error(m);
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(["b", "c", "d"]);
  });
});
