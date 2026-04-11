# News Agent — Architektura (v0.2)

> Primary data: Alpha Vantage | Fallback: Finnhub
> LLM (dev): Gemini 2.0 Flash | LLM (prod): Claude Sonnet
> Config: config.yaml — all feature flags and settings

---

## 1. Layout — workspace agentów (updated)

```
┌──────────────────────────┬──────────────────────────────┐
│                          │  Agent Workspace             │
│   Market View            │                              │
│                          │   (●)  (●)  (●)  (●)  (●)   │
│   • Chart (candlestick)  │   📰   📊   💬   🎯   🎓   │
│   • Order book           │   News Tech Sent Orch Coach  │
│   • Watchlist             │    3              1          │
│   • Position manager     │   ───                        │
│   • Trade execution      │                              │
│                          │  ┌────────────────────────┐  │
│                          │  │  News Agent             │  │
│                          │  │                        │  │
│                          │  │  [analyzed news feed]  │  │
│                          │  │  [interactive cards]   │  │
│                          │  │  [impact alerts]       │  │
│                          │  │                        │  │
│                          │  ├────────────────────────┤  │
│                          │  │  [  ask news agent  ]  │  │
│                          │  └────────────────────────┘  │
└──────────────────────────┴──────────────────────────────┘

Ikony = okrągłe awatary (48px) z badge count.
Badge = liczba nieprzeczytanych wiadomości.
Active agent = podświetlony ring + underline.
Critical badge = czerwony kolor (config: notifications.badge.critical_color).
Standard badge = niebieski (config: notifications.badge.standard_color).
```

---

## 2. Data source: Alpha Vantage

### Dlaczego Alpha Vantage jako primary

- **Oficjalny MCP server** — podczas developmentu w Claude Code / Cursor,
  agent kodujący ma bezpośredni dostęp do danych AV przez MCP.
  Ułatwia prototypowanie i testowanie bez pisania boilerplate'u.
- **NEWS_SENTIMENT endpoint** — zwraca newsy z wbudowanym sentiment
  score per ticker, co eliminuje potrzebę osobnego sentiment API.
- **50+ technical indicators** — gotowe do użycia przez Technical Agent (Phase 2).
- **20+ lat historii** — głębokie dane historyczne.
- **Oficjalny partner NASDAQ** — wiarygodne źródło danych.

### Ograniczenie free tier

Alpha Vantage free tier: **25 requestów/dzień**.

Przy 5 tickerach i fetchu co 5 minut potrzebujemy ~288 requestów/dzień.
To wykracza poza free tier. Rozwiązanie:

```
┌─────────────────────────────────────────────────┐
│  STRATEGIA DUAL-SOURCE                          │
│                                                 │
│  Alpha Vantage (primary)                        │
│  ├─ NEWS_SENTIMENT → news + sentiment scores    │
│  ├─ Fetch: on-demand (user opens agent,         │
│  │         adds ticker) + co 30 min background  │
│  └─ Budget: ~25 req/dzień (news + quotes)       │
│                                                 │
│  Finnhub (fallback + high-frequency)            │
│  ├─ /company-news → fill gaps between AV calls  │
│  ├─ /quote → real-time prices (60 req/min)      │
│  └─ /news → general market news                 │
│                                                 │
│  config.yaml kontroluje przełączanie            │
│  data_sources.fallback.enabled: true            │
└─────────────────────────────────────────────────┘
```

Gdy wykupisz płatny tier AV ($49.99+/msc), ustawiasz w configu
`data_sources.alpha_vantage.rate_limit.paid_tier` i Finnhub staje się
opcjonalny.

### Alpha Vantage NEWS_SENTIMENT response

```
GET https://www.alphavantage.co/query
  ?function=NEWS_SENTIMENT
  &tickers=AAPL
  &apikey=YOUR_KEY
```

```json
{
  "items": "50",
  "sentiment_score_definition": "...",
  "relevance_score_definition": "...",
  "feed": [
    {
      "title": "Apple Announces New AI Features",
      "url": "https://...",
      "time_published": "20260311T143000",
      "authors": ["Jane Doe"],
      "summary": "Apple Inc. unveiled new AI features...",
      "banner_image": "https://...",
      "source": "CNBC",
      "category_within_source": "Technology",
      "source_domain": "cnbc.com",
      "topics": [
        { "topic": "Technology", "relevance_score": "0.95" }
      ],
      "overall_sentiment_score": 0.32,
      "overall_sentiment_label": "Somewhat-Bullish",
      "ticker_sentiment": [
        {
          "ticker": "AAPL",
          "relevance_score": "0.89",
          "ticker_sentiment_score": "0.45",
          "ticker_sentiment_label": "Bullish"
        }
      ]
    }
  ]
}
```

