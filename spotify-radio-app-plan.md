# Spotify Radio — Project Plan

A radio-style listening experience built on top of a user's own Spotify library: continuous playback, DJ-mode crossfading, mood/genre "stations," smart shuffle, and social sharing — all via the Spotify Web API and Web Playback SDK.

> **Note on scope**: Actual audio playback (decoding/streaming the track bytes) is handled entirely by Spotify's Web Playback SDK inside the browser, using the user's own Premium account. Your app controls *what* plays and *when* — it never streams or stores audio itself. Web Playback SDK requires a **Spotify Premium** account; free-tier accounts can only be redirected to open Spotify natively.

---

## 1. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | Component-based, fast dev loop, good SDK typings available |
| State | Zustand or Redux Toolkit | Playback state, queue, station state |
| Styling | Tailwind CSS | Rapid, consistent, accessible utility styling |
| Backend | Node.js + Express (TypeScript) | Same language as frontend; simplest secure token handling |
| Database | PostgreSQL (via Prisma) | Relational fit for users, stations, history, feedback |
| Cache/session | Redis | Token cache, rate-limit counters, shared "listen-together" session state |
| Realtime (shared stations) | Socket.IO | Sync playback position across listeners |
| Auth | Spotify OAuth 2.0 Authorization Code + PKCE | Required for SPA-safe token exchange |
| Playback | Spotify Web Playback SDK (JS) | In-browser device registration & control |
| Deployment | Vercel (frontend) + Render (backend) + Neon/Supabase (Postgres) + Upstash (Redis) | All have permanently-free tiers that comfortably cover 10–50 users — see Section 9 |

---

## 2. Project Structure

```
spotify-radio/
├── apps/
│   ├── web/                          # React frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── player/
│   │   │   │   │   ├── NowPlaying.tsx
│   │   │   │   │   ├── PlaybackControls.tsx
│   │   │   │   │   ├── VolumeSlider.tsx
│   │   │   │   │   ├── FeedbackButtons.tsx      # thumbs up/down
│   │   │   │   │   └── SleepTimerMenu.tsx
│   │   │   │   ├── queue/
│   │   │   │   │   ├── UpNextList.tsx
│   │   │   │   │   └── QueuePeekDrawer.tsx
│   │   │   │   ├── stations/
│   │   │   │   │   ├── StationGrid.tsx
│   │   │   │   │   ├── StationCard.tsx
│   │   │   │   │   ├── StationEditor.tsx        # custom station builder
│   │   │   │   │   └── ShareStationModal.tsx
│   │   │   │   ├── auth/
│   │   │   │   │   ├── LoginButton.tsx
│   │   │   │   │   └── AuthCallback.tsx
│   │   │   │   └── layout/
│   │   │   │       ├── AppShell.tsx
│   │   │   │       └── AccessibleSkipLink.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useSpotifyPlayer.ts          # wraps Web Playback SDK
│   │   │   │   ├── useAuth.ts
│   │   │   │   ├── useQueueEngine.ts            # smart shuffle / no-repeat logic
│   │   │   │   ├── useCrossfade.ts              # DJ mode
│   │   │   │   ├── useSleepTimer.ts
│   │   │   │   └── useSharedSession.ts          # Socket.IO sync
│   │   │   ├── lib/
│   │   │   │   ├── api.ts                       # typed fetch client to backend
│   │   │   │   ├── pkce.ts                       # code_verifier/challenge generation
│   │   │   │   └── indexedDb.ts                 # offline "liked" cache, recent-plays ring buffer
│   │   │   ├── stores/
│   │   │   │   ├── playbackStore.ts
│   │   │   │   ├── stationStore.ts
│   │   │   │   └── userStore.ts
│   │   │   ├── pages/
│   │   │   │   ├── Home.tsx
│   │   │   │   ├── Station.tsx
│   │   │   │   ├── Callback.tsx
│   │   │   │   └── SharedSession.tsx
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   └── vite.config.ts
│   │
│   └── api/                          # Express backend
│       ├── src/
│       │   ├── routes/
│       │   │   ├── auth.routes.ts
│       │   │   ├── playlists.routes.ts
│       │   │   ├── stations.routes.ts
│       │   │   ├── playback.routes.ts
│       │   │   ├── feedback.routes.ts
│       │   │   ├── recommendations.routes.ts
│       │   │   └── sessions.routes.ts           # shared listening
│       │   ├── controllers/
│       │   ├── services/
│       │   │   ├── spotifyClient.ts             # rate-limit-aware wrapper (axios + queue)
│       │   │   ├── tokenService.ts               # refresh + encrypted storage
│       │   │   ├── stationEngine.ts              # builds/tunes station track lists
│       │   │   └── recommendationService.ts
│       │   ├── middleware/
│       │   │   ├── requireAuth.ts
│       │   │   ├── rateLimiter.ts
│       │   │   └── errorHandler.ts
│       │   ├── sockets/
│       │   │   └── sessionGateway.ts             # Socket.IO namespace for shared stations
│       │   ├── db/
│       │   │   ├── prisma/schema.prisma
│       │   │   └── client.ts
│       │   └── app.ts
│       └── server.ts
│
├── packages/
│   └── shared-types/                 # DTOs shared by web + api
│
├── infra/
│   ├── docker-compose.yml            # local Postgres + Redis
│   └── deploy/
│       ├── render.yaml
│       └── vercel.json
│
└── .env.example
```

