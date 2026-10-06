# Prisma/Postgres → IndexedDB Migration Plan

Move all per-user state (stations, history, feedback, profile cache) from Postgres/Prisma to browser IndexedDB. Keep Redis for sessions, API cache and (later) shared listening. Server becomes stateless apart from Redis.

---

## 1. Goals / Non-goals

**Goals**
- Remove Prisma, Postgres, `DATABASE_URL`, migrations, and the Postgres container.
- Stations, listen history and thumbs feedback live in IndexedDB, typed and versioned.
- Auth keeps working: server still verifies the Audius token; session holds the profile in Redis.
- User can back up / restore their data (export/import JSON) since there is no server copy.
- Zero regression in `/catalog` and `/library/favorites` behaviour.

**Non-goals (explicitly out of scope)**
- Cross-device sync. State is per browser. (Possible future: opt-in encrypted backup to Redis/S3; see §12.)
- Shared "listen together" server persistence. Handled separately in §9 with Redis TTL.

---

## 2. Current State (audit findings)

| Item | Finding |
|---|---|
| Prisma usage in code | Only `auth.controller.ts` (`user.upsert`), `requireAuth.ts` (`user.findUnique`), `tokenService.ts` (`user.update`), `db/client.ts` |
| `tokenService.ts` | **Dead code**: references `accessToken/refreshToken/tokenExpires` fields that don't exist in the schema, plus `spotifyClient.js`. Delete. Check `lib/crypto.ts` and `spotifyClient.ts` for the same. |
| `Station`, `ListenEvent`, `TrackFeedback`, `SharedSession` | Defined in schema + `shared-types`, **no code reads/writes them yet** → no data to migrate. |
| `req.user` | Full Prisma `User`; `/library/favorites` only needs `req.user.audiusUserId`. |
| Tests | `requireAuth.test.ts` mocks `db/client.js`; `tokenService.test.ts` tests dead code. |
| Plan docs | `audius-radio-app-plan.md` §2 already lists IndexedDB (`idb`) for client storage and Postgres for users/stations/history; needs updating. |

Because nothing persists today, **there is no data migration**; this is a clean cut.

---

## 3. Target Architecture

```
Browser                                   API (Express, stateless)              Redis
┌──────────────────────────────┐          ┌─────────────────────────┐          ┌────────────┐
│ React + Zustand              │  cookie  │ /auth/callback          │ sessions │ sess:*     │
│  └ repositories (Dexie)      │◄────────►│ /auth/me, /auth/logout  │◄────────►│ cache:*    │
│     IndexedDB "audius-radio" │          │ /catalog/*  /library/*  │          │ room:* TTL │
│      stations / history /    │          └─────────────────────────┘          └────────────┘
│      feedback / profile /    │
│      meta / kv               │
└──────────────────────────────┘
```

- **Identity key** = `audiusUserId` everywhere (drops the server-generated UUID). IndexedDB DB name is namespaced per user: `audius-radio:<audiusUserId>`, so two accounts on one browser don't mix data and logout doesn't need to wipe.
- **Session payload** (Redis): `{ audiusUserId, handle, displayName }`. No DB lookup per request.

---

## 4. Library Choice

**Dexie 4** (+ `dexie-react-hooks` `useLiveQuery`) over raw `idb`.

| | Dexie | idb |
|---|---|---|
| Schema versioning/migrations | Built-in `.version().upgrade()` | Manual in `upgrade()` |
| Reactive queries | `useLiveQuery` (UI auto-updates, cross-tab) | Hand-rolled |
| Compound indexes / `where().between()` | Yes | Manual cursors |
| Size | ~30 KB | ~1 KB |

Reactive queries + migrations are worth 30 KB here. (Note: `audius-radio-app-plan.md` says `idb`; update to Dexie.)

Test lib: `fake-indexeddb` for vitest.

---

## 5. Data Model (IndexedDB)

Types live in `packages/shared-types` (rename/trim the DTOs; drop `userId` since the DB is per user).

