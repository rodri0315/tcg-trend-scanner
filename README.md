# Pokemon TCG Trend Scanner

Internal-only TCG trend and arbitrage scanner.

## Scope
- Pokemon and One Piece
- English and Japanese tracked separately
- Singles only
- eBay US for active listing signals
- Daily snapshots
- Internal decision support for flips and holds
- eBay-first MVP to avoid TCGplayer API availability and terms issues

## Stack
- Node.js + TypeScript
- Next.js + React + TypeScript dashboard
- Postgres
- CSV/Markdown reports first

## Implemented MVP
- Postgres schema for cards, eBay daily snapshots, and signals
- CSV seed import for tracked cards
- Daily eBay Buy It Now and auction snapshot fetcher
- Signal scoring for trend and local lag opportunities using eBay-only history
- CSV and Markdown report output
- Internal read-only dashboard for overview, watchlist review, and card detail history

## Environment
Copy `.env.example` to `.env` and fill in:
- `DATABASE_URL`
- `DATABASE_SSL`
- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
- `EBAY_VERIFICATION_TOKEN`
- `APP_BASE_URL`

## Database setup
Apply [`migrations/001_init.sql`](/Users/jorgerodriguez/jr/TCG/pokemon-trend-scanner/migrations/001_init.sql) to a fresh database.
If you already applied the earlier pre-pivot schema, also apply [`migrations/002_ebay_only_signals.sql`](/Users/jorgerodriguez/jr/TCG/pokemon-trend-scanner/migrations/002_ebay_only_signals.sql).

## Seed cards
Starter seed data lives in [`seed/seed_cards.csv`](/Users/jorgerodriguez/jr/TCG/pokemon-trend-scanner/seed/seed_cards.csv).
Each row is tracked separately by `game`, `language`, and `product_type`.
Use `market_segment` to split raw vs graded lanes like `raw` and `psa_10`.

Run:

```bash
npm run seed
```

## Daily pipeline
Run the full daily job:

```bash
npm run daily
```

Optional backfill date:

```bash
npm run daily -- --date=2026-03-12
```

Offline mode (no eBay credentials required):

```bash
npm run daily -- --offline --date=2026-03-12
```

Optional custom fixture path:

```bash
npm run daily -- --offline --fixture=seed/mock_ebay_daily.json
```

Outputs are written to the `reports/` directory as:
- `YYYY-MM-DD-opportunities.csv`
- `YYYY-MM-DD-opportunities.md`

## Internal dashboard
Run the dashboard locally:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm run start
```

The dashboard includes:
- overview page with game, language, and market filters
- watchlist page for tracked cards
- card detail pages with recent history

## eBay production keyset compliance
The app includes a minimal Marketplace Account Deletion webhook at:

`/api/ebay/marketplace-account-deletion`

To configure it in the eBay developer portal:
- set `Delivery Method` to `Web server`
- use your deployed HTTPS URL plus `/api/ebay/marketplace-account-deletion`
- set `EBAY_VERIFICATION_TOKEN` to the same token you enter in eBay
- set `APP_BASE_URL` to the public base URL of the deployed app

How it works:
- `GET` handles eBay's `challenge_code` verification flow
- `POST` accepts deletion notifications and logs the payload

Example public endpoint:

```text
https://your-app.example.com/api/ebay/marketplace-account-deletion
```

## Notes
- eBay snapshots are aggregate-only for MVP and keep raw API payloads for debugging.
- Snapshot aggregation filters out likely non-card matches by title and suppresses obvious low-price BIN outliers before computing floors and counts, while keeping rejection diagnostics in `raw_payload`.
- Signals use 7-day and 30-day eBay lookbacks and degrade gracefully when history is not available yet.
- Local lag scoring is inferred from eBay floor acceleration, inventory tightening, and auctions trailing current BIN floors.
- Offline mode maps fixture rows by `ebay_query` first, then `card_name`, and defaults missing cards to zero-volume rows.
- English and Japanese are stored as separate tracked cards so the same character/card can be monitored independently by language.
- Raw and graded markets should be stored as separate watchlist rows using `market_segment`.
