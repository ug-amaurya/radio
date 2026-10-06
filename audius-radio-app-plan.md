# Audius Radio — Project Plan

A radio-style listening web app: continuous playback, DJ-mode crossfade, mood/genre "stations," smart shuffle, thumbs up/down feedback, sleep timer, discover mode, and shareable "listen together" stations. **Audius is the first music source**, built behind a provider interface so a self-hosted/local library (or another source) can be added later without touching the radio engine.

> **Why Audius instead of Spotify**: Spotify's Development Mode now requires the developer to have Premium, caps each app at 5 users, and limits endpoints — incompatible with a 10–50 user app on free infrastructure. Audius has a free API plan (10 req/s, 500,000 req/month), needs no Premium, has no 5-user cap, and serves plain audio streams — which also makes real crossfading possible (Spotify's SDK doesn't allow it).
>
> **Trade-off to accept up front**: the Audius catalog is mostly independent/electronic artists, not mainstream hits. Users' "personal playlists" means their Audius favorites and playlists, plus curated stations built from Audius trending/genre/search.

---

## 1. Key Decisions

| Decision | Choice |
|---|---|
| Music source (v1) | Audius REST API + `@audius/sdk` |
| Source architecture | `MusicProvider` interface; `AudiusProvider` first, `LocalLibraryProvider` later |
| User login | "Log in with Audius" (OAuth 2.0 PKCE via the SDK) → app issues its own httpOnly session cookie |
| Audio playback | Two HTML5 `<audio>` "decks" for gapless/crossfade, Web Audio `GainNode` where CORS allows |
| Backend role | Proxy + cache all Audius API calls (keeps the bearer token secret, protects the monthly request budget), stations, history, shared sessions |
| Hosting | 100% free tiers, GitHub-driven auto-deploy (Section 11) |
| Scale target | 10–50 users |

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | Component-based, fast dev loop |
| State | Zustand | Small, fits player/queue/station state |
| Styling | Tailwind CSS | Fast, consistent, accessible utilities |
| Backend | Node.js + Express (TypeScript) | Same language end to end |
| DB | PostgreSQL (Prisma) | Users, stations, history, feedback, sessions |
| Cache | Redis (Upstash free) | Audius response cache, rate-limit counters, session state |
| Realtime | Socket.IO | Shared listening sync |
| Source SDK | `@audius/sdk` | Search, tracks, playlists, OAuth |
| Audio | HTMLAudioElement ×2 + Web Audio API + Media Session API | Crossfade, lock-screen controls |
| Client storage | IndexedDB (`idb`) | Recent-plays ring buffer, queued feedback, favorites cache |

---

## 3. Project Structure

```
audius-radio/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── player/        NowPlaying, PlaybackControls, VolumeSlider,
│   │   │   │   │                  FeedbackButtons, SleepTimerMenu
│   │   │   │   ├── queue/         UpNextList, QueuePeekDrawer
│   │   │   │   ├── stations/      StationGrid, StationCard, StationEditor, ShareStationModal
│   │   │   │   ├── auth/          LoginButton, AuthCallback
│   │   │   │   └── layout/        AppShell, AccessibleSkipLink, ConnectionBanner
│   │   │   ├── engine/
│   │   │   │   ├── DeckPlayer.ts        two-deck audio engine (load/preload/play/fade)
│   │   │   │   ├── crossfade.ts         equal-power fade curves + scheduling
│   │   │   │   ├── queueEngine.ts       refill, auto-advance, smart shuffle
│   │   │   │   └── mediaSession.ts      lock-screen/hardware key controls
│   │   │   ├── hooks/                   useAuth, usePlayer, useSleepTimer, useSharedSession
│   │   │   ├── lib/                     api.ts (typed client), indexedDb.ts
│   │   │   ├── stores/                  playbackStore, stationStore, userStore
│   │   │   └── pages/                   Home, Station, Callback, SharedSession
│   │   └── vite.config.ts
│   └── api/
│       ├── src/
│       │   ├── providers/
│       │   │   ├── MusicProvider.ts     interface (Section 4)
│       │   │   ├── audius/AudiusProvider.ts
│       │   │   └── index.ts             provider registry
│       │   ├── routes/                  auth, library, catalog, stations, feedback,
│       │   │                            history, sessions
│       │   ├── services/                audiusClient (rate-limit aware), stationEngine,
│       │   │                            recommendationService, cache
│       │   ├── middleware/              requireAuth, rateLimiter, errorHandler
│       │   ├── sockets/sessionGateway.ts
│       │   └── db/prisma/schema.prisma
│       └── server.ts
├── packages/shared-types/               Track, Station, Provider DTOs
├── infra/docker-compose.yml             local Postgres + Redis
├── .github/workflows/ci.yml
└── .env.example
```

