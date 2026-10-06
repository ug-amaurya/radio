import { usePlaybackStore } from "../../stores/playbackStore";

/**
 * The one place track changes are announced to screen readers. (Having several
 * aria-live regions react to the same change makes them read it out repeatedly.)
 */
export function TrackAnnouncer() {
  const text = usePlaybackStore((s) => (s.current ? `Now playing: ${s.current.title} by ${s.current.artist}` : ""));
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {text}
    </div>
  );
}
