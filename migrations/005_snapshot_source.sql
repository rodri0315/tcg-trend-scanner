alter table ebay_daily
  add column if not exists snapshot_source text not null default 'live';

create index if not exists idx_ebay_daily_card_source_date
  on ebay_daily (card_id, snapshot_source, snapshot_date desc);
