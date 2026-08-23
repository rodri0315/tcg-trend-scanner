create table if not exists cards (
  id bigserial primary key,
  game text not null,
  language text not null,
  product_type text not null default 'single',
  market_segment text not null default 'raw',
  popularity_tier text not null default 'standard' check (popularity_tier in ('high', 'standard', 'niche')),
  name text not null,
  set_name text not null,
  card_number text not null,
  rarity text,
  variant text not null default '',
  ebay_query text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game, language, product_type, market_segment, name, set_name, card_number, variant)
);

create table if not exists ebay_daily (
  id bigserial primary key,
  card_id bigint not null references cards(id) on delete cascade,
  snapshot_date date not null,
  floor_bin numeric(12, 2),
  floor_bin_count integer not null default 0,
  total_bin_count integer not null default 0,
  auction_count integer not null default 0,
  median_auction_bid_count numeric(12, 2),
  median_auction_current_price numeric(12, 2),
  query_used text not null,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (card_id, snapshot_date)
);

create table if not exists signals_daily (
  id bigserial primary key,
  card_id bigint not null references cards(id) on delete cascade,
  signal_date date not null,
  ebay_floor_change_7d_pct numeric(12, 2),
  ebay_floor_change_30d_pct numeric(12, 2),
  inventory_change_7d_pct numeric(12, 2),
  inventory_change_30d_pct numeric(12, 2),
  auction_price_vs_floor_pct numeric(12, 2),
  auction_activity_change_7d_pct numeric(12, 2),
  volatility_7d_pct numeric(12, 2),
  trend_score numeric(12, 2) not null default 0,
  local_lag_score numeric(12, 2) not null default 0,
  spike_flag boolean not null default false,
  created_at timestamptz not null default now(),
  unique (card_id, signal_date)
);

create index if not exists idx_ebay_daily_card_date
  on ebay_daily (card_id, snapshot_date desc);

create index if not exists idx_signals_daily_card_date
  on signals_daily (card_id, signal_date desc);
