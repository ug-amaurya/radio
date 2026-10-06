import { describe, expect, it } from "vitest";
import { pickDominant } from "../lib/dominantColor";

const px = (...rgba: number[]) => rgba;

describe("pickDominant", () => {
  it("returns null for empty or fully transparent data", () => {
    expect(pickDominant([])).toBeNull();
    expect(pickDominant([10, 20, 30, 0])).toBeNull();
  });

  it("prefers saturated pixels over grey ones", () => {
    // 9 grey pixels + 1 vivid red: result should lean clearly red.
    const data = [...Array(9).fill(px(128, 128, 128, 255)).flat(), ...px(230, 20, 20, 255)];
    const [r, g, b] = pickDominant(data)!;
    expect(r).toBeGreaterThan(g + 40);
    expect(r).toBeGreaterThan(b + 40);
  });

  it("returns grey for a grey image", () => {
    const [r, g, b] = pickDominant(px(100, 100, 100, 255))!;
    expect([r, g, b]).toEqual([100, 100, 100]);
  });

  it("caps brightness so white text stays readable", () => {
    const [r, g, b] = pickDominant(px(255, 255, 255, 255))!;
    expect(Math.max(r, g, b)).toBeLessThanOrEqual(190);
  });
});
