import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { SessionPreview } from "@audius-radio/shared-types";
import { NowPlayingHero } from "../components/dashboard/NowPlayingHero";
import { AppShell } from "../components/layout/AppShell";
import { sessionClient } from "../engine/sessionClient";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import { useSessionStore } from "../stores/sessionStore";

/** Landing page for a shared listening link. No Audius account needed: visitors get a guest session. */
export default function Join() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { user, status, continueAsGuest, logout } = useAuth();
  const session = useSessionStore();
  const [preview, setPreview] = useState<SessionPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Anyone opening the link gets a guest session automatically.
  useEffect(() => {
    if (status === "unauthenticated") void continueAsGuest().catch(() => setLoadError("Could not start a guest session"));
  }, [status, continueAsGuest]);

  useEffect(() => {
    if (!user) return;
    api
      .getSession(code)
      .then((r) => setPreview(r.session))
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : "Could not find this session"));
  }, [user, code]);

  if (loadError) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-900 p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Can&apos;t join this session</h1>
          <p role="alert" className="mt-2 text-white/70">
            {loadError}
          </p>
          <button type="button" onClick={() => navigate("/")} className="mt-5 rounded-xl bg-lilac px-5 py-2.5 font-bold text-ink-900">
            Go to Audius Radio
          </button>
        </div>
      </div>
    );
  }

  if (!user || !preview) {
    return <div className="grid min-h-screen place-items-center bg-ink-900 text-white/60">Loading...</div>;
  }

  if (session.status === "ended") {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-900 p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">The party has ended</h1>
          <p className="mt-2 text-white/70">@{preview.hostHandle} stopped sharing.</p>
          <button
            type="button"
            onClick={() => {
              session.reset();
              navigate("/");
            }}
            className="mt-5 rounded-xl bg-lilac px-5 py-2.5 font-bold text-ink-900"
          >
            Go to Audius Radio
          </button>
        </div>
      </div>
    );
  }

  const joined = session.status === "live" || session.status === "reconnecting";

  if (!joined) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-900 p-6 text-center">
        <div className="max-w-sm">
          <p className="text-sm uppercase tracking-widest text-lilac">Listen together</p>
          <h1 className="mt-2 text-3xl font-black">@{preview.hostHandle} invited you</h1>
          <p className="mt-3 text-white/70">
            {preview.track ? `Now playing: ${preview.track.title} by ${preview.track.artist}` : "The party is about to start."}
          </p>
          <button
            type="button"
            disabled={session.status === "connecting"}
            onClick={() => void sessionClient.join(code)}
            className="mt-6 rounded-xl bg-lilac px-6 py-3 font-bold text-ink-900 transition hover:bg-lilac-300 disabled:opacity-60"
          >
            {session.status === "connecting" ? "Joining..." : "Join the radio"}
          </button>
          {session.error && (
            <p role="alert" className="mt-3 text-sm text-red-300">
              {session.error}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <AppShell
      user={user}
      onSearch={() => undefined}
      onLogout={() => {
        sessionClient.leave();
        void logout();
      }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink-700 px-4 py-3">
        <p role="status">
          Listening with @{preview.hostHandle} - {session.listeners} {session.listeners === 1 ? "listener" : "listeners"}
          {session.status === "reconnecting" && " (reconnecting...)"}
        </p>
        <button
          type="button"
          onClick={() => {
            sessionClient.leave();
            navigate("/");
          }}
          className="rounded-xl bg-ink-600 px-4 py-2 text-sm font-semibold hover:bg-ink-500"
        >
          Leave
        </button>
      </div>
      <NowPlayingHero onStart={() => undefined} />
    </AppShell>
  );
}
