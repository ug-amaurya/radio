import { create } from "zustand";

interface SleepState {
  /** Wall-clock expiry (ms since epoch), so the countdown survives tab throttling. */
  endsAt: number | null;
  start: (minutes: number) => void;
  extend: (minutes: number) => void;
  cancel: () => void;
}

export const useSleepStore = create<SleepState>((set, get) => ({
  endsAt: null,
  start: (minutes) => set({ endsAt: Date.now() + minutes * 60_000 }),
  extend: (minutes) => {
    const { endsAt } = get();
    if (endsAt) set({ endsAt: endsAt + minutes * 60_000 });
  },
  cancel: () => set({ endsAt: null }),
}));
