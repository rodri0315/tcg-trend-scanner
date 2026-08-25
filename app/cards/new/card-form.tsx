'use client';

import { useEffect, useState } from 'react';

import { createCardAction } from './actions';

interface CardFormValues {
  game: string;
  language: string;
  productType: string;
  marketSegment: string;
  condition: string;
  popularityTier: string;
  name: string;
  setName: string;
  cardNumber: string;
  rarity: string | null;
  variant: string;
  ebayQuery: string;
  tags: string[];
}

interface CardFormProps {
  action?: (formData: FormData) => void | Promise<void>;
  initialValues?: CardFormValues;
  submitLabel?: string;
  helperText?: string;
}

const GAMES = ['pokemon', 'one_piece'];
const LANGUAGES = ['english', 'japanese'];
const PRODUCT_TYPES = ['single'];
const MARKET_SEGMENTS = ['raw', 'psa_10'];
const POPULARITY_OPTIONS = [
  { value: 'high', label: 'High — broad collector demand' },
  { value: 'standard', label: 'Standard — normal demand' },
  { value: 'niche', label: 'Niche — narrower buyer pool' },
];
const CONDITION_OPTIONS = [
  { value: 'near_mint_or_better', label: 'Near Mint or better' },
  { value: 'light_played_or_better', label: 'Light Played or better' },
  { value: 'moderately_played_or_better', label: 'Moderately Played or better' },
  { value: 'heavily_played_or_better', label: 'Heavily Played or better' },
  { value: 'damaged_or_better', label: 'Any playable condition' },
  { value: 'graded', label: 'Graded only' },
];
const VARIANT_PRESETS: Record<
  string,
  Array<{ label: string; variant: string; rarity?: string; queryTerms?: string[]; tags?: string[] }>
> = {
  pokemon: [
    { label: 'Alt Art', variant: 'Alt Art', queryTerms: ['Alternate Art'], tags: ['alt-art', 'chase', 'modern'] },
    { label: 'Illustration Rare', variant: 'Illustration Rare', queryTerms: ['Illustration Rare'], tags: ['illustration-rare', 'modern'] },
    {
      label: 'Special Illustration Rare',
      variant: 'Special Illustration Rare',
      queryTerms: ['Special Illustration Rare'],
      tags: ['special-illustration-rare', 'chase', 'modern'],
    },
    { label: 'Master Ball', variant: 'Master Ball', queryTerms: ['Master Ball'], tags: ['master-ball', 'japanese', 'modern'] },
  ],
  one_piece: [
    { label: 'Leader', variant: 'Leader', rarity: 'Leader', queryTerms: ['Leader'], tags: ['leader', 'playable'] },
    { label: 'Manga', variant: 'Manga', queryTerms: ['Manga'], tags: ['manga', 'chase', 'modern'] },
    { label: 'Signature', variant: 'Signature', queryTerms: ['Signature'], tags: ['signature', 'chase', 'modern'] },
    { label: 'Parallel', variant: 'Parallel', queryTerms: ['Parallel'], tags: ['parallel', 'modern'] },
  ],
};

