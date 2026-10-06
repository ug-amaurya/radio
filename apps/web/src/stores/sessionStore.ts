import { create } from "zustand";

export type SessionStatus = "idle" | "connecting" | "live" | "reconnecting" | "ended" | "error";

interface SessionState {
  role: "host" | "guest" | null;
  joinCode: string | null;
  listeners: number;
  status: SessionStatus;
  error: string | null;
  set: (patch: Partial<Omit<SessionState, "set" | "reset">>) => void;
  reset: () => void;
}

const initial = { role: null, joinCode: null, listeners: 0, status: "idle", error: null } as const;

export const useSessionStore = create<SessionState>((set) => ({
  ...initial,
  set: (patch) => set(patch),
  reset: () => set({ ...initial }),
}));