---

## 3. Database Schema (PostgreSQL / Prisma)

```prisma
model User {
  id            String   @id @default(uuid())
  spotifyId     String   @unique
  displayName   String?
  accessToken   String   // encrypted at rest
  refreshToken  String   // encrypted at rest
  tokenExpires  DateTime
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
  mood          String?          // "chill", "focus", "party", custom label
  sourceType    String           // "playlist" | "liked_songs" | "custom_mix"
  sourceIds     String[]         // Spotify playlist IDs feeding this station
  djMode        Boolean  @default(false)
  crossfadeSec  Int      @default(5)
  discoverMode  Boolean  @default(false)
  shareSlug     String?  @unique
  createdAt     DateTime @default(now())

  user          User     @relation(fields: [userId], references: [id])
}

model ListenEvent {
  id           String   @id @default(uuid())
  userId       String
  trackId      String
  stationId    String?
  playedAt     DateTime @default(now())
  skipped      Boolean  @default(false)
  msPlayed     Int?

  user         User     @relation(fields: [userId], references: [id])
}

model TrackFeedback {
  id        String   @id @default(uuid())
  userId    String
  trackId   String
  rating    Int      // 1 = thumbs up, -1 = thumbs down
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id])
  @@unique([userId, trackId])
}

model SharedSession {
  id          String   @id @default(uuid())
  hostUserId  String
  stationId   String
  joinCode    String   @unique
  startedAt   DateTime @default(now())
  active      Boolean  @default(true)

  host        User     @relation("host", fields: [hostUserId], references: [id])
}
```

Client-side (IndexedDB, via a small wrapper like `idb`): cache of liked-track IDs for the "offline available" badge, a ring buffer of the last N played track IDs for smart shuffle's no-repeat window, and any queued feedback events to sync when back online.

---

## 4. Authentication Flow (Authorization Code + PKCE)

1. **Frontend generates PKCE pair**: random `code_verifier`, SHA-256 → base64url → `code_challenge`. Store `code_verifier` in `sessionStorage`.
2. **Redirect to Spotify** `/authorize` with `client_id`, `response_type=code`, `redirect_uri`, `code_challenge_method=S256`, `code_challenge`, and `scope`.
3. **Scopes needed**:
   ```
   streaming
   user-read-email
   user-read-private
   user-read-playback-state
   user-modify-playback-state
   playlist-read-private
   playlist-read-collaborative
   user-library-read
   user-top-read
   ```
