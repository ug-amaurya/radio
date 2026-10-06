import type { Track } from "@audius-radio/shared-types";

export interface MediaSessionHandlers {
  play: () => void;
  pause: () => void;
  next: () => void;
}

/** Exposes track info and transport controls to the lock screen, headset buttons and media keys. */
export function setupMediaSession(handlers: MediaSessionHandlers): void {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.setActionHandler("play", handlers.play);
  navigator.mediaSession.setActionHandler("pause", handlers.pause);
  navigator.mediaSession.setActionHandler("nexttrack", handlers.next);
}

export function updateMediaSession(track: Track | null): void {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = track
    ? new MediaMetadata({
        title: track.title,
        artist: track.artist,
        artwork: track.artworkUrl ? [{ src: track.artworkUrl, sizes: "480x480" }] : [],
      })
    : null;
}
