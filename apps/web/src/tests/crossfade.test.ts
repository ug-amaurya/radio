import { describe, expect, it } from "vitest";
import { equalPowerCurves } from "../engine/crossfade";

describe("equalPowerCurves", () => {
  it("fades in from 0 to 1 and out from 1 to 0", () => {
    const { fadeIn, fadeOut } = equalPowerCurves(64);
    expect(fadeIn[0]).toBeCloseTo(0);
    expect(fadeIn[63]).toBeCloseTo(1);
    expect(fadeOut[0]).toBeCloseTo(1);
    expect(fadeOut[63]).toBeCloseTo(0);
  });

  it("keeps total power constant at every step", () => {
    const { fadeIn, fadeOut } = equalPowerCurves(64);
    for (let i = 0; i < 64; i++) {
      expect(fadeIn[i]! ** 2 + fadeOut[i]! ** 2).toBeCloseTo(1);
    }
  });
});