Kluczowa przewaga: `ticker_sentiment_score` i `overall_sentiment_score`
są wbudowane — nie potrzebujemy osobnego callu do LLM tylko po sentiment.

### Finnhub /company-news response (fallback)

```json
{
  "category": "company",
  "datetime": 1710000000,
  "headline": "Apple Announces New AI Features",
  "id": 123456,
  "image": "https://...",
  "related": "AAPL",
  "source": "CNBC",
  "summary": "Apple Inc. unveiled new AI...",
  "url": "https://..."
}
```

Finnhub nie ma sentiment score — tu LLM wchodzi do gry.

---

## 3. Pipeline News Agenta — krok po kroku

```
  Trigger (config-driven)
  │
  │  feature_flags.news_agent.auto_fetch: true
  │  feature_flags.news_agent.fetch_interval_minutes: 5
  │  feature_flags.news_agent.fetch_on_agent_open: true
  │  feature_flags.news_agent.fetch_on_ticker_add: true
  │
  ▼
┌─────────────────────────────┐
│  STEP 1: DATA FETCHER       │
│  (Next.js API Route)        │
│                             │
│  Reads: config.yaml         │
│  ├─ data_sources.primary    │
│  ├─ watchlist.default_tickers│
│  └─ fallback settings       │
│                             │
│  Logic:                     │
│  1. Check rate limit budget │
│  2. AV: NEWS_SENTIMENT per  │
│     ticker (if budget OK)   │
│  3. Finnhub: /company-news  │
│     for remaining tickers   │
│  4. Finnhub: /news?general  │
│     (if include_macro_news) │
│  5. Merge results into      │
│     unified Article[]       │
└──────────┬──────────────────┘
           │ Article[] (unified format)
           ▼
┌─────────────────────────────┐
│  STEP 2: NORMALIZER         │
│  + DEDUPLICATOR             │
│                             │
│  1. Normalize AV and        │
│     Finnhub into common     │
│     Article interface       │
│  2. Deduplicate by URL      │
│     (same article from      │
│     different sources)      │
│  3. Merge cross-ticker      │
│     (same article, multiple │
│     tickers mentioned)      │
│  4. Filter: age < 48h       │
│     (config: article_       │
│     retention_hours)        │
│  5. Filter: has headline    │
│     + summary               │
│  6. Cap at max_articles_    │
│     per_batch (config: 15)  │
└──────────┬──────────────────┘
           │ Article[] (clean, unified)
           ▼
┌─────────────────────────────┐
│  STEP 3: LLM ANALYST        │
│                             │
│  Config: ai_provider.active │
│  Dev:  Gemini 2.0 Flash     │
│  Prod: Claude Sonnet        │
│                             │
│  Input:                     │
│  ├─ Batch of articles       │
│  ├─ User's watchlist        │
│  └─ Portfolio positions     │
│     (if any)                │
│                             │
│  LLM does:                  │
│  1. Deeper interpretation   │
│     (beyond API sentiment)  │
│  2. Cross-article patterns  │
│     ("3 articles point to   │
│      tech sector pressure") │
│  3. Portfolio impact flag   │
│     ("TSLA in your          │
│      portfolio — relevant") │
│  4. Urgency classification  │
│  5. Actionable summary      │
│                             │
│  Note: If AV already gave   │
│  sentiment scores, LLM      │
│  enriches rather than       │
│  recalculates.              │
│                             │
│  If sentiment_via_llm:false │
│  → skip LLM, use AV scores │
│    only (cheaper, faster)   │
└──────────┬──────────────────┘
           │ AnalyzedArticle[]
           ▼
┌─────────────────────────────┐
│  STEP 4: FORMATTER          │
│  + PRIORITIZER              │
│                             │
│  Sort by:                   │
│  1. Critical alerts (top)   │
│  2. Portfolio-relevant      │
│  3. High impact             │
│  4. Medium / Low (fold)     │
│                             │
│  Generate ChatBlock[]:      │
│  ├─ AlertCard (critical)    │
│  ├─ NewsCard (standard)     │
│  ├─ TrendInsight (pattern)  │
│  └─ text (summaries)        │
└──────────┬──────────────────┘
           │ ChatBlock[]
           ▼
┌─────────────────────────────┐
│  STEP 5: CHAT FEED          │
│  + BADGE UPDATE             │
│                             │
│  1. Append new blocks to    │
│     News Agent chat         │
│  2. Update badge count      │
│  3. If critical → red badge │
│  4. If user has chat open   │
│     → auto-scroll + mark    │
│     as read                 │
│  5. Store in newsStore      │
│     (Zustand)               │
└─────────────────────────────┘
```

