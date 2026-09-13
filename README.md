# deccan-birders-api

Standalone Vercel serverless API for [deccanbirders.org](https://deccanbirders.org).
No frontend, no React — just `/api/*` functions that proxy and shape data from eBird, Google Calendar, and YouTube.

## Local dev

```bash
npx vercel dev
```

This reads `.env` (copy `.env.example` to `.env` and fill in keys first). Endpoints are then available at `http://localhost:3000/api/...`.

## Environment variables

| Variable | Where to get it |
|---|---|
| `EBIRD_API_KEY` | Request at [ebird.org/api/keygen](https://ebird.org/api/keygen) (requires a free eBird account). |
| `GOOGLE_CALENDAR_ID` | The calendar's ID from Google Calendar → Settings → the calendar → "Integrate calendar" (looks like `xxxx@group.calendar.google.com`, or your Gmail address for a primary calendar). Calendar must be shared publicly ("make available to public") for the API to read it. |
| `GOOGLE_API_KEY` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create Credentials → API Key. Enable the "Google Calendar API" on the same project. |
| `YOUTUBE_CHANNEL_ID` | From the channel's "About" page → Share → Copy channel ID (starts with `UC`). |
| `YOUTUBE_API_KEY` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create Credentials → API Key. Enable the "YouTube Data API v3" on the same project. Can reuse the same key/project as `GOOGLE_API_KEY`. |

If a variable for a given data source is missing, that endpoint falls back to bundled mock data (`{ mock: true, data: [...] }`) instead of failing, so the site stays usable during setup.

## Endpoints

| Path | Params | Cache | Example |
|---|---|---|---|
| `GET /api/sightings` | `region` (default `IN-TG`), `tab` (`recent`, `notable`, `hotspots`, `hotspot_species`, `onthisday`, `lookup`), `m`, `d` (for `onthisday`), `locId` (for `hotspot_species`), `speciesCode` (for `lookup`) | `recent`/`notable`/`lookup`: 15 min (`s-maxage=900`); `hotspots`/`hotspot_species`/`onthisday`: 24 h (`s-maxage=86400`) | `/api/sightings?tab=recent&region=IN-TG` |
| `GET /api/events` | none | 1 h (`s-maxage=3600`) | `/api/events` |
| `GET /api/videos` | none | 6 h (`s-maxage=21600`) | `/api/videos` |
| `GET /api/health` | none | none | `/api/health` |

`/api/health` returns which of the three integrations have their required env vars set, plus a timestamp — useful for confirming a deploy picked up new environment variables.

## CORS

`vercel.json` locks `Access-Control-Allow-Origin` to `https://deccanbirders.org`. For local testing from `http://localhost`, temporarily add a second origin (or `http://localhost:3000`) to the `headers` block in `vercel.json` — **remove it again before deploying to production.**

## Deploy

1. Push this repo to GitHub.
2. Import the repo into Vercel (or `vercel link` if already using the CLI).
3. Add all 5 environment variables in the Vercel project settings (Production and Preview).
4. Every push to `main` auto-deploys via Vercel's GitHub integration.
