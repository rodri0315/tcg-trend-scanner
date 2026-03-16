import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DashboardShell } from '../../../components/dashboard-shell';
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

  const floorSeries = card.history.map((point) => point.floorBin);
  const trendSeries = card.history.map((point) => point.trendScore);

  return (
    <DashboardShell>
      <section className="heroPanel">
        <div>
          <p className="eyebrow">
            {card.game} · {card.language} · {card.marketSegment} · {card.productType}
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
          <Link href="/cards" className="textLink">
            Back to watchlist
          </Link>
          <p className="queryBlock">{card.ebayQuery}</p>
        </div>
      </section>

      <section className="detailGrid">
        <article className="panel">
          <div className="sectionHead">
            <div>
              <p className="eyebrow">Floor history</p>
              <h3>Recent eBay floor movement</h3>
            </div>
          </div>
          <Sparkline values={floorSeries} />
        </article>

        <article className="panel">
          <div className="sectionHead">
            <div>
              <p className="eyebrow">Score history</p>
              <h3>Trend score over time</h3>
            </div>
          </div>
          <Sparkline values={trendSeries} stroke="#0f8c74" />
        </article>
      </section>

      <section className="panel">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Last 30 snapshots</p>
            <h3>Daily timeline</h3>
          </div>
        </div>

        <div className="tableWrap">
          <table className="dataTable">
            <thead>
              <tr>
                <th>Date</th>
                <th>Floor</th>
                <th>Listings</th>
                <th>Auctions</th>
                <th>Median auction</th>
                <th>Trend</th>
                <th>Local lag</th>
                <th>Spike</th>
              </tr>
            </thead>
            <tbody>
              {card.history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="emptyTableCell">
                    No historical snapshots yet for this card.
                  </td>
                </tr>
              ) : (
                card.history.map((point) => (
                  <tr key={point.snapshotDate}>
                    <td>{point.snapshotDate}</td>
                    <td>{point.floorBin === null ? 'n/a' : `$${point.floorBin.toFixed(2)}`}</td>
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
    </DashboardShell>
  );
}