---

## 4. Unified Article interface

```typescript
interface Article {
  // Identity
  id: string;                    // hash of URL (dedup key)
  url: string;
  source: string;                // "CNBC", "Reuters", etc.
  sourceProvider: 'alpha_vantage' | 'finnhub';

  // Content
  headline: string;
  summary: string;
  imageUrl?: string;
  publishedAt: string;           // ISO 8601
  authors?: string[];

  // Ticker association
  tickers: string[];             // ["AAPL", "MSFT"] if multiple
  primaryTicker: string;         // main ticker this was fetched for

  // Sentiment (from API — before LLM)
  apiSentimentScore?: number;    // -1.0 to +1.0 (AV only)
  apiSentimentLabel?: string;    // "Bullish", "Bearish" (AV only)
  tickerRelevanceScore?: number; // 0-1 how relevant to ticker (AV only)

  // Categories
  topics?: string[];             // ["Technology", "AI", "Earnings"]
  category?: string;             // "company" | "macro" | "sector"
}
```

---

## 5. LLM Analyst — what it adds beyond API data

Kluczowe pytanie: jeśli Alpha Vantage już daje sentiment score,
po co nam jeszcze LLM?

**Co AV daje:** numeryczny score (-1 do 1) + label ("Bullish").
**Czego AV nie daje:**

| LLM dodaje | Przykład |
|------------|---------|
| Interpretacja w kontekście | "Mimo pozytywnego newsa, rynek może już to wyceniać" |
| Cross-article patterns | "4 artykuły z ostatnich 2h mówią o regulacjach AI → trend" |
| Portfolio-aware alerts | "Ten news dotyczy TSLA — masz pozycję long" |
| Urgency classification | "CEO rezygnacja = CRITICAL, nowy produkt = MEDIUM" |
| Actionable summary | "Najważniejsze dzisiaj: Fed, NVDA earnings, AAPL produkt" |
| Natural language Q&A | User pyta "co to znaczy?" → pełna odpowiedź |

**Kiedy LLM jest wywoływany:**
- Nowy batch artykułów → analiza batch
- User pisze pytanie w czacie → conversational response
- User klika "Analizuj wpływ" → deep dive

**Kiedy LLM NIE jest wywoływany (oszczędność):**
- `sentiment_via_llm: false` → tylko API scores
- Artykuł już przeanalizowany (cache po `article.id`)
- Batch identyczny jak poprzedni

---

## 6. Rate limit budget manager

```
┌─────────────────────────────────────────────┐
│  DAILY BUDGET MANAGER                       │
│                                             │
│  Total AV budget: 25 req/day                │
│                                             │
│  Allocation:                                │
│  ├─ NEWS_SENTIMENT: 10 req                  │
│  │   (2 fetches × 5 tickers)               │
│  ├─ GLOBAL_QUOTE:   10 req                  │
│  │   (2 per ticker × 5 tickers)             │
│  ├─ Reserved:         5 req                 │
│  │   (on-demand user queries)               │
│                                             │
│  Strategy:                                  │
│  ├─ Morning: AV fetch all tickers (10 req)  │
│  ├─ Midday:  AV refresh (10 req)            │
│  ├─ Between: Finnhub fills gaps (60/min)    │
│  └─ On-demand: reserve pool                 │
│                                             │
│  If budget exhausted → 100% Finnhub         │
└─────────────────────────────────────────────┘
```

---

## 7. MCP w developmencie — jak pomaga

Alpha Vantage MCP server nie jest częścią runtime'u aplikacji.
Jest narzędziem deweloperskim:

```
┌─────────────────────────────────────────┐
│  DEV TIME (Claude Code / Cursor)        │
│                                         │
│  Developer: "Fetch AAPL news and show   │
│  me the response format"                │
│                                         │
│  Claude Code → AV MCP Server            │
│  → real data in context                 │
│  → agent writes code that matches       │
│     actual API response shape           │
│                                         │
│  Benefit: no manual API testing,        │
│  agent sees real data while coding.     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  RUNTIME (Next.js app)                  │
│                                         │
│  App → REST API calls to AV/Finnhub     │
│  → standard fetch() in API routes       │
│  → no MCP involved                      │
│                                         │
│  MCP is dev-only, REST is prod.         │
└─────────────────────────────────────────┘
```

Claude Code / Cursor config:
```json
{
  "mcpServers": {
    "alpha-vantage": {
      "command": "uvx",
      "args": ["alphavantage-mcp"],
      "env": {
        "ALPHA_VANTAGE_API_KEY": "YOUR_KEY"
      }
    }
  }
}
```

