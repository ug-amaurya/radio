import { radio } from "../../engine/radio";
import { usePlaybackStore } from "../../stores/playbackStore";
import { Artwork } from "../ui/Artwork";
import { SeekSlider } from "../player/SeekSlider";
import { NextIcon, PauseIcon, PlayIcon, VolumeIcon } from "../ui/icons";
import { usePlayerSheetStore } from "../../stores/playerSheetStore";
import { NowPlayingSheet } from "./NowPlayingSheet";

const roundBtn =
  "grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-600 text-white transition hover:bg-ink-500 disabled:cursor-not-allowed disabled:opacity-40";

export function PlayerBar() {
  const { current, isPlaying, volume } = usePlaybackStore();
  const sheetOpen = usePlayerSheetStore((s) => s.open);
  const setSheetOpen = usePlayerSheetStore((s) => s.setOpen);
  const hasTrack = current !== null;
  const next = usePlaybackStore((s) => s.upNext[0]);

  return (
    <div
      role="region"
      aria-label="Player"
      className="fixed inset-x-3 bottom-3 z-20 flex items-center gap-3 rounded-2xl bg-ink-700/95 px-3 py-2.5 shadow-card backdrop-blur md:left-24 md:right-3 md:gap-5 md:px-4"
    >
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        disabled={!hasTrack}
        aria-haspopup="dialog"
        aria-label={current ? `Open full player: ${current.title} by ${current.artist}` : "Nothing playing"}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl text-left disabled:cursor-default md:hidden"
      >
        <Artwork src={current?.artworkUrl} fallbacks={current?.artworkFallbacks} className="h-11 w-11 shrink-0 rounded-lg object-cover" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{current?.title ?? "Nothing playing"}</span>
          <span className="block truncate text-xs text-white/60">{current?.artist ?? "Tune in to a station"}</span>
        </span>
      </button>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        disabled={!hasTrack}
        aria-haspopup="dialog"
        aria-label={current ? `Open full screen player: ${current.title} by ${current.artist}` : "Nothing playing"}
        className="hidden min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition enabled:hover:bg-white/5 disabled:cursor-default md:flex md:flex-none md:basis-1/4"
      >
        <Artwork src={current?.artworkUrl} fallbacks={current?.artworkFallbacks} className="h-11 w-11 shrink-0 rounded-lg object-cover" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{current?.title ?? "Nothing playing"}</p>
          <p className="truncate text-xs text-white/60">{current?.artist ?? "Tune in to a station"}</p>
          {next && (
            <p className="truncate text-xs text-lilac">
              Next: {next.title} <span className="text-white/60">- {next.artist}</span>
            </p>
          )}
        </div>
      </button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className={roundBtn}
          disabled={!hasTrack}
          onClick={() => void radio.toggle()}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button type="button" className={roundBtn} disabled={!hasTrack} onClick={() => void radio.next()} aria-label="Skip">
          <NextIcon />
        </button>
      </div>

      <SeekSlider className="hidden flex-1 md:flex" />

      <label className="hidden w-32 items-center gap-2 text-white/60 lg:flex">
        <VolumeIcon width={18} height={18} />
        <span className="sr-only">Volume</span>
        <input
          type="range"
          className="range-lilac"
          style={{ "--fill": `${volume * 100}%` } as React.CSSProperties}
          min={0}
          max={1}
          step={0.01}
          value={volume}
          aria-valuetext={`${Math.round(volume * 100)}%`}
          onChange={(e) => radio.setVolume(Number(e.target.value))}
        />
      </label>
      <NowPlayingSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
