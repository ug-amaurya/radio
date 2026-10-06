import { create } from "zustand";
import { api } from "../lib/api";
import { cacheFavorites, getCachedFavoriteIds } from "../lib/indexedDb";

interface FavoritesState {
  ids: Set<string>;
  /** Loads the cached list from IndexedDB first (instant, works offline), then refreshes it from Audius. */
  sync: () => Promise<void>;
}

export const useFavoritesStore = create<FavoritesState>((set) => ({
  ids: new Set(),
  sync: async () => {
    set({ ids: new Set(await getCachedFavoriteIds().catch(() => [])) });
    try {
      const { tracks } = await api.favorites();
      const ids = tracks.map((t) => t.id);
      set({ ids: new Set(ids) });
      await cacheFavorites(ids);
    } catch {
      /* keep the cached list */
    }
  },
}));
