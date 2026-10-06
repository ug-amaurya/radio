import type { Track } from "@audius-radio/shared-types";
import { api } from "../lib/api";
import { recordPlay } from "../lib/indexedDb";
import { usePlaybackStore } from "../stores/playbackStore";
import { DeckPlayer } from "./DeckPlayer";
import { setupMediaSession, updateMediaSession } from "./mediaSession";

const REFILL_THRESHOLD = 5;
const SKIP_FADE_SEC = 0.3;
const store = () => usePlaybackStore.getState();

type Refill = (exclude: Set<string>) => Promise<Track[]>;

/**
 * Glue between the queue, the stream-URL API and the DeckPlayer: plays the
 * current track, preloads the next one, refills the queue in the background,
 * and skips tracks that fail (retrying once with a freshly resolved URL).
 */
class Radio {
  private player: DeckPlayer | null = null;
  private refill: Refill | null = null;
  private stationId: string | null = null;
  private crossfadeSec = 0;
  private crossfading = false;
  /** Guests in a shared session: the host drives the queue, so local advancing is disabled. */
  private syncMode = false;
  private refilling = false;
  private played = new Set<string>();
  private preloaded: { trackId: string; url: string } | null = null;

  private ensurePlayer(): DeckPlayer {
    if (this.player) return this.player;
    this.player = new DeckPlayer({
      onEnded: () => (this.syncMode ? store().set({ isPlaying: false }) : void this.next(false)),
      onTime: (positionSec, durationSec) => {
        store().set({ positionSec, durationSec });
        this.maybeStartCrossfade(positionSec, durationSec);
      },
      onCapability: (crossfadeSupported) => store().set({ crossfadeSupported }),
      onPlayState: (isPlaying) => store().set({ isPlaying }),
      onError: () => void this.recover(),
    });
    this.player.setVolume(store().volume);
    setupMediaSession({
      play: () => void this.resume(),
      pause: () => this.pause(),
      next: () => void this.next(),
    });
    return this.player;
  }

  /** Starts a station. Call from a click handler so the browser allows audio. */
  async tuneIn(tracks: Track[], refill?: Refill, stationId?: string, options?: { crossfadeSec?: number }): Promise<void> {
    this.logListen(true);
    this.refill = refill ?? null;
    this.stationId = stationId ?? null;
    this.crossfadeSec = options?.crossfadeSec ?? 0;
    this.played.clear();
    this.preloaded = null;
    store().set({ upNext: tracks, current: null, error: null, stationId: stationId ?? null });
    await this.next(false);
  }

  /** Records how the current track ended (best-effort; feeds smart shuffle and cross-device no-repeat). */
  private logListen(skipped: boolean): void {
    const { current, positionSec, durationSec } = store();
    if (!current) return;
    const finished = durationSec > 0 && positionSec >= durationSec - 1;
    void api
      .logListen({
        trackId: current.id,
        stationId: this.stationId,
        skipped: skipped && !finished,
        msPlayed: Math.round(positionSec * 1000),
      })
      .catch(() => undefined);
  }

  /** DJ mode: once the current track is within `crossfadeSec` of its end, start the next one underneath it. */
  private maybeStartCrossfade(positionSec: number, durationSec: number): void {
    if (!this.crossfadeSec || this.crossfading || !this.preloaded || !this.player?.canCrossfade) return;
    // Tracks too short to overlap sensibly just play through.
    if (durationSec < this.crossfadeSec * 2 || durationSec - positionSec > this.crossfadeSec) return;
    this.crossfading = true;
    void this.next(false, this.crossfadeSec);
  }

  /** `fadeSec` overrides the transition: a DJ crossfade, a short click-free fade on skip, or 0 for gapless. */
  async next(userSkip = true, fadeSec?: number): Promise<void> {
    if (this.syncMode) return;
    this.crossfading = false;
    if (store().current) this.logListen(userSkip);
    const [track, ...rest] = store().upNext;
    if (!track) {
      store().set({ current: null, isPlaying: false });
      updateMediaSession(null);
      return;
    }
    store().set({ current: track, upNext: rest, error: null, positionSec: 0, durationSec: 0 });
    this.played.add(track.id);
    void recordPlay(track.id).catch(() => undefined);
    updateMediaSession(track);
    void this.maybeRefill();

    try {
      const player = this.ensurePlayer();
      const advanced =
        this.preloaded?.trackId === track.id &&
        (await player.advanceTo(this.preloaded.url, fadeSec ?? (userSkip ? SKIP_FADE_SEC : 0)));
      if (!advanced) await player.play(await this.resolve(track));
      this.preloaded = null;
      void this.preloadNext();
    } catch {
      await this.recover();
    }
  }

