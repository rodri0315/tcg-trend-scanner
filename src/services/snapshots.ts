import { pool } from '../db/pool';
import type { EbaySnapshot, SignalSnapshot } from '../types';

export async function upsertEbaySnapshots(snapshots: EbaySnapshot[]): Promise<void> {
  if (snapshots.length === 0) {
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const snapshot of snapshots) {
      await client.query(
        `
          insert into ebay_daily (
            card_id,
            snapshot_date,
            floor_bin,
            floor_bin_count,
            total_bin_count,
            auction_count,
            median_auction_bid_count,
            median_auction_current_price,
            query_used,
            raw_payload
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          on conflict (card_id, snapshot_date) do update set
            floor_bin = excluded.floor_bin,
            floor_bin_count = excluded.floor_bin_count,
            total_bin_count = excluded.total_bin_count,
            auction_count = excluded.auction_count,
            median_auction_bid_count = excluded.median_auction_bid_count,
            median_auction_current_price = excluded.median_auction_current_price,
            query_used = excluded.query_used,
            raw_payload = excluded.raw_payload
        `,
        [
          snapshot.cardId,
          snapshot.snapshotDate,
          snapshot.floorBin,
          snapshot.floorBinCount,
          snapshot.totalBinCount,
          snapshot.auctionCount,
          snapshot.medianAuctionBidCount,
          snapshot.medianAuctionCurrentPrice,
          snapshot.queryUsed,
          JSON.stringify(snapshot.rawPayload),
        ],
      );
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function upsertSignals(signals: SignalSnapshot[]): Promise<void> {
  if (signals.length === 0) {
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const signal of signals) {
      await client.query(
        `
          insert into signals_daily (
            card_id,
            signal_date,
            ebay_floor_change_7d_pct,
            ebay_floor_change_30d_pct,
            inventory_change_7d_pct,
            inventory_change_30d_pct,
            auction_price_vs_floor_pct,
            auction_activity_change_7d_pct,
            volatility_7d_pct,
            trend_score,
            local_lag_score,
            spike_flag
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          on conflict (card_id, signal_date) do update set
            ebay_floor_change_7d_pct = excluded.ebay_floor_change_7d_pct,
            ebay_floor_change_30d_pct = excluded.ebay_floor_change_30d_pct,
            inventory_change_7d_pct = excluded.inventory_change_7d_pct,
            inventory_change_30d_pct = excluded.inventory_change_30d_pct,
            auction_price_vs_floor_pct = excluded.auction_price_vs_floor_pct,
            auction_activity_change_7d_pct = excluded.auction_activity_change_7d_pct,
            volatility_7d_pct = excluded.volatility_7d_pct,
            trend_score = excluded.trend_score,
            local_lag_score = excluded.local_lag_score,
            spike_flag = excluded.spike_flag
        `,
        [
          signal.cardId,
          signal.signalDate,
          signal.ebayFloorChange7dPct,
          signal.ebayFloorChange30dPct,
          signal.inventoryChange7dPct,
          signal.inventoryChange30dPct,
          signal.auctionPriceVsFloorPct,
          signal.auctionActivityChange7dPct,
          signal.volatility7dPct,
          signal.trendScore,
          signal.localLagScore,
          signal.spikeFlag,
        ],
      );
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
