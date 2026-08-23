import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DashboardShell } from '../../../components/dashboard-shell';
import { MobileTimelineTable } from '../../../components/mobile-timeline-table';
import { QueryActions } from '../../../components/query-actions';
import { Sparkline } from '../../../components/sparkline';
import { getCardDetail } from '../../../src/dashboard/data';

export const dynamic = 'force-dynamic';

interface CardDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CardDetailPage({ params }: CardDetailPageProps) {
  const resolvedParams = await params;
  const cardId = Number(resolvedParams.id);
  if (!Number.isInteger(cardId)) {
    notFound();
  }

  const card = await getCardDetail(cardId);
  if (!card) {
    notFound();
  }

  const activeAskSeries = card.history.map((point) => point.activeAskReference);
  const trendSeries = card.history.map((point) => point.trendScore);
  const heroListing = card.latestListingDebug?.fixedPriceKept.entries.find((entry) => entry.imageUrl !== null) ?? null;
  const ebaySearchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(card.ebayQuery)}`;
  const headerHelp: Array<{ label: string; help: string }> = [
    { label: 'Date', help: 'Snapshot day for this card. We use these daily points to compare short-term momentum and inventory changes.' },
    { label: 'Ask range', help: 'Low credible cluster of active Buy It Now asking prices, including shipping. These are seller asks, not confirmed sales.' },
    { label: 'Liquidity', help: 'Observed liquidity score from listing absorption, auction participation, seller breadth, listing depth, and floor reliability.' },
    { label: 'Collector max', help: 'Maximum acquisition price that meets the configured net ROI after the liquidity and popularity-adjusted collector negotiation.' },
    { label: 'Listings', help: 'Count of filtered Buy It Now listings that still look like the tracked card. Falling supply can support a bullish move.' },
    { label: 'Auctions', help: 'Count of filtered auction listings for the card. Rising auction volume can signal growing market attention and price discovery.' },
    { label: 'Median auction', help: 'Median current auction price, including shipping, from the filtered auction set. We compare this against the floor to spot lag or confirmation.' },
    { label: 'Trend', help: 'Composite momentum score built from floor movement, inventory tightening, and auction activity. Higher usually means stronger near-term trend pressure.' },
    { label: 'Local lag', help: 'Score estimating whether local shops may be behind the online market. Higher values suggest eBay is firming faster than slower channels may react.' },
    { label: 'Spike', help: 'Flags a sharp move that looks more like a sudden burst than a steady climb. Useful for separating hype pops from sustained trends.' },
  ];

  return (
    <DashboardShell>
      <section className="heroPanel section--narrow">
        <div>
          <p className="eyebrow">
            {card.game} · {card.language} · {card.marketSegment} · {labelizeCondition(card.condition)} · {card.productType} · {card.popularityTier} popularity
          </p>
          <h2>
            {card.name} {card.cardNumber}
          </h2>
          <p className="lede">
            {card.setName} · {card.variant}
            {card.rarity ? ` · ${card.rarity}` : ''}
          </p>
          <div className="pillRow">
            {card.tags.map((tag) => (
              <span key={tag} className="pill">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="heroActions">
          {heroListing?.imageUrl ? (
            <a
              href={heroListing.itemWebUrl ?? '#'}
              className="heroImageLink"
              target="_blank"
              rel="noreferrer"
            >
              <img
                src={heroListing.imageUrl}
                alt={`${card.name} listing preview`}
                className="heroImage"
              />
            </a>
          ) : null}
          <Link href="/cards" className="textLink">
            Back to watchlist
          </Link>
          <p className="queryBlock">{card.ebayQuery}</p>
          <QueryActions query={card.ebayQuery} searchUrl={ebaySearchUrl} />
        </div>
      </section>

      <section className="detailGrid section--narrow">
        <article className="panel panel--purple">
          <div className="sectionHead">
            <div>
              <p className="eyebrow">Active ask history</p>
              <h3>Seller asking-price reference</h3>
            </div>
          </div>
          <Sparkline values={activeAskSeries} />
          <p className="subtle">Derived from active BIN listings. This is not a completed-sale price.</p>
        </article>

        <article className="panel panel--teal">
          <div className="sectionHead">
            <div>
              <p className="eyebrow">Score history</p>
              <h3>Trend score over time</h3>
            </div>
          </div>
          <Sparkline values={trendSeries} stroke="#0f8c74" />
        </article>
      </section>

      <section className="panel panel--amber section--narrow">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Last 30 snapshots</p>
            <h3>Daily timeline</h3>
          </div>
        </div>

        <MobileTimelineTable data={card.history} />

        <div className="tableWrap">
          <table className="dataTable">
            <thead>
              <tr>
                {headerHelp.map((column) => (
                  <th key={column.label}>
                    <span className="tableHeaderLabel">{column.label}</span>
                    <span
                      className="infoHint"
                      tabIndex={0}
                      aria-label={`${column.label}: ${column.help}`}
                      data-tooltip={column.help}
                    >
                      ?
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {card.history.length === 0 ? (
                <tr>
                  <td colSpan={10} className="emptyTableCell">
                    No historical snapshots yet for this card.
                  </td>
                </tr>
              ) : (
                card.history.map((point) => (
                  <tr key={point.snapshotDate}>
                    <td>{point.snapshotDate}</td>
                    <td>{formatCurrencyRange(point.activeAskLow, point.activeAskHigh)}</td>
                    <td>{point.liquidityTier ?? 'n/a'}{point.liquidityScore === null ? '' : ` ${point.liquidityScore.toFixed(0)}`}</td>
                    <td>{point.maxBuyPrice === null ? 'n/a' : `$${point.maxBuyPrice.toFixed(2)}`}</td>
                    <td>{point.totalBinCount}</td>
                    <td>{point.auctionCount}</td>
                    <td>{point.medianAuctionCurrentPrice === null ? 'n/a' : `$${point.medianAuctionCurrentPrice.toFixed(2)}`}</td>
                    <td>{point.trendScore === null ? 'n/a' : point.trendScore.toFixed(2)}</td>
                    <td>{point.localLagScore === null ? 'n/a' : point.localLagScore.toFixed(2)}</td>
                    <td>{point.spikeFlag ? 'Yes' : 'No'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel panel--rose section--narrow">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Filter debug</p>
            <h3>Latest listing review</h3>
          </div>
        </div>

        {card.latestListingDebug === null ? (
          <p className="emptyState">No listing debug payload is available for this card yet.</p>
        ) : (
          <div className="debugPanel">
            <p className="subtle">
              Snapshot {card.latestListingDebug.snapshotDate} using query: <span className="debugQuery">{card.latestListingDebug.queryUsed}</span>
            </p>
            <div className="debugGrid">
              {[
                { data: card.latestListingDebug.fixedPriceKept, color: 'success' },
                { data: card.latestListingDebug.fixedPriceRejected, color: 'warning' },
                { data: card.latestListingDebug.auctionKept, color: 'info' },
                { data: card.latestListingDebug.auctionRejected, color: 'error' },
              ].map(({ data: group, color }) => (
                <article key={group.label} className={`debugCard debugCard--${color}`}>
                  <div className="debugCardHead">
                    <h4>{group.label}</h4>
                    <span className="pill">{group.entries.length}/{group.total}</span>
                  </div>
                  {group.entries.length === 0 ? (
                    <p className="subtle">No listings in this bucket.</p>
                  ) : (
                    <ul className="debugList">
                      {group.entries.map((entry, index) => (
                        <li key={`${group.label}-${index}`}>
                          <strong>{entry.price === null ? 'n/a' : `$${entry.price.toFixed(2)}`}</strong>
                          <span>{entry.title}</span>
                          {group.label.toLowerCase().includes('auction') ? (
                            <span className="debugMeta">
                              {formatDaysLeft(entry.daysLeft)}
                            </span>
                          ) : null}
                          {entry.itemWebUrl ? (
                            <a href={entry.itemWebUrl} target="_blank" rel="noreferrer" className="debugMetaLink">
                              View listing
                            </a>
                          ) : null}
                          {entry.reason ? <em>{entry.reason}</em> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}

function labelizeCondition(value: string): string {
  return value.replace(/_or_better$/, '+').replace(/_/g, ' ');
}

function formatDaysLeft(daysLeft: number | null): string {
  if (daysLeft === null) {
    return 'Days left: n/a';
  }

  if (daysLeft === 0) {
    return 'Ends today';
  }

  if (daysLeft === 1) {
    return '1 day left';
  }

  return `${daysLeft} days left`;
}

function formatCurrencyRange(low: number | null, high: number | null): string {
  if (low === null && high === null) {
    return 'n/a';
  }

  if (low === null || high === null || low === high) {
    return `$${(low ?? high)?.toFixed(2)}`;
  }

  return `$${low.toFixed(2)}–$${high.toFixed(2)}`;
}
