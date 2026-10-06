import { describe, expect, it } from "vitest";
import { stationBody, stationPatchBody } from "../src/services/stationSchema.js";

const parse = (v: unknown) => stationBody.safeParse(v);

describe("stationBody", () => {
  it("accepts a trending station and trims the name", () => {
    const r = parse({ name: "  Late night  ", sourceType: "audius_trending", sourceRefs: { genre: "Lo-Fi" } });
    expect(r.success && r.data.name).toBe("Late night");
  });

  it("defaults sourceRefs to {} and strips unknown keys", () => {
    const r = parse({ name: "x", sourceType: "audius_trending", sourceRefs: { genre: "Lo-Fi", evil: { a: 1 } } });
    expect(r.success && r.data.sourceRefs).toEqual({ genre: "Lo-Fi" });
    const r2 = parse({ name: "x", sourceType: "audius_trending" });
    expect(r2.success && r2.data.sourceRefs).toEqual({});
  });

  it("requires a query for search stations and playlists for playlist stations", () => {
    expect(parse({ name: "s", sourceType: "audius_search" }).success).toBe(false);
    expect(parse({ name: "s", sourceType: "audius_search", sourceRefs: { query: "  " } }).success).toBe(false);
    expect(parse({ name: "s", sourceType: "audius_search", sourceRefs: { query: "jazz" } }).success).toBe(true);
    expect(parse({ name: "p", sourceType: "audius_playlist", sourceRefs: {} }).success).toBe(false);
    expect(parse({ name: "p", sourceType: "audius_playlist", sourceRefs: { playlistIds: ["a"] } }).success).toBe(true);
  });

  it("rejects empty names, custom_mix and out-of-range crossfade", () => {
    expect(parse({ name: "   ", sourceType: "audius_trending" }).success).toBe(false);
    expect(parse({ name: "m", sourceType: "custom_mix" }).success).toBe(false);
    expect(parse({ name: "c", sourceType: "audius_trending", crossfadeSec: 2 }).success).toBe(false);
    expect(parse({ name: "c", sourceType: "audius_trending", crossfadeSec: 10, djMode: true }).success).toBe(true);
  });

  it("supports partial updates for PATCH without resetting sourceRefs", () => {
    const r = stationPatchBody.safeParse({ djMode: true });
    expect(r.success && r.data).toEqual({ djMode: true });
  });
});