  private retried = new Set<string>();

  /** On a playback failure: retry once with a fresh stream URL, then skip. */
  private async recover(): Promise<void> {
    const track = store().current;
    if (!track) return;
    if (!navigator.onLine) {
      // Don't burn through the queue while offline; reconnect() resumes this track.
      store().set({ isPlaying: false, error: "Waiting for connection..." });
      return;
    }
    if (!this.retried.has(track.id)) {
      this.retried.add(track.id);
      try {
        await this.ensurePlayer().play(await this.resolve(track));
        return;
      } catch {
        /* fall through to skip */
      }
    }
    store().set({ error: `Skipped "${track.title}" (unavailable)` });
    await this.next();
  }

  private async resolve(track: Track): Promise<string> {
    return (await api.streamUrl(track.id)).url;
  }

  private async preloadNext(): Promise<void> {
    const upcoming = store().upNext[0];
    if (!upcoming || this.preloaded?.trackId === upcoming.id) return;
    try {
      const url = await this.resolve(upcoming);
      // The queue may have moved on while the URL was resolving.
      if (store().upNext[0]?.id !== upcoming.id) return;
      this.ensurePlayer().preload(url);
      this.preloaded = { trackId: upcoming.id, url };
    } catch {
      /* preload is best-effort; next() resolves the URL itself */
    }
  }

  private async maybeRefill(): Promise<void> {
    if (!this.refill || this.refilling || store().upNext.length >= REFILL_THRESHOLD) return;
    this.refilling = true;
    try {
      const queued = new Set(store().upNext.map((t) => t.id));
      const fresh = (await this.refill(new Set([...this.played, ...queued]))).filter(
        (t) => !this.played.has(t.id) && !queued.has(t.id),
      );
      store().set({ upNext: [...store().upNext, ...fresh] });
      void this.preloadNext();
    } finally {
      this.refilling = false;
    }
  }

  setSyncMode(on: boolean): void {
    this.syncMode = on;
    if (on) {
      this.refill = null;
      this.preloaded = null;
      this.crossfadeSec = 0;
    }
  }

  /** Shared session: play the host's track from where the room is. Call first from a user gesture. */
  async playSynced(track: Track, positionSec: number, upNext: Track[]): Promise<void> {
    store().set({ current: track, upNext, error: null, positionSec, durationSec: 0 });
    updateMediaSession(track);
    try {
      await this.ensurePlayer().play(await this.resolve(track), positionSec);
    } catch {
      store().set({ error: "Could not play the host's track. It will retry on the next one." });
    }
  }

  /** After the network returns: re-resolve the current track's stream URL and resume where it stopped. */
  async reconnect(): Promise<void> {
    const { current, positionSec } = store();
    if (!current) return;
    try {
      await this.ensurePlayer().play(await this.resolve(current), positionSec);
      store().set({ error: null });
      void this.preloadNext();
    } catch {
      store().set({ error: "Could not reconnect. Press play to retry." });
    }
  }

  /** Sleep timer expiry: fade out, then pause. */
  async fadeOutAndPause(fadeSec: number): Promise<void> {
    await this.player?.fadeOutAndPause(fadeSec);
  }

  async resume(): Promise<void> {
    await this.ensurePlayer().resume();
  }

  pause(): void {
    this.player?.pause();
  }

  async toggle(): Promise<void> {
    if (store().isPlaying) this.pause();
    else await this.resume();
  }

  seek(positionSec: number): void {
    this.player?.seek(positionSec);
  }

  setVolume(volume: number): void {
    store().set({ volume });
    this.player?.setVolume(volume);
  }
}

export const radio = new Radio();
