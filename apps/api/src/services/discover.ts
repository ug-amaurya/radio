import type { Track } from "@audius-radio/shared-types";
import type { MusicProvider } from "../providers/MusicProvider.js";

export interface FeedbackRow {
  trackId: string;
  genre: string | null;
  rating: number;
  createdAt: Date;
}

const MAX_LIKED_SEEDS = 2;
const MAX_GENRES = 3;

/** The most common genres in a pool, most frequent first. */
export function dominantGenres(pool: Track[], n = 2): string[] {
  const counts = new Map<string, number>();
  for (const t of pool) if (t.genre) counts.set(t.genre, (counts.get(t.genre) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([genre]) => genre);
}

/**
 * Candidate tracks for discover mode, seeded by the user's recent thumbs-ups
 * (related tracks + their genres) and the station's dominant genres.
 * Audius has no recommendations endpoint, so this is built from related + genre trending.
 */
export async function loadDiscoverPool(
  provider: MusicProvider,
  pool: Track[],
  feedback: FeedbackRow[],
): Promise<Track[]> {
  const likedSeeds = feedback
    .filter((f) => f.rating === 1)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, MAX_LIKED_SEEDS);

  const genres = [
    ...new Set([
      ...likedSeeds.map((f) => f.genre).filter((g): g is string => Boolean(g)),
      ...dominantGenres(pool),
    ]),
  ].slice(0, MAX_GENRES);

  const results = await Promise.allSettled([
    ...likedSeeds.map((f) => provider.getRelated(f.trackId)),
    ...genres.map((genre) => provider.getTrending({ genre })),
  ]);

  const byId = new Map<string, Track>();
  for (const r of results) {
    if (r.status === "fulfilled") for (const t of r.value) byId.set(t.id, t);
  }
  return [...byId.values()];
}

/** Puts one discover track in every `every`th slot of the queue; the queue length is unchanged. */
export function interleaveDiscover(main: Track[], discover: Track[], every = 5): Track[] {
  const out: Track[] = [];
  let m = 0;
  let d = 0;
  while (out.length < main.length) {
    const discoverSlot = (out.length + 1) % every === 0 && d < discover.length;
    if (discoverSlot) out.push(discover[d++]!);
    else if (m < main.length) out.push(main[m++]!);
    else break;
  }
  return out;
}
