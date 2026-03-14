# AGENTS.md

## Project
Build an internal-only TCG price trend and arbitrage scanner.

## Market scope
- Pokemon and One Piece cards
- Track English and Japanese separately
- Singles only
- Use eBay US marketplace only
- Ignore sealed product for MVP

## Goal
Detect early trend and arbitrage opportunities for Pokemon cards to support decisions for:
- short flips
- short holds (1-3 months)
- long holds (6+ months)

## Acquisition channels
The tool must support two acquisition paths:
1. Online: eBay and similar marketplaces
2. Local: card shops and stores that lag behind market updates

## Key insight
Our Pokemon market knowledge is the final judgment layer.
The software should surface signals, history, and ranked opportunities.
It should not make blind buy decisions.

## Data sources
### eBay
Use eBay Browse API search for active market microstructure:
- Buy It Now listings
- auctions
- inventory depth
- floor price including shipping

### Optional later sources
- manual reference prices
- approved/licensed pricing partners

## MVP constraints
- Daily scans only
- Aggregate eBay snapshots only, not full per-listing warehousing
- No user auth
- No SaaS product requirements
- No AI prediction layer in MVP

## Required storage
Store daily historical snapshots so the system can compute:
- 7d / 30d changes
- trend slopes
- inventory squeeze
- eBay floor vs recent auction behavior
- volatility
- spike vs sustained movement

## Recommended stack
- Node.js + TypeScript
- Postgres
- simple cron job
- CSV and Markdown output first
- React / Next dashboard later

## Data model
### cards
- id
- name
- set
- card_number
- rarity
- variant
- ebay_query
- tags

### ebay_daily
- card_id
- date
- floor_bin
- floor_bin_count
- total_bin_count
- auction_count
- median_auction_bid_count
- median_auction_current_price
- query_used

### signals_daily
- card_id
- date
- ebay_floor_change_7d_pct
- ebay_floor_change_30d_pct
- inventory_change_7d_pct
- inventory_change_30d_pct
- auction_price_vs_floor_pct
- auction_activity_change_7d_pct
- volatility_7d_pct
- trend_score
- local_lag_score
- spike_flag

## Opportunity logic
### Trend detection
Look for:
- eBay floor rising over 7d and 30d
- inventory depth shrinking
- increased auction activity

### Local arbitrage
Look for:
- eBay floor rising while inventory shrinks
- auctions trailing current BIN floor
- patterns that suggest local stores have not updated prices yet

## eBay query rules
- Use eBay US marketplace only
- Exclude Japanese and other languages in keyword filters
- Exclude proxy, custom, slabless junk matches when relevant
- Start with Pokemon TCG singles category when supported

Example query pattern:
"Gengar VMAX 271 Fusion Strike -japanese -jp -korean -proxy -custom"

Japanese example query pattern:
"One Piece Luffy OP05-119 Japanese -english -proxy -custom"

## Build order
1. Postgres schema + migrations
2. Seed cards import
3. eBay daily fetcher
4. Signal calculation
5. CSV/Markdown report
6. Simple dashboard later

## Codex guidance
- Prefer small, reviewable PR-sized changes
- Keep modules simple and typed
- Add clear README instructions for setup and scripts
- Do not add unnecessary frameworks early
- Do not build the dashboard before the data pipeline works
