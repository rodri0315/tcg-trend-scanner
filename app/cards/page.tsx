import Link from 'next/link';

import { DashboardShell } from '../../components/dashboard-shell';
import { FilterBar } from '../../components/filter-bar';
import { getDashboardSummary, getWatchlistCards } from '../../src/dashboard/data';

export const dynamic = 'force-dynamic';

interface CardsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CardsPage({ searchParams }: CardsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedGame = getSingleValue(resolvedSearchParams.game);
  const selectedLanguage = getSingleValue(resolvedSearchParams.language);
  const selectedMarketSegment = getSingleValue(resolvedSearchParams.marketSegment);
  const filters = {
    game: selectedGame,
    language: selectedLanguage,
    marketSegment: selectedMarketSegment,
  };

  const [summary, cards] = await Promise.all([
    getDashboardSummary(filters),
    getWatchlistCards(filters),
  ]);

  return (
    <DashboardShell>
      <section className="heroPanel">
        <div>
          <p className="eyebrow">Tracked watchlist</p>
          <h2>Review the exact card universe feeding the scanner.</h2>
          <p className="lede">
            This page is where your Pokemon and One Piece expert can sanity-check coverage, spot bad query
            choices, and decide what should be added next.
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

      <section className="panel">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Watchlist table</p>
            <h3>{cards.length} tracked cards</h3>
          </div>
          <Link href="/cards/new" className="textLink">
            Add new card
          </Link>
        </div>

        <div className="tableWrap">
          <table className="dataTable">
            <thead>
              <tr>
                <th>Card</th>
                <th>Game</th>
                <th>Language</th>
                <th>Market</th>
                <th>Liquidity</th>
                <th>Active ask range</th>
                <th>Trend</th>
                <th>Local lag</th>
                <th>Listings</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => (
                <tr key={card.id}>
                  <td>
                    <Link href={`/cards/${card.id}`} className="tableLink">
                      {card.name} {card.cardNumber}
                    </Link>
                    <div className="subtle">
                      {card.setName} · {card.variant} · {labelizeCondition(card.condition)}
                      {' · '}{card.popularityTier} popularity
                    </div>
                  </td>
                  <td>{card.game}</td>
                  <td>{card.language}</td>
                  <td>{card.marketSegment}</td>
                  <td>{card.liquidityTier ?? 'n/a'}{card.liquidityScore === null ? '' : ` ${card.liquidityScore.toFixed(0)}`}</td>
                  <td>{formatCurrencyRange(card.activeAskLow, card.activeAskHigh)}</td>
                  <td>{card.trendScore === null ? 'n/a' : card.trendScore.toFixed(2)}</td>
                  <td>{card.localLagScore === null ? 'n/a' : card.localLagScore.toFixed(2)}</td>
                  <td>{card.totalBinCount ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}

function getSingleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function labelizeCondition(value: string): string {
  return value.replace(/_or_better$/, '+').replace(/_/g, ' ');
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
