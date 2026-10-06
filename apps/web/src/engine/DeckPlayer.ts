import { equalPowerCurves } from "./crossfade";

export interface DeckEvents {
  onEnded: () => void;
  onTime: (positionSec: number, durationSec: number) => void;
  onPlayState: (playing: boolean) => void;
  onError: () => void;
  /** Fired once the audio graph is built: true if Web Audio crossfading is available. */
  onCapability?: (crossfadeSupported: boolean) => void;
}

const SKIP_FADE_SEC = 0.3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Two HTMLAudioElement "decks". While one plays, the other preloads the next
 * track so advancing is gapless. Each deck routes through a Web Audio GainNode
 * (needs CORS on the stream host) which enables equal-power crossfades and
 * volume control on iOS. Without Web Audio it degrades to plain gapless playback.
 */
export class DeckPlayer {
  private decks: [HTMLAudioElement, HTMLAudioElement];
  private active = 0;
  private preloadedUrl: string | null = null;

  private ctx: AudioContext | null = null;
  private gains: [GainNode, GainNode] | null = null;
  private master: GainNode | null = null;
  private webAudioFailed = false;
  private volume = 0.8;

  private fadeOutgoing: number | null = null;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private events: DeckEvents) {
    this.decks = [new Audio(), new Audio()];
    this.decks.forEach((deck, i) => {
      // Required for Web Audio to read the stream; must be set before src.
      deck.crossOrigin = "anonymous";
      deck.preload = "auto";
      const isActive = () => i === this.active;
      deck.addEventListener("ended", () => isActive() && this.events.onEnded());
      deck.addEventListener("timeupdate", () => {
        if (isActive()) this.events.onTime(deck.currentTime, Number.isFinite(deck.duration) ? deck.duration : 0);
      });
      deck.addEventListener("play", () => isActive() && this.events.onPlayState(true));
      deck.addEventListener("pause", () => isActive() && !deck.ended && this.events.onPlayState(false));
      deck.addEventListener("error", () => isActive() && this.events.onError());
      deck.addEventListener("stalled", () => isActive() && deck.paused === false && deck.load());
    });
  }

  private get deck(): HTMLAudioElement {
    return this.decks[this.active]!;
  }

  private get idleDeck(): HTMLAudioElement {
    return this.decks[1 - this.active]!;
  }

  /** True once the Web Audio graph exists, i.e. crossfading will actually work. */
  get canCrossfade(): boolean {
    return this.ctx !== null && this.gains !== null;
  }

  /** Builds the Web Audio graph on first use (inside a user gesture, per autoplay policy). */
  private async ensureAudioGraph(): Promise<void> {
    if (!this.ctx && !this.webAudioFailed) {
      try {
        const Ctor =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) throw new Error("Web Audio unavailable");
        const ctx = new Ctor();
        const master = ctx.createGain();
        master.gain.value = this.volume;
        master.connect(ctx.destination);
        const gains = this.decks.map((deck) => {
          const gain = ctx.createGain();
          ctx.createMediaElementSource(deck).connect(gain);
          gain.connect(master);
          return gain;
        }) as [GainNode, GainNode];
        this.decks.forEach((d) => (d.volume = 1));
        this.ctx = ctx;
        this.master = master;
        this.gains = gains;
      } catch {
        this.webAudioFailed = true;
      }
      this.events.onCapability?.(this.canCrossfade);
    }
    if (this.ctx?.state === "suspended") await this.ctx.resume();
  }

  /** Loads and plays a URL on the active deck. Must first be called from a user gesture. */
  async play(url: string, startAtSec = 0): Promise<void> {
    await this.ensureAudioGraph();
    this.finishFade();
    await this.fadeOutActive();
    this.preloadedUrl = null;
    this.idleDeck.removeAttribute("src");
    this.deck.src = url;
    if (startAtSec > 0) {
      const deck = this.deck;
      deck.addEventListener("loadedmetadata", () => (deck.currentTime = startAtSec), { once: true });
    }
    await this.deck.play();
  }

  /** Fades the master volume to silence over `fadeSec`, pauses, then restores the volume. */
  async fadeOutAndPause(fadeSec: number): Promise<void> {
    if (this.ctx && this.master) {
      const gain = this.master.gain;
      const now = this.ctx.currentTime;
      gain.cancelScheduledValues(0);
      gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(0, now + fadeSec);
    } else {
      // No Web Audio: step the element volume down instead (iOS ignores this, so it just pauses there).
      const steps = 20;
      for (let i = steps - 1; i >= 0; i--) {
        this.decks.forEach((d) => (d.volume = (this.volume * i) / steps));
        await sleep((fadeSec * 1000) / steps);
      }
    }
    if (this.ctx) await sleep(fadeSec * 1000);
    this.deck.pause();
    if (this.master) {
      this.master.gain.cancelScheduledValues(0);
      this.master.gain.value = this.volume;
    } else {
      this.decks.forEach((d) => (d.volume = this.volume));
    }
  }

  /** Starts loading the next track on the idle deck. */
  preload(url: string): void {
    this.preloadedUrl = url;
    this.idleDeck.src = url;
    this.idleDeck.load();
  }

  /**
   * Swaps to the preloaded deck if it holds `url`, overlapping the two tracks
   * with an equal-power crossfade of `fadeSec` (0 = gapless hard swap).
   * Returns false if nothing matching was preloaded.
   */
  async advanceTo(url: string, fadeSec = 0): Promise<boolean> {
    if (this.preloadedUrl !== url) return false;
    this.finishFade();
    const outgoingIdx = this.active;
    const outgoing = this.deck;
    this.active = 1 - this.active;
    this.preloadedUrl = null;
    const incoming = this.deck;

    if (fadeSec > 0 && this.ctx && this.gains) {
      const { fadeIn, fadeOut } = equalPowerCurves();
      const start = this.ctx.currentTime + 0.01;
      const inGain = this.gains[this.active]!.gain;
      const outGain = this.gains[outgoingIdx]!.gain;
      inGain.cancelScheduledValues(0);
      outGain.cancelScheduledValues(0);
      inGain.value = 0;
      outGain.value = 1;
      inGain.setValueCurveAtTime(fadeIn, start, fadeSec);
      outGain.setValueCurveAtTime(fadeOut, start, fadeSec);
      this.fadeOutgoing = outgoingIdx;
      this.fadeTimer = setTimeout(() => this.finishFade(), fadeSec * 1000 + 100);
    } else {
      outgoing.pause();
      outgoing.removeAttribute("src");
    }
    await incoming.play();
    return true;
  }

  /** Ends any in-progress crossfade immediately: stops the outgoing deck and restores unity gain. */
  private finishFade(): void {
    if (this.fadeOutgoing === null) return;
    if (this.fadeTimer) clearTimeout(this.fadeTimer);
    this.fadeTimer = null;
    const outgoing = this.decks[this.fadeOutgoing]!;
    outgoing.pause();
    outgoing.removeAttribute("src");
    this.fadeOutgoing = null;
    this.resetGains();
  }

  private resetGains(): void {
    this.gains?.forEach((g) => {
      g.gain.cancelScheduledValues(0);
      g.gain.value = 1;
    });
  }

  /** Short fade-out before cutting to another track, to avoid an audible click. */
  private async fadeOutActive(): Promise<void> {
    if (!this.ctx || !this.gains || this.deck.paused || this.deck.ended) return;
    const gain = this.gains[this.active]!.gain;
    const now = this.ctx.currentTime;
    gain.cancelScheduledValues(0);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + SKIP_FADE_SEC);
    await sleep(SKIP_FADE_SEC * 1000);
    this.deck.pause();
    this.resetGains();
  }

  async resume(): Promise<void> {
    await this.ensureAudioGraph();
    await this.deck.play();
  }

  pause(): void {
    this.deck.pause();
  }

  seek(positionSec: number): void {
    this.deck.currentTime = positionSec;
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (this.master) this.master.gain.value = volume;
    else this.decks.forEach((d) => (d.volume = volume));
  }

  dispose(): void {
    this.finishFade();
    this.decks.forEach((d) => {
      d.pause();
      d.removeAttribute("src");
    });
    void this.ctx?.close();
  }
}
