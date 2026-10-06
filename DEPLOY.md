# Deploying Audius Radio (free tiers)

API on Render, site on Vercel, Postgres on Neon/Supabase, Redis on Upstash. Deploys on every push to `main`.

## 1. One-time setup
1. **GitHub:** push this repo (`git init`, create the repo, push `main`). Turn on branch protection for `main` (require PR + passing CI).
2. **Audius:** create an app on the Audius developer settings page. Register **both** redirect URIs exactly:
   `http://localhost:5173/callback` and `https://<your-site>.vercel.app/callback`.
3. **Neon/Supabase:** create a Postgres database and copy its connection string.
4. **Upstash:** create a Redis database and copy its `rediss://` URL.
5. **Render:** New > Blueprint > pick the repo (`render.yaml`). Fill the `sync: false` variables below. The build runs migrations.
6. **Vercel:** Import the repo, Root Directory `apps/web`. Set the variables below.
7. In `apps/web/vercel.json`, replace `audius-radio-api.onrender.com` with your real Render URL, then push.
8. **UptimeRobot:** ping `https://<your-api>.onrender.com/health` every 5 minutes (keeps the free Render instance awake).

## 2. Environment variables
| Variable | Where | Value |
|---|---|---|
| `DATABASE_URL`, `REDIS_URL` | Render | from Neon / Upstash |
| `AUDIUS_API_KEY`, `AUDIUS_BEARER_TOKEN` | Render | Audius app (**bearer token: server only**) |
| `AUDIUS_REDIRECT_URI` | Render | `https://<your-site>.vercel.app/callback` |
| `FRONTEND_ORIGIN` | Render | `https://<your-site>.vercel.app` |
| `SESSION_SECRET`, `COOKIE_SECURE`, `NODE_ENV` | Render | generated / `true` / `production` (in `render.yaml`) |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | Render / Vercel | optional |
| `VITE_AUDIUS_API_KEY` | Vercel | same API key (safe in the browser) |
| `VITE_API_BASE_URL` | Vercel | `/api/v1` (Vercel proxies it to Render, so cookies stay same-site) |
| `VITE_SOCKET_URL` | Vercel | `https://<your-api>.onrender.com` (Vercel can't proxy websockets) |

## 3. Before you tell anyone
- [ ] Read the current **Audius API terms** and confirm attribution/caching rules (the app links every track back to Audius and never stores audio).
- [ ] Log in with a real Audius account on the production URL (login and favorites are untested against live Audius).
- [ ] Open a listening-party link from a second device; confirm both stay in sync.
- [ ] Watch Render logs for `[audius usage]` warnings: the free plan allows 500,000 requests/month (warns at 80% and 95%).