```ts
// stations           key: id (uuid, client generated via crypto.randomUUID)
//   indexes: createdAt, shareSlug (unique, sparse)
Station { id, name, mood|null, sourceType, sourceRefs, djMode, crossfadeSec, discoverMode,
          shareSlug|null, createdAt: number, updatedAt: number }

// history            key: ++id (auto-increment)
//   indexes: playedAt, trackId, [stationId+playedAt]
ListenEvent { id?, trackId, stationId|null, playedAt: number, skipped, msPlayed|null }

// feedback           key: trackId   (one rating per track = replaces @@unique)
//   indexes: genre, createdAt
TrackFeedback { trackId, genre|null, rating: 1|-1, createdAt: number }

// profile            key: 'me'   (cache of PublicUser for offline boot)
// meta               key: 'schemaVersion' | 'lastExportAt' | 'lastPrunedAt' | 'installId'
// kv                 key: string (volume, last station id, sleep timer, UI prefs)
```

Decisions:
- Timestamps are `number` (epoch ms), not ISO strings: cheaper to index and compare.
- `sourceRefs` stored as structured-clone object (no JSON column needed).
- **History retention**: ring buffer, cap at 5,000 events or 180 days, whichever first; prune on app start and every 100 writes. Prevents unbounded growth and eviction risk.
- **Feedback** is never pruned (small, high value).
- Optional denormalized `Track` snapshot (title/artist/artwork) on `ListenEvent` so a history view renders offline without API calls. Cap snapshot to those 5 fields.

---

## 6. Code Structure

```
apps/web/src/
├── db/
│   ├── database.ts          Dexie subclass, schema versions, per-user DB open/close
│   ├── migrations.ts        version().upgrade() steps, one function per version
│   ├── repositories/
│   │   ├── stationRepo.ts   list/get/create/update/delete, slug helpers
│   │   ├── historyRepo.ts   record, recent(n), forStation, prune, stats
│   │   ├── feedbackRepo.ts  rate/clear/get, genreAffinity()
│   │   └── kvRepo.ts        typed get/set with defaults
│   ├── backup.ts            exportAll() / importAll() w/ validation (zod)
│   ├── persistence.ts       navigator.storage.persist() + estimate()
│   └── index.ts
├── hooks/
│   ├── useStations.ts       useLiveQuery wrappers
│   ├── useHistory.ts
│   └── useFeedback.ts
└── tests/db/*.test.ts       fake-indexeddb
```

Rules:
- **Components never import Dexie directly**, only repositories/hooks. Keeps a future swap (e.g. server sync) a one-folder change.
- Zustand keeps *ephemeral* playback state; IndexedDB is the source of truth for persisted state. No duplicating stations into Zustand; use `useLiveQuery`.
- Repos return plain objects, throw typed `StorageError` (`QuotaExceeded`, `Blocked`, `Unavailable`).

---

## 7. Implementation Phases

### Phase 0: Safety net (0.5 d)
- Create branch (repo is not under git yet → `git init` + initial commit first, or copy the folder, so removal is reversible).
- Run `npm run typecheck && npm test` for baseline; record results.

### Phase 1: API de-Prisma (1 d)
1. `express-session` types: `SessionData { audiusUserId?, handle?, displayName?, oauthState? }` (replace `userId`).
2. `auth.controller.ts`:
   - `callback`: verify token → `regenerate` session → store profile fields → respond `{ user: PublicUser }`.
   - `me`/`toPublicUser`: build from session; `id = audiusUserId`; drop `createdAt` (or make optional and set client-side on first run).
3. `requireAuth.ts`: synchronous, checks `req.session.audiusUserId`, sets `req.user = { audiusUserId, handle, displayName }`. No DB, no `async`.
4. `types/express.d.ts`: define local `SessionUser` interface instead of Prisma `User`.
5. `catalog.routes.ts`: unchanged (already uses `req.user!.audiusUserId`).
6. Delete: `src/db/`, `src/services/tokenService.ts`, `src/lib/crypto.ts`, `src/services/spotifyClient.ts` (after grepping for importers), `prisma/`, `tests/tokenService.test.ts`.
7. `package.json`: remove `@prisma/client`, `prisma`, `prisma:*` scripts.
8. `env.ts`: remove `DATABASE_URL`; `.env`, `.env.example` too.
9. `infra/docker-compose.yml`: remove `postgres` service + `postgres-data` volume.
10. Rewrite `requireAuth.test.ts` (no mocks needed): no session → 401; session with profile → `next()` and `req.user` set.
11. Add `auth.controller.test.ts` using supertest: callback happy path, bad token → 401, missing token → 400, session fixation (`regenerate` called), logout clears cookie.

