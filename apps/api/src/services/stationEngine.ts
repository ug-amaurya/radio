import type { Track } from "@audius-radio/shared-types";

export interface QueueInput {
  pool: Track[];
  /** Track ids ordered most-recently-played first. */
  recentIds: string[];
  /** trackId -> 1 (thumbs up) | -1 (thumbs down). */
  ratings: Map<string, number>;
  /** Track ids skipped within the first seconds: a soft negative signal. */
  quickSkipIds?: Set<string>;
  count: number;
  random?: () => number;
}

const MAX_WINDOW = 50;

function weightOf(track: Track, ratings: Map<string, number>, artistRating: Map<string, number>, quick: Set<string>) {
  let w = 1;
  if (ratings.get(track.id) === 1) w += 1;
  const artist = artistRating.get(track.artist) ?? 0;
  if (artist > 0) w += 0.5;
  if (artist < 0) w *= 0.5;
  if (quick.has(track.id)) w *= 0.5;
  return w;
}

/**
 * Smart shuffle: excludes the recently-played window and thumbs-downs, weights
 * thumbs-up tracks/artists higher, and falls back to least-recently-played so
 * small stations never stall.
 */
export function pickQueue({ pool, recentIds, ratings, quickSkipIds = new Set(), count, random = Math.random }: QueueInput): Track[] {
  const eligible = pool.filter((t) => ratings.get(t.id) !== -1);
  const windowSize = Math.min(MAX_WINDOW, Math.floor(pool.length / 2));
  const recentWindow = new Set(recentIds.slice(0, windowSize));

  const artistRating = new Map<string, number>();
  for (const t of pool) {
    const r = ratings.get(t.id);
    if (r) artistRating.set(t.artist, (artistRating.get(t.artist) ?? 0) + r);
  }

  const candidates = eligible.filter((t) => !recentWindow.has(t.id));
  const picked: Track[] = [];

  while (picked.length < count && candidates.length > 0) {
    const weights = candidates.map((t) => weightOf(t, ratings, artistRating, quickSkipIds));
    let roll = random() * weights.reduce((a, b) => a + b, 0);
    let idx = weights.findIndex((w) => (roll -= w) < 0);
    if (idx === -1) idx = candidates.length - 1;
    picked.push(candidates.splice(idx, 1)[0]!);
  }

  if (picked.length < count) {
    // Fallback: least recently played first (never-played tracks sort first).
    const chosen = new Set(picked.map((t) => t.id));
    const rank = (t: Track) => {
      const i = recentIds.indexOf(t.id);
      return i === -1 ? Infinity : i;
    };
    const rest = eligible.filter((t) => !chosen.has(t.id)).sort((a, b) => rank(b) - rank(a));
    picked.push(...rest.slice(0, count - picked.length));
  }

  return picked;
}
