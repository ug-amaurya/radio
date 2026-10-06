import type { PlaylistSummary, ProviderId, Track } from "@audius-radio/shared-types";

/** The radio engine only ever talks to this interface, never to a source (Audius, local files) directly. */
export interface MusicProvider {
  readonly id: ProviderId;
  search(query: string, opts?: { limit?: number }): Promise<Track[]>;
  getTrending(opts?: { genre?: string; time?: "week" | "month" | "allTime" }): Promise<Track[]>;
  getUserFavorites(userId: string): Promise<Track[]>;
  getUserPlaylists(userId: string): Promise<PlaylistSummary[]>;
  getPlaylistTracks(playlistId: string): Promise<Track[]>;
  getRelated(trackId: string): Promise<Track[]>;
  /** Resolved just-in-time; never stored. */
  getStreamUrl(trackId: string): Promise<string>;
}
