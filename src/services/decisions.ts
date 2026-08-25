import { pool } from '../db/pool';
import type { LocalOfferEvaluation } from '../economics/localOffer';
import type { ExitScenario } from '../economics/netOutcome';

export type DecisionChoice = 'buy' | 'pass' | 'watch';
export type OfferSourceChannel = 'local_shop' | 'vendor_offer' | 'collector' | 'ebay' | 'other';
export type IntendedExitChannel = 'direct_collector' | 'vendor' | 'ebay';

export interface DecisionContext {
  signalDate: string;
  marketReference: number | null;
  exitScenarios: Record<string, ExitScenario>;
}

export interface DecisionJournalEntry {
  id: number;
  decidedAt: string;
  decision: DecisionChoice;
  sourceChannel: OfferSourceChannel;
  intendedExitChannel: IntendedExitChannel;
  offerPrice: number;
  evaluationStatus: LocalOfferEvaluation['status'];
  signalDate: string | null;
  marketReference: number | null;
  maxBuyPrice: number | null;
  marginToMaxBuy: number | null;
  projectedNetProfit: number | null;
  projectedNetRoiPct: number | null;
  notes: string | null;
}

export interface CreateDecisionInput {
  cardId: number;
  decision: DecisionChoice;
  sourceChannel: OfferSourceChannel;
  intendedExitChannel: IntendedExitChannel;
  notes: string | null;
  context: DecisionContext | null;
  scenario: ExitScenario | null;
  evaluation: LocalOfferEvaluation;
}

export async function getLatestDecisionContext(cardId: number): Promise<DecisionContext | null> {
  const result = await pool.query<{
    signal_date: string;
    market_reference: string | null;
    exit_scenarios: Record<string, ExitScenario>;
  }>(
    `
      select
        signal_date::text as signal_date,
        coalesce(active_ask_reference, market_now) as market_reference,
        exit_scenarios
      from public.signals_daily
      where card_id = $1
      order by signal_date desc
      limit 1
    `,
    [cardId],
  );

  const row = result.rows[0];
  return row
    ? {
        signalDate: row.signal_date,
        marketReference: toNullableNumber(row.market_reference),
        exitScenarios: row.exit_scenarios ?? {},
      }
    : null;
}

export async function getDecisionJournal(cardId: number, limit = 20): Promise<DecisionJournalEntry[]> {
  const result = await pool.query<{
    id: number;
    decided_at: Date | string;
    decision: DecisionChoice;
    source_channel: OfferSourceChannel;
    intended_exit_channel: IntendedExitChannel;
    offer_price: string;
    evaluation_status: LocalOfferEvaluation['status'];
    signal_date: string | null;
    market_reference: string | null;
    max_buy_price: string | null;
    margin_to_max_buy: string | null;
    projected_net_profit: string | null;
    projected_net_roi_pct: string | null;
    notes: string | null;
  }>(
    `
      select
        id,
        decided_at,
        decision,
        source_channel,
        intended_exit_channel,
        offer_price,
        evaluation_status,
        signal_date::text as signal_date,
        market_reference,
        max_buy_price,
        margin_to_max_buy,
        projected_net_profit,
        projected_net_roi_pct,
        notes
      from public.decision_journal
      where card_id = $1
      order by decided_at desc
      limit $2
    `,
    [cardId, limit],
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    decidedAt: row.decided_at instanceof Date ? row.decided_at.toISOString() : String(row.decided_at),
    decision: row.decision,
    sourceChannel: row.source_channel,
    intendedExitChannel: row.intended_exit_channel,
    offerPrice: Number(row.offer_price),
    evaluationStatus: row.evaluation_status,
    signalDate: row.signal_date,
    marketReference: toNullableNumber(row.market_reference),
    maxBuyPrice: toNullableNumber(row.max_buy_price),
    marginToMaxBuy: toNullableNumber(row.margin_to_max_buy),
    projectedNetProfit: toNullableNumber(row.projected_net_profit),
    projectedNetRoiPct: toNullableNumber(row.projected_net_roi_pct),
    notes: row.notes,
  }));
}

export async function createDecisionJournalEntry(input: CreateDecisionInput): Promise<number> {
  const result = await pool.query<{ id: number }>(
    `
      insert into public.decision_journal (
        card_id,
        decision,
        source_channel,
        intended_exit_channel,
        offer_price,
        evaluation_status,
        signal_date,
        market_reference,
        expected_sale_price,
        estimated_net_exit,
        max_buy_price,
        margin_to_max_buy,
        projected_net_profit,
        projected_net_roi_pct,
        target_net_roi_pct,
        scenario_snapshot,
        notes
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      returning id
    `,
    [
      input.cardId,
      input.decision,
      input.sourceChannel,
      input.intendedExitChannel,
      input.evaluation.offerPrice,
      input.evaluation.status,
      input.context?.signalDate ?? null,
      input.context?.marketReference ?? null,
      input.evaluation.expectedSalePrice,
      input.evaluation.estimatedNetExit,
      input.evaluation.maxBuyPrice,
      input.evaluation.marginToMaxBuy,
      input.evaluation.projectedNetProfit,
      input.evaluation.projectedNetRoiPct,
      input.evaluation.targetNetRoiPct,
      JSON.stringify(input.scenario ?? {}),
      input.notes,
    ],
  );

  const id = result.rows[0]?.id;
  if (!id) {
    throw new Error('Decision journal insert did not return an id.');
  }

  return Number(id);
}

function toNullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
