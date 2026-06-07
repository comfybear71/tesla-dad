# HANDOFF.md — Tesla Dad

> The project's **memory**. Current state, what's done, what's next, open
> decisions. Read this and `CLAUDE.md` before starting. Update at session end.
> Never delete this file.

## Status

🟢 **Prototype skeleton complete.** Builds clean, runs locally, deploys to
Vercel. Awaiting the owner to add API keys in Vercel env vars, after which it
goes fully live (real data only — no fakes).

- **Repo:** `comfybear71/tesla-dad`
- **Working branch:** `claude/tesla-dad-tracker-KSR7U`
- **Production branch:** `master` (protected — never push directly)
- **Live URL:** _not deployed yet_ — will be a `*.vercel.app` URL

## What's built

- Mobile-first **Next.js 14 PWA** with Tesla-style monochrome UI (installable
  via "Add to Home Screen").
- **Dashboard** (`/`): live price, BUY/SELL/HOLD signal card, visual tier
  ladder with live needle, portfolio summary. Shows an honest "live price
  unavailable" state when no data source is connected.
- **Trades** (`/trades`): price chart with buy/sell markers, log-a-trade form
  (pre-fills from a signal), full history table.
- **Settings** (`/settings`): edit baseline, holdings, CMC fees, all 3 tiers;
  "set baseline to current price"; "send test Telegram".
- **Signal engine** (`lib/signals.ts`): 3-tier ladder, picks most extreme tier,
  enforces $1,000 CMC minimum + fees. Baseline resets to trade price on each log.
- **Price feed** (`lib/price.ts`): Finnhub → Alpha Vantage. **No mock fallback.**
- **Vercel Cron** every 15 min → real quote → snapshot → Telegram (de-duped).
- **Telegram** sender + rich message formatting.
- **Persistence**: Vercel KV (prod) / local JSON file (dev).
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
  `HANDOFF.md`. Opening first prototype PR.
