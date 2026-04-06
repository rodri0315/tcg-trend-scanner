alter table ebay_listing_samples
  drop constraint if exists ebay_listing_samples_ebay_item_id_observed_at_key;

alter table ebay_listing_samples
  add constraint ebay_listing_samples_card_item_observed_at_key
  unique (card_id, ebay_item_id, observed_at);
