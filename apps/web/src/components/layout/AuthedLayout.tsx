import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { LoginScreen } from "../auth/LoginScreen";
import { useAuth } from "../../hooks/useAuth";
import { sessionClient } from "../../engine/sessionClient";
import { useFavoritesStore } from "../../stores/favoritesStore";
import { useStationsStore } from "../../stores/stationsStore";
import { AppShell } from "./AppShell";

/**
 * Wraps every signed-in page: gates on auth and keeps the shell (nav, search, player bar)
 * mounted across route changes so playback is never interrupted by navigating.
 */
export function AuthedLayout() {
  const { user, status, logout } = useAuth();

  useEffect(() => {
    if (!user) return;
    void useStationsStore.getState().load();
    // Real accounts only: guests have no Audius favorites.
    if (!user.isGuest) void useFavoritesStore.getState().sync();
  }, [user]);

  if (status === "idle" || status === "loading") {
    return <div className="grid min-h-screen place-items-center bg-ink-900 text-white/60">Loading...</div>;
  }
  if (!user) return <LoginScreen />;

  return (
    <AppShell
      user={user}
      onLogout={() => {
        sessionClient.leave();
        void logout();
      }}
    >
      <Outlet />
    </AppShell>
  );
}
