import { create } from "zustand";

interface ConnectionState {
  /** navigator.onLine, or false after a request failed at the network level. */
  online: boolean;
  setOnline: (online: boolean) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  setOnline: (online) => set({ online }),
}));
