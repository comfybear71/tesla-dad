# CLAUDE.md — Tesla Dad

> Project context and rules for AI sessions. **Read this and `HANDOFF.md` before
> starting any work.** Do not delete either file — they are the project's brain
> and memory.

## What this is

**Tesla Dad** is a sleek, mobile-first web app that tracks share prices (TSLA
first, plus any watchlist ticker covered by a real feed) and sends **buy/sell
signals** to a phone (via Telegram) so an 80-year-old investor doesn't have to
watch the market. The long-term goal is to **accumulate TSLA shares over ~5
years** (and add SpaceX / Anthropic / OpenAI the day they list — the watchlist
only accepts tickers a real price feed covers).

It is a **signal tool only** — see the trading rules below.

## 🚨 Non-negotiable rules

These extend the ecosystem **SAFETY-RULES**:
https://github.com/comfybear71/Master/blob/master/SAFETY-RULES.md

1. **Never push directly to `main`/`master`.** Work on a feature/dev branch and
   verify on a Vercel preview before any merge to production.
2. **This is a TRADING project → heightened protection.** It must remain
   **signal-only**: it NEVER places, executes, or automates real orders. Any
   change to the signal/trade logic requires explicit written authorization from
   the owner. Otherwise treat as read-only monitoring.
3. **NEVER use fake / mock / demo / placeholder data.** No fabricated prices,
   no seeded charts. If a real data source is unavailable, show an honest
   "unavailable" state and stop — do not invent numbers.
4. **Secrets only via environment variables.** Never hardcode keys. Owner adds
   all keys in the Vercel project settings.
5. **TypeScript strict, no `any`** without a written reason.
6. **Surgical, atomic commits** — one logical change per commit. Diagnose before
   fixing; after **3 failed attempts**, stop and consult the owner. Don't batch-
   revert or batch-delete files.
7. **Update `HANDOFF.md` at the end of every session.**

## Tech stack

- **Next.js 14** (App Router, TypeScript) + **Tailwind CSS**
- **Recharts** for the price/trade chart
- Hosted on **Vercel** (free `*.vercel.app` domain for now), PWA installable
- **Vercel Cron** (`vercel.json`) runs `/api/cron/check` every 15 min
- Persistence: **Vercel KV** in prod, local JSON file (`.data/`) fallback in dev
  - ⚠️ Ecosystem standard is MongoDB. KV was chosen for prototype speed; revisit
    if the owner wants alignment (see HANDOFF "Open decisions").

## Architecture

```
src/
├── app/
│   ├── page.tsx          Dashboard: price, signal, tier ladder, portfolio
│   ├── news/page.tsx     Market desk: AI daily brief + real headlines
│   ├── trades/page.tsx   Chart + log-a-trade form + history list
│   ├── settings/page.tsx Watchlist + per-symbol baseline/holdings/fees/tiers
│   └── api/              (symbol-scoped routes accept ?symbol=)
│       ├── signal/       price + computed signal (503 if no source)
│       ├── quote/        live quote (503 if no source)
│       ├── config/       GET/POST per-symbol strategy config
│       ├── trades/       GET/POST trades (updates holdings + resets baseline)
│       ├── history/      snapshots + trades + baseline for the chart
│       ├── watchlist/    GET/POST/DELETE tracked tickers (real-feed-validated)
│       ├── news/         real Finnhub company news (503 if no source)
│       ├── brief/        GET stored AI daily brief / POST regenerate
│       ├── cron/check/   Vercel Cron: per-symbol quote → snapshot → Telegram
│       └── test-telegram/ send a test message
├── components/           SignalCard, TierLadder, PriceChart, SymbolTabs, …
└── lib/
    ├── types.ts          domain types
    ├── defaults.ts       default config + 3-tier ladder
    ├── store.ts          per-symbol Vercel KV / file persistence + watchlist
    ├── price.ts          Finnhub → Alpha Vantage (NO mock fallback)
    ├── news.ts           Finnhub company news (NO mock fallback)
    ├── brief.ts          AI daily brief (Claude, context only, never trades)
    ├── signals.ts        tier logic (the core strategy)
    ├── useWatchlist.ts   client hook: tracked symbols + active selection
    └── telegram.ts       Bot API sender + message formatting
```

## The strategy (3-tier accumulation ladder)

Deviation is measured from a **baseline** that **resets to the trade price after
each logged trade**. Defaults (editable in Settings):

| Tier | Buy on drop | Deploy | Sell on rise | Sell |
|------|-------------|--------|--------------|------|
| 1 | −3%  | $1,000 | +10% | 3 shares |
| 2 | −5%  | $1,500 | +15% | 4 shares |
| 3 | −10% | $2,500 | +20% | 5 shares |

- Picks the **most extreme** triggered tier.
- Every order must clear the **$1,000 CMC minimum** and includes a fee estimate.
- Note: 1–2 share sells are below the $1,000 minimum at ~$340/share → sells
  default to 3+ shares.

## Environment variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `FINNHUB_API_KEY` | Live quotes + company news | **Yes** |
| `ALPHAVANTAGE_API_KEY` | Fallback quotes | Optional |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Phone alerts; chat id accepts a comma-separated list (or a group id) for multiple recipients | For alerts |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Vercel KV persistence | Prod |
| `ANTHROPIC_API_KEY` | AI daily brief (News page + Telegram) | For the brief |
| `BRIEF_MODEL` | Override brief model (default `claude-opus-4-8`) | Optional |
| `CRON_SECRET` | Protect the cron endpoint | Optional |

## File structure convention (ecosystem)

Root: `CLAUDE.md`, `HANDOFF.md`, `README.md`. All other docs go in `docs/`.

## Commands

```bash
npm run dev        # local dev
npm run build      # production build (must pass before any PR)
npm run typecheck  # tsc --noEmit
```
