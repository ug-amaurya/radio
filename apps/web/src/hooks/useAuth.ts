import { useCallback, useEffect } from "react";
import { api, ApiError } from "../lib/api";
import { completeAudiusRedirect, startLogin } from "../lib/audius";
import { useUserStore } from "../stores/userStore";

/**
 * Owns the session lifecycle: checks for an existing session on mount,
 * starts "Log in with Audius", and exchanges the returned JWT for a session
 * by calling our backend, which verifies it with Audius. Also offers a guest
 * session for users who can't reach Audius login (blocked in some regions).
 */
export function useAuth() {
  const user = useUserStore((s) => s.user);
  const status = useUserStore((s) => s.status);
  const setUser = useUserStore((s) => s.setUser);
  const setStatus = useUserStore((s) => s.setStatus);

  useEffect(() => {
    if (status !== "idle") return;
    setStatus("loading");
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null));
  }, [status, setStatus, setUser]);

  const login = useCallback(() => startLogin(), []);

  const completeLogin = useCallback(async () => {
    const token = await completeAudiusRedirect();
    const res = await api.callback({ token });
    setUser(res.user);
  }, [setUser]);

  const continueAsGuest = useCallback(async () => {
    const res = await api.guest();
    setUser(res.user);
  }, [setUser]);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, [setUser]);

  return { user, status, login, completeLogin, continueAsGuest, logout };
}

export { ApiError };
