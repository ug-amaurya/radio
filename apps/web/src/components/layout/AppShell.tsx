import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import type { PublicUser } from "@audius-radio/shared-types";
import { TrackAnnouncer } from "../a11y/TrackAnnouncer";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { SearchResults } from "../dashboard/SearchResults";
import { HomeIcon, LogoutIcon, MusicIcon, SearchIcon, TrendIcon, UserIcon } from "../ui/icons";
import { ConnectionBanner } from "./ConnectionBanner";
import { ThemePicker } from "./ThemePicker";
import { PlayerBar } from "./PlayerBar";

const railBtn = "grid h-11 w-11 place-items-center rounded-xl text-white/60 transition hover:text-white";

const NAV = [
  { to: "/", label: "Home", Icon: HomeIcon, end: true },
  { to: "/stations", label: "Stations", Icon: MusicIcon, end: false },
  { to: "/trending", label: "Trending", Icon: TrendIcon, end: false },
  { to: "/profile", label: "Profile", Icon: UserIcon, end: false },
];

interface Props {
  user: PublicUser;
  /** Optional hook for callers that want to observe searches; results are shown by the shell itself. */
  onSearch?: (query: string) => void;
  onLogout: () => void;
  children: ReactNode;
}

function Avatar({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid place-items-center rounded-full bg-lilac font-bold uppercase text-ink-900 ${className}`}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export function AppShell({ user, onSearch, onLogout, children }: Props) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const { pathname } = useLocation();
  const name = user.displayName ?? user.handle;
  useKeyboardShortcuts();

  // New page: start at the top, and drop any search results from the previous one.
  useEffect(() => {
    window.scrollTo(0, 0);
    setSubmitted("");
    setQuery("");
  }, [pathname]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    setSubmitted(q);
    onSearch?.(q);
  };

  return (
    <div className="min-h-screen bg-ink-900">
      <a
        href="#main"
        className="sr-only z-50 rounded-xl bg-lilac px-4 py-2 font-bold text-ink-900 focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to main content
      </a>
      <TrackAnnouncer />
      {/* Left icon rail */}
      <nav
        aria-label="Main"
        className="fixed inset-y-0 left-0 z-10 hidden w-20 flex-col items-center border-r border-white/5 bg-ink-800 py-6 md:flex"
      >
        <div className="flex flex-1 flex-col items-center gap-3">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              aria-label={label}
              className={({ isActive }) => `${railBtn} ${isActive ? "bg-black text-white" : ""}`}
            >
              <Icon />
            </NavLink>
          ))}
        </div>
        <button type="button" className={railBtn} onClick={onLogout} aria-label={user.isGuest ? "Leave guest mode" : "Log out"}>
          <LogoutIcon />
        </button>
      </nav>

      <main id="main" tabIndex={-1} className="mx-auto max-w-[1600px] px-4 pb-32 pt-6 focus:outline-none md:pl-28 md:pr-8">
        <ConnectionBanner />
        <header className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <form role="search" onSubmit={submit} className="order-last flex min-h-11 w-full items-center gap-3 rounded-xl px-2 sm:order-none sm:w-auto sm:flex-1 text-white/60 focus-within:ring-2 focus-within:ring-lilac">
            <SearchIcon aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tracks and artists"
              aria-label="Search"
              className="min-h-11 w-full max-w-md bg-transparent text-sm text-white placeholder:text-white/60 focus:outline-none"
            />
          </form>
          <div className="flex items-center gap-4">
            <ThemePicker />
            {user.isGuest && <span className="rounded-full bg-mint px-2 py-0.5 text-[10px] font-bold text-ink-900">guest</span>}
            <Avatar name={name} className="h-9 w-9 text-sm" />
            <button type="button" onClick={onLogout} className="inline-flex min-h-11 items-center px-2 text-xs text-white/60 underline md:hidden">
              {user.isGuest ? "Leave" : "Log out"}
            </button>
          </div>
        </header>
        <nav aria-label="Pages" className="-mt-2 mb-6 flex gap-2 overflow-x-auto md:hidden">
          {NAV.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${
                  isActive ? "bg-lilac text-ink-900" : "bg-ink-700 text-white/80"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        {submitted && <SearchResults query={submitted} onClear={() => { setSubmitted(""); setQuery(""); }} />}
        {children}
        <footer className="mt-12 border-t border-white/10 pt-4 text-xs text-white/60">
          Music is streamed from{" "}
          <a href="https://audius.co" target="_blank" rel="noreferrer" className="text-lilac underline">
            Audius
          </a>
          . Every track links back to its artist on Audius. Audius Radio is not affiliated with or endorsed by Audius.
        </footer>
      </main>

      <PlayerBar />
    </div>
  );
}
