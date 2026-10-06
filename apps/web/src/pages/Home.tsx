import { NowPlayingHero } from "../components/dashboard/NowPlayingHero";
import { StatTile } from "../components/dashboard/StatTile";
import { StationsPanel } from "../components/dashboard/StationsPanel";
import { TrendingGrid } from "../components/dashboard/TrendingGrid";
import { UpNextPanel } from "../components/dashboard/UpNextPanel";
import { ListenTogether } from "../components/session/ListenTogether";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { formatTime } from "../lib/format";
import { STATION_PRESETS, tuneInToPreset } from "../lib/stations";
import { usePlaybackStore } from "../stores/playbackStore";
import { useStationsStore } from "../stores/stationsStore";

export default function Home() {
  const user = useCurrentUser();
  const stationCount = useStationsStore((s) => (s.loaded ? s.stations.length : null));
  const upNextCount = usePlaybackStore((s) => s.upNext.length);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const hasTrack = usePlaybackStore((s) => s.current !== null);
  const remaining = usePlaybackStore((s) => Math.max(s.durationSec - s.positionSec, 0));

  const trending = STATION_PRESETS[0]!;
  const name = user.displayName ?? user.handle;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Greeting + stats */}
      <div className="xl:col-span-5">
        <p className="text-lg">Hi {name},</p>
        <h1 className="text-4xl font-black">Welcome back</h1>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 xl:col-span-7">
        <StatTile value={stationCount ?? "-"} label="stations" />
        <StatTile value={upNextCount} label="up next" />
        <StatTile value={hasTrack ? formatTime(remaining) : "-"} label="left" />
        <StatTile value={user.isGuest ? "Guest" : "Member"} label="mode" />
        <StatTile value={isPlaying ? "Live" : hasTrack ? "Paused" : "Idle"} label="status" highlight />
      </div>

      {/* Now playing + queue */}
      <div className="xl:col-span-7">
        <NowPlayingHero onStart={() => void tuneInToPreset(trending)} />
      </div>
      <div className="space-y-6 xl:col-span-5">
        <UpNextPanel />
        <ListenTogether />
      </div>

      {/* Quick stations */}
      <div className="xl:col-span-12">
        <StationsPanel isGuest={user.isGuest} variant="compact" />
      </div>

      {/* Promo + trending preview */}
      <section aria-label="Daily sounds" className="xl:col-span-4">
        <h2 className="mb-4 text-2xl font-bold">Daily sounds</h2>
        <div className="flex min-h-56 flex-col justify-between rounded-2xl bg-lilac p-6 text-ink-900 xl:h-[calc(100%-3rem)]">
          <p className="text-2xl font-bold leading-snug">Check out what&apos;s trending on Audius and let the radio do the rest!</p>
          <button
            type="button"
            onClick={() => void tuneInToPreset(trending)}
            className="mt-6 min-h-11 self-start rounded-xl bg-ink-900 px-5 py-2.5 font-semibold text-white shadow-card transition hover:bg-ink-700"
          >
            Explore
          </button>
        </div>
      </section>
      <div className="xl:col-span-8">
        <TrendingGrid limit={6} viewAll />
      </div>
    </div>
  );
}
