# News pipeline

**Date:** 2026-09-24 · **Owner:** JH

The job collects and stores real news and uses it to show articles published around unusual price moves. It does not establish why a price moved; the app presents these articles as possible explanations and says why each one is listed.

## What runs, when, and in what order

`.github/workflows/nightly-news.yml` runs every night at **00:30 UTC (02:30 SAST)**. That is after the JSE close (17:00 SAST) and the US close (22:00 SAST), and just after 00:00 UTC, where the app's daily request count restarts. It uses the deploy role's `ssm:SendCommand` to run one command on the production instance:

    docker exec equity-lens-backend python -m app.scripts.news_nightly --quiet

`app/scripts/news_nightly.py` then does this, in order:

1. **Lock.** It takes a Postgres advisory lock. If another run holds it, it logs "another run in progress", writes nothing and exits 0.
2. **Universe.** It takes the tickers held by any user first, then the curated `SEED_UNIVERSE` (the JSE Top 40 plus 10 US names). Funds and the region benchmarks are left out, because their moves are the market's. This is the same function the backfill uses.
3. **Prices.** It calls `get_cached_price_histories(universe + benchmarks, period="1y", force_live=True)`. It records which tickers still have no current price afterwards. A ticker whose cache is younger than `MARKET_DATA_REFRESH_TTL_HOURS` is not fetched again.
4. **Latest news.** It sends calls of up to 5 tickers each, one listing country per call, held tickers first. Each asks for articles published since the start of the last nightly run that stored anything. With no such run, it goes back 36 hours. These articles are stored as `ingest_mode='nightly'`.
5. **Event windows.** It scores the refreshed prices with the same detector the chart uses (EWMA volatility, k = 3). For each unusual move in the last 7 trading days that has no qualifying article yet, it makes one query covering three days before to one day after the move. Before any request is spent, a move is rejected if it is bad data: a gap, a cents/rands flip, or a spike that is undone the next day.
6. **Catch-up.** Whatever is left of the nightly budget goes on the six-month backfill: the same `detect_events` → `plan_calls` as `seed_news --event-windows`, stored as `ingest_mode='backfill'`, held tickers first. A window already fetched is skipped, so each night finishes more of the six months, and a holding imported today has its history filled over the next few nights without anyone running the backfill.
7. **Register.** Every move the detector flagged across the universe, bad data included, is written to `price_anomalies` (see below). This makes no provider call.
8. **Summary.** It writes one `news_ingest_runs` row and prints one line of JSON with the counters, `status`, `budget_left`, `catchup_windows` (backlog windows the provider answered tonight) and `catchup_remaining` (in-window moves still to fetch).

The backfill (`python -m app.scripts.seed_news --event-windows`) is the same machinery, run by hand. `--plan` shows what it would do without spending anything, and `--report review.md` writes a review table that opens with the coverage summary: moves detected in the window (up and down, by band), validated and rejected with the reasons, windows fetched, and how many validated moves have at least one article that would show on the card, as a count, a percentage, and per ticker. That percentage is the honest headline number: "of N genuine anomalies in six months, X% had provider-tagged news within [−3, +1] days". It is counted from stored articles, so a `--dry-run` does not add to it.

## Which moves get a news call: the six-month rule

Only moves from the last **183 days** (`--since-days`, default 183) get a news call. Older moves are still detected, and counted in the plan and the report as `older_than_window`, but they cost nothing.

The six months limits the **calls**, not the **price history**. The detector still reads a year (`period="1y"`, the same series as `GET /api/portfolio/events`), because it seeds its volatility from the first 30 returns it is given. Fed six months instead, the first 30 days would never be scored, and the next two months would be judged against a freshly seeded σ: with λ = 0.94 the seed still carries 0.94^30 ≈ 0.16 of the weight after 30 days, and 0.94^60 ≈ 0.024 after 60. It would flag different days from the dots on the chart. So the input stays at a year, and "six months" is applied afterwards, in `plan_calls`, before the budget, so an old move never takes a call from a recent one.

