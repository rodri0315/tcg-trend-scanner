create index if not exists idx_ebay_daily_live_trusted_card_date
  on public.ebay_daily (card_id, snapshot_date)
  include (active_ask_reference)
  where snapshot_source = 'live'
    and active_ask_reference is not null
    and sampled_bin_count >= 3;

create index if not exists idx_ebay_daily_source_date_card
  on public.ebay_daily (snapshot_source, snapshot_date desc, card_id)
  include (active_ask_reference, sampled_bin_count);

create index if not exists idx_signals_daily_date_card
  on public.signals_daily (signal_date desc, card_id)
  include (rank_score, confidence_score);