---

## 4. Provider Abstraction

The radio engine only ever talks to this interface, never to Audius directly.

```ts
// packages/shared-types
export interface Track {
  id: string;               // namespaced: "audius:D7KyD"
  provider: 'audius' | 'local';
  title: string;
  artist: string;
  artworkUrl?: string;
  durationSec: number;
  genre?: string;
  mood?: string;
  permalinkUrl?: string;    // link back to source (attribution)
}

export interface MusicProvider {
  readonly id: 'audius' | 'local';
  search(query: string, opts?: { limit?: number }): Promise<Track[]>;
  getTrending(opts?: { genre?: string; time?: 'week' | 'month' | 'allTime' }): Promise<Track[]>;
  getUserFavorites(userId: string): Promise<Track[]>;
  getUserPlaylists(userId: string): Promise<PlaylistSummary[]>;
  getPlaylistTracks(playlistId: string): Promise<Track[]>;
  getRelated(trackId: string): Promise<Track[]>;       // discover mode
  getStreamUrl(trackId: string): Promise<string>;      // resolved just-in-time
}
```

Adding a local-library provider later = implement this interface + register it. Nothing in `engine/`, stations, feedback, or shared sessions changes.

---

## 5. Database Schema (PostgreSQL / Prisma)

No Audius tokens are stored — Log in with Audius gives the app a verified identity, not long-lived API credentials.

```prisma
model User {
  id            String   @id @default(uuid())
  audiusUserId  String   @unique
  handle        String
  displayName   String?
  createdAt     DateTime @default(now())

  stations      Station[]
  history       ListenEvent[]
  feedback      TrackFeedback[]
  sessions      SharedSession[] @relation("host")
}

model Station {
  id            String   @id @default(uuid())
  userId        String
  name          String
  mood          String?
  // "audius_favorites" | "audius_playlist" | "audius_trending" | "audius_search" | "custom_mix"
  sourceType    String
  sourceRefs    Json              // e.g. { playlistIds: [...] } or { genre: "Lo-Fi" }
  djMode        Boolean  @default(false)
  crossfadeSec  Int      @default(5)      // validated 3–10
  discoverMode  Boolean  @default(false)
  shareSlug     String?  @unique
  createdAt     DateTime @default(now())

  user          User     @relation(fields: [userId], references: [id])
}

model ListenEvent {
  id        String   @id @default(uuid())
  userId    String
  trackId   String                 // namespaced id
  stationId String?
  playedAt  DateTime @default(now())
  skipped   Boolean  @default(false)
  msPlayed  Int?
  user      User     @relation(fields: [userId], references: [id])
  @@index([userId, playedAt])
}

model TrackFeedback {
  id        String   @id @default(uuid())
  userId    String
  trackId   String
  genre     String?                // denormalized so feedback can steer discover mode
  rating    Int                    // 1 | -1
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
  @@unique([userId, trackId])
}

model SharedSession {
  id            String   @id @default(uuid())
  hostUserId    String
  stationId     String
  joinCode      String   @unique
  // authoritative playback clock for sync:
  currentTrackId String?
  trackStartedAt DateTime?         // server time the current track began
  active        Boolean  @default(true)
  startedAt     DateTime @default(now())
  host          User     @relation("host", fields: [hostUserId], references: [id])
}
```

