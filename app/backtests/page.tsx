import { DashboardShell } from '../../components/dashboard-shell';
import { FilterBar } from '../../components/filter-bar';
import { MetricCard } from '../../components/metric-card';
import { getBacktestReport } from '../../src/services/backtests';

export const dynamic = 'force-dynamic';

interface BacktestsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BacktestsPage({ searchParams }: BacktestsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedGame = getSingleValue(resolvedSearchParams.game);
  const selectedLanguage = getSingleValue(resolvedSearchParams.language);
  const selectedMarketSegment = getSingleValue(resolvedSearchParams.marketSegment);
  const report = await getBacktestReport({
    game: selectedGame,
    language: selectedLanguage,
    marketSegment: selectedMarketSegment,
  });

  return (
    <DashboardShell>
      <section className="heroPanel">
        <div>
          <p className="eyebrow">Historical validation</p>
          <h2>Measure whether higher scores actually preceded stronger markets.</h2>
          <p className="lede">
            Backtests use trusted live asking-price references only. They are calibration evidence—not completed-sale
            returns, guarantees, or automatic changes to the scoring model.
          </p>
        </div>
        <FilterBar
          games={report.filters.games}
          languages={report.filters.languages}
          marketSegments={report.filters.marketSegments}
          selectedGame={selectedGame}
          selectedLanguage={selectedLanguage}
          selectedMarketSegment={selectedMarketSegment}
        />
      </section>

      <section className="metricGrid">
        <MetricCard label="Trusted signal starts" value={String(report.observations)} help="Signals with a same-day live snapshot, a usable active ask, and at least three matched BIN listings." />
        <MetricCard label="Latest live evidence" value={report.latestLiveDate ?? 'No live data'} help="Last live snapshot available for closing backtest windows." tone="accent" />
        {report.summaries.map((summary) => (
          <MetricCard
            key={summary.horizonDays}
            label={`${summary.horizonDays}d evaluated`}
            value={`${summary.evaluatedSignals}/${summary.eligibleSignals}`}
            help="Evaluated observations divided by observations whose tolerance window has closed or already produced a valid match."
            tone={summary.coveragePct >= 70 ? 'accent' : 'warning'}
          />
        ))}
      </section>

      <section className="panel panel--amber">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Methodology guardrails</p>
            <h3>Sparse dates stay missing—not losing</h3>
          </div>
        </div>
        <p>
          The 7-day horizon matches days 5–10, 30-day matches days 23–37, and 90-day matches days 76–104.
          Backfills, thin markets, and future windows that have not elapsed are excluded. “Positive” means the later
          active ask was above the starting ask; it does not mean a card sold at that price.
        </p>
      </section>

      {report.summaries.map((summary) => (
        <section key={summary.horizonDays} className="panel">
          <div className="sectionHead">
            <div>
              <p className="eyebrow">{summary.horizonDays}-day forward ask</p>
              <h3>{labelizeMaturity(summary.maturity)}</h3>
            </div>
            <span className={`pill${summary.maturity === 'usable' ? '' : ' pill--hot'}`}>{summary.maturity}</span>
          </div>

          <dl className="queryHealthMetrics">
            <div>
              <dt>Average return</dt>
              <dd>{formatPct(summary.averageReturnPct)}</dd>
            </div>
            <div>
              <dt>Median return</dt>
              <dd>{formatPct(summary.medianReturnPct)}</dd>
            </div>
            <div>
              <dt>Positive rate</dt>
              <dd>{formatPct(summary.positiveRatePct)}</dd>
            </div>
            <div>
              <dt>10%+ gain rate</dt>
              <dd>{formatPct(summary.tenPctGainRatePct)}</dd>
            </div>
            <div>
              <dt>Outcome coverage</dt>
              <dd>{summary.coveragePct.toFixed(1)}%</dd>
            </div>
            <div>
              <dt>Missing / pending</dt>
              <dd>{summary.missingOutcomes} / {summary.pendingSignals}</dd>
            </div>
          </dl>

          <p className="subtle">{getMaturityExplanation(summary.maturity, summary.evaluatedSignals, summary.coveragePct)}</p>

          <div className="calibrationTableWrap">
            <table className="dataTable calibrationTable">
              <thead>
                <tr>
                  <th>Rank bucket</th>
                  <th>Evaluated</th>
                  <th>Average return</th>
                  <th>Positive rate</th>
                  <th>10%+ gain rate</th>
                </tr>
              </thead>
              <tbody>
                {summary.buckets.map((bucket) => (
                  <tr key={bucket.label}>
                    <td>{bucket.label}</td>
                    <td>{bucket.evaluatedSignals}</td>
                    <td>{formatPct(bucket.averageReturnPct)}</td>
                    <td>{formatPct(bucket.positiveRatePct)}</td>
                    <td>{formatPct(bucket.tenPctGainRatePct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </DashboardShell>
  );
}

function labelizeMaturity(value: 'insufficient' | 'early' | 'usable'): string {
  if (value === 'usable') {
    return 'Enough observations for directional calibration';
  }

  if (value === 'early') {
    return 'Early evidence—interpret cautiously';
  }

  return 'Insufficient observations for calibration';
}

function getMaturityExplanation(
  value: 'insufficient' | 'early' | 'usable',
  count: number,
  coveragePct: number,
): string {
  if (value === 'usable') {
    return `${count} evaluated observations at ${coveragePct.toFixed(1)}% outcome coverage. Use the bucket ordering as directional evidence, while continuing to monitor regime changes.`;
  }

  const target = value === 'early' ? 100 : 30;
  return `${count} evaluated observations at ${coveragePct.toFixed(1)}% outcome coverage. The next level requires at least ${target} observations and stronger coverage; scoring weights remain unchanged.`;
}

function formatPct(value: number | null): string {
  return value === null ? 'n/a' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function getSingleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
