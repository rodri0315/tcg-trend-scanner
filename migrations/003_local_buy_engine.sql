create table if not exists ebay_listing_samples (
  id bigserial primary key,
  card_id bigint not null references cards(id) on delete cascade,
  observed_at timestamptz not null,
  observed_date date not null,
  ebay_item_id text not null,
  title text not null,
  listing_type text not null,
  condition text,
  price numeric(12, 2) not null,
  shipping numeric(12, 2) not null default 0,
  total_price numeric(12, 2) not null,
  seller_key text,
  item_web_url text,
  item_creation_date timestamptz,
  item_end_date timestamptz,
  query_used text not null,
  is_candidate_floor boolean not null default false,
  created_at timestamptz not null default now(),
  unique (card_id, ebay_item_id, observed_at)
);

create index if not exists idx_ebay_listing_samples_card_date
  on ebay_listing_samples (card_id, observed_date desc);

create index if not exists idx_ebay_listing_samples_card_floor
  on ebay_listing_samples (card_id, observed_date desc, is_candidate_floor, total_price asc);

alter table ebay_daily
  add column if not exists market_price_estimate numeric(12, 2),
  add column if not exists market_price_method text,
  add column if not exists floor_quality_score numeric(12, 2) not null default 0,
  add column if not exists sampled_bin_count integer not null default 0,
  add column if not exists sampled_auction_count integer not null default 0,
  add column if not exists seller_concentration_top3_pct numeric(12, 2),
  add column if not exists fresh_low_count_24h integer not null default 0,
  add column if not exists new_bin_count_24h integer not null default 0;

alter table signals_daily
  add column if not exists market_now numeric(12, 2),
  add column if not exists target_buy_80 numeric(12, 2),
  add column if not exists target_buy_85 numeric(12, 2),
  add column if not exists target_buy_90 numeric(12, 2),
  add column if not exists confidence_score numeric(12, 2) not null default 0,
  add column if not exists sustained_move_score numeric(12, 2) not null default 0,
  add column if not exists inventory_squeeze_score numeric(12, 2) not null default 0,
  add column if not exists auction_lag_score numeric(12, 2) not null default 0,
  add column if not exists absorption_score numeric(12, 2) not null default 0,
  add column if not exists stability_score numeric(12, 2) not null default 0,
  add column if not exists query_confidence_score numeric(12, 2) not null default 0,
  add column if not exists rank_score numeric(12, 2) not null default 0,
  add column if not exists reason_codes jsonb not null default '[]'::jsonb;
