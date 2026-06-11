# HANDOFF.md — Tesla Dad

> The project's **memory**. Current state, what's done, what's next, open
> decisions. Read this and `CLAUDE.md` before starting. Update at session end.
> Never delete this file.

## Status

🟢 **LIVE in production.** Deployed on Vercel with real Finnhub data and working
Telegram alerts. Real data only — no fakes.

- **Repo:** `comfybear71/tesla-dad`
- **Production branch:** `master` (protected — never push directly; PR + squash)
- **Live URL:** https://tesla-dad.vercel.app
- **Env vars set:** `FINNHUB_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
  (now two ids: owner + Dad), Upstash Redis (`KV_REST_API_*`), `ANTHROPIC_API_KEY`.
  Latest release: `v0.3.0-2026-06-10`.
- **Vercel gotcha (resolved):** project was first imported when the repo was
  empty, so Framework Preset locked to "Other" → every route 404'd despite green
  builds. Fix: set Framework Preset = **Next.js** + one fresh deploy.

## What's built

- Mobile-first **Next.js 14 PWA** with Tesla-style monochrome UI (installable
  via "Add to Home Screen").
- **Multi-asset watchlist** (v0.3.0): track any real-feed ticker alongside TSLA
  (adds validated against Finnhub — unlisted names like SpaceX rejected
  honestly). Per-symbol config/baseline/tiers/trades/snapshots; TSLA keeps its
  original Redis keys (no prod migration). All APIs take `?symbol=`.
  ⚠️ Cash is per-asset — see open decision 4.
- **Dashboard** (`/`): live price, day-range bar, BUY/SELL/HOLD signal card in
  plain English, tier ladder with dollar trigger prices + true-zero baseline,
  portfolio with day P&L. Honest "unavailable" state when no data source.
- **Market desk** (`/news`, v0.3.0): real Finnhub headlines per symbol + AI
  daily brief (Claude `claude-opus-4-8` via `@anthropic-ai/sdk`, structured
  JSON, `BRIEF_MODEL` override). Generated once per ET weekday by the cron
  premarket (≥ 08:00 ET) and posted to Telegram; manual refresh on the page.
  Context-only — never instructs trades.
- **Premarket gap alerts**: 07:00–09:30 ET, Telegram alert when a watched stock
  gaps beyond ±`GAP_ALERT_PCT` (default 3%) vs prev close, once/symbol/day.
- **Desk notes** (`/api/telegram/webhook`): the bot listens — voice memos are
  transcribed with Whisper (Groq → OpenAI fallback) and `/note` texts captured;
  last 48h of notes feed the daily brief as attributed human context (never
  trade instructions). Webhook registered in prod with `TELEGRAM_WEBHOOK_SECRET`;
  ⚠️ while the webhook is set, manual `getUpdates` no longer works (Telegram
  rule — likely what broke budju's notes).
- **Desk-style brief**: budju-Desk format — broad-market regime read (real
  SPY/QQQ/USO quotes), per-asset sentiment with confidence %, week change from
  stored snapshots, and the next ladder trigger levels as context.
- **Trades** (`/trades`): price chart with buy/sell markers + baseline line,
  log-a-trade form (pre-fills from a signal), mobile-friendly history list.
- **Settings** (`/settings`): watchlist add/remove, per-symbol baseline,
  holdings, CMC fees, all 3 tiers (stepper inputs); "set baseline to current
  price"; "send test Telegram".
- **Telegram**: signal alerts, open/close summaries, gap alerts and the brief
  fan out to every chat id in `TELEGRAM_CHAT_ID` (comma-separated; Dad added).
- **Signal engine** (`lib/signals.ts`): 3-tier ladder, picks most extreme tier,
  enforces $1,000 CMC minimum + fees. Baseline resets to trade price on each log.
- **Price feed** (`lib/price.ts`): Finnhub → Alpha Vantage. **No mock fallback.**
- **Vercel Cron** every 15 min → real quote → snapshot → Telegram (de-duped).
- **Daily Telegram summaries** (`lib/market.ts` + cron): market **open** (first
  run ≥ 09:30 ET) and **close** (first run ≥ 16:00 ET) summaries, once per ET
  weekday, with price, day change, range, prev close, baseline deviation, and
  the current signal. DST-safe via `America/New_York`. ⚠️ US market holidays are
  NOT detected — on a holiday a flat summary may still send (minor; refine later).
- **Telegram** sender + rich message formatting.
- **Persistence**: Upstash Redis / Vercel KV (prod) / local JSON file (dev).
- Root docs: `README.md`, `CLAUDE.md`, this file.

## Verified

- `npm run build` passes; all routes compile.
- Endpoints smoke-tested: signal computes correct BUY (deep dip) and correctly
  HOLDs a sell that's below the $1,000 minimum; trade logging updates holdings
  and resets baseline; cron returns a clean 503 when no price source is set.

## To go live (owner actions)

1. Import repo into **Vercel**.
2. Add **Vercel KV** store (auto-injects `KV_REST_API_*`).
3. Add env vars: `FINNHUB_API_KEY` (required), optional `ALPHAVANTAGE_API_KEY`,
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CRON_SECRET`.
4. Deploy, open on phone → Add to Home Screen → Settings → "Send test Telegram".

