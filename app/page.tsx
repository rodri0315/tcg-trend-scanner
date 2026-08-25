import Link from 'next/link';

import { DashboardShell } from '../components/dashboard-shell';
import { FilterBar } from '../components/filter-bar';
import { MetricCard } from '../components/metric-card';
import { getDashboardSummary, getLatestOpportunities } from '../src/dashboard/data';

export const dynamic = 'force-dynamic';

interface HomePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedGame = getSingleValue(resolvedSearchParams.game);
  const selectedLanguage = getSingleValue(resolvedSearchParams.language);
  const selectedMarketSegment = getSingleValue(resolvedSearchParams.marketSegment);
  const filters = {
    game: selectedGame,
    language: selectedLanguage,
    marketSegment: selectedMarketSegment,
  };

  const [summary, latestRows] = await Promise.all([
    getDashboardSummary(filters),
    getLatestOpportunities(filters, 50),
  ]);
  const opportunities = latestRows.filter((row) => row.isActionable).slice(0, 12);
  const reviewQueue = latestRows.filter((row) => !row.isActionable);
  const summaryHelp = {
    latestSignalDate: 'Most recent day the signal pipeline completed for this filter set. If this is stale, the rankings may be stale too.',
    trackedCards: 'How many cards are currently on the watchlist for the selected filters. This is the size of the review universe.',
    cardsWithSignals: 'How many tracked cards have a signal row in the latest run. This shows how much of the watchlist is active in the current snapshot.',
    spikeFlags: 'Count of cards flagged as sudden moves rather than steadier climbs. Useful for spotting hype bursts that may need extra caution.',
    averageTrendScore: 'Average momentum score across the latest filtered run. Higher means the watchlist is broadly showing stronger floor, inventory, and auction pressure.',
    averageLocalLagScore: 'Average estimate of how much slower local channels may be versus eBay. Higher means more names may deserve local arbitrage review.',
  };

  return (
    <DashboardShell>
      <section className="heroPanel">
        <div>
          <p className="eyebrow">Read-only internal dashboard</p>
          <h2>Find the names that deserve a closer look before the market moves further.</h2>
          <p className="lede">
            The dashboard ranks tracked cards using daily eBay floors, inventory depth, and auction pressure.
            Human judgment still decides what matters. The UI just makes that review loop much faster.
          </p>
        </div>
        <FilterBar
          games={summary.filters.games}
          languages={summary.filters.languages}
          marketSegments={summary.filters.marketSegments}
          selectedGame={selectedGame}
          selectedLanguage={selectedLanguage}
          selectedMarketSegment={selectedMarketSegment}
        />
      </section>

      <section className="metricGrid">
        <MetricCard
          label="Latest signal date"
          value={summary.latestSignalDate ?? 'No runs yet'}
          help={summaryHelp.latestSignalDate}
          tone="accent"
        />
        <MetricCard label="Tracked cards" value={String(summary.trackedCards)} help={summaryHelp.trackedCards} />
        <MetricCard
          label="Cards with signals"
          value={String(summary.cardsWithSignals)}
          help={summaryHelp.cardsWithSignals}
        />
        <MetricCard label="Spike flags" value={String(summary.spikeFlags)} help={summaryHelp.spikeFlags} tone="warning" />
        <MetricCard
          label="Average trend score"
          value={summary.averageTrendScore === null ? 'n/a' : summary.averageTrendScore.toFixed(2)}
          help={summaryHelp.averageTrendScore}
        />
        <MetricCard
          label="Average local lag score"
          value={summary.averageLocalLagScore === null ? 'n/a' : summary.averageLocalLagScore.toFixed(2)}
          help={summaryHelp.averageLocalLagScore}
        />
      </section>

      <section className="panel">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Top opportunities</p>
            <h3>Highest ranked actionable cards in the latest run</h3>
          </div>
          <Link href="/cards" className="textLink">
            Open full watchlist
          </Link>
        </div>

        {opportunities.length === 0 ? (
          <p className="emptyState">
            No cards currently meet the confidence, listing-depth, ask-range, and exit-economics gates.
          </p>
        ) : (
          <div className="cardRail">
            {opportunities.map((row) => (
              <Link key={row.id} href={`/cards/${row.id}`} className="opportunityCard">
                <div className="pillRow">
                  <span className="pill">{row.game}</span>
                  <span className="pill">{row.language}</span>
                  <span className="pill">{row.marketSegment}</span>
                  <span className="pill">{row.popularityTier} popularity</span>
                  {row.spikeFlag ? <span className="pill pill--hot">spike</span> : null}
                </div>
                <h4>
                  {row.name} <span>{row.cardNumber}</span>
                </h4>
                <p className="subtle">
                  {row.setName} · {row.variant}
                </p>
                <dl className="scoreGrid">
                  <div>
                    <dt>Rank</dt>
                    <dd>{row.rankScore.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>Confidence</dt>
                    <dd>{row.confidenceScore.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>Trend</dt>
                    <dd>{row.trendScore.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>Local lag</dt>
                    <dd>{row.localLagScore.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>Active ask range</dt>
                    <dd>{formatCurrencyRange(row.activeAskLow, row.activeAskHigh)}</dd>
                  </div>
                  <div>
                    <dt>Collector max</dt>
                    <dd>{formatCurrencyRange(row.collectorMaxBuyLow, row.collectorMaxBuyHigh)}</dd>
                  </div>
                </dl>
                <p className="subtle">
                  {row.liquidityTier} liquidity {row.liquidityScore.toFixed(0)}/100 · {row.collectorDiscountPct.toFixed(0)}% expected collector negotiation · vendor max {formatCurrency(row.vendorMaxBuyPrice)} · asking prices, not confirmed sales
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {reviewQueue.length > 0 ? (
        <section className="panel">
          <div className="sectionHead">
            <div>
              <p className="eyebrow">Needs review</p>
              <h3>Signals withheld from the actionable ranking</h3>
            </div>
          </div>
          <div className="cardRail">
            {reviewQueue.map((row) => (
              <Link key={row.id} href={`/cards/${row.id}`} className="opportunityCard">
                <div className="pillRow">
                  <span className="pill pill--hot">review</span>
                  <span className="pill">confidence {row.confidenceScore.toFixed(0)}</span>
                  <span className="pill">{row.sampledBinCount} BIN samples</span>
                </div>
                <h4>
                  {row.name} <span>{row.cardNumber}</span>
                </h4>
                <p className="subtle">{row.setName} · {row.language} · {row.marketSegment}</p>
                <p>{row.reviewReasons.join(' · ')}</p>
                <p className="subtle">
                  Ask {formatCurrencyRange(row.activeAskLow, row.activeAskHigh)} · rank {row.rankScore.toFixed(2)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </DashboardShell>
  );
}

function getSingleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatCurrency(value: number | null): string {
  return value === null ? 'n/a' : `$${value.toFixed(2)}`;
}

function formatCurrencyRange(low: number | null, high: number | null): string {
  if (low === null && high === null) {
    return 'n/a';
  }

  if (low === null || high === null || low === high) {
    return formatCurrency(low ?? high);
  }

  return `${formatCurrency(low)}–${formatCurrency(high)}`;
}