**Exit:** `npm run typecheck && npm test -w apps/api` green; server boots with only Redis.

### Phase 2: Shared types (0.25 d)
- `PublicUser { id (= audiusUserId), audiusUserId, handle, displayName }`.
- Update `Station`, `ListenEvent`, `TrackFeedback` as in §5 (numbers for timestamps, no `userId`).
- Remove `SharedSession` from shared-types for now (re-added in §9 with Redis shape).
- Fix header comment ("mirror the Prisma schema").

### Phase 3: Storage foundation (1 d)
- `npm i dexie dexie-react-hooks -w apps/web`; `npm i -D fake-indexeddb -w apps/web`; add to vitest setup.
- `database.ts`: `class RadioDB extends Dexie` with `version(1).stores({...})`; `openForUser(audiusUserId)`; close on logout / user switch.
- `persistence.ts`: call `navigator.storage.persist()` after first successful login (permission is heuristic-based; engagement helps), expose `estimate()` for a Settings storage meter.
- Wire into `useAuth`: after `me()`/`completeLogin` success → open DB for that user; after `logout` → close DB (don't delete).
- Fallback: if IndexedDB unavailable (Firefox private mode older versions, blocked) → in-memory Dexie shim (`fake-indexeddb` isn't for prod; use a simple Map-backed repo implementation behind the same interface) and show a non-blocking "Your data won't be saved in this window" banner.

### Phase 4: Repositories + tests (1.5 d)
- Implement the four repos with unit tests (fake-indexeddb): CRUD, ordering, uniqueness of `shareSlug`, feedback upsert (`rate` twice → one row), history prune boundary cases, `genreAffinity()` aggregation.
- `historyRepo.record` is **fire-and-forget with error swallow + console.warn**, so a storage failure never interrupts playback.
- Batch history writes (buffer in memory, flush on `visibilitychange: hidden`, `pagehide`, and every N seconds) to cut write amplification.

### Phase 5: Wire into the app (1.5 d)
- Engine (`engine/radio.ts`): on track end/skip → `historyRepo.record({trackId, stationId, skipped, msPlayed})`.
- Feedback buttons → `feedbackRepo.rate`; discover mode reads `genreAffinity()` to weight the queue; thumbs-down also excludes track from the current station's refill.
- Stations UI: `StationGrid/Editor` use `useStations()`; create default stations on first run (Trending, Favorites) via an idempotent `seedDefaults()` guarded by a `meta.seeded` flag.
- Persist `volume`, last station, sleep timer through `kvRepo` (replace any `localStorage` use).
- Show "Recently played" list from `historyRepo.recent()`.

### Phase 6: Backup / restore + Settings (1 d)
- **Export**: single JSON file `audius-radio-backup-<date>.json` `{ app, version, exportedAt, audiusUserId, stations, history, feedback, kv }`.
- **Import**: zod-validate, show preview counts, mode = *merge* (default; newer `updatedAt` wins, feedback by newest `createdAt`) or *replace*. Reject backups for a different `audiusUserId` unless the user confirms.
- Settings page: storage usage bar, persistence status ("Your browser will keep this data" / "May be cleared if the device is low on space" with a button to request), Export, Import, **Clear listening history**, **Delete all local data** (confirm dialog).
- Gentle nudge to export every ~30 days (`meta.lastExportAt`).

### Phase 7: Robustness (1 d)
- **Multi-tab**: Dexie live queries sync across tabs automatically; handle `versionchange` (close DB and prompt reload) and `blocked` events during upgrades.
- **Quota errors**: catch `QuotaExceededError` → prune history aggressively (halve cap) → retry once → surface toast.
- **Eviction detection**: store `meta.installId`; if the DB opens empty but `localStorage` marker says it existed, show "Your local data was cleared by the browser. Restore from backup?" with import shortcut.
- **Schema upgrade tests**: seed v1 DB with fixtures, open as v2, assert data preserved (template for future migrations).
- **Safari/iOS**: ITP can purge script-writable storage after 7 days of no use unless installed as a PWA → mention in Settings copy, and make the export nudge more prominent on iOS.
- Logout semantics: data stays under the user-scoped DB name (so re-login restores). "Delete all local data" is the only destructive path.

### Phase 8: Docs, cleanup, verification (0.5 d)
- Update `audius-radio-app-plan.md`: §1 (backend role), §2 (stack: remove Postgres/Prisma, Dexie), §4 data model section, §5 API table (remove `/stations` & history endpoints), §11 hosting (drop Neon/Supabase if listed).
- Delete or archive `spotify-radio-app-plan.md` if obsolete (ask first).
- README: setup now only needs Redis.
- Final full check: `npm run typecheck && npm test && npm run build`.

---

## 8. Test Plan

| Layer | Tests |
|---|---|
| API unit | `requireAuth` (3 cases), `auth.controller` callback/me/logout via supertest, catalog routes still gated |
| DB unit (fake-indexeddb) | each repo; prune; import/export round-trip; merge conflict rules; schema upgrade v1→v2 fixture |
| Hook/component | `useStations` renders live updates after `create`; feedback toggle idempotency |
| E2E manual (Chrome DevTools MCP is available) | login → create station → play 3 tracks (1 skipped) → rate → reload → data persists → second tab sees updates → export → delete all → import → restored → logout/login same user → data present; different user → empty |
| Failure injection | Block IndexedDB (override `indexedDB.open` to throw) → app still plays, banner shown; simulate `QuotaExceededError` |
| Lighthouse | PWA/perf unchanged after change |

---

## 9. Things That Still Need a Server (decisions)

| Feature | Approach |
|---|---|
| **Shared "listen together" sessions** | Redis hashes with TTL (`room:<joinCode>` → `{hostAudiusUserId, stationSnapshot, currentTrackId, trackStartedAt}`, TTL refreshed on heartbeat, e.g. 6 h). Station config is **snapshotted into the room** at creation, so guests never need the host's IndexedDB. Socket.IO for sync. Implement when that milestone starts; no Postgres needed. |
| **Share slugs / public station links** | Preferred: encode config in the URL (`/s/<base64url(JSON)>`, with `sourceRefs` size cap ~1.5 KB; compress with `CompressionStream` if needed). Fallback if links get too long: Redis key `share:<slug>` with 30-day TTL refreshed on access. |
| **Guest sessions** | See §9a. |
| **Server-side recommendations** | Not supported by design; discover mode runs client-side from `genreAffinity()`. |

---

### 9a. Guest mode (added; implemented against the current Prisma code)

**Why:** `audius.co/oauth/auth` returns a Cloudflare "Sorry, you have been blocked" page from India, so Log in with Audius is unusable there. `api.audius.co` and audio streams work (verified with curl: API 200, stream 206 `audio/mpeg`). Guests must be able to use the app without logging in.

**Implemented now (pre-migration)**
- `POST /auth/guest` creates `User{audiusUserId:"guest:<uuid>", handle:"guest-xxxxxx", displayName:"Guest"}` and a session; rate-limited 10/h/IP (`middleware/rateLimit.ts`, Redis).
- `lib/guest.ts` (`isGuestUser`, `createGuestIdentity`), `middleware/requireAudiusAccount.ts` (403 for guests on `/library/favorites` and `/library/playlists`), guest check on creating `audius_favorites` stations.
- `PublicUser.isGuest` in shared-types. Web: `GuestButton` on the login screen, `useAuth().continueAsGuest`, Home hides "My Favorites" for guests and labels logout "Leave guest mode".
- Tests: `apps/api/tests/guest.test.ts` (identity, handler, guard, rate limit).

**Changes when this migration lands**
- Phase 1: the guest session no longer creates a DB row; it stores `{ audiusUserId: "guest:<uuid>", handle, displayName, isGuest: true }` in the Redis session only. `requireAuth` sets `req.user` from the session, and `isGuestUser` is unchanged.
- Phase 3: guest data lives in IndexedDB `audius-radio:guest:<uuid>`. Persist the guest id in `localStorage`/`kv` so a guest keeps their stations after the session cookie expires; `POST /auth/guest` accepts an optional existing guest id so the same identity is reused.
- Phase 6: add "Upgrade to Audius account" for guests who later log in: offer to merge guest stations/feedback/history into the real account DB (reuse the import merge path).
- Orphaned guest rows disappear with the Prisma removal; until then, add a cleanup job: delete guest users with no `ListenEvent` in 30 days.

**Open items**
- Set `app.set("trust proxy", 1)` on the hosted backend (Render) so `req.ip` is the client IP; otherwise the guest rate limit applies to the proxy's IP for everyone.
- Optional later: detect login-page failure (not possible via redirect; consider a pre-flight `no-cors` fetch to `audius.co`) to auto-suggest guest mode.

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Browser clears data | User loses stations/feedback | `storage.persist()`, export nudge, eviction detection + restore prompt |
| Safari 7-day purge | Same, iOS users | PWA install prompt, stronger export nudge |
| Schema changes later | Corrupt/lost data | Dexie versioned upgrades + fixture tests |
| Multi-tab upgrade lockups | App appears hung | `blocked`/`versionchange` handlers |
| Storage failure breaks playback | Bad UX | History writes fire-and-forget; in-memory fallback |
| Accidentally deleting still-used server code | Build break | grep importers before each delete; typecheck after each step; commit per step |
| No git repo | No rollback | Initialize git before Phase 1 |
| Shared sessions need user data from another browser | Feature gap | Room snapshot (§9) |
| Audius login blocked regionally (India) | Users can't sign in | Guest mode (§9a) |

---

## 11. Rollback Plan

- Each phase is its own commit. Phase 1 (server) is independent of Phases 3–6 (client), so the client work can land first behind the existing API with no server change, and server de-Prisma can follow.
- If needed, revert Phase 1 commit to restore Prisma + Postgres; client IndexedDB data is unaffected because it never depended on the server DB.

---

## 12. Future Enhancements (the "bells")

- **Opt-in encrypted cloud backup**: encrypt export client-side (WebCrypto AES-GCM, key from user passphrase via PBKDF2) → store blob in Redis/S3 keyed by `audiusUserId`; server never sees plaintext.
- **File System Access API** auto-backup to a user-chosen file (Chromium).
- **BroadcastChannel** cross-tab "now playing owner" so only one tab plays audio.
- **Listening stats page** from `history` (top genres, streak, hours per week) computed in a Web Worker.
- **Offline mode**: cache last-played tracks' metadata + artwork in Cache Storage; show history/stations offline.
- **PWA install** + `navigator.storage.persist()` auto-granted on installed apps.
- **Dev tooling**: Dexie Cloud-free devtools (`dexie-export-import`), a hidden `/debug/storage` route showing table counts and sizes.
- **Telemetry-free diagnostics**: "Copy diagnostics" button (schema version, counts, quota) for support.

---

## 13. Effort Summary

| Phase | Est. |
|---|---|
| 0 Safety net | 0.5 d |
| 1 API de-Prisma | 1 d |
| 2 Shared types | 0.25 d |
| 3 Storage foundation | 1 d |
| 4 Repos + tests | 1.5 d |
| 5 App wiring | 1.5 d |
| 6 Backup/Settings | 1 d |
| 7 Robustness | 1 d |
| 8 Docs/verification | 0.5 d |
| **Total** | **~8.25 d** |

## 14. Definition of Done

- No `prisma`, `@prisma/client`, `DATABASE_URL`, or Postgres references remain (`grep -ri prisma` clean except docs history).
- API boots with only Redis; `typecheck`, `test`, `build` pass at root.
- Stations, history, feedback survive reload, tab duplication and logout/login; isolated between users.
- Export → delete → import restores everything.
- IndexedDB-unavailable and quota-exceeded paths verified.
- Docs updated.
