import { useEffect } from "react";
import { radio } from "../../engine/radio";
import { api } from "../../lib/api";
import { usePlaybackStore } from "../../stores/playbackStore";

const buttonClass =
  "min-h-11 min-w-11 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lilac";

export function FeedbackButtons() {
  const current = usePlaybackStore((s) => s.current);
  const rating = usePlaybackStore((s) => (s.current ? s.ratings[s.current.id] : undefined));
  const set = usePlaybackStore((s) => s.set);

  // Load any existing rating for the track that just started.
  const trackId = current?.id;
  useEffect(() => {
    if (!trackId || usePlaybackStore.getState().ratings[trackId] !== undefined) return;
    api
      .ratings([trackId])
      .then(({ ratings }) => {
        if (ratings[trackId]) set({ ratings: { ...usePlaybackStore.getState().ratings, [trackId]: ratings[trackId] } });
      })
      .catch(() => undefined);
  }, [trackId, set]);

  if (!current) return null;

  const rate = (value: 1 | -1) => {
    // Clicking the active rating again clears it.
    const next = rating === value ? 0 : value;
    const { [current.id]: _old, ...rest } = usePlaybackStore.getState().ratings;
    set({ ratings: next === 0 ? rest : { ...rest, [current.id]: next } });
    void api.rateTrack({ trackId: current.id, rating: next, genre: current.genre ?? null }).catch(() => {
      set({ error: "Could not save your rating" });
    });
    // A thumbs-down means "don't play this": move on.
    if (next === -1) void radio.next();
  };

  return (
    <div className="flex items-center gap-3" role="group" aria-label="Rate this track">
      <button
        type="button"
        aria-pressed={rating === 1}
        onClick={() => rate(1)}
        className={`${buttonClass} ${rating === 1 ? "bg-lilac text-ink-900" : "bg-ink-600 text-white hover:bg-ink-500"}`}
      >
        {rating === 1 ? "✓ Liked" : "Like"}
      </button>
      <button
        type="button"
        aria-pressed={rating === -1}
        onClick={() => rate(-1)}
        className={`${buttonClass} ${rating === -1 ? "bg-white text-ink-900" : "bg-ink-600 text-white hover:bg-ink-500"}`}
      >
        {rating === -1 ? "✓ Disliked" : "Dislike"}
      </button>
    </div>
  );
}
