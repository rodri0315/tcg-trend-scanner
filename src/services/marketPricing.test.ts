import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveMarketPriceMetrics, type PreparedListingSample } from './marketPricing';

test('describes the credible low ask cluster as a range', () => {
  const listings = [100, 102, 105, 130].map<PreparedListingSample>((totalPrice, index) => ({
    ebayItemId: String(index),
    title: `Listing ${index}`,
    listingType: 'BIN',
    condition: null,
    price: totalPrice,
    shipping: 0,
    totalPrice,
    sellerKey: index < 2 ? 'seller-a' : `seller-${index}`,
    itemWebUrl: null,
    itemCreationDate: null,
    itemEndDate: null,
  }));

  const result = deriveMarketPriceMetrics(listings, '2026-08-20');

  assert.equal(result.activeAskLow, 100);
  assert.equal(result.activeAskHigh, 105);
  assert.equal(result.activeAskReference, 102);
  assert.equal(result.activeAskSellerCount, 2);
});
