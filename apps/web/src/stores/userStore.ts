import { create } from "zustand";
import type { PublicUser } from "@audius-radio/shared-types";

export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

interface UserState {
  user: PublicUser | null;
  status: AuthStatus;
  setUser: (user: PublicUser | null) => void;
  setStatus: (status: AuthStatus) => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  status: "idle",
  setUser: (user) => set({ user, status: user ? "authenticated" : "unauthenticated" }),
  setStatus: (status) => set({ status }),
}));