## Dividends and splits cannot appear as anomalies

Prices are fetched with `auto_adjust=True`, both in `_fetch_from_yfinance` and in the batched `yf.download` in `app/utils/stock_cache.py`. Yahoo then back-adjusts earlier closes for dividends and splits, so an ex-dividend drop or a 2-for-1 split is not a jump in the series and is never flagged. There is no separate dividend or split check, and none is needed.

Earnings and results dates are not used either. There is no reliable free source of JSE results dates, so the card does not claim a move was "results day".

## The anomaly register (`price_anomalies`)

One row per flagged move: `ticker`, `event_date`, `return_pct`, `z_score`, `sigma`, `direction`, `band`, `k_sigma`, and `validation` (`ok`, `spike`, `unit_flip` or `gap`), plus `first_seen_at`, `last_seen_at` and `first_run_id`. It is unique on (`ticker`, `event_date`, `k_sigma`).

- **Written by** `seed_news --event-windows` in every mode except `--plan`, and by the nightly job for the whole universe it scores. Both store exactly what `score_series` returned; nothing is computed here and **detection is unchanged**. The register costs no quota.
- **A re-sighting** keeps `first_seen_at` and `first_run_id` and takes the latest scoring and `last_seen_at`. A move on the last day of a series has no next day yet, so it can only be recognised as a spike the night after.
- **Scan coverage** is kept in the run's `details` as `"scanned": {"MTN.JO": ["2025-10-02", "2026-09-23"], ...}`: the first scored date and the last date for each ticker. It is written only by runs over the whole universe; a backfill for a few named tickers would otherwise make everything else look unscanned.

The event detail reads it as `same_day`: how many of the other tickers the latest scan covered on that date (`scanned`), how many of them were flagged and validated (`unusual`), how many went the same way (`same_direction`), up to five of those, and `expected_by_chance = scanned × erfc(k/√2)`. That baseline assumes independent normal moves. Real returns share a market factor, which is exactly what a count well above it shows. With fewer than 10 other tickers covered, or before any scan has recorded its coverage, `same_day` is null. Only rows the latest scan saw again are counted, so a day that has since dropped under k is not.

The card never fetches news "about the sector" or about other companies in the window. A provider tag on the holding stays the only basis for listing an article.

## Provider and limits

The provider is **MarketAux** (`api.marketaux.com/v1/news/all`). The free plan allows **100 requests a day** and returns **3 articles a request**. The pricing page states both. It does not say when the daily count resets, so 00:00 UTC is the app's own assumption, not the provider's.

The app keeps its own ledger of calls: every HTTP call, including retries, writes one row to `news_fetch_log`. Jobs stop at `NEWS_DAILY_REQUEST_BUDGET` (80), leaving 20 for the News page. The nightly job spends at most `NEWS_NIGHTLY_REQUEST_BUDGET` (60) of those 80.

## How an article is linked to a holding

An article is linked only when MarketAux itself tags it with an entity that passes all three checks:

- the entity's symbol is exactly the holding's ticker (`MTN.JO`, not `MTN`)
- the entity's country is the listing's country (`za` for `.JO`, `us` otherwise)
- the entity's type is `equity`

Each link is stored with the provider's `match_score` and one highlight, as plain text.

Rejected entities are counted by reason:

- **`symbol_mismatch`:** for example, a bare `MTN` is Vail Resorts on the NYSE, not MTN Group.
- **`country_mismatch`**
- **`not_equity`:** for example, a JSE sector index.

An article with no link is still stored, because it feeds the search index's word statistics. It never appears against a move.

## How an article is associated with a move

- **Window:** the article must be published between 3 days before and 1 day after the move. The dates are the exchange's own calendar dates: JSE is UTC+2, and the US is held at UTC−5.
- **Relevance:** it must also have a `match_score` of 25 or more, or name the company in its headline.
  - Passing mentions scored 12.6 and 17 in our sample, and articles about the company scored 31 and up.
  - The threshold is applied when reading, so it can be changed without fetching again.