---

## 6. Authentication ("Log in with Audius")

Audius login proves *who the user is* and optionally grants write access (favoriting, etc.). Reading public catalog data needs only the API key/bearer token, so **the app only requests `read` scope**.

**Flow (SDK OAuth 2.0 PKCE, redirect-based):**
1. Frontend initializes `@audius/sdk` with the **API key** (safe in the browser) and a `redirectUri` (e.g. `https://your-app.vercel.app/callback`).
2. User clicks "Continue with Audius" → `audiusSdk.oauth.login({ scope: 'read' })` redirects to Audius.
3. Audius redirects back; `audiusSdk.oauth.handleRedirectCallback()` yields the user profile (userId, handle, name) and a signed JWT.
4. Frontend sends the JWT to `POST /auth/callback`. **Backend verifies the JWT with Audius** (never trust the client's claimed profile), upserts the `User`, and sets an httpOnly, secure, sameSite cookie session.
5. All later requests use the session cookie.

**Secrets rule**: the Audius **bearer token** (API secret) lives only on the backend in env vars — never shipped to the browser. The frontend only ever calls *your* API, which proxies and caches Audius requests.

**Guest mode (implemented)**: `audius.co` (the Log in with Audius page) is blocked by Cloudflare in some regions, including India, while `api.audius.co` and audio streams still work. The login screen therefore offers "Continue as guest". `POST /auth/guest` (rate-limited to 10/hour/IP via Redis) creates a `User` row with `audiusUserId = "guest:<uuid>"`, handle `guest-xxxxxx`, and a normal session. `PublicUser.isGuest` is derived from that prefix. Guests get trending/search/custom stations, history and feedback, but `/library/favorites`, `/library/playlists` and `audius_favorites` stations return 403 (`requireAudiusAccount`). Guest data is tied to the session cookie; clearing it orphans the row (cleanup job tracked in `indexeddb-migration-plan.md` §9a).

> Verify against current docs when implementing: exact SDK method names and the JWT verification endpoint (`docs.audius.co` → Log In with Audius). The SDK has changed across major versions.

---

## 7. Key Backend API Endpoints

All prefixed `/api/v1`. The frontend never calls Audius directly for catalog data — it calls these, and they proxy + cache.

### Auth
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/callback` | Verify Audius JWT, upsert user, set session cookie |
| POST | `/auth/guest` | Create a guest session (fallback when Audius login is unreachable) |
| GET | `/auth/me` | Current user |
| POST | `/auth/logout` | Clear session |

### Library & Catalog (proxied from Audius)
| Method | Path | Purpose |
|---|---|---|
| GET | `/library/favorites` | User's Audius favorites (paginated, cached) |
| GET | `/library/playlists` | User's Audius playlists |
| GET | `/library/playlists/:id/tracks` | Tracks in a playlist |
| GET | `/catalog/trending?genre=&time=` | Trending tracks, optionally by genre |
| GET | `/catalog/search?q=` | Search tracks |
| GET | `/catalog/tracks/:id/related` | Related tracks (discover mode) |
| GET | `/catalog/tracks/:id/stream` | Returns a fresh stream URL for the track (resolved just-in-time, not stored) |

### Stations
| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/stations` | List / create |
| PATCH/DELETE | `/stations/:id` | Update (crossfade 3–10s, discover on/off) / remove |
| GET | `/stations/:id/queue?count=` | Next N tracks: smart shuffle + discover injection + feedback weighting |
| POST | `/stations/:id/share` | Create/return share slug |
| GET | `/stations/join/:slug` | Resolve a shared station |

### Feedback & History
| Method | Path | Purpose |
|---|---|---|
| POST | `/feedback` | `{ trackId, rating: 1 \| -1 }` |
| GET | `/feedback?trackIds=` | Ratings for a batch of tracks |
| POST | `/history` | Log a listen event (played/skipped/msPlayed) |
| GET | `/history/recent` | Recent plays (cross-device no-repeat) |

### Shared Sessions
| Method | Path | Purpose |
|---|---|---|
| POST | `/sessions` | Host starts a session for a station |
| GET | `/sessions/:joinCode` | Session state for a joining guest |
| WS | `session:state`, `session:track-change`, `session:resync` | Server-authoritative sync (Section 8.5) |

Note there are **no `/playback/*` proxy endpoints** (unlike a Spotify design): playback is entirely local in the browser's audio engine. The server only supplies track lists and stream URLs.

---

## 8. Radio Engine (frontend)

### 8.1 Two-deck player (`DeckPlayer`)
- Two `HTMLAudioElement`s (Deck A / Deck B). While A plays, B **preloads** the next track (`preload="auto"`, stream URL fetched ahead of time). This delivers gapless playback by default.
- On `ended` (or at the crossfade trigger point), the roles swap. The queue refills in the background when it drops below ~5 tracks, so playback never stalls waiting for the network.
- Stream URLs are resolved **just before use** (not stored) in case they expire or rotate.

### 8.2 DJ mode / crossfade (3–10 s, configurable)
- Start the fade when `duration - currentTime <= crossfadeSec`: start Deck B at gain 0, ramp B up and A down together using an **equal-power curve** (`cos`/`sin`) so perceived loudness stays constant, then stop and unload A.
- Implementation preference order:
  1. **Web Audio `GainNode` per deck** (`createMediaElementSource`) — precise, smooth. Requires the audio element to have `crossOrigin="anonymous"` and the stream host to send CORS headers.
  2. **`HTMLMediaElement.volume` ramps** via `requestAnimationFrame` — no CORS needed, but **iOS Safari ignores programmatic volume**.
  3. **Graceful fallback**: if neither works on a device (e.g., iOS without CORS), degrade to gapless playback with no overlap and show a small notice in DJ-mode settings. Detect at startup with a quick capability test rather than assuming.
- Skipping manually mid-fade should cancel the fade and cut to the next track with a short (~300 ms) fade-out to avoid clicks.

### 8.3 Smart shuffle
- Keep a rolling "recently played" window (last ~30–50 tracks or ~50% of the pool, whichever is smaller) in IndexedDB, mirrored via `ListenEvent`.
- Next-track selection excludes the window; if the pool is smaller than the window, fall back to **least recently played** so small stations never stall.
- Weighting: thumbs-up artists/genres get a boost; thumbs-down tracks are excluded and their artist is down-weighted. Quick skips (<10 s) count as soft negative signals.

### 8.4 Stations & Discover mode
- A station = a named source definition (favorites, one or more playlists, trending-by-genre, search, or a mix) plus mood/DJ/discover settings. Presets render as a grid of "radio buttons."
- **Discover mode**: every Nth slot (default 1 in 5) is filled from `/catalog/tracks/:id/related` and `/catalog/trending?genre=` seeded by the user's recent thumbs-up tracks and the station's dominant genres — Audius has no direct equivalent of Spotify's recommendations endpoint, so this is built from related-tracks + genre trending + your own feedback data.

### 8.5 Shared "listen together" stations
Because audio is plain streaming (no DRM), sync is simple and accurate:
- The server holds the **authoritative clock**: `currentTrackId` + `trackStartedAt` (server time).
- A joining client computes `offset = serverNow - trackStartedAt`, loads the track, and seeks to `offset`. Clients correct drift on a periodic `session:resync` (every ~15–30 s), tolerating a few hundred ms.
- The host (or an auto-advance timer on the server) emits `session:track-change` when a track ends; guests preload the next track from the shared queue.
- Guests need no Audius login — they get a guest session for the shared room.

### 8.6 Sleep timer
- 15/30/60 min presets via `useSleepTimer`. At expiry, **fade out over ~10 s**, pause, and clear. Visible countdown; cancel/extend available. (Counts down on wall-clock time so it survives tab throttling.)

### 8.7 "Offline" indicator — adapted for Audius
Audius is a streaming service and its terms govern caching of audio, so v1 does **not** download audio for offline play. The indicator becomes two honest signals instead:
- a **"In your favorites"** badge on tracks that are in the user's Audius favorites (from the cached favorites list in IndexedDB), and
- a **connection status banner** (`navigator.onLine` + failed-fetch detection) that explains when playback will pause because the network dropped.
True offline caching can be revisited later only for tracks whose artists enable downloads, and for the local-library provider (your own files).

### 8.8 Media Session (mobile/desktop OS controls)
Use the Media Session API to expose title/artist/artwork and play/pause/next/previous to the lock screen, headset buttons, and keyboard media keys — important for the "radio in the background" feel on mobile browsers.

---

## 9. UI & Accessibility

| Requirement | Component |
|---|---|
| Now playing (artwork, artist, title) | `NowPlaying` |
| Up-next + peek | `UpNextList`, `QueuePeekDrawer` |
| Play/pause, skip, volume | `PlaybackControls`, `VolumeSlider` |
| Thumbs up/down | `FeedbackButtons` → `POST /feedback` |
| Stations + custom builder | `StationGrid`, `StationEditor` |
| Sleep timer | `SleepTimerMenu` |
| Share link | `ShareStationModal` |

**Responsive**: mobile = mini-player that expands to a full-screen sheet, ≥44 px touch targets; desktop = station rail + bottom transport bar.

**Accessibility (WCAG 2.1 AA)**: native `<button>`/`<input type="range">` controls with visible focus; `aria-live="polite"` announcement on track change; full keyboard map (Space play/pause, arrows for seek/volume/station grid with roving tabindex); ≥4.5:1 contrast; thumbs state conveyed by icon shape + label, not color alone; respect `prefers-reduced-motion`; decorative artwork gets `alt=""` since title/artist are text.

**Attribution**: show artist name and a link back to each track's Audius page (`permalinkUrl`) in the player; confirm current Audius API terms for any additional attribution requirements.

---

## 10. Rate Limits, Errors, and Terms

- **Audius free plan: 10 requests/second, 500,000 requests/month.** For 10–50 users this is generous, but protect it anyway: the backend's `audiusClient` caches (Redis) favorites/playlists (minutes), trending (an hour+), and track metadata (hours); batches where possible; and backs off on `429`.
- **Budget sanity check**: 50 users × ~30 API calls/hour × ~4 hours/day × 30 days ≈ 180k calls/month *before caching* — within budget, and caching cuts it substantially. Monitor monthly usage in logs.
- **Keys**: API key may live in the frontend; the **bearer token stays server-side**.
- **Playback errors**: handle `error`/`stalled`/`waiting` events on each deck; on a failed track, retry once with a freshly resolved stream URL, then skip to the next track and log it. Tracks removed or made private by artists must be skipped gracefully, not stall the station.
- **Network drops**: pause cleanly, show the connection banner, and resume (re-resolving URLs) when back online. Keep the next track preloaded to ride out brief blips.
- **Autoplay policy**: browsers require a user gesture before audio starts — the first "Tune in" click unlocks the `AudioContext` and both decks; design the first-load flow around that.
- **Terms**: don't download/redistribute audio, respect artist-set availability, keep attribution/links visible, and re-check the Audius API terms before launch.

---

## 11. Hosting & Deployment (Free-Tier Only, 10–50 Users)

### 11.1 Where each piece lives (all free)

| Piece | Host | Notes |
|---|---|---|
| Frontend (Vite build) | **Vercel** (Hobby) | Static build + CDN, preview URL per PR |
| Backend (Express + Socket.IO) | **Render** (free web service) | Sleeps after ~15 min idle (cold start ~30–60 s) → keep-alive ping below |
| PostgreSQL | **Neon** or **Supabase** (free) | Far more storage than this app needs |
| Redis | **Upstash** (free) | Keep values small (IDs, short JSON) |
| Errors | **Sentry** (free plan) | |
| Uptime + keep-alive | **UptimeRobot** (free) | Ping `/health` every 5 min; keeps Render awake |

Serverless functions are a poor fit for the backend because Socket.IO needs a persistent process.

### 11.2 Domains, HTTPS, redirect URIs
Use the free `*.vercel.app` / `*.onrender.com` subdomains (free TLS). Register the production **redirect URI** (e.g., `https://your-app.vercel.app/callback`) in your Audius app settings alongside `http://localhost:5173/callback`; it must match exactly. Set `FRONTEND_ORIGIN` (CORS) and cookie domain settings so the session cookie works across the frontend/backend split (or proxy `/api` through Vercel rewrites to keep it same-site, which avoids third-party-cookie problems on Safari).

### 11.3 Environment variables

| Variable | Local | Production |
|---|---|---|
| `AUDIUS_API_KEY` | from Audius API Plans page | same app is fine |
| `AUDIUS_BEARER_TOKEN` | same (**server only**) | same (**server only**) |
| `AUDIUS_REDIRECT_URI` | `http://localhost:5173/callback` | `https://your-app.vercel.app/callback` |
| `DATABASE_URL` | local Docker Postgres | Neon/Supabase connection string |
| `REDIS_URL` | local Docker Redis | Upstash connection string |
| `SESSION_SECRET` | any dev value | unique random value |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Vercel URL |
| `COOKIE_SECURE` | `false` | `true` |

Secrets live in Vercel/Render dashboards, never in git; `.env.example` documents the shape only.

### 11.4 GitHub as source of truth + auto-deploy on push to `main`
1. Push the monorepo to GitHub (`apps/web`, `apps/api`).
2. **Vercel**: Import the repo → Root Directory `apps/web` → Production Branch `main` (or `master`).
3. **Render**: New Web Service from the same repo → Root Directory `apps/api` → build `npm install && npm run build`, start `npm start`, pre-deploy `npx prisma migrate deploy` → Auto-Deploy on push to `main`.
4. Add env vars (11.3) in both dashboards once.

**On every `git push origin main`**: Vercel rebuilds and promotes the frontend; Render rebuilds the backend, runs migrations, and restarts — both automatically and in parallel. Vercel also builds a preview deployment for each PR. Turn on **branch protection** for `main` (require PR + passing checks).

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
```

### 11.5 Keeping within free limits
Cache aggressively (Section 10); if shared sessions ever run on multiple backend instances, add the Socket.IO Redis adapter (Upstash supports it); revisit only if you outgrow ~50 users or a dashboard shows a free-tier cap approaching.

### 11.6 Local dev parity
`docker compose up` (Postgres + Redis) → copy `.env.example` → `npm install` at the root (workspaces) → `npm run dev` runs web + api together.

---

## 12. Implementation Roadmap

### Phase 0 — Setup (½–1 day)
- Create an Audius app/API key at the Audius API Plans page; note the key and bearer token.
- Scaffold the monorepo, `docker-compose.yml`, `.env.example`, Prisma schema + first migration, root `npm run dev`.
- Create the GitHub repo and push; connect Vercel + Render early so the deploy pipeline is proven with a "hello world" before features exist.
- **Milestone**: both apps run locally; pushing to `main` deploys a placeholder to production.

### Phase 1 — Provider layer + auth (2 days)
- Implement `MusicProvider` + `AudiusProvider` (trending, search, favorites, playlists, related, stream URL) with Redis caching and 429 backoff.
- Implement Log in with Audius → `/auth/callback` JWT verification → cookie session; `requireAuth`; guest fallback.
- Tests: JWT verification, session middleware, provider caching/backoff (mock Audius).
- **Milestone**: log in and see your handle plus your Audius favorites list rendered.

### Phase 2 — Single-deck playback (2 days)
- `DeckPlayer` with one deck, `NowPlaying`, `PlaybackControls`, `VolumeSlider`, Media Session, autoplay-unlock on first click, error handling.
- **Milestone**: pick a track/playlist and play, pause, skip, change volume.

### Phase 3 — Continuous queue + smart shuffle (2–3 days)
- Second deck + preloading for gapless playback; `stationEngine` + `/stations/:id/queue`; background refill; recent-plays window (IndexedDB + `ListenEvent`); `UpNextList` and peek drawer.
- **Milestone**: a full playlist plays continuously with gapless transitions and no near-term repeats.

### Phase 4 — Stations (2 days)
- Station CRUD, `StationEditor`, preset `StationGrid`; clean queue swap when tuning to another station.
- **Milestone**: 3 stations (e.g., favorites, a Lo-Fi trending station, a playlist) switchable like radio presets.

### Phase 5 — DJ mode crossfade (2–3 days)
- Equal-power crossfade with the 3–10 s setting; capability detection with graceful fallback (iOS/CORS); skip-during-fade handling.
- **Milestone**: audible smooth crossfade on desktop; sensible fallback on iOS.

### Phase 6 — Feedback & Discover (2 days)
- Thumbs up/down UI + `/feedback`; weighting in `stationEngine`; discover injection via related/trending seeded by feedback.
- **Milestone**: thumbs-ups visibly shift what discover mode surfaces.

### Phase 7 — Sleep timer & status indicators (1 day)
- Sleep timer with fade-out; "In your favorites" badges; connection banner.
- **Milestone**: 15-minute timer fades out and pauses on time.

### Phase 8 — Shared listening (2–3 days)
- `SharedSession` + Socket.IO gateway, server-authoritative clock, join links, guest sessions, periodic resync.
- **Milestone**: two browsers on one link stay within a few hundred ms of each other.

### Phase 9 — Accessibility & responsive pass (1–2 days)
- Keyboard map, screen reader pass (VoiceOver/NVDA), contrast, reduced motion, mobile layout and touch targets.

### Phase 10 — Hardening & launch (2 days)
- Centralized error handling and toasts, Sentry, UptimeRobot `/health` keep-alive, monthly Audius usage logging, final terms/attribution check, production redirect URI registered.
- **Milestone**: production URL, real login, whole flow works on free infrastructure.

**Estimate**: ~3 weeks part-time, or ~1.5 weeks full-time.

---

## 13. Risks & Open Decisions

| Risk / decision | Mitigation |
|---|---|
| **iOS ignores `audio.volume`** and stream hosts may lack CORS for Web Audio → crossfade may not work on some devices | Capability detection + gapless fallback (8.2); test on a real iPhone in Phase 5 |
| **Catalog fit**: Audius is mostly independent/electronic music | Genre/mood stations built on trending + search; add the `LocalLibraryProvider` (Navidrome or uploaded files) for personal music |
| **Stream URL format/CORS/headers** can change | Resolve URLs just-in-time; verify against live docs/Swagger in Phase 1–2 |
| **Audius SDK/OAuth changes** between versions | Pin the SDK version; keep auth behind `useAuth` so it's swappable |
| **API terms/attribution** | Re-read terms before launch; keep artist/track links visible |
| **Free-tier cold starts** (Render) | UptimeRobot keep-alive; accept occasional slow first load |
| Whether to add `LocalLibraryProvider` next | Decide after v1 feedback; the interface already supports it |
