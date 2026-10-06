import { radio } from "../../engine/radio";
import { formatTime } from "../../lib/format";
import { usePlaybackStore } from "../../stores/playbackStore";

/** Seek bar with the time on either side; screen readers hear "1:05 of 3:20" rather than raw seconds. */
export function SeekSlider({ className = "" }: { className?: string }) {
  const hasTrack = usePlaybackStore((s) => s.current !== null);
  const positionSec = usePlaybackStore((s) => s.positionSec);
  const durationSec = usePlaybackStore((s) => s.durationSec);
  const progress = durationSec > 0 ? (positionSec / durationSec) * 100 : 0;

  return (
    <div className={`flex items-center gap-3 text-xs text-white/60 ${className}`}>
      <span aria-hidden="true" className="w-9 text-right tabular-nums">
        {formatTime(positionSec)}
      </span>
      <input
        type="range"
        aria-label="Seek"
        aria-valuetext={`${formatTime(positionSec)} of ${formatTime(durationSec)}`}
        className="range-lilac"
        style={{ "--fill": `${progress}%` } as React.CSSProperties}
        min={0}
        max={durationSec || 1}
        step={1}
        value={Math.min(positionSec, durationSec || 1)}
        disabled={!hasTrack || durationSec === 0}
        onChange={(e) => radio.seek(Number(e.target.value))}
      />
      <span aria-hidden="true" className="w-9 tabular-nums">
        {formatTime(durationSec)}
      </span>
    </div>
  );
}
