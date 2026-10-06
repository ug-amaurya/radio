import { describe, expect, it, vi } from "vitest";

vi.mock("../src/db/client.js", () => ({ prisma: {} }));

const { needsResync, positionMs } = await import("../src/services/sessionClock.js");
const { generateJoinCode } = await import("../src/services/sessionRooms.js");

describe("positionMs", () => {
  it("is the time elapsed since the track started", () => {
    expect(positionMs(1_000, 4_500)).toBe(3_500);
  });

  it("never goes negative if clocks briefly disagree", () => {
    expect(positionMs(5_000, 4_000)).toBe(0);
  });
});

describe("needsResync", () => {
  it("tolerates small drift and corrects large drift", () => {
    expect(needsResync(10_200, 10_000)).toBe(false);
    expect(needsResync(10_500, 10_000)).toBe(false);
    expect(needsResync(11_000, 10_000)).toBe(true);
    expect(needsResync(9_000, 10_000)).toBe(true);
  });
});

describe("generateJoinCode", () => {
  it("makes 6-character codes without look-alike characters", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateJoinCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    }
  });
});

describe("trackSchema", () => {
  it("accepts real tracks with null optional fields and strips unknown keys", async () => {
    const { trackSchema } = await import("../src/sockets/sessionGateway.js");
    const parsed = trackSchema.parse({
      id: "audius:x",
      provider: "audius",
      title: "T",
      artist: "A",
      durationSec: 10,
      mood: null,
      genre: "Dubstep",
      artworkFallbacks: ["https://a/1.jpg"],
      junk: "dropped",
    });
    expect(parsed.mood).toBeUndefined();
    expect(parsed.genre).toBe("Dubstep");
    expect(parsed.artworkFallbacks).toEqual(["https://a/1.jpg"]);
    expect("junk" in parsed).toBe(false);
  });

  it("rejects tracks without an id", async () => {
    const { trackSchema } = await import("../src/sockets/sessionGateway.js");
    expect(trackSchema.safeParse({ provider: "audius", title: "T", artist: "A", durationSec: 1 }).success).toBe(false);
  });
});
