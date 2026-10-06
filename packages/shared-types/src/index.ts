// DTOs shared between apps/web and apps/api.
// These mirror the Prisma schema but never include secrets
// (no Audius tokens are stored at all).

export interface PublicUser {
  id: string;
  audiusUserId: string;
  handle: string;
  displayName: string | null;
  /** True for "Continue as guest" sessions (no Audius account: no favorites/playlists). */
  isGuest: boolean;
  createdAt: string;
}

export interface Station {
  id: string;
  userId: string;
  name: string;
  mood: string | null;
  sourceType: "audius_favorites" | "audius_playlist" | "audius_trending" | "audius_search" | "custom_mix";
  sourceRefs: Record<string, unknown>;
  djMode: boolean;
  crossfadeSec: number;
  discoverMode: boolean;
  shareSlug: string | null;
  createdAt: string;
}

export interface ListenEvent {
  id: string;
  userId: string;
  trackId: string;
  stationId: string | null;
  playedAt: string;
  skipped: boolean;
  msPlayed: number | null;
}

export interface TrackFeedback {
  id: string;
  userId: string;
  trackId: string;
  rating: 1 | -1;
  createdAt: string;
}

export interface SharedSession {
  id: string;
  hostUserId: string;
  stationId: string;
  joinCode: string;
  startedAt: string;
  active: boolean;
}

// --- Auth ---

export interface AuthCallbackRequest {
  /** JWT returned by Log in with Audius; the backend verifies it with Audius. */
  token: string;
}

export interface SessionUserResponse {
  user: PublicUser;
}

// --- Music providers ---

export type ProviderId = "audius" | "local";

export interface Track {
  /** Namespaced, e.g. "audius:D7KyD". */
  id: string;
  provider: ProviderId;
  title: string;
  artist: string;
  artworkUrl?: string;
  /** Same artwork on other content nodes; try these when `artworkUrl` fails to load. */
  artworkFallbacks?: string[];
  durationSec: number;
  genre?: string;
  mood?: string;
  /** Link back to the source (attribution). */
  permalinkUrl?: string;
}

export interface PlaylistSummary {
  id: string;
  name: string;
  trackCount: number;
  artworkUrl?: string;
}

export interface TracksResponse {
  tracks: Track[];
}

export interface PlaylistsResponse {
  playlists: PlaylistSummary[];
}

export interface StreamUrlResponse {
  url: string;
}

export interface StationsResponse {
  stations: Station[];
}

export interface StationResponse {
  station: Station;
}

export interface CreateStationRequest {
  name: string;
  mood?: string | null;
  sourceType: Station["sourceType"];
  sourceRefs?: Record<string, unknown>;
  djMode?: boolean;
  discoverMode?: boolean;
  /** 3-10 seconds. */
  crossfadeSec?: number;
}

export interface LogListenRequest {
  trackId: string;
  stationId?: string | null;
  skipped: boolean;
  msPlayed?: number | null;
}


export interface RateTrackRequest {
  trackId: string;
  /** 1 = thumbs up, -1 = thumbs down, 0 = clear. */
  rating: 1 | -1 | 0;
  genre?: string | null;
}

export interface FeedbackResponse {
  ratings: Record<string, 1 | -1>;
}

// --- Shared listening sessions ---

export interface SessionState {
  track: Track | null;
  upNext: Track[];
  /** How far into `track` the room is, by the server's clock. */
  positionMs: number;
}

export interface SessionPreview extends SessionState {
  joinCode: string;
  hostHandle: string;
}

export interface CreateSessionResponse {
  session: { joinCode: string; stationId: string };
}

export interface SessionPreviewResponse {
  session: SessionPreview;
}
