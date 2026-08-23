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
- Local buy scoring with market-now estimates, target buy prices, confidence, and reason codes
- Thin low-end listing sampling for floor-quality and absorption analysis
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
- Optional selling-cost assumptions described below

## Database setup
Apply [`migrations/001_init.sql`](/Users/jorgerodriguez/jr/TCG/pokemon-trend-scanner/migrations/001_init.sql) to a fresh database.
If you already applied the earlier pre-pivot schema, also apply [`migrations/002_ebay_only_signals.sql`](/Users/jorgerodriguez/jr/TCG/pokemon-trend-scanner/migrations/002_ebay_only_signals.sql).
Apply [`migrations/003_local_buy_engine.sql`](/Users/jorgerodriguez/jr/TCG/pokemon-trend-scanner/migrations/003_local_buy_engine.sql) to enable listing samples, market-now estimation, target buy prices, and local-buy scoring.
Apply [`migrations/004_listing_sample_unique_per_card.sql`](/Users/jorgerodriguez/jr/TCG/pokemon-trend-scanner/migrations/004_listing_sample_unique_per_card.sql) to make listing samples idempotent per tracked card.
Apply [`migrations/005_snapshot_source.sql`](/Users/jorgerodriguez/jr/TCG/pokemon-trend-scanner/migrations/005_snapshot_source.sql) to separate live history from backfill and fixture data.
Apply [`migrations/006_card_condition.sql`](/Users/jorgerodriguez/jr/TCG/pokemon-trend-scanner/migrations/006_card_condition.sql) to add tracked card condition lanes like `near_mint_or_better` and `graded`.
Apply [`migrations/007_economic_decision_support.sql`](/Users/jorgerodriguez/jr/TCG/pokemon-trend-scanner/migrations/007_economic_decision_support.sql) to add explicit active-ask ranges, expert popularity tiers, liquidity fields, and auditable net-exit/max-buy scenarios.

## Exit scenarios

Active eBay listings are asking prices, not confirmed sales. The scanner stores a credible low ask range and uses its median as an active-ask reference.

eBay is used for price discovery, while actual exits may happen directly with collectors, through vendors, or occasionally on eBay. The daily signal stores all calculated exit scenarios and uses `direct_collector` as the primary scenario.

Default assumptions are editable through `.env`:

- Direct collector: `EXIT_COLLECTOR_DISCOUNT_PCT=5`
- Vendor: `EXIT_VENDOR_PAYOUT_PCT=80`
- Target return: `EXIT_TARGET_NET_ROI_PCT=20`
- Shared acquisition costs: `EXIT_ACQUISITION_COSTS=0`

The eBay scenario is optional and is only calculated when `EXIT_EBAY_FEE_PCT` is set. Shipping, materials, risk reserve, and fixed costs can be configured separately for each channel; see `.env.example` for the full list.

The calculation is:

```text
expected exit = active ask reference × channel payout/discount
net exit = expected sale - percentage costs - fixed selling costs
max buy = net exit ÷ (1 + target net ROI) - acquisition costs
```

Every scenario and its complete assumptions are stored with each daily signal so historical recommendations remain auditable when configuration changes.

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
- eBay snapshots now keep a thin sample of the lowest active listings for floor quality, seller concentration, and low-end absorption analysis.
- The dashboard and reports label active listing values as asking-price ranges rather than completed-sale market values.
- Cards now carry a tracked `condition` lane. Raw defaults to `near_mint_or_better`; graded rows use `graded`.
- Cards carry an expert-set collector popularity tier (`high`, `standard`, or `niche`); existing and newly seeded cards default to `standard` until reviewed.
- Liquidity is scored from low-listing disappearance, auction participation, seller breadth, listing depth, floor reliability, and seller concentration. Missing observations reduce liquidity confidence instead of counting as zero demand.
- The direct-collector exit starts from `EXIT_COLLECTOR_DISCOUNT_PCT` (5% by default), adjusts for observed liquidity and expert popularity, and produces optimistic/expected/conservative maximum-buy prices. Vendor payout remains a separate exit scenario.
- Snapshot aggregation filters out likely non-card matches by title and suppresses obvious low-price BIN outliers before computing floors and counts, while keeping rejection diagnostics in `raw_payload`.
- Auction lag now uses only near-end auctions ending within 12 hours and ignores immature current bids below a market-relative floor. If no usable auctions remain, auction lag is treated as unavailable rather than bearish.
- Signals use 7-day and 30-day eBay lookbacks, estimate a more executable `market_now`, and degrade gracefully when history is not available yet.
- Only `live` snapshot history is used for trend calculations. Backfilled or fixture data should not be treated as true historical market state.
- Local buy scoring is inferred from sustained price movement, inventory tightening, auctions trailing current market, low-end absorption, sample stability, and query confidence.
- Deferred follow-up: revisit `query confidence reduced` cases for high-end cards like Gengar VMAX and Giratina V by tightening identity matching separately for BIN and auction listings.
- Offline mode maps fixture rows by `ebay_query` first, then `card_name`, and defaults missing cards to zero-volume rows.
- English and Japanese are stored as separate tracked cards so the same character/card can be monitored independently by language.
- Raw and graded markets should be stored as separate watchlist rows using `market_segment`.
