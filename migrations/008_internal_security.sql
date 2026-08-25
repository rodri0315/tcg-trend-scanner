alter table public.cards enable row level security;
alter table public.ebay_daily enable row level security;
alter table public.ebay_listing_samples enable row level security;
alter table public.signals_daily enable row level security;

revoke all privileges on table
  public.cards,
  public.ebay_daily,
  public.ebay_listing_samples,
  public.signals_daily
from anon, authenticated;

revoke all privileges on sequence
  public.cards_id_seq,
  public.ebay_daily_id_seq,
  public.ebay_listing_samples_id_seq,
  public.signals_daily_id_seq
from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated;
