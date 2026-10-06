import { useState } from "react";
import { Link } from "react-router-dom";
import type { Station } from "@audius-radio/shared-types";
import {
  describeStation,
  isPresetName,
  STATION_PRESETS,
  tuneInToPreset,
  tuneInToStation,
  type StationPreset,
} from "../../lib/stations";
import { useStationsStore } from "../../stores/stationsStore";
import { CreateStationDialog } from "../stations/CreateStationDialog";

const card = "rounded-2xl bg-ink-800 px-4 py-4 text-left transition hover:bg-ink-600 disabled:cursor-not-allowed disabled:opacity-40";
const iconBtn =
  "grid h-11 w-11 place-items-center rounded-lg text-white/50 transition hover:bg-ink-700 hover:text-white disabled:opacity-40";
const COMPACT_LIMIT = 3;

interface Props {
  isGuest: boolean;
  /** "compact" (Home): presets + a few of your stations. "full" (Stations page): everything. */
  variant?: "compact" | "full";
}

export function StationsPanel({ isGuest, variant = "full" }: Props) {
  const stations = useStationsStore((s) => s.stations);
  const add = useStationsStore((s) => s.add);
  const remove = useStationsStore((s) => s.remove);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; station: Station | null }>({ open: false, station: null });

  const mine = stations.filter((s) => !isPresetName(s.name));
  const shown = variant === "compact" ? mine.slice(0, COMPACT_LIMIT) : mine;

  const run = async (key: string, action: () => Promise<void>) => {
    setLoading(key);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(null);
    }
  };

  const tunePreset = (preset: StationPreset) => run(preset.name, () => tuneInToPreset(preset));

  const onSaved = (station: Station, mode: "created" | "updated") => {
    add(station);
    setDialog({ open: false, station: null });
    if (mode === "created") void run(station.id, () => tuneInToStation(station));
  };

  const del = (station: Station) => {
    if (!window.confirm(`Delete "${station.name}"?`)) return;
    void run(station.id, () => remove(station.id));
  };

  return (
    <section aria-label="Stations" className="rounded-3xl bg-ink-700 p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Stations</h2>
        <div className="flex items-center gap-4">
          {variant === "compact" && (
            <Link to="/stations" className="inline-flex min-h-11 items-center text-sm text-white/70 hover:text-white">
              Manage &rarr;
            </Link>
          )}
          <button
            type="button"
            onClick={() => setDialog({ open: true, station: null })}
            className="min-h-11 rounded-xl bg-lilac px-4 py-2 text-sm font-bold text-ink-900 transition hover:bg-lilac-300"
          >
            + New station
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STATION_PRESETS.map((preset) => {
          const locked = preset.requiresAccount && isGuest;
          return (
            <button
              key={preset.name}
              type="button"
              disabled={locked || loading !== null}
              onClick={() => void tunePreset(preset)}
              title={locked ? "Log in with Audius to use favorites" : undefined}
              className={card}
            >
              <span className="block truncate font-semibold">{preset.name}</span>
              <span className="text-xs text-lilac">
                {loading === preset.name ? "Tuning in..." : locked ? "Audius account" : "Station"}
              </span>
            </button>
          );
        })}
      </div>

      <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-white/60">Your stations</h3>
      {mine.length === 0 ? (
        <p className="text-sm text-white/60">
          You haven&apos;t made any yet. Build one from a genre, a search or your playlists.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((s) => (
            <li key={s.id} className="relative">
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void run(s.id, () => tuneInToStation(s))}
                className={`${card} w-full pr-24`}
              >
                <span className="block truncate font-semibold">{s.name}</span>
                <span className="block truncate text-xs text-white/60">
                  {loading === s.id ? "Tuning in..." : describeStation(s)}
                </span>
                <span className="mt-1 flex gap-1.5">
                  {s.mood && <span className="rounded-full bg-ink-600 px-2 py-0.5 text-[10px] text-lilac">{s.mood}</span>}
                  {s.djMode && (
                    <span className="rounded-full bg-mint px-2 py-0.5 text-[10px] font-bold text-ink-900">DJ {s.crossfadeSec}s</span>
                  )}
                </span>
              </button>
              <div className="absolute right-1 top-1 flex">
                <button
                  type="button"
                  onClick={() => setDialog({ open: true, station: s })}
                  disabled={loading !== null}
                  aria-label={`Edit ${s.name}`}
                  className={iconBtn}
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => del(s)}
                  disabled={loading !== null}
                  aria-label={`Delete ${s.name}`}
                  className={`${iconBtn} hover:text-red-300`}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {variant === "compact" && mine.length > COMPACT_LIMIT && (
        <Link to="/stations" className="mt-3 inline-flex min-h-11 items-center text-sm text-lilac hover:underline">
          +{mine.length - COMPACT_LIMIT} more stations
        </Link>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <CreateStationDialog
        key={dialog.station?.id ?? "new"}
        open={dialog.open}
        isGuest={isGuest}
        station={dialog.station}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onSaved={onSaved}
      />
    </section>
  );
}
