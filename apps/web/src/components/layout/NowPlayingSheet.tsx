import { useEffect, useRef } from "react";
import { radio } from "../../engine/radio";
import { useDominantColor } from "../../hooks/useDominantColor";
import { formatTime } from "../../lib/format";
import { usePlaybackStore } from "../../stores/playbackStore";
import { Artwork } from "../ui/Artwork";
import { NextIcon, PauseIcon, PlayIcon } from "../ui/icons";
import { SeekSlider } from "../player/SeekSlider";

/**
 * Minimal full-screen player: cover, title, artist, seek bar and transport on a soft wash
 * of the cover's dominant color. A native <dialog> gives focus trapping, Escape-to-close
 * and an inert page behind it.
 */
export function NowPlayingSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const current = usePlaybackStore((s) => s.current);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const color = useDominantColor(current?.artworkUrl, current?.artworkFallbacks);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Nothing left to show (queue ran out): close instead of sitting on an empty screen.
  useEffect(() => {
    if (open && !current) onClose();
  }, [open, current, onClose]);

  const tint = color ? color.join(" ") : undefined;
  const meta = current ? [current.genre, formatTime(current.durationSec)].filter(Boolean).join("  ·  ") : "";

  return (
    <dialog
      ref={ref}
      aria-label="Now playing"
      onClose={onClose}
      style={{ "--tint": tint } as React.CSSProperties}
      className="m-0 h-full max-h-none w-full max-w-none overflow-hidden bg-ink-900 p-0 text-white backdrop:bg-black/70"
    >
      {/* Soft wash of the cover's color; falls back to the theme accent. Decorative. */}
      <div
        aria-hidden="true"
        key={tint ?? "none"}
        className="absolute inset-0 motion-safe:animate-fade-in"
        style={{
          background:
            "linear-gradient(to bottom, rgb(var(--tint, var(--c-accent)) / 0.45), rgb(var(--c-ink-900)) 85%)",
        }}
      />

      <button
        type="button"
        onClick={onClose}
        aria-label="Close player"
        className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full text-xl text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        ✕
      </button>

      <div className="relative mx-auto flex h-full max-w-sm flex-col items-center justify-center gap-8 overflow-y-auto px-6 py-16">
        <Artwork
          src={current?.artworkUrl}
          fallbacks={current?.artworkFallbacks}
          alt={current ? `Cover art for ${current.title}` : ""}
          className="aspect-square w-full rounded-2xl object-cover text-6xl shadow-card"
        />

        <div className="w-full text-center" aria-live="polite">
          <h2 className="text-2xl font-bold leading-tight">{current?.title ?? "Nothing playing"}</h2>
          <p className="mt-1 text-white/70">{current?.artist ?? "Tune in to a station"}</p>
          {meta && <p className="mt-2 text-sm text-white/50">{meta}</p>}
        </div>

        <SeekSlider className="w-full" />

        <div className="flex items-center gap-6">
          <button
            type="button"
            disabled={!current}
            onClick={() => void radio.toggle()}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="grid h-16 w-16 place-items-center rounded-full bg-white text-ink-900 transition hover:scale-105 disabled:opacity-40 motion-reduce:hover:scale-100"
          >
            {isPlaying ? <PauseIcon width={26} height={26} /> : <PlayIcon width={26} height={26} />}
          </button>
          <button
            type="button"
            disabled={!current}
            onClick={() => void radio.next()}
            aria-label="Skip"
            className="grid h-12 w-12 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            <NextIcon width={24} height={24} />
          </button>
        </div>
      </div>
    </dialog>
  );
}
