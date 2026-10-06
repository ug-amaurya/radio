import type { PlaylistSummary, Track } from "@audius-radio/shared-types";
import { audiusGet } from "../../services/audiusHttp.js";
import { cached } from "../../services/cache.js";
import type { MusicProvider } from "../MusicProvider.js";

// Endpoints and shapes checked against the live API (api.audius.co/v1).
interface AudiusArtwork {
  "480x480"?: string;
  /** Other content nodes that host the same file under the same path. */
  mirrors?: string[];
}

interface AudiusTrack {
  id: string;
  title: string;
  duration: number;
  genre?: string;
  mood?: string;
  permalink?: string;
  artwork?: AudiusArtwork;
  user: { name: string };
}

interface AudiusPlaylist {
  id: string;
  playlist_name: string;
  track_count: number;
  artwork?: { "480x480"?: string };
}

const MIN = 60;
const HOUR = 60 * MIN;
const AUDIUS_SITE = "https://audius.co";

const trackId = (id: string) => `audius:${id}`;
const rawId = (id: string) => id.replace(/^audius:/, "");

/** Rebuilds the artwork URL on each mirror host (the path is identical across nodes). */
export function artworkFallbacks(artwork?: AudiusArtwork): string[] | undefined {
  const url = artwork?.["480x480"];
  if (!url || !artwork.mirrors?.length) return undefined;
  const { pathname } = new URL(url);
  return artwork.mirrors.map((host) => `${host.replace(/\/$/, "")}${pathname}`).filter((u) => u !== url);
}

function toTrack(t: AudiusTrack): Track {
  return {
    id: trackId(t.id),
    provider: "audius",
    title: t.title,
    artist: t.user.name,
    artworkUrl: t.artwork?.["480x480"],
    artworkFallbacks: artworkFallbacks(t.artwork),
    durationSec: t.duration,
    genre: t.genre,
    mood: t.mood,
    permalinkUrl: t.permalink ? `${AUDIUS_SITE}${t.permalink}` : undefined,
  };
}

export class AudiusProvider implements MusicProvider {
  readonly id = "audius" as const;

  search(query: string, opts?: { limit?: number }): Promise<Track[]> {
    const limit = opts?.limit ?? 25;
    return cached(`audius:search:${query.toLowerCase()}:${limit}`, 10 * MIN, async () =>
      (await audiusGet<AudiusTrack[]>("/tracks/search", { query, limit })).map(toTrack),
    );
  }

  getTrending(opts?: { genre?: string; time?: "week" | "month" | "allTime" }): Promise<Track[]> {
    const { genre, time = "week" } = opts ?? {};
    return cached(`audius:trending:${genre ?? "all"}:${time}`, HOUR, async () =>
      (await audiusGet<AudiusTrack[]>("/tracks/trending", { genre, time })).map(toTrack),
    );
  }

  getUserFavorites(userId: string): Promise<Track[]> {
    return cached(`audius:favorites:${userId}`, 5 * MIN, async () => {
      // /favorites only returns ids; the library endpoint returns full tracks wrapped as { item }.
      const rows = await audiusGet<Array<{ item: AudiusTrack }>>(`/users/${userId}/library/tracks`, {
        type: "favorite",
        limit: 100,
      });
      return rows.map((r) => toTrack(r.item));
    });
  }

  getUserPlaylists(userId: string): Promise<PlaylistSummary[]> {
    return cached(`audius:playlists:${userId}`, 5 * MIN, async () =>
      (await audiusGet<AudiusPlaylist[]>(`/users/${userId}/playlists`)).map((p) => ({
        id: p.id,
        name: p.playlist_name,
        trackCount: p.track_count,
        artworkUrl: p.artwork?.["480x480"],
      })),
    );
  }

  getPlaylistTracks(playlistId: string): Promise<Track[]> {
    return cached(`audius:playlist:${playlistId}`, 10 * MIN, async () =>
      (await audiusGet<AudiusTrack[]>(`/playlists/${playlistId}/tracks`)).map(toTrack),
    );
  }

  getRelated(id: string): Promise<Track[]> {
    const raw = rawId(id);
    // Audius has no related-tracks endpoint: approximate with trending in the track's genre.
    return cached(`audius:related:${raw}`, HOUR, async () => {
      const { genre } = await audiusGet<AudiusTrack>(`/tracks/${raw}`);
      const trending = await audiusGet<AudiusTrack[]>("/tracks/trending", { genre });
      return trending.filter((t) => t.id !== raw).map(toTrack);
    });
  }

  async getStreamUrl(id: string): Promise<string> {
    // Not cached: resolved just-in-time in case the URL expires or rotates.
    return audiusGet<string>(`/tracks/${rawId(id)}/stream`, { no_redirect: true });
  }
}