## Open decisions (need owner input)

1. **Persistence: Vercel KV vs MongoDB.** Ecosystem standard is MongoDB; this
   prototype uses Vercel KV for speed. Migrate for consistency? (Low effort.)
2. **Sell sizing.** Defaults to 3/4/5 shares so sells clear the $1,000 minimum
   (1–2 shares is too small at ~$340). Confirm acceptable.
3. **Notification channel.** Telegram first (chosen). Add in-app Web Push later?
4. **Per-asset cash.** With the multi-asset watchlist, `cashUsd` is a budget per
   stock (labelled "USD cash for this stock" in Settings). Simplest and keeps
   the signal engine untouched, but the same dollars could be allocated to two
   stocks. Confirm acceptable, or move to a shared cash pool.

## Next steps / roadmap

- ⬜ Deploy to Vercel + connect keys (owner)
- ⬜ Confirm open decisions above
- ⬜ In-app Web Push as a Telegram alternative
- ⬜ CMC API integration to (optionally) automate orders — future, needs auth
- ⬜ SpaceX ticker when it lists

## Session log

- **2026-06-07** — Initial build. Scaffolded full Next.js prototype: dashboard,
  trades, settings, signal engine, Telegram, Vercel cron, PWA. Then, per owner's
  safety rules, **removed all demo/mock data** (deleted `/api/seed`, removed the
  mock price fallback) so the app uses real data only. Added `CLAUDE.md` +
  `HANDOFF.md`. Merged PR #1 (prototype), #2 (Upstash env names), #3 (Next.js
  14.2.35 security patch). Debugged Vercel 404 → Framework Preset was "Other";
  set to Next.js → **went live** at tesla-dad.vercel.app with real Finnhub data;
  Telegram confirmed working. Added **daily open/close Telegram summaries**
  (PR #4). Homepage polls live price every 30s while open.
- **2026-06-09** — Big feature session on branch `claude/app-ui-improvements-vw5khx`:
  multi-asset watchlist backend + UI (owner explicitly authorized extending to
  new symbols; `signals.ts` math untouched), full UI overhaul incl. the ladder
  baseline-position bug fix, and the budju-style market desk (real news feed +
  AI daily brief). Merged as PR #5 → released **v0.3.0-2026-06-10**, deployed,
  verified live (`/api/watchlist`, `/news` 200).
- **2026-06-10** — **Multi-recipient Telegram** (PR #6, merged): comma-separated
  `TELEGRAM_CHAT_ID`; owner added Dad's chat id (1768033255). **Premarket
  pipeline** (this PR, inspired by Humbled Trader's Claude+TradingView video):
  gap alert 07:00–09:30 ET at ±`GAP_ALERT_PCT` (default 3%, once/symbol/day)
  and the AI brief moved from ≥ 09:30 to ≥ 08:00 ET with a premarket data note
  in the prompt. Also in PR #7: **Telegram desk notes** (voice via Whisper +
  `/note` texts → brief context, ported from budju). Merged + verified live:
  owner's voice memo about Iran/Trump transcribed perfectly. Then upgraded the
  brief to **budju-Desk format** (market regime via SPY/QQQ/USO, confidence %,
  week changes, ladder trigger levels). Idea parked deliberately: IBKR-style
  order automation from the video is out of scope (signal-only rule).
  Candidate next: backtest the tier ladder on historical candles to tune
  percentages.
