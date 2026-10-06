import { useEffect } from "react";
import { radio } from "../../engine/radio";
import { useConnectionStore } from "../../stores/connectionStore";
import { usePlaybackStore } from "../../stores/playbackStore";

/** Tells the listener when the network drops, and resumes playback when it returns. */
export function ConnectionBanner() {
  const online = useConnectionStore((s) => s.online);
  const setOnline = useConnectionStore((s) => s.setOnline);

  useEffect(() => {
    let wasPlaying = false;
    const goOffline = () => {
      wasPlaying = usePlaybackStore.getState().isPlaying || wasPlaying;
      setOnline(false);
    };
    const goOnline = () => {
      setOnline(true);
      const { current, isPlaying } = usePlaybackStore.getState();
      if (wasPlaying && current && !isPlaying) void radio.reconnect();
      wasPlaying = false;
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [setOnline]);

  if (online) return null;
  return (
    <div role="status" className="mb-4 rounded-xl bg-yellow-900 px-4 py-2 text-center text-sm text-yellow-100">
      You&apos;re offline. Music will pause when the buffered audio runs out, and resume when you&apos;re back online.
    </div>
  );
}
