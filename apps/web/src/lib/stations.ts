import type { Station, Track } from "@audius-radio/shared-types";
import { radio } from "../engine/radio";
import { useStationsStore } from "../stores/stationsStore";
import { api } from "./api";

export interface StationPreset {
  name: string;
  sourceType: Station["sourceType"];
  sourceRefs?: Record<string, unknown>;
  /** Needs a real Audius account (not available to guests). */
  requiresAccount?: boolean;
}

export const STATION_PRESETS: StationPreset[] = [
  { name: "Trending", sourceType: "audius_trending" },
  { name: "My Favorites", sourceType: "audius_favorites", requiresAccount: true },
  { name: "Electronic", sourceType: "audius_trending", sourceRefs: { genre: "Electronic" } },
  { name: "Hip-Hop/Rap", sourceType: "audius_trending", sourceRefs: { genre: "Hip-Hop/Rap" } },
  { name: "Lo-Fi", sourceType: "audius_trending", sourceRefs: { genre: "Lo-Fi" } },
  { name: "Ambient", sourceType: "audius_trending", sourceRefs: { genre: "Ambient" } },
];

export const isPresetName = (name: string) =>
  STATION_PRESETS.some((p) => p.name.toLowerCase() === name.trim().toLowerCase());

/** Tunes in to an existing station, using its DJ/crossfade settings. */
export async function tuneInToStation(station: Station): Promise<void> {
  const { tracks } = await api.stationQueue(station.id);
  await radio.tuneIn(tracks, async () => (await api.stationQueue(station.id)).tracks, station.id, {
    crossfadeSec: station.djMode ? station.crossfadeSec : 0,
  });
}

/** Finds (or creates) a preset station by name, then tunes in. */
export async function tuneInToPreset(preset: StationPreset): Promise<void> {
  const { stations, add } = useStationsStore.getState();
  const station =
    stations.find((s) => s.name === preset.name) ??
    (await api.createStation({ name: preset.name, sourceType: preset.sourceType, sourceRefs: preset.sourceRefs })).station;
  add(station);
  await tuneInToStation(station);
}

/** Plays a specific track first, then continues with the rest of `tracks` and trending refills. */
export async function playTrackFrom(tracks: Track[], index: number, genre?: string): Promise<void> {
  const queue = [...tracks.slice(index), ...tracks.slice(0, index)];
  await radio.tuneIn(queue, async () => (await api.trending(genre)).tracks);
}

/** One-line description of where a station's music comes from. */
export function describeStation(s: Station): string {
  const refs = (s.sourceRefs ?? {}) as { genre?: string; query?: string; playlistIds?: string[] };
  switch (s.sourceType) {
    case "audius_favorites":
      return "Your favorites";
    case "audius_playlist":
      return `${refs.playlistIds?.length ?? 0} playlist${refs.playlistIds?.length === 1 ? "" : "s"}`;
    case "audius_search":
      return `Search: ${refs.query ?? ""}`;
    case "audius_trending":
      return refs.genre ? `Trending ${refs.genre}` : "Trending";
    default:
      return "Custom";
  }
}
