import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.fn();
vi.mock("../src/services/audiusHttp.js", () => ({ audiusGet: (...a: unknown[]) => getMock(...a) }));
vi.mock("../src/services/cache.js", () => ({
  cached: (_key: string, _ttl: number, load: () => Promise<unknown>) => load(),
}));

const { AudiusProvider } = await import("../src/providers/audius/AudiusProvider.js");

beforeEach(() => getMock.mockReset());

describe("AudiusProvider", () => {
  it("maps Audius tracks to namespaced Track DTOs", async () => {
    getMock.mockResolvedValue([
      { id: "D7KyD", title: "Song", duration: 180, genre: "Lo-Fi", permalink: "/a/song", user: { name: "Artist" } },
    ]);
    const [track] = await new AudiusProvider().search("song");
    expect(track).toMatchObject({
      id: "audius:D7KyD",
      provider: "audius",
      artist: "Artist",
      durationSec: 180,
      permalinkUrl: "https://audius.co/a/song",
    });
  });

  it("strips the namespace when resolving related tracks and stream URLs", async () => {
    const provider = new AudiusProvider();
    getMock.mockResolvedValueOnce({ id: "D7KyD", genre: "Dubstep" }).mockResolvedValueOnce([
      { id: "D7KyD", title: "self", duration: 1, user: { name: "A" } },
      { id: "other", title: "o", duration: 1, user: { name: "B" } },
    ]);
    const related = await provider.getRelated("audius:D7KyD");
    expect(getMock).toHaveBeenNthCalledWith(1, "/tracks/D7KyD");
    expect(related.map((t) => t.id)).toEqual(["audius:other"]);
    getMock.mockResolvedValue("https://stream");
    expect(await provider.getStreamUrl("audius:D7KyD")).toBe("https://stream");
    expect(getMock).toHaveBeenLastCalledWith("/tracks/D7KyD/stream", { no_redirect: true });
  });

  it("reads favorites from the library endpoint", async () => {
    getMock.mockResolvedValue([{ item: { id: "x", title: "T", duration: 1, user: { name: "A" } } }]);
    const [track] = await new AudiusProvider().getUserFavorites("u1");
    expect(track?.id).toBe("audius:x");
  });
});

describe("artwork fallbacks", () => {
  it("rebuilds the artwork URL on each mirror host, skipping the primary", async () => {
    const { artworkFallbacks } = await import("../src/providers/audius/AudiusProvider.js");
    expect(
      artworkFallbacks({
        "480x480": "https://a.example/content/cid1/480x480.jpg",
        mirrors: ["https://b.example/", "https://a.example", "https://c.example"],
      }),
    ).toEqual(["https://b.example/content/cid1/480x480.jpg", "https://c.example/content/cid1/480x480.jpg"]);
  });

  it("returns undefined when there is no artwork or no mirrors", async () => {
    const { artworkFallbacks } = await import("../src/providers/audius/AudiusProvider.js");
    expect(artworkFallbacks(undefined)).toBeUndefined();
    expect(artworkFallbacks({ "480x480": "https://a.example/content/x/480x480.jpg" })).toBeUndefined();
  });
});
