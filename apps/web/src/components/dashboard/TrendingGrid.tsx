import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Track } from "@audius-radio/shared-types";
import { api } from "../../lib/api";
import { playTrackFrom } from "../../lib/stations";
import { Artwork } from "../ui/Artwork";
import { PlayIcon } from "../ui/icons";

const DEFAULT_GRID = "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4";

export function TrackGrid({
  tracks,
  title,
  onPlay,
  gridClass = DEFAULT_GRID,
  action,
}: {
  tracks: Track[];
  title: string;
  onPlay: (index: number) => void;
  gridClass?: string;
  /** Optional control shown at the right of the heading (e.g. a "View all" link). */
  action?: ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-2xl font-bold">{title}</h2>
        {action}
      </div>
      <ul className={`grid gap-4 ${gridClass}`}>
        {tracks.map((t, i) => (
          <li key={t.id} className="group relative overflow-hidden rounded-2xl bg-ink-700">
            <Artwork src={t.artworkUrl} fallbacks={t.artworkFallbacks} className="aspect-square w-full object-cover text-4xl" loading="lazy" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-900/95 to-transparent p-3 pr-14">
              <p className="truncate text-sm font-semibold">{t.title}</p>
              <p className="truncate text-xs text-white/70">{t.artist}</p>
            </div>
            <button
              type="button"
              onClick={() => onPlay(i)}
              aria-label={`Play ${t.title} by ${t.artist}`}
              className="absolute bottom-1.5 right-1.5 grid h-11 w-11 place-items-center rounded-xl bg-ink-800/90 text-white transition hover:bg-lilac hover:text-ink-900"
            >
              <PlayIcon width={18} height={18} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface TrendingProps {
  genre?: string;
  limit?: number;
  title?: string;
  gridClass?: string;
  /** Show a "View all" link to the Trending page. */
  viewAll?: boolean;
}

/** Top Audius tracks (optionally for one genre); clicking one starts it and continues with the rest. */
export function TrendingGrid({
  genre,
  limit = 8,
  title = "Trending now",
  gridClass = "grid-cols-2 sm:grid-cols-3 2xl:grid-cols-4",
  viewAll = false,
}: TrendingProps) {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTracks(null);
    setFailed(false);
    api
      .trending(genre)
      .then((r) => !cancelled && setTracks(r.tracks.filter((t) => t.artworkUrl)))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [genre]);

  if (failed) return <p className="text-sm text-white/60">Couldn&apos;t load trending tracks.</p>;
  if (!tracks) return <p className="text-sm text-white/60">Loading trending...</p>;
  if (tracks.length === 0) return <p className="text-sm text-white/60">No tracks found{genre ? ` for ${genre}` : ""}.</p>;
  return (
    <TrackGrid
      tracks={tracks.slice(0, limit)}
      title={title}
      gridClass={gridClass}
      action={
        <span className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => void playTrackFrom(tracks, 0, genre)}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-lilac hover:underline"
          >
            Play all
          </button>
          {viewAll && (
            <Link to="/trending" className="inline-flex min-h-11 items-center text-sm text-white/70 hover:text-white">
              View all &rarr;
            </Link>
          )}
        </span>
      }
      onPlay={(i) => void playTrackFrom(tracks, i, genre)}
    />
  );
}