---

## 8. Config references — where each flag is consumed

| Config path | Consumed by | Purpose |
|-------------|-------------|---------|
| `data_sources.primary` | `lib/fetcher.ts` | Pick which API to call first |
| `data_sources.fallback.enabled` | `lib/fetcher.ts` | Auto-switch when rate limited |
| `ai_provider.active` | `lib/llm/llmRouter.ts` | Gemini vs Claude |
| `watchlist.default_tickers` | `lib/fetcher.ts` | Which tickers to poll |
| `feature_flags.news_agent.auto_fetch` | `api/news/fetch/route.ts` | Enable/disable cron |
| `feature_flags.news_agent.fetch_interval_minutes` | `api/news/fetch/route.ts` | Polling frequency |
| `feature_flags.news_agent.fetch_on_agent_open` | `components/news/` | Trigger on UI open |
| `feature_flags.news_agent.fetch_on_ticker_add` | `store/watchlistStore.ts` | Trigger on add |
| `feature_flags.news_agent.max_articles_per_batch` | `lib/deduplicator.ts` | Cap before LLM |
| `feature_flags.news_agent.article_retention_hours` | `lib/deduplicator.ts` | Cleanup old articles |
| `feature_flags.news_agent.sentiment_via_llm` | `lib/analyzer.ts` | LLM vs API-only |
| `feature_flags.news_agent.show_trend_insights` | `lib/formatter.ts` | Generate patterns |
| `feature_flags.news_agent.include_macro_news` | `lib/fetcher.ts` | Fetch general news |
| `feature_flags.dev.mock_data` | `lib/fetcher.ts` | Use mocks in dev |
| `notifications.badge.*` | `components/AgentSidebar.tsx` | Badge styling |

---

## 9. Struktura plików (updated)

```
src/
├── config/
│   ├── config.yaml              ← master config
│   ├── config.development.yaml  ← dev overrides (optional)
│   └── loadConfig.ts            ← YAML parser + type-safe accessor
├── app/
│   ├── api/
│   │   └── news/
│   │       ├── fetch/route.ts   ← data fetching (cron + on-demand)
│   │       └── analyze/route.ts ← LLM analysis
│   ├── dashboard/
│   │   └── page.tsx
│   └── onboarding/
│       └── page.tsx
├── components/
│   ├── agents/
│   │   ├── AgentSidebar.tsx     ← round icons + badges
│   │   ├── AgentChat.tsx        ← chat container
│   │   └── news/
│   │       ├── NewsFeed.tsx     ← list of ChatBlocks
│   │       ├── NewsCard.tsx     ← single article card
│   │       ├── AlertCard.tsx    ← critical alert
│   │       ├── TrendInsight.tsx ← pattern summary
│   │       ├── DailySummary.tsx ← day overview
│   │       └── NewsInput.tsx    ← message input
│   └── market/
│       ├── Chart.tsx
│       ├── Watchlist.tsx
│       └── OrderBook.tsx
├── lib/
│   ├── data-sources/
│   │   ├── alphaVantage.ts      ← AV API client
│   │   ├── finnhub.ts           ← Finnhub API client
│   │   └── rateLimitManager.ts  ← budget tracking
│   ├── news/
│   │   ├── fetcher.ts           ← step 1
│   │   ├── normalizer.ts        ← step 2 (unified format)
│   │   ├── deduplicator.ts      ← step 2 (dedup + filter)
│   │   ├── analyzer.ts          ← step 3 (LLM call)
│   │   ├── formatter.ts         ← step 4 (ChatBlock gen)
│   │   └── types.ts             ← interfaces
│   └── llm/
│       ├── geminiClient.ts      ← Gemini wrapper (dev)
│       ├── claudeClient.ts      ← Claude wrapper (prod)
│       └── llmRouter.ts         ← reads config → routes to active
├── store/
│   ├── newsStore.ts             ← articles + chat state
│   └── configStore.ts           ← parsed config
└── agents/
    └── prompts/
        └── newsAgentPrompt.ts   ← system prompt
```

---

## 10. Następne kroki

1. **Walidacja tego dokumentu + config.yaml**
2. **API keys:** Alpha Vantage + Finnhub + Gemini
3. **System prompt News Agenta** — uniwersalny (Gemini + Claude)
4. **Scaffold Next.js** — layout + config loader
5. **Fetcher + normalizer** — dual-source → unified Article[]
6. **LLM analyzer** — Gemini integration
7. **Chat feed UI** — NewsCard, AlertCard, badges
