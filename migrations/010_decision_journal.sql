create table if not exists public.decision_journal (
  id bigserial primary key,
  card_id bigint not null references public.cards(id) on delete cascade,
  decided_at timestamptz not null default now(),
  decision text not null check (decision in ('buy', 'pass', 'watch')),
  source_channel text not null check (source_channel in ('local_shop', 'vendor_offer', 'collector', 'ebay', 'other')),
  intended_exit_channel text not null check (intended_exit_channel in ('direct_collector', 'vendor', 'ebay')),
  offer_price numeric(12, 2) not null check (offer_price > 0),
  evaluation_status text not null check (evaluation_status in ('within_target', 'above_target', 'unavailable')),
  signal_date date,
  market_reference numeric(12, 2),
  expected_sale_price numeric(12, 2),
  estimated_net_exit numeric(12, 2),
  max_buy_price numeric(12, 2),
  margin_to_max_buy numeric(12, 2),
  projected_net_profit numeric(12, 2),
  projected_net_roi_pct numeric(10, 2),
  target_net_roi_pct numeric(8, 2),
  scenario_snapshot jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  check (notes is null or char_length(notes) <= 5000)
);

create index if not exists idx_decision_journal_card_decided
  on public.decision_journal (card_id, decided_at desc);

create index if not exists idx_decision_journal_decision_date
  on public.decision_journal (decision, decided_at desc);

alter table public.decision_journal enable row level security;

revoke all privileges on table public.decision_journal from anon, authenticated;
revoke all privileges on sequence public.decision_journal_id_seq from anon, authenticated;
