create table if not exists public.scan_runs (
  id bigserial primary key,
  run_date date not null,
  trigger_source text not null check (trigger_source in ('cli', 'cron')),
  status text not null check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  tracked_cards integer not null default 0,
  snapshots_stored integer not null default 0,
  signals_stored integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_scan_runs_date_started
  on public.scan_runs (run_date desc, started_at desc);

alter table public.scan_runs enable row level security;

revoke all privileges on table public.scan_runs from anon, authenticated;
revoke all privileges on sequence public.scan_runs_id_seq from anon, authenticated;
