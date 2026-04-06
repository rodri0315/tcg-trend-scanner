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
            snapshot_source,
            floor_bin,
            floor_bin_count,
            total_bin_count,
            auction_count,
            median_auction_bid_count,
            median_auction_current_price,
            market_price_estimate,
            market_price_method,
            floor_quality_score,
            sampled_bin_count,
            sampled_auction_count,
            seller_concentration_top3_pct,
            fresh_low_count_24h,
            new_bin_count_24h,
            query_used,
            raw_payload
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          on conflict (card_id, snapshot_date) do update set
            snapshot_source = excluded.snapshot_source,
            floor_bin = excluded.floor_bin,
            floor_bin_count = excluded.floor_bin_count,
            total_bin_count = excluded.total_bin_count,
            auction_count = excluded.auction_count,
            median_auction_bid_count = excluded.median_auction_bid_count,
            median_auction_current_price = excluded.median_auction_current_price,
            market_price_estimate = excluded.market_price_estimate,
            market_price_method = excluded.market_price_method,
            floor_quality_score = excluded.floor_quality_score,
            sampled_bin_count = excluded.sampled_bin_count,
            sampled_auction_count = excluded.sampled_auction_count,
            seller_concentration_top3_pct = excluded.seller_concentration_top3_pct,
            fresh_low_count_24h = excluded.fresh_low_count_24h,
            new_bin_count_24h = excluded.new_bin_count_24h,
            query_used = excluded.query_used,
            raw_payload = excluded.raw_payload
        `,
        [
          snapshot.cardId,
          snapshot.snapshotDate,
          snapshot.snapshotSource,
          snapshot.floorBin,
          snapshot.floorBinCount,
          snapshot.totalBinCount,
          snapshot.auctionCount,
          snapshot.medianAuctionBidCount,
          snapshot.medianAuctionCurrentPrice,
          snapshot.marketPriceEstimate,
          snapshot.marketPriceMethod,
          snapshot.floorQualityScore,
          snapshot.sampledBinCount,
          snapshot.sampledAuctionCount,
          snapshot.sellerConcentrationTop3Pct,
          snapshot.freshLowCount24h,
          snapshot.newBinCount24h,
          snapshot.queryUsed,
          JSON.stringify(snapshot.rawPayload),
        ],
      );

      await client.query(
        `
          delete from ebay_listing_samples
          where card_id = $1
            and observed_date = $2
        `,
        [snapshot.cardId, snapshot.snapshotDate],
      );

      for (const sample of snapshot.listingSamples) {
        await client.query(
          `
            insert into ebay_listing_samples (
              card_id,
              observed_at,
              observed_date,
              ebay_item_id,
              title,
              listing_type,
              condition,
              price,
              shipping,
              total_price,
              seller_key,
              item_web_url,
              item_creation_date,
              item_end_date,
              query_used,
              is_candidate_floor
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            on conflict (card_id, ebay_item_id, observed_at) do update set
              title = excluded.title,
              listing_type = excluded.listing_type,
              condition = excluded.condition,
              price = excluded.price,
              shipping = excluded.shipping,
              total_price = excluded.total_price,
              seller_key = excluded.seller_key,
              item_web_url = excluded.item_web_url,
              item_creation_date = excluded.item_creation_date,
              item_end_date = excluded.item_end_date,
              query_used = excluded.query_used,
              is_candidate_floor = excluded.is_candidate_floor
          `,
          [
            sample.cardId,
            sample.observedAt,
            sample.observedDate,
            sample.ebayItemId,
            sample.title,
            sample.listingType,
            sample.condition,
            sample.price,
            sample.shipping,
            sample.totalPrice,
            sample.sellerKey,
            sample.itemWebUrl,
            sample.itemCreationDate,
            sample.itemEndDate,
            sample.queryUsed,
            sample.isCandidateFloor,
          ],
        );
      }
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
            market_now,
            target_buy_80,
            target_buy_85,
            target_buy_90,
            ebay_floor_change_7d_pct,
            ebay_floor_change_30d_pct,
            inventory_change_7d_pct,
            inventory_change_30d_pct,
            auction_price_vs_floor_pct,
            auction_activity_change_7d_pct,
            volatility_7d_pct,
            trend_score,
            local_lag_score,
            confidence_score,
            sustained_move_score,
            inventory_squeeze_score,
            auction_lag_score,
            absorption_score,
            stability_score,
            query_confidence_score,
            rank_score,
            reason_codes,
            spike_flag
          )
          values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25
          )
          on conflict (card_id, signal_date) do update set
            market_now = excluded.market_now,
            target_buy_80 = excluded.target_buy_80,
            target_buy_85 = excluded.target_buy_85,
            target_buy_90 = excluded.target_buy_90,
            ebay_floor_change_7d_pct = excluded.ebay_floor_change_7d_pct,
            ebay_floor_change_30d_pct = excluded.ebay_floor_change_30d_pct,
            inventory_change_7d_pct = excluded.inventory_change_7d_pct,
            inventory_change_30d_pct = excluded.inventory_change_30d_pct,
            auction_price_vs_floor_pct = excluded.auction_price_vs_floor_pct,
            auction_activity_change_7d_pct = excluded.auction_activity_change_7d_pct,
            volatility_7d_pct = excluded.volatility_7d_pct,
            trend_score = excluded.trend_score,
            local_lag_score = excluded.local_lag_score,
            confidence_score = excluded.confidence_score,
            sustained_move_score = excluded.sustained_move_score,
            inventory_squeeze_score = excluded.inventory_squeeze_score,
            auction_lag_score = excluded.auction_lag_score,
            absorption_score = excluded.absorption_score,
            stability_score = excluded.stability_score,
            query_confidence_score = excluded.query_confidence_score,
            rank_score = excluded.rank_score,
            reason_codes = excluded.reason_codes,
            spike_flag = excluded.spike_flag
        `,
        [
          signal.cardId,
          signal.signalDate,
          signal.marketNow,
          signal.targetBuy80,
          signal.targetBuy85,
          signal.targetBuy90,
          signal.ebayFloorChange7dPct,
          signal.ebayFloorChange30dPct,
          signal.inventoryChange7dPct,
          signal.inventoryChange30dPct,
          signal.auctionPriceVsFloorPct,
          signal.auctionActivityChange7dPct,
          signal.volatility7dPct,
          signal.trendScore,
          signal.localLagScore,
          signal.confidenceScore,
          signal.sustainedMoveScore,
          signal.inventorySqueezeScore,
          signal.auctionLagScore,
          signal.absorptionScore,
          signal.stabilityScore,
          signal.queryConfidenceScore,
          signal.rankScore,
          JSON.stringify(signal.reasonCodes),
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
