# Audius Radio

A radio-style web app for [Audius](https://audius.co): pick a station and it plays an endless, smart-shuffled
stream of independent music. Mix tracks with DJ-style crossfades, give tracks a thumbs up or down so it learns
what you like, or share your station so friends hear the same track at the same moment.

Built behind a `MusicProvider` interface, so other sources (for example a local library) can be added later
without touching the radio engine.

## Features

- **Stations:** Trending, My Favorites, genre presets (Electronic, Hip-Hop/Rap, Lo-Fi, Ambient) and your own
  stations built from a genre, a search or one of your Audius playlists.
- **Smart shuffle:** no near-term repeats, boosts artists you like, skips tracks you disliked or quickly skipped.
- **Discover mode:** mixes in new music seeded by your thumbs-ups.
- **DJ mode:** equal-power crossfade of 3 to 10 seconds between tracks (Web Audio), with a gapless fallback.
- **Listen together:** share a link; everyone hears the same track in sync (server-authoritative clock).
- **Sleep timer** with a fade-out, an "In your favorites" badge, and an offline banner that resumes playback.
- **Accessible and responsive:** keyboard shortcuts, screen-reader announcements, a full-screen mobile player,
  five color themes.
- **Guest mode:** no Audius account needed (trending, genre and search stations; no favorites or playlists).

**Keyboard:** `Space` play/pause, `←` `→` seek 5s, `↑` `↓` volume, `N` next track.

## Tech stack

| Layer | Choice |
|---|---|
| Web | React 18, TypeScript, Vite, Tailwind, Zustand |
| API | Node 20, Express, Socket.IO, Zod |
| Data | PostgreSQL (Prisma), Redis (cache, sessions, rate limits) |
| Music | Audius REST API and `@audius/sdk` (login only, loaded on demand) |
| Audio | Two `<audio>` decks, Web Audio gain nodes, Media Session API |

## Project structure

```
apps/web/            React app (engine/ holds the audio engine, stores/ the state)
apps/api/            Express API and Socket.IO gateway (providers/ wraps Audius)
packages/shared-types/   Types shared by both apps
infra/docker-compose.yml Local Postgres and Redis
render.yaml, apps/web/vercel.json, .github/workflows/ci.yml   Deployment and CI
```

## Run it locally

Requires Node 20+ and Docker (or your own Postgres and Redis).

```bash
npm install
cp .env.example .env              # then fill it in (below)
docker compose -f infra/docker-compose.yml up -d
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
npm run dev                       # API on :4000, web on :5173
```

**Audius credentials.** Create an app in your Audius developer settings, register
`http://localhost:5173/callback` as a redirect URI, and set `AUDIUS_API_KEY`, `AUDIUS_BEARER_TOKEN` (server only,
never exposed to the browser) and `VITE_AUDIUS_API_KEY` (same key) in `.env`. Set `SESSION_SECRET` to any random
string of 16+ characters.

Without Audius login you can still use **Continue as guest**, which only needs the public Audius API.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API and web with hot reload |
| `npm run typecheck` | Type-check both apps |
| `npm test` | Unit tests for both apps (Vitest) |
| `npm run build` | Production build of both apps |

## Configuration

See [`.env.example`](.env.example) for every variable. The ones you must set are the Audius keys,
`SESSION_SECRET`, `DATABASE_URL`, `REDIS_URL` and `FRONTEND_ORIGIN`. `SENTRY_DSN` and `VITE_SENTRY_DSN` are
optional error reporting.

## Deploying

The free-tier setup (Render for the API, Vercel for the site, Neon/Supabase for Postgres, Upstash for Redis) is in
[`DEPLOY.md`](DEPLOY.md), including environment variables and a pre-launch checklist.

## Status and known limitations

- **Audius login is untested against the live service.** The SDK calls and the token-verification response in
  `apps/web/src/lib/audius.ts` and `apps/api/src/services/audiusClient.ts` are best guesses from the docs. Guest
  mode and the public catalog endpoints have been exercised against the real API.
- Host pause doesn't propagate to listeners in a listening party; listeners keep playing.
- Listening-party rooms live in one server's memory. Running several API instances would need the Socket.IO Redis
  adapter.
- The free Audius plan allows 500,000 requests per month. The API counts usage and logs a warning at 80% and 95%.
- Check the current [Audius API terms](https://audius.co) for attribution and caching rules before launching.
  The app links every track back to Audius and never stores audio.

## License

No license has been chosen yet.
