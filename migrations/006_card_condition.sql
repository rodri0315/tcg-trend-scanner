alter table cards
  add column if not exists condition text not null default 'near_mint_or_better';

update cards
set condition = case
  when market_segment = 'psa_10' then 'graded'
  else 'near_mint_or_better'
end
where condition is null
   or condition = ''
   or market_segment = 'psa_10';

alter table cards
  drop constraint if exists cards_game_language_product_type_market_segment_name_set_na_key;

alter table cards
  add constraint cards_game_language_product_type_market_segment_condition_name__key
  unique (game, language, product_type, market_segment, condition, name, set_name, card_number, variant);
