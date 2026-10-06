import { create } from "zustand";

/** Whether the full-screen player is open. Shared so the mini player and the hero card can both open it. */
export const usePlayerSheetStore = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
