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
- Postgres
- CSV/Markdown reports first
- React/Next dashboard later

## Implemented MVP
- Postgres schema for cards, eBay daily snapshots, and signals
- CSV seed import for tracked cards
- Daily eBay Buy It Now and auction snapshot fetcher
- Signal scoring for trend and local lag opportunities using eBay-only history
- CSV and Markdown report output

## Environment
Copy `.env.example` to `.env` and fill in:
- `DATABASE_URL`
- `DATABASE_SSL`
- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`

## Database setup
Apply [`migrations/001_init.sql`](/Users/jorgerodriguez/jr/TCG/pokemon-trend-scanner/migrations/001_init.sql) to a fresh database.
If you already applied the earlier pre-pivot schema, also apply [`migrations/002_ebay_only_signals.sql`](/Users/jorgerodriguez/jr/TCG/pokemon-trend-scanner/migrations/002_ebay_only_signals.sql).

## Seed cards
Starter seed data lives in [`seed/seed_cards.csv`](/Users/jorgerodriguez/jr/TCG/pokemon-trend-scanner/seed/seed_cards.csv).
Each row is tracked separately by `game`, `language`, and `product_type`.

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

## Notes
- eBay snapshots are aggregate-only for MVP and keep raw API payloads for debugging.
- Signals use 7-day and 30-day eBay lookbacks and degrade gracefully when history is not available yet.
- Local lag scoring is inferred from eBay floor acceleration, inventory tightening, and auctions trailing current BIN floors.
- Offline mode maps fixture rows by `ebay_query` first, then `card_name`, and defaults missing cards to zero-volume rows.
- English and Japanese are stored as separate tracked cards so the same character/card can be monitored independently by language.
