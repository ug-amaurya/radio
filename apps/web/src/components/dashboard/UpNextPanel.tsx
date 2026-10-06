import { formatTime } from "../../lib/format";
import { usePlaybackStore } from "../../stores/playbackStore";
import { Artwork } from "../ui/Artwork";

const VISIBLE = 5;

export function UpNextPanel() {
  const upNext = usePlaybackStore((s) => s.upNext);

  return (
    <section aria-label="Up next" className="rounded-3xl bg-ink-700 p-5 shadow-card">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Up next</h2>
        {upNext.length > VISIBLE && <span className="text-sm text-white/60">+{upNext.length - VISIBLE} more</span>}
      </div>
      {upNext.length === 0 ? (
        <p className="text-sm text-white/60">The queue is empty. Tune in to a station to fill it.</p>
      ) : (
        <ol className="space-y-2">
          {upNext.slice(0, VISIBLE).map((t, i) => (
            <li
              key={t.id}
              className={`flex items-center gap-3 rounded-2xl p-2 ${i === 0 ? "bg-ink-600" : "bg-ink-800"}`}
            >
              <span className="w-5 text-center text-sm tabular-nums text-white/60">{i + 1}</span>
              <Artwork src={t.artworkUrl} fallbacks={t.artworkFallbacks} className="h-11 w-11 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{t.title}</p>
                <p className="truncate text-xs text-white/60">{t.artist}</p>
              </div>
              {i === 0 && <span className="rounded-full bg-lilac px-2 py-0.5 text-[10px] font-bold text-ink-900">NEXT</span>}
              <span className="text-xs tabular-nums text-white/60">{formatTime(t.durationSec)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
