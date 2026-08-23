'use client';

import { useEffect, useState } from 'react';

interface TimelineRow {
  snapshotDate: string;
  floorBin: number | null;
  activeAskLow: number | null;
  activeAskHigh: number | null;
  activeAskReference: number | null;
  activeAskSellerCount: number;
  estimatedNetExit: number | null;
  maxBuyPrice: number | null;
  liquidityScore: number | null;
  liquidityTier: string | null;
  collectorDiscountPct: number | null;
  totalBinCount: number;
  auctionCount: number;
  medianAuctionCurrentPrice: number | null;
  trendScore: number | null;
  localLagScore: number | null;
  spikeFlag: boolean | null;
}

interface MobileTimelineTableProps {
  data: TimelineRow[];
}

export function MobileTimelineTable({ data }: MobileTimelineTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleRow = (date: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedRows(newExpanded);
  };

  if (data.length === 0) {
    return <p className="emptyState">No historical snapshots yet for this card.</p>;
  }

  if (!mounted) {
    return (
      <div className="mobileTimelineTable">
        {data.map((row) => (
          <div key={row.snapshotDate} className="timelineRow">
            <div className="timelineRowHeader">
              <div className="timelineRowSummary">
                <span className="timelineDate">{row.snapshotDate}</span>
                <span className="timelineFloor">
                  {formatCurrencyRange(row.activeAskLow, row.activeAskHigh)}
                </span>
                {row.spikeFlag && <span className="pill pill--hot">spike</span>}
              </div>
              <svg
                className="timelineChevron"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 8 10 12 14 8" />
              </svg>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mobileTimelineTable">
      {data.map((row) => {
        const isExpanded = expandedRows.has(row.snapshotDate);
        return (
          <div key={row.snapshotDate} className="timelineRow">
            <button
              className="timelineRowHeader"
              onClick={() => toggleRow(row.snapshotDate)}
              aria-expanded={isExpanded}
            >
              <div className="timelineRowSummary">
                <span className="timelineDate">{row.snapshotDate}</span>
                <span className="timelineFloor">
                  {formatCurrencyRange(row.activeAskLow, row.activeAskHigh)}
                </span>
                {row.spikeFlag && <span className="pill pill--hot">spike</span>}
              </div>
              <svg
                className={`timelineChevron ${isExpanded ? 'timelineChevron--expanded' : ''}`}
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 8 10 12 14 8" />
              </svg>
            </button>

            {isExpanded && (
              <div className="timelineRowDetails">
                <dl className="timelineMetrics">
                  <div className="timelineMetric">
                    <dt>Ask reference</dt>
                    <dd>{formatCurrency(row.activeAskReference)}</dd>
                  </div>
                  <div className="timelineMetric">
                    <dt>Low-range sellers</dt>
                    <dd>{row.activeAskSellerCount}</dd>
                  </div>
                  <div className="timelineMetric">
                    <dt>Liquidity</dt>
                    <dd>{row.liquidityTier ?? 'n/a'}{row.liquidityScore === null ? '' : ` ${row.liquidityScore.toFixed(0)}`}</dd>
                  </div>
                  <div className="timelineMetric">
                    <dt>Collector negotiation</dt>
                    <dd>{row.collectorDiscountPct === null ? 'n/a' : `${row.collectorDiscountPct.toFixed(0)}%`}</dd>
                  </div>
                  <div className="timelineMetric">
                    <dt>Estimated net exit</dt>
                    <dd>{formatCurrency(row.estimatedNetExit)}</dd>
                  </div>
                  <div className="timelineMetric">
                    <dt>Max buy</dt>
                    <dd>{formatCurrency(row.maxBuyPrice)}</dd>
                  </div>
                  <div className="timelineMetric">
                    <dt>Listings</dt>
                    <dd>{row.totalBinCount}</dd>
                  </div>
                  <div className="timelineMetric">
                    <dt>Auctions</dt>
                    <dd>{row.auctionCount}</dd>
                  </div>
                  <div className="timelineMetric">
                    <dt>Median auction</dt>
                    <dd>{row.medianAuctionCurrentPrice === null ? 'n/a' : `$${row.medianAuctionCurrentPrice.toFixed(2)}`}</dd>
                  </div>
                  <div className="timelineMetric">
                    <dt>Trend</dt>
                    <dd>{row.trendScore === null ? 'n/a' : row.trendScore.toFixed(2)}</dd>
                  </div>
                  <div className="timelineMetric">
                    <dt>Local lag</dt>
                    <dd>{row.localLagScore === null ? 'n/a' : row.localLagScore.toFixed(2)}</dd>
                  </div>
                  <div className="timelineMetric">
                    <dt>Spike</dt>
                    <dd>{row.spikeFlag ? 'Yes' : 'No'}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
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
