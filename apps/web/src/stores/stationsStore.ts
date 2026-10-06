import { create } from "zustand";
import type { Station } from "@audius-radio/shared-types";
import { api } from "../lib/api";

interface StationsState {
  stations: Station[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (station: Station) => void;
  remove: (id: string) => Promise<void>;
  reset: () => void;
}

export const useStationsStore = create<StationsState>((set, get) => ({
  stations: [],
  loaded: false,
  load: async () => {
    try {
      set({ stations: (await api.stations()).stations, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  add: (station) => set({ stations: [...get().stations.filter((s) => s.id !== station.id), station] }),
  remove: async (id) => {
    await api.deleteStation(id);
    set({ stations: get().stations.filter((s) => s.id !== id) });
  },
  reset: () => set({ stations: [], loaded: false }),
}));
