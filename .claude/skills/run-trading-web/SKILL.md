---
name: run-trading-web
description: Build, run, drive, screenshot, and smoke-test the US Small-Cap SMC Scanner (Next.js trading dashboard). Use when asked to run/start/launch/serve the app, screenshot its pages, verify the screening API, or check the dashboard/graph/watchlist works.
---

# Run: US Small-Cap SMC Scanner

Next.js 14 web app (App Router, TypeScript). Server-side pipeline screens US
small-cap stocks with SMC + Volume Profile via Yahoo Finance (keyless); four
pages: `/` (dashboard), `/graph/[ticker]`, `/conclude`, `/watchlist`.

Drive it with **`.claude/skills/run-trading-web/driver.mjs`** — it hits every
API route (asserting the pipeline returns 10 well-ordered picks) and takes
Playwright screenshots of all four pages including a watchlist add-ticker
interaction. All paths below are relative to the repo root (`<unit>/`).

## Prerequisites

Node 22 (`node --version` → v22.x). No `apt-get` needed — the app runs headless
and the driver uses the **system Playwright** at
`/opt/node22/lib/node_modules/playwright` with the browser at
`/opt/pw-browsers/chromium`. No API key (Yahoo Finance is keyless).

## Build

```bash
npm install
npm run build
```

## Run (agent path)

Start the server in the background, wait for it, then run the driver:

```bash
pkill -f 'next[-]server' 2>/dev/null; sleep 1
(nohup npm run start -- -p 3100 > /tmp/tw-server.log 2>&1 &)
sleep 5
curl -s --noproxy '*' -o /dev/null -w "server: %{http_code}\n" http://localhost:3100/
```

```bash
node .claude/skills/run-trading-web/driver.mjs
```

Expected tail (exit 0):

```
  PASS /api/screen returned 10 picks
  PASS every pick has SL < entry < mid < TP <= High
  PASS /api/history?interval=15m returned 260 bars
  PASS /api/analyze/TSLA returned levels (entry 7.26, TP 7.74)
  PASS main page table has 10 rows
  PASS graph page rendered 7 canvas element(s)
  PASS watchlist add produced 1 row(s)

ALL CHECKS PASSED
```

Screenshots land in `/tmp/trading-web-shots/` (`main`, `graph`, `conclude`,
`watchlist`). Sub-modes: `driver.mjs api` (no browser) or `driver.mjs shots`.
Flags: `--base http://localhost:3100`, `--out <dir>`.

Stop the server when done: `pkill -f 'next[-]server'`

## Direct invocation (analysis lib, no server)

The pipeline internals (`src/lib/{levels,smc,volumeProfile,alerts}.ts`) are pure
and testable without the app — compile with tsc, then call. Verifies the
intraday level refinement:

```bash
npx tsc src/lib/levels.ts src/lib/alerts.ts src/lib/types.ts \
  --outDir /tmp/tw-libtest --module commonjs --target es2020 --skipLibCheck
node -e '
const { deriveLevels } = require("/tmp/tw-libtest/levels.js");
const smc = { swingHigh:12, swingLow:8, bullishBos:true, impulseRelVolume:2, orderBlock:{high:9.5,low:9.0,time:0,confirmed:true} };
const r = deriveLevels(10.5, smc, {poc:9.8,vah:11.2,val:9.2,bins:[]}, 12, {high:10.2,low:10.0,time:0,confirmed:true});
console.log(r.refinedByIntraday && r.levels.entry===10.2 ? "PASS" : "FAIL", JSON.stringify(r.levels));
'
```

## Run (human path)

`npm run dev` → open http://localhost:3000. Useless headless (no browser to
view it); use the driver instead.

## Test

No test framework is configured (`npm test` is absent). The driver **is** the
smoke test; the direct-invocation block above is the lib-level check.

## Gotchas

- **Sample-data mode is expected in this sandbox.** The network blocks Yahoo
  and TradingView (`CONNECT 403`), so the app auto-falls back to clearly-labeled
  sample data (banner "โหมดข้อมูลตัวอย่าง", `dataSource: "sample"`, and a blank
  TradingView iframe on the graph page). The real SMC/Volume-Profile pipeline
  still runs fully on generated candles. On an unrestricted network it serves
  live data automatically — no code change.
- **localhost must bypass the proxy.** This env sets `HTTPS_PROXY`; curl needs
  `--noproxy '*'` or it returns `000`. The driver deletes `*_PROXY` from its own
  env for the same reason.
- **Playwright is not a project dependency.** The driver imports it by absolute
  path (`file:///opt/node22/lib/node_modules/playwright/index.mjs`) and launches
  with `executablePath:'/opt/pw-browsers/chromium'` + `args:['--no-sandbox']`.
  Do not run `playwright install`.
- **`pkill -f "next start"` kills its own shell** (the pattern matches the
  command line). Use `pkill -f 'next[-]server'`.
- **`yahoo-finance2` is pinned to exactly `2.11.3`.** 2.14.0 is a broken
  transitional release missing `screener`/`chart`/`search`. Do not bump it.
- **`next.config.js` sets `serverComponentsExternalPackages:["yahoo-finance2"]`** —
  its ESM build references Deno-only test modules that break the webpack bundle
  otherwise. Leave it.
- **Cold `/api/screen` takes ~20–40 s** (screens + analyzes ~25 candidates, then
  15m-refines the top 12); the driver allows a 90 s fetch timeout. Result is
  cached ~5 min, so re-runs are instant.
- The graph page renders **7 canvases** (Lightweight Charts uses several layers);
  `> 0` is the real assertion.

## Troubleshooting

- **`server: 000`** — server not up yet (build still running or crashed). Check
  `/tmp/tw-server.log`; increase the `sleep` after backgrounding `npm run start`.
- **Driver `/api/screen threw: HTTP 500`** — usually the build is stale; re-run
  `npm run build` before `npm run start`.
- **Screenshot is blank/error** — confirm the server returns `200` first; the
  driver waits on `table tbody tr` / `canvas`, so a blank shot means the page
  errored server-side (check the server log).
