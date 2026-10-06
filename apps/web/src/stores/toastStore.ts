import { create } from "zustand";

export type ToastKind = "error" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const DISMISS_MS = 6000;
const MAX_VISIBLE = 3;

interface ToastState {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (kind, message) => {
    // The same failure often fires several times at once (e.g. a queue refill and a preload): show it once.
    if (get().toasts.some((t) => t.message === message)) return;
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, kind, message }].slice(-MAX_VISIBLE) });
    setTimeout(() => get().dismiss(id), DISMISS_MS);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = {
  error: (message: string) => useToastStore.getState().push("error", message),
  info: (message: string) => useToastStore.getState().push("info", message),
};
