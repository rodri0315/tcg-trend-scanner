alter table cards
  add column if not exists market_segment text not null default 'raw',
  add column if not exists popularity_tier text not null default 'standard';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cards_popularity_tier_check'
  ) then
    alter table cards
      add constraint cards_popularity_tier_check
      check (popularity_tier in ('high', 'standard', 'niche'));
  end if;
end $$;

alter table ebay_daily
  add column if not exists active_ask_low numeric(12, 2),
  add column if not exists active_ask_high numeric(12, 2),
  add column if not exists active_ask_reference numeric(12, 2),
  add column if not exists active_ask_seller_count integer not null default 0;

update ebay_daily
set
  active_ask_low = coalesce(active_ask_low, floor_bin),
  active_ask_reference = coalesce(active_ask_reference, market_price_estimate, floor_bin)
where active_ask_low is null
   or active_ask_reference is null;

alter table signals_daily
  add column if not exists active_ask_reference numeric(12, 2),
  add column if not exists expected_sale_price numeric(12, 2),
  add column if not exists estimated_net_exit numeric(12, 2),
  add column if not exists max_buy_price numeric(12, 2),
  add column if not exists target_net_roi_pct numeric(8, 2),
  add column if not exists primary_exit_channel text not null default 'direct_collector',
  add column if not exists exit_scenarios jsonb not null default '{}'::jsonb,
  add column if not exists liquidity_score numeric(8, 2) not null default 0,
  add column if not exists liquidity_confidence_score numeric(8, 2) not null default 0,
  add column if not exists liquidity_tier text not null default 'low',
  add column if not exists collector_discount_pct numeric(8, 2) not null default 5;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'signals_daily_liquidity_tier_check'
  ) then
    alter table signals_daily
      add constraint signals_daily_liquidity_tier_check
      check (liquidity_tier in ('high', 'medium', 'low'));
  end if;
end $$;

update signals_daily
set active_ask_reference = coalesce(active_ask_reference, market_now)
where active_ask_reference is null;
