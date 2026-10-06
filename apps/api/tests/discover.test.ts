import { describe, expect, it, vi } from "vitest";
import type { Track } from "@audius-radio/shared-types";
import type { MusicProvider } from "../src/providers/MusicProvider.js";
import { dominantGenres, interleaveDiscover, loadDiscoverPool } from "../src/services/discover.js";

const track = (id: string, genre?: string): Track => ({
  id,
  provider: "audius",
  title: id,
  artist: `artist-${id}`,
  durationSec: 100,
  genre,
});

describe("interleaveDiscover", () => {
  it("fills every Nth slot with a discover track without changing the length", () => {
    const main = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10"].map((id) => track(id));
    const out = interleaveDiscover(main, [track("d1"), track("d2")], 5);
    expect(out).toHaveLength(10);
    expect(out[4]?.id).toBe("d1");
    expect(out[9]?.id).toBe("d2");
  });

  it("leaves the queue untouched when there are no discover tracks", () => {
    const main = [track("a"), track("b"), track("c"), track("d"), track("e")];
    expect(interleaveDiscover(main, [], 5).map((t) => t.id)).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("dominantGenres", () => {
  it("returns the most common genres first", () => {
    const pool = [track("1", "Lo-Fi"), track("2", "Lo-Fi"), track("3", "Jazz"), track("4")];
    expect(dominantGenres(pool, 1)).toEqual(["Lo-Fi"]);
  });
});

describe("loadDiscoverPool", () => {
  it("seeds from thumbs-up tracks: related tracks and their genre", async () => {
    const getRelated = vi.fn().mockResolvedValue([track("rel")]);
    const getTrending = vi.fn().mockImplementation(async ({ genre }: { genre: string }) => [track(`trend-${genre}`)]);
    const provider = { getRelated, getTrending } as unknown as MusicProvider;
    const feedback = [
      { trackId: "audius:liked", genre: "Techno", rating: 1, createdAt: new Date() },
      { trackId: "audius:disliked", genre: "Country", rating: -1, createdAt: new Date() },
    ];

    const out = await loadDiscoverPool(provider, [track("p1", "Lo-Fi")], feedback);

    expect(getRelated).toHaveBeenCalledWith("audius:liked");
    expect(getTrending).toHaveBeenCalledWith({ genre: "Techno" });
    expect(getTrending).not.toHaveBeenCalledWith({ genre: "Country" });
    expect(out.map((t) => t.id).sort()).toEqual(["rel", "trend-Lo-Fi", "trend-Techno"]);
  });

  it("survives a failing provider call", async () => {
    const provider = {
      getRelated: vi.fn().mockRejectedValue(new Error("boom")),
      getTrending: vi.fn().mockResolvedValue([track("ok")]),
    } as unknown as MusicProvider;
    const out = await loadDiscoverPool(provider, [track("p", "Jazz")], [
      { trackId: "x", genre: null, rating: 1, createdAt: new Date() },
    ]);
    expect(out.map((t) => t.id)).toEqual(["ok"]);
  });
});
