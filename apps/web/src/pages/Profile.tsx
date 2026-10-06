import { LoginButton } from "../components/auth/LoginButton";
import { ThemeList } from "../components/layout/ThemePicker";
import { useAuth } from "../hooks/useAuth";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { sessionClient } from "../engine/sessionClient";

export default function Profile() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const name = user.displayName ?? user.handle;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-4xl font-black">Profile</h1>

      <section aria-label="Account" className="flex items-center gap-4 rounded-3xl bg-ink-700 p-5 shadow-card">
        <span aria-hidden="true" className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-lilac text-2xl font-bold uppercase text-ink-900">
          {name.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold">{name}</p>
          <p className="truncate text-sm text-white/60">@{user.handle}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${user.isGuest ? "bg-mint text-ink-900" : "bg-lilac text-ink-900"}`}
        >
          {user.isGuest ? "Guest" : "Audius member"}
        </span>
      </section>

      {user.isGuest && (
        <section aria-label="Upgrade" className="rounded-3xl bg-ink-700 p-5 shadow-card">
          <h2 className="text-lg font-bold">Have an Audius account?</h2>
          <p className="mb-4 mt-1 text-sm text-white/70">
            Log in to use your favorites and playlists. Stations you made as a guest stay with this browser session and won&apos;t carry over.
          </p>
          <LoginButton />
        </section>
      )}

      <section aria-label="Appearance" className="rounded-3xl bg-ink-700 p-5 shadow-card">
        <h2 className="mb-3 text-lg font-bold">Theme</h2>
        <ThemeList />
      </section>

      <button
        type="button"
        onClick={() => {
          sessionClient.leave();
          void logout();
        }}
        className="min-h-11 rounded-xl border border-white/20 px-5 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-ink-700"
      >
        {user.isGuest ? "Leave guest mode" : "Log out"}
      </button>
    </div>
  );
}
