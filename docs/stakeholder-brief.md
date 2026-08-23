# Pokemon Trend Scanner Stakeholder Brief

## What This Tool Does

This tool is an internal scanner for English Pokemon TCG singles.

Its job is to:
- collect daily eBay US market snapshots for a tracked list of cards
- store that history in Postgres
- calculate simple trend and local lag signals
- produce a ranked daily CSV and Markdown report

The tool is meant to surface cards worth reviewing.
It is not meant to make blind buy decisions on its own.

## What Data It Uses Today

The current MVP uses eBay US only.

For each tracked card, the scanner looks at:
- credible low Buy It Now asking range including shipping
- number of BIN listings
- number of auction listings
- median auction current price
- median auction bid count

Over time, daily history lets us measure:
- 7-day floor change
- 30-day floor change
- inventory tightening
- auction activity changes
- short-term volatility
- whether auction pricing is lagging BIN pricing
- observed liquidity, with a separate confidence score when historical inputs are incomplete

Each card also has an expert-set collector popularity tier. The app combines that judgment with observed liquidity to adjust the expected direct-collector negotiation from the normal 5% starting point. It shows a range of collector maximum-buy prices rather than pretending there is one certain exit value. A disappeared listing is treated as an absorption signal, not proof of a completed sale.

## What The Report Means

The daily report ranks cards using two main scores:

### Trend Score
This is meant to highlight cards that may be moving up in a real way.

Signals that help this score:
- rising eBay floor
- shrinking inventory
- stronger auction activity
- lower short-term volatility

### Local Lag Score
This is meant to highlight cards that may still be underpriced in local shops or slower channels.

Signals that help this score:
- BIN floor rising faster than recent auction pricing
- inventory shrinking
- auction activity increasing

### Spike Flag
This is a simple warning that a card may be moving unusually fast rather than climbing steadily.

It is triggered when the 7-day move is strong relative to the 30-day move and short-term volatility is elevated.

## What The Tool Does Not Do Yet

The current MVP does not:
- discover all Pokemon cards automatically
- scrape every listing into a warehouse
- understand set context, print context, or collector psychology
- know which cards are truly "good buys" without human review
- compare against TCGplayer or another outside pricing baseline

## What We Need From Our Pokemon Expert

The scanner is strongest when the tracked card list is curated well.

We need help choosing which cards to monitor first.
The expert should guide us on:
- which sets matter most right now
- which chase cards and mid-tier cards are worth tracking
- which arts, rarities, and variants deserve separate tracking
- which cards are overhyped noise vs real market movers
- which search terms produce clean eBay results

## Can The App Find Opportunities On Its Own?

Not across the whole market yet.

Today, the app can find opportunities only within the list of cards we choose to track.

That means:
- yes, it can rank and surface potential opportunities among tracked cards
- no, it does not yet crawl the full Pokemon card universe and discover candidates automatically

So the current workflow is:
1. We choose a focused watchlist.
2. The scanner tracks those cards daily.
3. The report highlights which of those tracked cards look interesting.
4. Our Pokemon expert reviews the output and tells us which signals are meaningful.

## Best Use Of The MVP

The best first use is not "track everything."

The best first use is to track a curated list such as:
- top chase cards from key Sword & Shield and Scarlet & Violet sets
- alt arts and special illustration rares
- historically liquid modern grails
- a small set of cards local stores often misprice

This gives us better signal quality and cleaner feedback loops.

## Recommended Starting Card Selection

A strong starting list would usually include:
- 20 to 50 high-interest modern chase singles
- a mix of expensive grails and liquid mid-range cards
- cards with enough eBay volume to produce useful daily readings

Good candidates often come from:
- Evolving Skies
- Fusion Strike
- Lost Origin
- Crown Zenith
- Paldea Evolved
- Paradox Rift
- Temporal Forces
- Twilight Masquerade
- Surging Sparks and other current high-attention sets

The exact list should be approved by our Pokemon expert.

## How Stakeholder Feedback Improves The System

We should expect the expert to help tune:
- the watchlist itself
- eBay query wording
- which signals matter most
- which false positives to ignore
- which opportunity types are worth separate tags

Examples of useful tags:
- `alt-art`
- `sir`
- `waifu`
- `starter`
- `charizard`
- `grail`
- `liquid`
- `local-misprice`

## Near-Term Improvement Path

Once the expert helps us choose a better starting watchlist, the next improvements are:
- expand the seed list
- improve eBay query quality
- add report notes for cards with no usable market data
- add basic card categories and priority tiers
- later add approved reference data sources if available

## Bottom Line

This MVP is a watchlist-based opportunity scanner, not a fully autonomous market discovery engine.

Right now, the smartest approach is:
- let our Pokemon expert help choose the first watchlist
- let the scanner monitor those cards daily
- use the report to narrow attention to the most promising names
- refine the watchlist and scoring as we learn
