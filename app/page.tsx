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

  const [summary, opportunities] = await Promise.all([
    getDashboardSummary(filters),
    getLatestOpportunities(filters, 12),
  ]);
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
            <h3>Highest ranked cards in the latest run</h3>
          </div>
          <Link href="/cards" className="textLink">
            Open full watchlist
          </Link>
        </div>

        {opportunities.length === 0 ? (
          <p className="emptyState">
            No signals yet for this filter set. Run the daily job and refresh this page once data lands.
          </p>
        ) : (
          <div className="cardRail">
            {opportunities.map((row) => (
              <Link key={row.id} href={`/cards/${row.id}`} className="opportunityCard">
                <div className="pillRow">
                  <span className="pill">{row.game}</span>
                  <span className="pill">{row.language}</span>
                  <span className="pill">{row.marketSegment}</span>
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
                    <dt>Trend</dt>
                    <dd>{row.trendScore.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>Local lag</dt>
                    <dd>{row.localLagScore.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>eBay floor</dt>
                    <dd>{formatCurrency(row.ebayFloor)}</dd>
                  </div>
                  <div>
                    <dt>Listings</dt>
                    <dd>{row.totalBinCount}</dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}

function getSingleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatCurrency(value: number | null): string {
  return value === null ? 'n/a' : `$${value.toFixed(2)}`;
}
