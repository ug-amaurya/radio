import { create } from "zustand";
import type { Track } from "@audius-radio/shared-types";

interface PlaybackState {
  current: Track | null;
  upNext: Track[];
  isPlaying: boolean;
  positionSec: number;
  durationSec: number;
  volume: number;
  error: string | null;
  /** The station currently on air (null when playing an ad-hoc track list). */
  stationId: string | null;
  /** trackId -> 1 (thumbs up) | -1 (thumbs down). Unrated tracks are absent. */
  ratings: Record<string, 1 | -1>;
  /** null until the first play builds the audio graph; false = gapless fallback only. */
  crossfadeSupported: boolean | null;
  set: (patch: Partial<Omit<PlaybackState, "set">>) => void;
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  current: null,
  upNext: [],
  isPlaying: false,
  positionSec: 0,
  durationSec: 0,
  volume: 0.8,
  error: null,
  stationId: null,
  ratings: {},
  crossfadeSupported: null,
  set: (patch) => set(patch),
}));
