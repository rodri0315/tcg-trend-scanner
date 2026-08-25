'use client';

import { useMemo, useState } from 'react';

import { evaluateLocalOffer } from '../src/economics/localOffer';
import type { ExitScenario } from '../src/economics/netOutcome';

interface LocalPriceEvaluatorProps {
  action: (formData: FormData) => void | Promise<void>;
  signalDate: string | null;
  marketReference: number | null;
  exitScenarios: Record<string, ExitScenario>;
}

const EXIT_OPTIONS = [
  { value: 'direct_collector', label: 'Direct collector' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'ebay', label: 'eBay' },
];

export function LocalPriceEvaluator({
  action,
  signalDate,
  marketReference,
  exitScenarios,
}: LocalPriceEvaluatorProps) {
  const [offerPrice, setOfferPrice] = useState('');
  const [exitChannel, setExitChannel] = useState(
    exitScenarios.direct_collector ? 'direct_collector' : Object.keys(exitScenarios)[0] ?? 'direct_collector',
  );
  const numericOffer = Number(offerPrice);
  const evaluation = useMemo(
    () => Number.isFinite(numericOffer) && numericOffer > 0
      ? evaluateLocalOffer(numericOffer, exitScenarios[exitChannel])
      : null,
    [exitChannel, exitScenarios, numericOffer],
  );

  return (
    <form action={action} className="offerEvaluator">
      <div className="offerFormGrid">
        <label>
          Offered/local price
          <input
            name="offerPrice"
            type="number"
            min="0.01"
            max="1000000"
            step="0.01"
            inputMode="decimal"
            value={offerPrice}
            onChange={(event) => setOfferPrice(event.target.value)}
            placeholder="75.00"
            required
          />
        </label>
        <label>
          Intended exit
          <select
            name="intendedExitChannel"
            value={exitChannel}
            onChange={(event) => setExitChannel(event.target.value)}
            required
          >
            {EXIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} disabled={!exitScenarios[option.value]}>
                {option.label}{exitScenarios[option.value] ? '' : ' — not configured'}
              </option>
            ))}
          </select>
        </label>
        <label>
          Offer source
          <select name="sourceChannel" defaultValue="local_shop" required>
            <option value="local_shop">Local shop</option>
            <option value="vendor_offer">Vendor offer</option>
            <option value="collector">Collector</option>
            <option value="ebay">eBay</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Your decision
          <select name="decision" defaultValue="watch" required>
            <option value="watch">Watch / negotiate</option>
            <option value="buy">Buy</option>
            <option value="pass">Pass</option>
          </select>
        </label>
      </div>

      <div className={`offerEvaluation${evaluation?.status === 'above_target' ? ' offerEvaluation--warning' : ''}`}>
        <div>
          <span>Market reference</span>
          <strong>{formatCurrency(marketReference)}</strong>
        </div>
        <div>
          <span>Max buy</span>
          <strong>{formatCurrency(evaluation?.maxBuyPrice ?? null)}</strong>
        </div>
        <div>
          <span>Room vs max</span>
          <strong>{formatSignedCurrency(evaluation?.marginToMaxBuy ?? null)}</strong>
        </div>
        <div>
          <span>Projected net ROI</span>
          <strong>{formatPct(evaluation?.projectedNetRoiPct ?? null)}</strong>
        </div>
      </div>

      <p className="subtle">
        {evaluation === null
          ? 'Enter an offered price to compare it with the latest configured exit economics.'
          : evaluation.status === 'within_target'
            ? `This price meets the configured ${evaluation.targetNetRoiPct?.toFixed(0) ?? 'n/a'}% net ROI target for this exit.`
            : evaluation.status === 'above_target'
              ? 'This price is above the configured max buy. Card knowledge, liquidity, and negotiation still determine the final decision.'
              : 'No current economics are configured for this exit, so the journal will record the offer without a threshold.'}
        {signalDate ? ` Evidence date: ${signalDate}.` : ' No signal evidence is available yet.'}
      </p>

      <label className="offerNotes">
        Decision notes
        <textarea
          name="notes"
          rows={3}
          maxLength={5000}
          placeholder="Condition, seller context, liquidity judgment, negotiation, or why you passed."
        />
      </label>

      <div className="formActions">
        <button type="submit">Save journal entry</button>
        <span className="subtle">Saving records your decision; it does not execute a purchase.</span>
      </div>
    </form>
  );
}

function formatCurrency(value: number | null): string {
  return value === null ? 'n/a' : `$${value.toFixed(2)}`;
}

function formatSignedCurrency(value: number | null): string {
  if (value === null) {
    return 'n/a';
  }

  return `${value >= 0 ? '+' : '−'}$${Math.abs(value).toFixed(2)}`;
}

function formatPct(value: number | null): string {
  return value === null ? 'n/a' : `${value.toFixed(1)}%`;
}
