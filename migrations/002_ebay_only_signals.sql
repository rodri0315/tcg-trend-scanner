alter table signals_daily
  add column if not exists ebay_floor_change_30d_pct numeric(12, 2),
  add column if not exists inventory_change_30d_pct numeric(12, 2),
  add column if not exists auction_price_vs_floor_pct numeric(12, 2),
  add column if not exists auction_activity_change_7d_pct numeric(12, 2),
  add column if not exists volatility_7d_pct numeric(12, 2),
  add column if not exists local_lag_score numeric(12, 2) not null default 0;

alter table signals_daily
  drop column if exists spread_pct,
  drop column if exists tcg_market_change_7d_pct,
  drop column if exists local_arbitrage_score;