export function CardForm({
  action = createCardAction,
  initialValues,
  submitLabel = 'Save card',
  helperText = 'After saving, the next scheduled scan will fetch the first market snapshot for this card.',
}: CardFormProps) {
  const [game, setGame] = useState(initialValues?.game ?? 'pokemon');
  const [language, setLanguage] = useState(initialValues?.language ?? 'english');
  const [productType, setProductType] = useState(initialValues?.productType ?? 'single');
  const [marketSegment, setMarketSegment] = useState(initialValues?.marketSegment ?? 'raw');
  const [condition, setCondition] = useState(initialValues?.condition ?? 'near_mint_or_better');
  const [name, setName] = useState(initialValues?.name ?? '');
  const [cardSetName, setCardSetName] = useState(initialValues?.setName ?? '');
  const [cardNumber, setCardNumber] = useState(initialValues?.cardNumber ?? '');
  const [rarity, setRarity] = useState(initialValues?.rarity ?? '');
  const [variant, setVariant] = useState(initialValues?.variant ?? '');
  const [tags, setTags] = useState(initialValues?.tags.join(', ') ?? '');
  const [ebayQuery, setEbayQuery] = useState(initialValues?.ebayQuery ?? '');
  const [queryEdited, setQueryEdited] = useState(initialValues !== undefined);
  const [tagsEdited, setTagsEdited] = useState(initialValues !== undefined);
  const isEditing = initialValues !== undefined;
  const variantPresets = VARIANT_PRESETS[game] ?? [];

  useEffect(() => {
    if (queryEdited) {
      return;
    }

    setEbayQuery(buildDefaultQuery({ game, language, marketSegment, condition, name, setName: cardSetName, cardNumber, variant }));
  }, [cardNumber, cardSetName, condition, game, language, marketSegment, name, queryEdited, variant]);

  useEffect(() => {
    if (tagsEdited) {
      return;
    }

    setTags(buildDefaultTags({ game, language, marketSegment, condition, variant, name }));
  }, [condition, game, language, marketSegment, name, tagsEdited, variant]);

  return (
    <form action={action} className="cardForm">
      <div className="formGrid">
        <label>
          Game
          {isEditing ? <input type="hidden" name="game" value={game} /> : null}
          <select
            name="game"
            value={game}
            disabled={isEditing}
              onChange={(event) => {
                setGame(event.target.value);
                setQueryEdited(false);
                setTagsEdited(false);
              }}
            required
          >
            {GAMES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Language
          {isEditing ? <input type="hidden" name="language" value={language} /> : null}
          <select
            name="language"
            value={language}
            disabled={isEditing}
              onChange={(event) => {
                setLanguage(event.target.value);
                setQueryEdited(false);
                setTagsEdited(false);
              }}
            required
          >
            {LANGUAGES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Product type
          {isEditing ? <input type="hidden" name="productType" value={productType} /> : null}
          <select name="productType" value={productType} onChange={(event) => setProductType(event.target.value)} disabled={isEditing} required>
            {PRODUCT_TYPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Market segment
          {isEditing ? <input type="hidden" name="marketSegment" value={marketSegment} /> : null}
          <select
            name="marketSegment"
            value={marketSegment}
            disabled={isEditing}
            onChange={(event) => {
              const nextMarketSegment = event.target.value;
              setMarketSegment(nextMarketSegment);
              setCondition(nextMarketSegment === 'psa_10' ? 'graded' : 'near_mint_or_better');
              setQueryEdited(false);
              setTagsEdited(false);
            }}
            required
          >
            {MARKET_SEGMENTS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Condition
          <select
            name="condition"
            value={condition}
            onChange={(event) => {
              setCondition(event.target.value);
              setQueryEdited(false);
            }}
            required
          >
            {CONDITION_OPTIONS.filter((option) => (marketSegment === 'psa_10' ? option.value === 'graded' : option.value !== 'graded')).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Collector popularity
          <select name="popularityTier" defaultValue={initialValues?.popularityTier ?? 'standard'} required>
            {POPULARITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="formSpan2">
          Card name
          <input
            name="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setQueryEdited(false);
              setTagsEdited(false);
            }}
            placeholder="Gengar VMAX"
            required
          />
        </label>

        <label>
          Set
              <input
                name="setName"
                value={cardSetName}
                onChange={(event) => {
                  setCardSetName(event.target.value);
                  setQueryEdited(false);
                }}
                placeholder="Fusion Strike"
            required
          />
        </label>

        <label>
          Card number
          <input
            name="cardNumber"
            value={cardNumber}
            onChange={(event) => {
              setCardNumber(event.target.value);
              setQueryEdited(false);
            }}
            placeholder="271"
            required
          />
        </label>

        <label>
          Rarity
          <input name="rarity" value={rarity} onChange={(event) => setRarity(event.target.value)} placeholder="Secret Rare" />
        </label>

        <label>
          Variant
          <input
            name="variant"
            value={variant}
            onChange={(event) => {
              setVariant(event.target.value);
              setQueryEdited(false);
              setTagsEdited(false);
            }}
            placeholder="Alternate Art"
          />
        </label>

        <div className="formSpan2 variantPresetRow">
          <span className="subtle">Common presets</span>
          <div className="pillRow">
            {variantPresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={`presetButton${variant === preset.variant ? ' presetButton--active' : ''}`}
                onClick={() => {
                  setVariant(preset.variant);
                  if (preset.rarity) {
                    setRarity(preset.rarity);
                  }
                  setTags(buildDefaultTags({ game, language, marketSegment, condition, variant: preset.variant, name, presetTags: preset.tags }));
                  setTagsEdited(false);
                  setQueryEdited(false);
                  setEbayQuery(
                    buildDefaultQuery({
                      game,
                      language,
                      marketSegment,
                      condition,
                      name,
                      setName: cardSetName,
                      cardNumber,
                      variant: preset.variant,
                    }),
                  );
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <label className="formSpan2">
          Tags
          <input
            name="tags"
            value={tags}
            onChange={(event) => {
              setTags(event.target.value);
              setTagsEdited(true);
            }}
            placeholder="alt-art, chase, gengar"
          />
        </label>

        <div className="formSpan2 queryBuilder">
          <div className="queryBuilderHead">
            <label className="queryField">
              eBay query
              <textarea
                name="ebayQuery"
                rows={4}
                value={ebayQuery}
                onChange={(event) => {
                  setEbayQuery(event.target.value);
                  setQueryEdited(true);
                }}
                required
              />
            </label>
            <button
              type="button"
              className="textLink queryReset"
              onClick={() => {
                setEbayQuery(
                  buildDefaultQuery({ game, language, marketSegment, condition, name, setName: cardSetName, cardNumber, variant }),
                );
                setQueryEdited(false);
              }}
            >
              Reset to defaults
            </button>
            <button
              type="button"
              className="textLink queryReset"
              onClick={() => {
                setTags(buildDefaultTags({ game, language, marketSegment, condition, variant, name }));
                setTagsEdited(false);
              }}
            >
              Reset tags
            </button>
          </div>
          <p className="subtle">
            Default query is generated from the card details and our standard exclusions for this game and market
            segment. You can edit it whenever a card needs custom tuning.
          </p>
        </div>
      </div>

      <div className="formActions">
        <button type="submit">{submitLabel}</button>
        <p className="subtle">{helperText}</p>
      </div>
      {isEditing ? (
        <p className="subtle">
          Game, language, product type, and market segment are locked because changing those lanes would mix old
          snapshots with a different market. Add a new card row when one of those changes.
        </p>
      ) : null}
    </form>
  );
}

function buildDefaultQuery(input: {
  game: string;
  language: string;
  marketSegment: string;
  condition: string;
  name: string;
  setName: string;
  cardNumber: string;
  variant: string;
}): string {
  const baseParts = [input.name.trim(), input.cardNumber.trim(), input.setName.trim(), ...getVariantQueryTerms(input.game, input.variant)]
    .filter(Boolean);
  const baseQuery = baseParts.join(' ').trim();
  if (!baseQuery) {
    return '';
  }

  const gamePrefix = input.game === 'one_piece' ? 'One Piece' : '';
  const languageTerm = getLanguageTerm(input.game, input.language);
  const gradeTerm = input.marketSegment === 'psa_10' ? 'PSA 10' : '';
  const exclusions = getDefaultExclusions(input.game, input.language, input.marketSegment, input.condition);

  return [gamePrefix, baseQuery, languageTerm, gradeTerm, exclusions].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function getVariantQueryTerms(game: string, variant: string): string[] {
  const normalizedVariant = variant.trim().toLowerCase();
  if (!normalizedVariant) {
    return [];
  }

  const preset = (VARIANT_PRESETS[game] ?? []).find((entry) => entry.variant.toLowerCase() === normalizedVariant);
  if (preset?.queryTerms?.length) {
    return preset.queryTerms;
  }

  return [variant.trim()];
}

function buildDefaultTags(input: {
  game: string;
  language: string;
  marketSegment: string;
  condition: string;
  variant: string;
  name: string;
  presetTags?: string[];
}): string {
  const tags = new Set<string>();
  const normalizedGame = input.game === 'one_piece' ? 'one-piece' : input.game;

  tags.add(normalizedGame);
  tags.add(input.language);
  tags.add(input.marketSegment === 'psa_10' ? 'psa-10' : input.marketSegment);
  tags.add(input.condition.replace(/_or_better$/, '').replace(/_/g, '-'));

  const preset = input.presetTags?.length ? { tags: input.presetTags } : findVariantPreset(input.game, input.variant);
  for (const tag of preset?.tags ?? []) {
    tags.add(tag);
  }

  const nameTag = slugifyNameToken(input.name);
  if (nameTag) {
    tags.add(nameTag);
  }

  return Array.from(tags).join(', ');
}

function findVariantPreset(game: string, variant: string) {
  const normalizedVariant = variant.trim().toLowerCase();
  if (!normalizedVariant) {
    return null;
  }

  return (VARIANT_PRESETS[game] ?? []).find((entry) => entry.variant.toLowerCase() === normalizedVariant) ?? null;
}

function slugifyNameToken(name: string): string | null {
  const firstToken = name
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)[0];

  return firstToken ?? null;
}

function getLanguageTerm(game: string, language: string): string {
  if (language === 'japanese') {
    return 'Japanese';
  }

  if (game === 'one_piece') {
    return 'English';
  }

  return '';
}

function getDefaultExclusions(game: string, language: string, marketSegment: string, condition: string): string {
  const exclusions: string[] = [];

  if (language === 'english') {
    exclusions.push('-japanese', '-jp', '-korean');
  } else if (language === 'japanese') {
    exclusions.push('-english');
  }

  exclusions.push('-proxy', '-custom');

  if (marketSegment === 'raw') {
    exclusions.push('-psa', '-bgs', '-cgc', '-sgc', '-beckett');
    if (game === 'pokemon') {
      exclusions.push('-tag');
    }

    if (condition === 'near_mint_or_better') {
      exclusions.push('-lp', '-played', '-mp', '-hp', '-damaged');
    } else if (condition === 'light_played_or_better') {
      exclusions.push('-mp', '-hp', '-damaged');
    } else if (condition === 'moderately_played_or_better') {
      exclusions.push('-hp', '-damaged');
    } else if (condition === 'heavily_played_or_better') {
      exclusions.push('-damaged');
    }
  }

  return exclusions.join(' ');
}
