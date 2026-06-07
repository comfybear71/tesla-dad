# Tesla Dad 🚗⚡

A sleek, mobile-first app that tracks the Tesla (**TSLA**) share price and sends
**buy / sell signals** to your phone — so Dad doesn't have to watch the market.

It's a **signal tool only**: it never places real orders. When TSLA moves past a
tier threshold it tells you what to do; you review it and place the trade in CMC
yourself. The long game: **accumulate as many TSLA shares as possible over 5 years**
(and be ready for SpaceX whenever it lists).

> Built to look like Tesla made it — monochrome, lots of whitespace, big numbers.

---

## How it works

1. A scheduled job (**Vercel Cron**, every 15 min) fetches the live TSLA price.
2. It compares the price to your **baseline** and measures the deviation.
3. If a **tier** is crossed it sends a **Telegram** message with the exact action.
4. You place the order in CMC, then **log the trade** in the app.
5. Logging a trade updates your holdings and **resets the baseline** to the trade
   price — so the next round of dips/rallies is measured from where you just acted.

### The 3-tier accumulation ladder (defaults — editable in Settings)

| Tier | Buy when TSLA drops | Deploy | Sell when TSLA rises | Sell |
|------|--------------------|--------|----------------------|------|
| 1 | −3%  | $1,000 | +10% | 3 shares |
| 2 | −5%  | $1,500 | +15% | 4 shares |
| 3 | −10% | $2,500 | +20% | 5 shares |

Deeper dips deploy more cash; bigger rallies release more shares. Every order
respects the **$1,000 CMC minimum** and includes estimated fees.

> ⚠️ At ~$340/share, selling only 1–2 shares is **below** the $1,000 minimum, so
> sell sizes default to 3+ shares. Adjust in **Settings** to taste.

> 🕒 TSLA trades on NASDAQ (9:30am–4:00pm US Eastern ≈ 11:30pm–6:00am AEST), so
> signals usually arrive overnight in Australia — act on them in the morning.

---

## Run it locally

```bash
npm install
cp .env.example .env.local   # add at least FINNHUB_API_KEY
npm run dev                  # http://localhost:3000
```

**Real data only.** This app never fabricates prices. Without a market-data key
(`FINNHUB_API_KEY` or `ALPHAVANTAGE_API_KEY`) the dashboard shows an honest
"live price unavailable" state instead of fake numbers. Strategy/trade data is
stored in a local `.data/` JSON file in dev (Vercel KV in production).

---

## Deploy to Vercel

1. Push this repo to GitHub and **Import** it in Vercel (framework auto-detected).
2. Add a **Vercel KV** store (Storage tab) so data persists — it injects
   `KV_REST_API_URL` / `KV_REST_API_TOKEN` automatically.
3. Add the environment variables below.
4. Deploy. The cron in `vercel.json` runs `/api/cron/check` every 15 minutes.

You get a free `*.vercel.app` URL. On the phone, open it and **Add to Home Screen**
— it installs as a full-screen app icon (PWA), no App Store needed.

### Environment variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `FINNHUB_API_KEY` | Live TSLA quotes ([finnhub.io](https://finnhub.io), free) | **Required** |
| `ALPHAVANTAGE_API_KEY` | Fallback quotes ([alphavantage.co](https://www.alphavantage.co)) | Optional |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | For alerts |
| `TELEGRAM_CHAT_ID` | Dad's chat id | For alerts |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Vercel KV persistence | Recommended |
| `CRON_SECRET` | Protects the cron endpoint | Optional |

See `.env.example` for copy-paste setup notes.

### Set up Telegram (5 minutes)

1. In Telegram, message **@BotFather** → `/newbot` → follow prompts → copy the **token**.
2. Open your new bot and send it any message (e.g. "hi").
3. Visit `https://api.telegram.org/bot<TOKEN>/getUpdates` → copy your **chat id**.
4. Put both in the env vars, redeploy, then tap **Send test Telegram** in Settings.

---

## Project structure

```
src/
├── app/
│   ├── page.tsx            # Dashboard: price, signal, tier ladder, portfolio
│   ├── trades/page.tsx     # Chart + log-a-trade form + history table
│   ├── settings/page.tsx   # Edit baseline, holdings, fees, tiers
│   └── api/
│       ├── signal/         # current price + computed signal
│       ├── quote/          # live TSLA quote
│       ├── config/         # get/save strategy config
│       ├── trades/         # get/record trades (updates holdings + baseline)
│       ├── history/        # snapshots + trades for the chart
│       ├── cron/check/     # Vercel Cron: check price, notify Telegram
│       └── test-telegram/  # send a test message
├── components/             # UI (SignalCard, TierLadder, PriceChart, …)
└── lib/                    # types, store, price feed, signal logic, telegram
```

---

## Roadmap

- ✅ Live price + 3-tier buy/sell signals to Telegram
- ✅ Trade log (table + chart) and portfolio tracking
- ⬜ In-app Web Push (no Telegram needed)
- ⬜ CMC API integration to (optionally) automate orders
- ⬜ SpaceX ticker support when it lists

---

*This app does not provide financial advice and never executes trades. Always
review each signal and trade through your own broker.*
