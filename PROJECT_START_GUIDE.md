# Pokemon TCG Trend Scanner - Project Start Guide

## Should we start manually or in Codex?
Yes, it is completely okay to build the starter repo ourselves first and then move into Codex.

Recommended approach:
1. Create the starter repo manually
2. Add basic structure and project docs
3. Open the repo in Codex
4. Give Codex focused implementation tasks

This usually produces better results than asking Codex to invent the whole project from scratch.

## MVP scope
- English Pokemon singles only
- TCGplayer US
- eBay US
- Daily snapshots
- Internal-only tool
- CSV/Markdown outputs first

## Suggested starter structure
```text
pokemon-trend-scanner/
  src/
    db/
    services/
    jobs/
    signals/
    utils/
  scripts/
  seed/
  migrations/
  AGENTS.md
  PROJECT_START_GUIDE.md
  README.md
  .env.example
  package.json
  tsconfig.json
```

## Suggested stack
- Node.js + TypeScript
- Postgres
- pg or Prisma/Drizzle later
- cron-based daily job
- React/Next later, not on day one

## Why no React first?
The hard part is reliable pricing and signal history.
Once the data pipeline is stable, a dashboard is easy to add.

## Manual first steps
1. Create a Postgres database
2. Fill in `.env`
3. Seed a small starter card list
4. Add migrations
5. Implement one fetcher at a time

## Good first Codex tasks
- create database migrations
- create seed import script
- build TCGplayer client
- build eBay client
- compute daily signal metrics
- generate a daily CSV and Markdown report

## Suggested first Codex prompt
Scaffold the MVP for the internal Pokemon TCG Trend Scanner described in AGENTS.md. Build the Postgres schema, seed import, daily TCGplayer fetcher, daily eBay fetcher, signal calculation, and a CSV/Markdown report.