4. **Callback**: Spotify redirects to `/callback?code=...`. Frontend sends `code` + `code_verifier` to the **backend** (never exchange directly from the SPA if you want to keep the client secret server-side, or use the PKCE-only public-client flow entirely client-side — see note below).
5. **Backend exchanges code for tokens** at `/api/v1/token` (Spotify's `accounts.spotify.com/api/token`), receives `access_token`, `refresh_token`, `expires_in`.
6. **Backend stores tokens encrypted**, issues the frontend its own short-lived session cookie (httpOnly, secure, sameSite=lax) — the Spotify tokens themselves never touch client-side JS or localStorage.
7. **Silent refresh**: backend middleware checks `tokenExpires` on each request; if within a safety window (e.g., < 60s remaining) it refreshes via `grant_type=refresh_token` before proxying the call.

> **Design choice**: Because PKCE was designed to let public clients (SPAs, mobile apps) skip a client secret, you *can* do the whole exchange in the browser. This plan instead proxies it through the backend so refresh tokens never live in browser storage and can't be read via XSS — a stronger posture for anything you intend to run in production.

---

## 5. Key Backend API Endpoints

All routes below are your **own** backend endpoints (prefixed `/api/v1`), which internally call the Spotify Web API using the stored/refreshed token — the frontend never calls Spotify directly except for the Web Playback SDK's own internal socket.

### Auth
| Method | Path | Purpose |
|---|---|---|
| GET | `/auth/login` | Builds Spotify authorize URL, returns it to frontend |
| POST | `/auth/callback` | Exchanges `code` + `code_verifier` for tokens, creates session |
| POST | `/auth/refresh` | Forces a token refresh (rarely called manually; middleware handles it) |
| POST | `/auth/logout` | Clears session cookie, revokes local token record |

### Library
| Method | Path | Purpose |
|---|---|---|
| GET | `/library/playlists` | User's playlists (paginated, cached) |
| GET | `/library/liked-songs` | Paginated liked/saved tracks |
| GET | `/library/top-tracks` | Used to seed "Discover" recommendations |

### Stations
| Method | Path | Purpose |
|---|---|---|
| GET | `/stations` | List user's stations |
| POST | `/stations` | Create station (name, mood, source playlists, DJ/discover settings) |
| PATCH | `/stations/:id` | Update settings (crossfade length, discover on/off) |
| DELETE | `/stations/:id` | Remove station |
| GET | `/stations/:id/queue` | Server-computed next-N tracks (smart shuffle + discover injection) |
| POST | `/stations/:id/share` | Generates/returns `shareSlug` and public join link |
| GET | `/stations/join/:slug` | Resolve a shared station link to station + live session info |

### Playback (thin proxy/control layer)
| Method | Path | Purpose |
|---|---|---|
| PUT | `/playback/transfer` | Transfer playback to the SDK's local device_id |
| POST | `/playback/play` | Start/resume playback of a given context or track list |
| POST | `/playback/pause` | Pause |
| POST | `/playback/next` | Skip forward |
| POST | `/playback/previous` | Skip back |
| PUT | `/playback/volume` | Set volume (used by both the manual slider and crossfade engine) |

### Feedback & History
| Method | Path | Purpose |
|---|---|---|
| POST | `/feedback` | `{ trackId, rating }` thumbs up/down |
| GET | `/feedback/:trackId` | Current rating for a track (to render active thumb state) |
| POST | `/history` | Log a `ListenEvent` (played, skipped, ms played) |
| GET | `/history/recent` | Recent plays, used server-side too for cross-device no-repeat |

### Recommendations ("Discover mode")
| Method | Path | Purpose |
|---|---|---|
| GET | `/recommendations?stationId=` | Blend of Spotify's recommendation endpoint seeded by station's top tracks/artists/genres + user's thumbs-up history |

### Shared Sessions (listen-together)
| Method | Path | Purpose |
|---|---|---|
| POST | `/sessions` | Host starts a shared session for a station |
| GET | `/sessions/:joinCode` | Fetch session state for a joining guest |
| WS | `/socket.io` events: `session:sync`, `session:play`, `session:pause`, `session:seek` | Realtime playback-position broadcast from host to guests |

---

## 6. Radio Playback Engine (frontend logic)

### 6.1 Continuous playback / queue engine (`useQueueEngine`)
- Maintains an in-memory queue of upcoming track objects, refilled from `/stations/:id/queue` when it drops below a threshold (e.g., 5 tracks).
- On `player_state_changed` from the SDK reporting a track finished, dequeue → play next automatically. No user action required.
- **Smart shuffle**: maintain a rolling window (e.g., last 30–50 plays, or a percentage of the source pool, whichever is smaller) in IndexedDB + mirrored server-side in `ListenEvent`. When picking the next track, weight-exclude anything in that window; if the entire pool is smaller than the window, fall back to least-recently-played rather than hard-blocking (so small playlists don't stall).

### 6.2 DJ mode / crossfade (`useCrossfade`)
Spotify's Web Playback SDK doesn't natively crossfade two tracks — it's a single audio pipeline — so this is simulated:
- When the current track's remaining time crosses the configured fade window (3–10s, user setting), start ramping `player.setVolume()` down on a `requestAnimationFrame`/interval loop while triggering the next track to begin playing under it isn't literally possible in one SDK player instance (only one active track at a time). Two practical approaches:
  1. **Two-player crossfade** (higher fidelity): mount a second, hidden `Spotify.Player` instance, pre-load the next track paused on it a few seconds early, then simultaneously fade volume down on player A and up on player B while transferring "active" status once B has full volume — then tear down A. Requires care with Spotify's one-active-device-per-account-tab behavior.
  2. **Fade-and-gap** (simpler, ships faster): just fade the outgoing track's volume to 0 over N seconds, then start the next track at full volume immediately after. No true overlap, but reads as a smooth DJ transition rather than a hard cut.
- Ship (2) first; treat (1) as a stretch goal once the rest of the app is stable.

### 6.3 Stations ("tuning in")
- A station = a named bundle of one or more source playlists / liked-songs / mood tag, defined via `StationEditor.tsx` and persisted through `POST /stations`.
- `StationGrid` renders stations as tappable "presets," mirroring physical radio preset buttons.
- Switching stations mid-play stops the current queue engine, clears the in-memory queue, and requests a fresh one from `/stations/:id/queue`.

### 6.4 Discover mode
- When enabled on a station, every Nth queue slot (e.g., 1 in 5) is filled from `/recommendations` instead of the station's own pool, seeded by recent thumbs-up tracks + the station's dominant genres/artists.

---

## 7. UI Requirements Mapping

| Requirement | Component |
|---|---|
| Now playing (art, artist, title) | `NowPlaying.tsx` |
| Up-next / peek queue | `UpNextList.tsx`, `QueuePeekDrawer.tsx` (slide-over, keyboard-dismissible) |
| Play/pause, skip, volume | `PlaybackControls.tsx`, `VolumeSlider.tsx` |
| Thumbs up/down | `FeedbackButtons.tsx` → `POST /feedback` |
| Stations grid + custom builder | `StationGrid.tsx`, `StationEditor.tsx` |
| Sleep timer | `SleepTimerMenu.tsx` + `useSleepTimer.ts` (sets a timeout that calls `/playback/pause` and clears itself) |
| Offline/library indicator | Badge on track rows, checked against IndexedDB liked-track cache |
| Shareable station link | `ShareStationModal.tsx` → `/stations/:id/share` |

**Responsive design**: Tailwind breakpoints; mobile gets a bottom sheet player (collapsed mini-player + expandable full view), desktop gets a persistent left rail (stations) + bottom bar (transport controls), similar to Spotify's own layout conventions.

**Accessibility (WCAG 2.1 AA)**:
- All interactive controls are real `<button>`/`<input type="range">` elements (never bare `<div onClick>`), with visible focus rings.
- Album art has empty `alt=""` (decorative, title/artist already in text) or descriptive alt when it's the only identifying element.
- Live region (`aria-live="polite"`) announces track changes for screen reader users without being disruptive.
- Full keyboard map: `Space` play/pause, `→`/`←` seek or skip depending on focus, `↑`/`↓` volume, station grid fully tab-navigable with arrow-key roving tabindex.
- Color contrast checked against Tailwind palette (aim for 4.5:1 body text minimum); don't rely on color alone for thumbs up/down state — pair with icon shape change + label.
- Respect `prefers-reduced-motion` for crossfade visual transitions (the audio fade itself is unaffected — this only affects UI animation).

---

## 8. Rate Limits, Token Refresh, and Error Handling

- **Rate limits**: Spotify enforces a rolling 30-second window per app (exact ceiling isn't published and varies). Implement `spotifyClient.ts` as a thin wrapper that:
  - Queues outbound requests and respects `Retry-After` on `429` responses.
  - Caches read-heavy, slow-changing data (playlists, liked songs) with short TTLs in Redis to cut duplicate calls.
  - Batches where the API allows it (e.g., fetching multiple tracks by ID in one call rather than N calls).
- **Token refresh**: centralized in `tokenService.ts`; every outbound Spotify call goes through it so refresh is transparent to route handlers. Store `tokenExpires`; refresh proactively rather than reactively on 401 to avoid a failed-request round trip on every expiry.
- **Playback failure handling**:
  - SDK `initialization_error`, `authentication_error`, `account_error`, `playback_error` events all get a listener → surface a toast + attempt one retry/re-auth before giving up.
  - `account_error` specifically means non-Premium account trying to use Web Playback SDK — show a clear explanatory message rather than a generic failure.
  - Network drop mid-play: SDK typically pauses; queue engine listens for `player_state_changed` with `paused: true, position: 0` ambiguity guarded by a "did we intend this pause" flag so it doesn't wrongly auto-advance.
- **Terms of service**: no caching/redistributing of audio content itself, no building a standalone "library browser" that competes with Spotify's own apps, respect the "must visibly attribute Spotify" branding requirements, and don't allow playback for logged-out/anonymous users.

---

## 9. Hosting & Deployment (Free-Tier Only, Sized for 10–50 Users)

At 10–50 users, this whole app comfortably fits inside the free tiers of every service below — no paid plan should be necessary. The main free-tier trade-off to design around isn't capacity, it's **idle behavior** (a couple of these free tiers spin a service down after inactivity, adding a cold-start delay on the next request) — noted per-service below.

### 9.1 Where each piece lives (all free)

| Piece | Host | Free tier fit for 10–50 users | Free-tier catch to design around |
|---|---|---|---|
| Frontend (static/Vite build) | **Vercel** (Hobby plan) | Static builds + global CDN, effectively unlimited for this traffic level | Hobby plan is for non-commercial use — fine for a personal/friends project |
| Backend (Express API + Socket.IO) | **Render** (Free web service) | One always-deployed Node process is all you need | Free web services **spin down after ~15 min idle** and take ~30–60s to wake on the next request — first request after a quiet period will be slow. A tiny external "keep-alive" ping (see 9.5) avoids this, or accept the occasional cold start for a small user base |
| PostgreSQL | **Neon** or **Supabase** (Free tier) | Free storage allowance (hundreds of MB) is far more than 10–50 users' history/stations/feedback rows will ever need | Neon free projects can also idle/auto-suspend after inactivity, with a short wake-up on next query — same shape of trade-off as Render, generally sub-second |
| Redis | **Upstash** (Free tier) | Free tier's daily command allowance comfortably covers token-cache and rate-limit-counter traffic at this scale | None meaningful at 10–50 users; just don't cache large payloads (keep values small — IDs and short JSON, not full track objects) |
| Error tracking | **Sentry** (Developer/free plan) | Free event volume is far above what a 10–50 user app will generate | Fixed monthly event cap, not usually reachable at this scale |
| Uptime check | **UptimeRobot** (free plan) | 5-minute interval checks, free forever, doubles as the Render "keep-alive" ping | None at this scale |

No paid add-ons (custom domains, extra compute, higher connection limits, etc.) are needed to run this for 10–50 users — every row above is a permanently-free tier, not a trial.

> Serverless functions (e.g., Vercel Functions) are still a poor fit for the **backend**, free tier or not — Socket.IO needs a persistent, stateful connection for shared-listening sessions, which is why the API keeps its own always-on(ish) host rather than living alongside the frontend.

### 9.2 Domains, HTTPS, and Spotify redirect URIs
- Skip a custom domain to stay 100% free: Vercel and Render both give you a free `*.vercel.app` / `*.onrender.com` subdomain with free TLS out of the box — a custom domain is optional, not required, for this scale.
- In the **Spotify Developer Dashboard**, add the production redirect URI (e.g., `https://your-app.vercel.app/callback`) alongside the local dev one — Spotify requires an exact match, and OAuth will fail silently-to-error if it's off by a trailing slash or protocol.
- Set `SPOTIFY_REDIRECT_URI`, `FRONTEND_ORIGIN` (for CORS), and `COOKIE_DOMAIN` so the session cookie is scoped correctly across the frontend/backend subdomain split.

### 9.3 Environment variables

Given the scale, a single production environment (no separate paid staging infra) is enough — test locally via Docker Compose and treat the free-tier deploy as your one real environment.

| Variable | Local dev | Production (free tier) |
|---|---|---|
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | dev app in Spotify dashboard | same app is fine at this scale — no need to register a second one |
| `SPOTIFY_REDIRECT_URI` | `http://localhost:5173/callback` | `https://your-app.vercel.app/callback` |
| `DATABASE_URL` | local Docker Postgres | Neon/Supabase free project connection string |
| `REDIS_URL` | local Docker Redis | Upstash free database connection string |
| `SESSION_SECRET` | any dev value | unique, random |
| `COOKIE_SECURE` | `false` | `true` |

Keep secrets in Vercel's/Render's own env-var UI rather than committing `.env` files; `.env.example` in the repo documents the shape without values.

### 9.4 Version Control & Auto-Deploy on Push to `main`

**GitHub as the single source of truth**: one repo (the monorepo from Section 2), with both Vercel and Render connected directly to it via their native GitHub integrations — no custom deploy scripts needed for either.

**One-time setup:**
1. Push the project to a GitHub repo (e.g., `github.com/you/spotify-radio`), with `apps/web` and `apps/api` as the two deployable folders.
2. **Vercel**: "Import Project" → select the GitHub repo → set **Root Directory** to `apps/web` → it auto-detects Vite/React and sets the build command. Under Project Settings → Git, confirm the **Production Branch** is `main` (or `master`, whichever you use).
3. **Render**: "New Web Service" → connect the same GitHub repo → set **Root Directory** to `apps/api` → build command `npm install && npm run build`, start command `npm start`. Under Settings → Auto-Deploy, confirm it's set to deploy on every push to `main`.
4. Add both platforms' required env vars (Section 9.3) in their respective dashboards — this only needs doing once per project, not per deploy.

**What happens on every `git push origin main`:**
- Vercel receives a GitHub webhook, rebuilds `apps/web`, and promotes the new build to production automatically — typically live within 1–2 minutes.
- Render receives the same push event (independently, since it's watching the same repo), rebuilds `apps/api`, runs the `prisma migrate deploy` pre-deploy step, and restarts the service with zero manual action.
- Both are fully automatic and parallel — you don't trigger one before the other; a single push updates the whole app.

**Branches and PRs:**
- Keep `main` as the always-deployable branch; do feature work on branches and merge via PR.
- Vercel automatically builds a **preview deployment** with its own URL for every PR — useful for checking frontend changes before they hit `main`.
- Render's free tier doesn't do PR preview environments, so backend changes are reviewed via code review + local testing before merging, then go live automatically once merged to `main`.
- Optional but recommended: turn on GitHub branch protection on `main` (Settings → Branches → require PR review and passing status checks before merge) so nothing reaches the auto-deploying branch untested.

**CI checks before merge** (`.github/workflows/ci.yml`):
```yaml
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
This runs free on GitHub Actions (2,000 free minutes/month) and just gates merges — it doesn't deploy anything itself; Vercel and Render handle deployment independently once the merge lands on `main`.

**Database migrations**: run `prisma migrate deploy` as Render's "pre-deploy" command so schema changes apply automatically as part of each auto-deploy, before the new server code starts.

### 9.5 Keeping the free backend responsive
- Render's free web service sleeps after ~15 minutes with no incoming requests. For 10–50 users this is usually fine (an occasional slow first load), but if you want to avoid it entirely: point the free **UptimeRobot** monitor from 9.1 at your backend's `/health` endpoint on a 5-minute interval — this doubles as uptime alerting *and* a free keep-alive ping, with zero added cost.
- Don't add a paid "always-on" instance tier just to avoid this — at 10–50 users the free tier plus a keep-alive ping is enough.

### 9.6 Staying inside free-tier limits long-term
- Cache aggressively (the `spotifyClient.ts` Redis layer) so you're making fewer, smaller calls to Postgres/Redis/Spotify rather than scaling up a paid tier — at 10–50 users this is a comfort margin, not a necessity, but it's good practice regardless.
- If shared-listening sessions ever need to run across more than one backend instance, Socket.IO's default in-memory adapter would need the Redis adapter (`socket.io-redis`) — Upstash's free tier supports this too, so horizontal scaling wouldn't require leaving free tier at this user count.
- Revisit this section only if you outgrow 50 users or a specific free-tier cap (storage, daily command count) starts showing up in Render/Neon/Upstash's own dashboards — none of that is expected at this scale.

### 9.7 Local development parity
- `infra/docker-compose.yml` (already in the project structure) spins up local Postgres + Redis, both free and local, so dev doesn't touch any hosted free-tier quota at all.
- A single `README.md` "Getting Started" section should cover: clone → `docker compose up` → `.env` from `.env.example` → `npm install` at the repo root (workspaces) → `npm run dev` for both apps concurrently.

---

## 10. Implementation Roadmap

### Phase 0 — Setup (½–1 day)
- Register app in the Spotify Developer Dashboard, set redirect URIs (`http://localhost:5173/callback` for dev).
- Scaffold monorepo (frontend + backend + shared-types), set up `docker-compose` for local Postgres/Redis.
- `.env.example` with `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, `SESSION_SECRET`, `DATABASE_URL`, `REDIS_URL`.

### Phase 1 — Authentication (1–2 days)
- Implement PKCE generation client-side, login redirect, backend `/auth/callback` token exchange, encrypted token storage, session cookie issuance.
- Middleware for auth-required routes + automatic refresh.
- **Milestone**: can log in and see your own Spotify display name rendered in the app.

### Phase 2 — Library & basic playback (2–3 days)
- `/library/playlists`, `/library/liked-songs` endpoints with Redis caching.
- Integrate Web Playback SDK: register device, transfer playback, play a single hardcoded track.
- Build `NowPlaying`, `PlaybackControls`, `VolumeSlider`.
- **Milestone**: pick a playlist, hit play, hear audio, pause/resume/skip work.

### Phase 3 — Continuous queue + smart shuffle (2–3 days)
- `stationEngine.ts` computing initial/refill queues from a playlist's track pool.
- `useQueueEngine` auto-advance on track end.
- No-repeat window logic (IndexedDB + `ListenEvent` table).
- Build `UpNextList` / peek drawer.
- **Milestone**: playback flows continuously through a full playlist without manual skipping, without near-term repeats.

### Phase 4 — Stations (2 days)
- `Station` CRUD endpoints + `StationEditor` UI, `StationGrid` presets.
- Switching stations swaps the active queue cleanly.
- **Milestone**: create 2–3 custom stations, switch between them like radio presets.

### Phase 5 — DJ mode / crossfade (2–3 days)
- Implement fade-and-gap crossfade first; wire the 3–10s slider in station settings.
- **Milestone**: enabling DJ mode produces an audibly smooth transition instead of a hard cut.

### Phase 6 — Feedback & Discover mode (2 days)
- Thumbs up/down UI + `/feedback` persistence.
- `/recommendations` endpoint using Spotify's recommendation seeds; wire "1-in-N" injection into the queue engine when discover mode is on.
- **Milestone**: thumbs-up history visibly shifts what discover mode surfaces over a session.

### Phase 7 — Sleep timer & offline indicator (1 day)
- `useSleepTimer` with 15/30/60-min presets, cancel option, visible countdown.
- IndexedDB liked-track cache → badge on rows.
- **Milestone**: setting a 15-min timer auto-pauses playback at expiry.

### Phase 8 — Shared "listen together" stations (2–3 days)
- `SharedSession` model, join-code generation, Socket.IO namespace.
- Host broadcasts play/pause/seek events; guests' players stay in sync (accept a few hundred ms of drift rather than fighting for perfect sync).
- **Milestone**: two browser sessions on the same station stay audibly in sync.

### Phase 9 — Accessibility & responsive pass (1–2 days)
- Full keyboard-nav audit, screen-reader pass with VoiceOver/NVDA, contrast check, `prefers-reduced-motion` handling.
- Mobile layout pass (bottom-sheet player, touch targets ≥ 44px).

### Phase 10 — Hardening & deployment (2–3 days)
- Centralized error handling + user-facing toasts for all SDK error events.
- Rate-limit-aware Spotify client wrapper with retry/backoff.
- Deploy to the free-tier stack per **Section 9 (Hosting & Deployment)**: Vercel (frontend), Render (backend), Neon/Supabase (Postgres), Upstash (Redis) — production Spotify redirect URI registered in the dashboard.
- Wire up Sentry (free tier) and an UptimeRobot check on `/health`, which doubles as a keep-alive ping for Render's free web service.
- **Milestone**: production URL, real login, works end-to-end for a Premium account — entirely on free-tier infrastructure.

**Total estimate**: roughly 3–4 weeks for one developer working part-time, or 1.5–2 weeks full-time, before polish/edge cases.

---

## 11. Open Decisions Worth Revisiting Later
- Whether to build the two-player true-crossfade engine or keep the simpler fade-and-gap approach long-term.
- How aggressively to cache library data vs. always hitting Spotify fresh (staleness vs. rate-limit safety trade-off).
- Whether shared sessions need a dedicated "guest" auth flow or can allow fully anonymous joins (simpler, but limits per-guest feedback/history).
