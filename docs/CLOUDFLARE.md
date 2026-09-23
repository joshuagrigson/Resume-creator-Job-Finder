# Launchpad on Cloudflare Workers

One Worker serves everything:

- **The app** (the built React SPA in `dist/`) comes from Workers static assets. Static requests are free and unlimited on every plan.
- **`/api/*`** runs the same Express app as Node (`server/app.ts`) through Cloudflare's Node HTTP bridge (`server/worker.ts`).
- **Geo tables** (ZIP and town centroids) are bundled as text and parsed once at Worker startup, never per request.
- **Secrets** set on the Worker (Anthropic, Adzuna, USAJOBS, JSearch) arrive in `process.env`. The code is unchanged.

Verified locally with `wrangler dev` (wrangler 4.137):

- health responds
- ZIP-radius search for 75501 returns jobs labelled Texarkana, TX
- an unknown ZIP returns a 400
- SPA routes fall back to the app
- `/privacy` and `/terms` serve the static pages
- security headers are applied

The upload is 1.17 MB gzipped, under the free plan's 3 MB limit.

## The plan limit that matters

| | Workers Free | Workers Paid ($5/month) |
| --- | --- | --- |
| CPU per request | **10 ms** | 30 s (default) |
| Requests | 100,000/day | 10 million/month included |

A job search uses about **27 ms of CPU even from cache**, and up to about 500 ms when it fetches all nine boards fresh (measured on Node with `process.cpuUsage`). The time spent waiting on the job boards doesn't count; the parsing and ranking afterwards does. On the free plan, searches would fail with Cloudflare **Error 1102**. The pages, Polish and health checks are light and would mostly get through, but search is the product.

**So the Worker needs Workers Paid.** The free alternative is to keep the API on Render (already configured in `render.yaml`). Render's free tier sleeps after 15 minutes idle, so the first search after a quiet spell waits 30–60 seconds.

## HANDS NEEDED (one time, pre-approved — paste, don't review)

1. **Plan** (only if you choose Paid): https://dash.cloudflare.com/?to=/:account/workers/plans → Workers Paid.
2. **Connect the repo**: https://dash.cloudflare.com/?to=/:account/workers-and-pages/create → *Import a repository* → GitHub → `joshuagrigson/Resume-creator-Job-Finder`. Use these values:

   ```text
   Project name:     launchpad
   Build command:    npm run build
   Deploy command:   npx wrangler deploy
   Root directory:   /
   Production branch: claude/gifted-pascal-ocskwo
   ```

   After the first build, every push to that branch deploys. The address will be `https://launchpad.<your-workers-subdomain>.workers.dev`.
3. **Secrets**: Worker → Settings → Variables and Secrets → add each as type *Secret*. Leave out any you don't have; that source or feature just stays off.

   ```text
   ANTHROPIC_API_KEY
   ADZUNA_APP_ID
   ADZUNA_APP_KEY
   USAJOBS_API_KEY
   USAJOBS_USER_AGENT
   JSEARCH_API_KEY
   ```

Plain settings (`LAUNCHPAD_RUNTIME`, `NODE_ENV`, `ADZUNA_COUNTRY`, `JSEARCH_PROVIDER`) live in `wrangler.jsonc` and deploy with the code.

## Local

```sh
npm run cf:dev     # build + wrangler dev on :8787; put secrets in .dev.vars (git-ignored)
npm run cf:deploy  # build + deploy from a machine logged in with `npx wrangler login`
```

## Why the rate limit reads CF-Connecting-IP

Every request reaches the Worker from Cloudflare's own edge, so the socket address is the same for everyone. Keying the AI rate limit on it would put every visitor in one bucket. With `LAUNCHPAD_RUNTIME=cloudflare`, the limit keys on `CF-Connecting-IP`, which the edge sets and clients can't override. Off Cloudflare the header is ignored, because anyone could send it (see `tests/ai.routes.test.ts`).