- **Labels:** an article is labelled **close** when the headline names the company within a day of the move, and **related** otherwise.
- **Why it is listed:** each article carries the evidence for its listing: whether the headline names the company, the provider's score, the days from the move, the highlight, and when it was collected.

## Failure behaviour and exit codes

| Provider answer | What the job does |
|---|---|
| 402 usage limit | Stops the run. Status `partial`. |
| 429 rate limit | Waits 60 s and retries once. Still 429: stops, `partial`. |
| 401 / 403 | Stops. Status `failed`. This is a configuration problem. |
| Timeout, connection error, 5xx | Retries once after 5 s, then skips that call. Three failures in a row stop the run. |
| Malformed response or article | Counted and skipped. |

The job pauses 1 s between calls and never raises. Every run leaves exactly one `news_ingest_runs` row.

**Exit codes:** `0` means ok, or a plan or dry run, or skipped because another run held the lock. `1` means partial, which the workflow shows as a warning and still passes. `2` means failed, which fails the workflow.

`/api/portfolio/events` returns `news_last_collected_at` and `news_last_run_status` in its coverage block, for the event card to show. That response is cached in-process for 15 minutes, so it can lag a run by up to 15 minutes.

## Reading `news_ingest_runs`

The backend container has no `psql`, so this uses the app's own engine:

    docker exec equity-lens-backend python -c "
    from sqlalchemy import text
    from app.database import SessionLocal
    db = SessionLocal()
    for label, q in [
        ('last runs', 'SELECT mode, status, started_at, finished_at, requests_made, articles_new, articles_duplicate, links_new, links_rejected, events_considered, events_with_candidates, error_summary FROM news_ingest_runs ORDER BY started_at DESC LIMIT 10'),
        ('calls today', \"SELECT count(*) FROM news_fetch_log WHERE source = 'marketaux' AND fetched_at >= date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc'\"),
        ('articles by mode', 'SELECT ingest_mode, count(*) FROM news_articles GROUP BY 1'),
        ('register', 'SELECT count(*), min(event_date), max(event_date) FROM price_anomalies'),
    ]:
        print(label, db.execute(text(q)).all())
    "

`details` on each run holds the rejection counts by reason, the per-ticker results, the price tickers that failed to refresh, and (for nightly runs) the catch-up results and the scan coverage.

## Running the news jobs locally

The local stack uses the same MarketAux key as production, and therefore the same 100 requests a day. Do local real runs sparingly. Prefer `--plan`, which makes no news calls, and the CI test, which makes none at all.

    docker compose up -d db backend
    docker compose exec backend alembic upgrade head
    docker compose exec backend python -m app.scripts.seed_market_data

`seed_market_data` writes about 40 business days of **synthetic** prices for SBK.JO, NPN.JO, AGL.JO, MTN.JO, STX40.JO and STXGOV.JO, so the dashboard has something to draw. That is below the 60 days the move detector needs, so the event-window step finds nothing on seeded prices. Real history arrives once the cache is older than `MARKET_DATA_REFRESH_TTL_HOURS` and the job fetches from Yahoo.

Next, import the demo portfolio through the UI (Portfolio → Import). Then run:

    docker compose exec backend python -m app.scripts.news_nightly --plan
    docker compose exec backend python -m app.scripts.news_nightly --dry-run
    docker compose exec backend python -m app.scripts.news_nightly

## In CI

`backend/tests/integration/test_news_nightly.py` runs the whole job against the test database with the provider stubbed from the MarketAux fixtures. The scenario covers a 429 then success, a malformed article, the Vail/MTN collision, a duplicate and an event window. It needs no network and spends no quota, and it runs on every PR as part of `python -m pytest`.

## On production

After a merge to `main` and a deploy: **Actions → Nightly news → Run workflow → branch `main`, mode `dry-run`**. Read the JSON summary line in the job log, then let the schedule take over.

A run from any other branch fails at "Configure AWS credentials". This is by design: the deploy role only trusts `main`.
