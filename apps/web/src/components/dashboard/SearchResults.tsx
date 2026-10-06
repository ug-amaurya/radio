import { useEffect, useState } from "react";
import type { Track } from "@audius-radio/shared-types";
import { api } from "../../lib/api";
import { playTrackFrom } from "../../lib/stations";
import { TrackGrid } from "./TrendingGrid";

export function SearchResults({ query, onClear }: { query: string; onClear: () => void }) {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTracks(null);
    setError(null);
    api
      .search(query)
      .then((r) => !cancelled && setTracks(r.tracks.slice(0, 12)))
      .catch(() => !cancelled && setError("Search failed."));
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-white/60">Results for &ldquo;{query}&rdquo;</p>
        <button type="button" onClick={onClear} className="text-sm text-lilac underline">
          Clear
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {!error && !tracks && <p className="text-sm text-white/60">Searching...</p>}
      {tracks && tracks.length === 0 && <p className="text-sm text-white/60">No tracks found.</p>}
      {tracks && tracks.length > 0 && (
        <TrackGrid tracks={tracks} title="Search results" onPlay={(i) => void playTrackFrom(tracks, i)} />
      )}
    </div>
  );
}
