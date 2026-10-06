import type { Station } from "@prisma/client";
import type { Track } from "@audius-radio/shared-types";
import { getProvider } from "../providers/index.js";

/** Resolves a station's source definition into its pool of tracks. */
export async function loadStationPool(station: Station, audiusUserId: string): Promise<Track[]> {
  const provider = getProvider();
  const refs = (station.sourceRefs ?? {}) as { playlistIds?: string[]; genre?: string; query?: string };

  switch (station.sourceType) {
    case "audius_favorites":
      return provider.getUserFavorites(audiusUserId);
    case "audius_playlist":
      return (await Promise.all((refs.playlistIds ?? []).map((id) => provider.getPlaylistTracks(id)))).flat();
    case "audius_trending":
      return provider.getTrending({ genre: refs.genre });
    case "audius_search":
      return provider.search(refs.query ?? "");
    default:
      return [];
  }
}
