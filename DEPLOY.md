# Deploying Mosaic to Vercel

## The one thing to understand first

**Vercel does not read any env file from the repo.** A committed `.env.prd`,
`.env.production`, etc. is (a) ignored by Vercel at runtime and (b) a secret
leak — this repo is public until the buildathon ends. Production values live
in **each Vercel project's Environment Variables** (Settings → Environment
Variables, scope *Production*), entered via the dashboard or the Vercel CLI.

## Env file map (local)

| File | Read by | Committed? |
|---|---|---|
| `.env.example` | nobody (template) | ✅ yes — no secrets |
| `apps/app/.env.local` | `pnpm --filter @mosaic/app dev` | ❌ gitignored |
| `apps/site/.env.local` | site dev | ❌ gitignored |
| `apps/app/.env.production.local` | local `next build && start` | ❌ gitignored |
| `apps/site/.env.production.local` | local prod build | ❌ gitignored |
| root `.env.local` | **nobody** (pointer note) | ❌ gitignored |

## Two Vercel projects (from the Phase 2 split)

### ⚠️ #1 cause of build failure: Root Directory

This is a monorepo with **two** Next.js apps under `apps/`. There is **no
Next.js app at the repo root**. If a Vercel project's **Root Directory is the
repo root**, the build runs `turbo run build` (both apps) and Vercel can't
find a single app output → the build fails after install. The tell in the
log is `Scope: all 5 workspace projects` during install.

**Fix:** create TWO separate Vercel projects, each pointing at one app:

| Project | Root Directory (Settings → General) | Domain |
|---|---|---|
| mosaic-app | `apps/app` | app.mosaic.xyz |
| mosaic-site | `apps/site` | mosaic.xyz |

With Root Directory set to the app subfolder, Vercel walks up to the
workspace root for `pnpm install`, then runs `next build` in that one app and
finds its `.next` output. Leave Build/Install commands on their defaults
(Vercel auto-detects Next.js + Turborepo). The app project picks up
`apps/app/vercel.json` (the daily snapshot cron) automatically.

Do NOT deploy from the repo root, and do NOT add a root `vercel.json` to force
it — Root Directory per app is the supported path.

## Setting production env vars

**Option A — CLI (bulk, from the gitignored prod files):**
```bash
npm i -g vercel && vercel login

cd apps/app  && vercel link   # link to mosaic-app
../../scripts/vercel-env-push.sh .env.production.local production

cd ../site   && vercel link   # link to mosaic-site
../../scripts/vercel-env-push.sh .env.production.local production
```

**Option B — dashboard:** copy each key/value from
`apps/app/.env.production.local` and `apps/site/.env.production.local` into
the respective project, Production scope.

Then deploy: `vercel --prod` (in each app dir), or push the branch if the
projects auto-deploy.

## Mainnet go-live checklist

- [ ] `MOSAIC_NETWORK=mainnet` + `NEXT_PUBLIC_MOSAIC_NETWORK=mainnet` (both apps)
- [ ] `MOSAIC_MAINNET_ENABLED=true`
- [ ] SoDEX **mainnet** trading key created + registered under the wallet
      (testnet keys do NOT work on mainnet) — verify at `/status`
- [ ] Spot account funded on mainnet (transfer from EVM-funding → Spot)
- [ ] `MOSAIC_DRY_RUN=1` for the first armed run (build+sign, don't send);
      confirm the logged payload, then remove it to place real orders
- [ ] `SESSION_SECRET` and `STATUS_TOKEN` set (required in production)
- [ ] `MOSAIC_GLOBAL_MAX_NOTIONAL` set to a sane cap
- [ ] `NEXT_PUBLIC_APP_URL` on the site points at the app's prod URL

## Rotate-after-buildathon note

The secrets currently in the local prod files (SoDEX private key, DB
password, Anthropic key, session/cron/snapshot secrets) exist only on your
machine. If any were ever pasted into a channel or an older commit, rotate
them before mainnet. They must never enter the public repo.
