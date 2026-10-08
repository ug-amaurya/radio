import { radio } from "../../engine/radio";
import { usePlaybackStore } from "../../stores/playbackStore";
import { FeedbackButtons } from "../player/FeedbackButtons";
import { InFavoritesBadge } from "../player/InFavoritesBadge";
import { SleepTimerMenu } from "../player/SleepTimerMenu";
import { Artwork } from "../ui/Artwork";
import { usePlayerSheetStore } from "../../stores/playerSheetStore";
import { ExpandIcon, NextIcon, PauseIcon, PlayIcon } from "../ui/icons";

const ctrl =
  "grid h-12 w-12 place-items-center rounded-xl bg-ink-600 text-white transition hover:bg-ink-500 disabled:cursor-not-allowed disabled:opacity-40";

export function NowPlayingHero({ onStart }: { onStart: () => void }) {
  const { current, isPlaying, error } = usePlaybackStore();
  const openFullScreen = usePlayerSheetStore((s) => s.setOpen);

  return (
    <section aria-label="Now playing" className="rounded-3xl bg-ink-700 p-4 shadow-card sm:p-5">
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="relative shrink-0 sm:w-56">
          <span aria-hidden="true" className="absolute -left-2 top-3 hidden h-[calc(100%-1.5rem)] w-full rounded-2xl bg-ink-600 sm:block" />
          <Artwork
            src={current?.artworkUrl}
            fallbacks={current?.artworkFallbacks}
            className="relative aspect-square w-full rounded-2xl object-cover text-5xl shadow-card"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-5">
          {current ? (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {current.genre && (
                  <span className="rounded-full bg-mint px-3 py-0.5 text-xs font-bold text-ink-900">{current.genre}</span>
                )}
                <InFavoritesBadge trackId={current.id} />
              </div>
              <h2 className="mt-3 text-2xl font-bold leading-tight [overflow-wrap:anywhere] sm:text-3xl">{current.title}</h2>
              <p className="mt-1 text-lg text-white/80 [overflow-wrap:anywhere]">{current.artist}</p>
              {current.permalinkUrl && (
                <a
                  href={current.permalinkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm text-lilac underline"
                >
                  Listen on Audius
                </a>
              )}
              {error && <p className="mt-2 text-sm text-yellow-300">{error}</p>}
            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">Nothing playing yet</h2>
              <p className="mt-2 text-white/70">Pick a station below, or start with what&apos;s trending right now.</p>
              <button
                type="button"
                onClick={onStart}
                className="mt-4 rounded-xl bg-lilac px-5 py-2.5 font-bold text-ink-900 transition hover:bg-lilac-300"
              >
                Tune in to Trending
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              className={ctrl}
              disabled={!current}
              onClick={() => void radio.toggle()}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button type="button" className={ctrl} disabled={!current} onClick={() => void radio.next()} aria-label="Skip">
              <NextIcon />
            </button>
            <button
              type="button"
              className={ctrl}
              disabled={!current}
              onClick={() => openFullScreen(true)}
              aria-haspopup="dialog"
              aria-label="Open full screen player"
              title="Full screen"
            >
              <ExpandIcon />
            </button>
          </div>
          <FeedbackButtons />
          <SleepTimerMenu />
        </div>
      </div>
    </section>
  );
}
