import { z } from "zod";

export const MAX_STATIONS_PER_USER = 20;

/** Source types a station can be created with (`custom_mix` isn't resolvable yet, so it's not offered). */
export const CREATABLE_SOURCES = ["audius_favorites", "audius_playlist", "audius_trending", "audius_search"] as const;

const refs = z
  .object({
    genre: z.string().trim().min(1).max(40).optional(),
    query: z.string().trim().min(1).max(100).optional(),
    playlistIds: z.array(z.string().min(1).max(40)).min(1).max(10).optional(),
  })
  .strip(); // drop unknown keys: sourceRefs is stored as JSON, so don't accept arbitrary blobs

const stationShape = z.object({
  name: z.string().trim().min(1, "Give your station a name").max(80),
  mood: z.string().trim().max(40).nullish(),
  sourceType: z.enum(CREATABLE_SOURCES),
  sourceRefs: refs.default({}),
  djMode: z.boolean().optional(),
  crossfadeSec: z.number().int().min(3).max(10).optional(),
  discoverMode: z.boolean().optional(),
});

/** Full validation for creating a station. */
export const stationBody = stationShape.superRefine((v, ctx) => {
  if (v.sourceType === "audius_search" && !v.sourceRefs.query) {
    ctx.addIssue({ code: "custom", path: ["sourceRefs", "query"], message: "Enter a search term for this station" });
  }
  if (v.sourceType === "audius_playlist" && !v.sourceRefs.playlistIds) {
    ctx.addIssue({ code: "custom", path: ["sourceRefs", "playlistIds"], message: "Pick at least one playlist" });
  }
});

/** Partial update (PATCH). Cross-field rules are not re-checked here. */
export const stationPatchBody = stationShape.partial();

export type StationInput = z.infer<typeof stationBody>;
