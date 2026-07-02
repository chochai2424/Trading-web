#!/usr/bin/env node
// Driver for the US Small-Cap SMC Scanner (Next.js app).
//
// Drives a *running* server (start it first — see SKILL.md) in two phases:
//   1. API smoke  — hits every route, asserts the screening pipeline
//                   returns 10 picks with valid level ordering.
//   2. UI shots   — Playwright screenshots of all four pages, including
//                   a real watchlist add-ticker interaction.
//
// Usage:
//   node .claude/skills/run-trading-web/driver.mjs [api|shots|all] \
//        [--base http://localhost:3100] [--out <dir>]
//
// Notes for this container:
//   - localhost fetch must bypass the proxy; we clear *_PROXY below.
//   - Playwright is the system install, not a project dep (see import).
//   - Sandbox blocks Yahoo, so the app serves labeled SAMPLE data — the
//     pipeline still runs fully; on an open network it's live automatically.

import { mkdirSync } from "node:fs";

// localhost must not go through the env proxy (HTTPS_PROXY is set here)
for (const k of ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"]) {
  delete process.env[k];
}
process.env.NO_PROXY = "*";

const args = process.argv.slice(2);
const mode = args.find((a) => !a.startsWith("--")) || "all";
const getFlag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const BASE = getFlag("base", "http://localhost:3100").replace(/\/$/, "");
const OUT = getFlag("out", "/tmp/trading-web-shots");

let failures = 0;
const pass = (m) => console.log(`  \x1b[32mPASS\x1b[0m ${m}`);
const fail = (m) => {
  console.log(`  \x1b[31mFAIL\x1b[0m ${m}`);
  failures++;
};

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.json();
}

async function apiSmoke() {
  console.log(`\n== API smoke (${BASE}) ==`);

  // /api/screen — the heart of the app
  try {
    const j = await getJson("/api/screen");
    const n = j.picks?.length ?? 0;
    n === 10 ? pass(`/api/screen returned ${n} picks`) : fail(`/api/screen returned ${n} picks (want 10)`);
    console.log(`       dataSource=${j.dataSource} marketState=${j.marketState}`);
    let bad = 0;
    for (const p of j.picks ?? []) {
      const l = p.levels;
      if (!(l.stopLoss < l.entry && l.entry < l.mid && l.mid < l.takeProfit && l.takeProfit <= l.high + 1e-9)) {
        bad++;
        console.log(`       bad ordering ${p.symbol}: ${JSON.stringify(l)}`);
      }
    }
    bad === 0
      ? pass("every pick has SL < entry < mid < TP <= High")
      : fail(`${bad} pick(s) with broken level ordering`);
    const refined = (j.picks ?? []).filter((p) => p.intraday?.refined).length;
    console.log(`       intraday-refined entries: ${refined}/${n}`);
  } catch (e) {
    fail(`/api/screen threw: ${e.message}`);
  }

  // /api/history with the 15m interval toggle
  try {
    const j = await getJson("/api/history/SOUN?interval=15m");
    const c = j.candles?.length ?? 0;
    c > 50 && j.interval === "15m"
      ? pass(`/api/history?interval=15m returned ${c} bars`)
      : fail(`/api/history 15m returned ${c} bars, interval=${j.interval}`);
  } catch (e) {
    fail(`/api/history threw: ${e.message}`);
  }

  // /api/analyze — on-demand analysis for an arbitrary ticker (watchlist)
  try {
    const j = await getJson("/api/analyze/TSLA");
    const l = j.levels;
    l && l.entry && l.takeProfit && l.high
      ? pass(`/api/analyze/TSLA returned levels (entry ${l.entry}, TP ${l.takeProfit})`)
      : fail(`/api/analyze/TSLA missing levels: ${JSON.stringify(j).slice(0, 120)}`);
  } catch (e) {
    fail(`/api/analyze threw: ${e.message}`);
  }

  // /api/quote and /api/news
  try {
    const q = await getJson("/api/quote/SOUN");
    q.symbol === "SOUN" && typeof q.price === "number"
      ? pass(`/api/quote/SOUN price ${q.price}`)
      : fail(`/api/quote/SOUN unexpected: ${JSON.stringify(q).slice(0, 120)}`);
  } catch (e) {
    fail(`/api/quote threw: ${e.message}`);
  }
  try {
    const n = await getJson("/api/news/SOUN");
    Array.isArray(n.news) && n.news.length > 0
      ? pass(`/api/news/SOUN returned ${n.news.length} items`)
      : fail(`/api/news/SOUN returned no items`);
  } catch (e) {
    fail(`/api/news threw: ${e.message}`);
  }
}

async function uiShots() {
  console.log(`\n== UI screenshots (${BASE}) -> ${OUT} ==`);
  mkdirSync(OUT, { recursive: true });
  // System Playwright, not a project dependency
  const { chromium } = await import(
    "file:///opt/node22/lib/node_modules/playwright/index.mjs"
  );
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

  try {
    // Main dashboard
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("table tbody tr", { timeout: 90_000 });
    const rows = await page.locator("table tbody tr").count();
    await shot("main");
    rows === 10 ? pass(`main page table has ${rows} rows`) : fail(`main page has ${rows} rows (want 10)`);

    // Graph & News — LevelChart renders a <canvas>
    await page.goto(`${BASE}/graph/SOUN`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("canvas", { timeout: 60_000 });
    await page.waitForTimeout(3000);
    const canvases = await page.locator("canvas").count();
    await shot("graph");
    canvases > 0 ? pass(`graph page rendered ${canvases} canvas element(s)`) : fail("graph page has no canvas");

    // Conclude
    await page.goto(`${BASE}/conclude`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("table tbody tr", { timeout: 60_000 });
    await shot("conclude");
    pass("conclude page rendered");

    // Watchlist — real interaction: add a ticker, expect an analyzed row
    await page.goto(`${BASE}/watchlist`, { waitUntil: "domcontentloaded" });
    await page.fill('input[aria-label="เพิ่มหุ้นเข้ารายการโปรด"]', "SOUN");
    await page.click('button[type="submit"]');
    await page.waitForSelector("table tbody tr", { timeout: 60_000 });
    await page.waitForTimeout(2000);
    const wlRows = await page.locator("table tbody tr").count();
    await shot("watchlist");
    wlRows >= 1 ? pass(`watchlist add produced ${wlRows} row(s)`) : fail("watchlist add produced no rows");
  } finally {
    await browser.close();
  }
}

if (mode === "api" || mode === "all") await apiSmoke();
if (mode === "shots" || mode === "all") await uiShots();

console.log(
  failures === 0
    ? `\n\x1b[32mALL CHECKS PASSED\x1b[0m`
    : `\n\x1b[31m${failures} CHECK(S) FAILED\x1b[0m`
);
process.exit(failures === 0 ? 0 : 1);
