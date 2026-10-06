import { describe, expect, it } from "vitest";
import type { Track } from "@audius-radio/shared-types";
import { pickQueue } from "../src/services/stationEngine.js";

const track = (id: string, artist = `artist-${id}`): Track => ({
  id,
  provider: "audius",
  title: id,
  artist,
  durationSec: 100,
});
const pool = ["a", "b", "c", "d", "e", "f"].map((id) => track(id));

describe("pickQueue", () => {
  it("excludes the recent window and thumbs-downs", () => {
    const out = pickQueue({
      pool,
      recentIds: ["a", "b", "c"],
      ratings: new Map([["d", -1]]),
      count: 2,
    });
    expect(out.map((t) => t.id).sort()).toEqual(["e", "f"]);
  });

  it("never repeats a track within one queue", () => {
    const out = pickQueue({ pool, recentIds: [], ratings: new Map(), count: 6 });
    expect(new Set(out.map((t) => t.id)).size).toBe(out.length);
  });

  it("falls back to least recently played when the pool is small", () => {
    const small = [track("x"), track("y")];
    const out = pickQueue({ pool: small, recentIds: ["x", "y"], ratings: new Map(), count: 2 });
    expect(out.map((t) => t.id)).toEqual(["y", "x"]);
  });

  it("boosts thumbs-up artists", () => {
    const p = [track("up", "fav"), track("same", "fav"), track("other", "meh")];
    let ups = 0;
    for (let i = 0; i < 400; i++) {
      const [first] = pickQueue({ pool: p, recentIds: [], ratings: new Map([["up", 1]]), count: 1 });
      if (first?.artist === "fav") ups++;
    }
    expect(ups).toBeGreaterThan(260);
  });
});
