# News Agent — Architektura v3 (final)

> Data source: Finnhub (free tier, 60 req/min)
> AI analysis: Gemini (dev) → Claude (prod)
> Config: `config.yaml`
> No MCP. No Alpha Vantage.

---

## 1. Layout — workspace agentów

```
┌──────────────────────────┬──────────────────────────────┐
│                          │  Agent Workspace             │
│   Market View            │                              │
│                          │   (○)  (○)  (○)  (○)  (○)   │
│   • Chart (candlestick)  │   📰   📊   💬   🎯   🎓   │
│   • Order book           │   ●3              ●1         │
│   • Watchlist             │  News Tech  Sent Orch Coach  │
│   • Position manager     │                              │
│   • Trade execution      │  ┌────────────────────────┐  │
│                          │  │  News Agent             │  │
│                          │  │                        │  │
│                          │  │  [feed / cards / alerts]│  │
│                          │  │                        │  │
│                          │  ├────────────────────────┤  │
│                          │  │  [ ask news agent... ] │  │
│                          │  └────────────────────────┘  │
└──────────────────────────┴──────────────────────────────┘

Ikony = okrągłe awatary (nie taby).
Badge = kółko z liczbą nieprzeczytanych wiadomości.
  - niebieski badge = standardowe wiadomości
  - czerwony badge = critical alert (impact ≥ config threshold)
Aktywny agent = podświetlony ring wokół ikony.
```

---

## 2. Finnhub — co dostajemy

### Company News endpoint
`GET /company-news?symbol=AAPL&from=2026-03-10&to=2026-03-11&token=KEY`

```json
{
  "category": "company",
  "datetime": 1710000000,
  "headline": "Apple Announces New AI Features for iPhone",
  "id": 123456,
  "image": "https://...",
  "related": "AAPL",
  "source": "CNBC",
  "summary": "Apple Inc. unveiled new artificial intelligence...",
  "url": "https://cnbc.com/..."
}
```

### General Market News
`GET /news?category=general&token=KEY`

Same format, broader scope (macro, sector-level news).

### Co Finnhub NIE daje (i czym to uzupełniamy):
- **Sentiment score** → AI analysis (Gemini/Claude) liczy impact + sentiment
- **Ticker relevance score** → AI analysis ocenia relevance do portfela
- **Topic categorization** → AI analysis klasyfikuje (earnings/macro/regulatory/etc.)

### Rate limit math
```
5 tickerów × 1 request each   = 5 req
1 general market news          = 1 req
                               -------
Total per fetch cycle          = 6 req

Przy fetch co 5 min:
  6 req × 12 cycles/h = 72 req/h  → limit 60/min, OK (72 << 3600)

Przy 20 tickerów:
  21 req per cycle × 12 = 252 req/h → wciąż OK

Zapas jest ogromny. Bottleneck to AI cost, nie rate limit.
```

---

## 3. Pipeline — krok po kroku

```
┌─────────────────┐
│   config.yaml   │
│  • watchlist    │
│  • feature flags│
│  • intervals    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  1. SCHEDULER           │
│                         │
│  Reads:                 │
│  - fetch_interval_sec   │
│  - auto_fetch flag      │
│                         │
│  Triggers fetch every   │
│  N seconds, or on       │
│  manual request         │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  2. FINNHUB FETCHER     │
│                         │
│  For each ticker:       │
│    GET /company-news    │
│                         │
│  If include_market_news:│
│    GET /news?general    │
│                         │
│  Collects raw articles  │
└────────────┬────────────┘
             │ RawArticle[]
             ▼
┌─────────────────────────┐
│  3. DEDUP + FILTER      │
│                         │
│  • Dedup by article id  │
│  • Merge cross-ticker   │
│    duplicates           │
│  • Drop older than      │
│    retention_hours      │
│  • Drop empty/spam      │
│  • Cap at max_articles_ │
│    per_batch            │
└────────────┬────────────┘
             │ clean RawArticle[]
             ▼
┌─────────────────────────┐
│  4. AI ANALYST          │
│                         │
│  Checks config:         │
│  ai_analysis: true?     │
│                         │
│  YES → send batch to    │
│    Gemini (dev) or      │
│    Claude (prod)        │
│    with system prompt   │
│                         │
│  NO → pass through raw  │
│    articles without     │
│    enrichment           │
│                         │
│  Output per article:    │
│  - impactScore (-1..+1) │
│  - category             │
│  - urgency              │
│  - interpretation       │
│  - affectsPortfolio     │
│  - tags                 │
└────────────┬────────────┘
             │ AnalyzedArticle[]
             ▼
┌─────────────────────────┐
│  5. FORMATTER           │
│                         │
│  Maps → ChatBlock[]     │
│  Sorts by priority:     │
│  1. critical alerts     │
│  2. high + in portfolio │
│  3. medium              │
│  4. low (collapsed)     │
│                         │
│  Generates:             │
│  - NewsCard blocks      │
│  - AlertCard blocks     │
│  - TrendInsight blocks  │
└────────────┬────────────┘
             │ ChatBlock[]
             ▼
┌─────────────────────────┐
│  6. FEED + BADGE        │
│                         │
│  New blocks → update    │
│  badge count on icon    │
│                         │
│  impact ≥ critical →    │
│    red badge            │
│  impact ≥ min_impact →  │
│    blue badge           │
│                         │
│  User opens chat →      │
│    badge resets to 0    │
└─────────────────────────┘
```

---

## 4. Krok 2 — Finnhub Fetcher (szczegóły)

```typescript
// lib/news/finnhub-client.ts

interface FinnhubArticle {
  category: string;
  datetime: number;          // UNIX timestamp
  headline: string;
  id: number;
  image: string;
  related: string;           // ticker symbol
  source: string;
  summary: string;
  url: string;
}

async function fetchCompanyNews(
  ticker: string,
  from: string,              // YYYY-MM-DD
  to: string
): Promise<FinnhubArticle[]> {
  const url = `${BASE_URL}/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${API_KEY}`;
  const res = await fetch(url);
  if (res.status === 429) throw new RateLimitError();
  return res.json();
}

async function fetchMarketNews(): Promise<FinnhubArticle[]> {
  const url = `${BASE_URL}/news?category=general&token=${API_KEY}`;
  const res = await fetch(url);
  return res.json();
}

async function fetchAllNews(tickers: string[]): Promise<RawArticle[]> {
  const today = formatDate(new Date());
  const yesterday = formatDate(subDays(new Date(), 1));

  // Parallel fetch per ticker
  const tickerResults = await Promise.all(
    tickers.map(t => fetchCompanyNews(t, yesterday, today))
  );

  // Flatten + normalize to RawArticle format
  const articles = tickerResults.flat().map(normalizeArticle);

  // Optionally add market news
  if (config.features.news_agent.include_market_news) {
    const marketNews = await fetchMarketNews();
    articles.push(...marketNews.map(normalizeArticle));
  }

  return articles;
}
```

---

## 5. Krok 3 — Dedup + Filter

```typescript
// lib/news/deduplicator.ts

function deduplicateAndFilter(
  articles: RawArticle[],
  config: NewsAgentConfig
): RawArticle[] {
  const seen = new Map<string, RawArticle>();

  for (const article of articles) {
    const key = article.id;

    if (seen.has(key)) {
      // Same article for different ticker → merge tickers
      const existing = seen.get(key)!;
      existing.tickers = [...new Set([...existing.tickers, ...article.tickers])];
    } else {
      seen.set(key, article);
    }
  }

  const cutoff = Date.now() - config.retention_hours * 60 * 60 * 1000;

  return Array.from(seen.values())
    .filter(a => a.publishedAt > cutoff)          // age filter
    .filter(a => a.headline.length >= 20)          // spam filter
    .filter(a => a.summary.length > 0)             // empty filter
    .sort((a, b) => b.publishedAt - a.publishedAt) // newest first
    .slice(0, config.max_articles_per_batch);       // batch limit
}
```

---

## 6. Krok 4 — AI Analyst

**System prompt** (skrót — pełna wersja w `agents/NEWS_AGENT.md`):

```
You are News Agent — a financial news analyst.

You receive a batch of news articles about stocks the user
is watching. The user's watchlist: {tickers from config}.

For each article, produce JSON:
{
  "articleId": number,
  "impactScore": number,    // -1.0 (very bearish) to +1.0 (very bullish)
  "category": string,       // "earnings" | "macro" | "sector" | "company" | "regulatory"
  "urgency": string,        // "low" | "medium" | "high" | "critical"
  "interpretation": string, // 2-3 sentences: what does this mean for an investor?
  "affectsPortfolio": bool, // true if article's ticker is in user's watchlist
  "tags": string[]          // keywords: ["AI", "product-launch", "bullish"]
}

Additionally, if you detect a pattern across multiple articles
(e.g. entire sector under pressure), generate a TrendInsight:
{
  "type": "trend",
  "title": string,
  "summary": string,
  "affectedTickers": string[]
}

Respond ONLY with a JSON object:
{
  "articles": [...],
  "trends": [...]
}

Language: match the user's language. If user writes in Polish,
respond in Polish. If English, respond in English.
```

**Batch call strategy:**
- All 15 articles in ONE call (not per-article)
- Estimated tokens: ~2500 input + ~2000 output per batch
- Gemini 2.0 Flash: negligible cost in dev
- Cache: same article batch → skip AI call

---

## 7. Krok 5 — Formatter → ChatBlock types

```typescript
// lib/news/types.ts

type ChatBlock =
  | TextBlock
  | NewsCardBlock
  | AlertCardBlock
  | TrendInsightBlock;

interface NewsCardBlock {
  type: "news_card";
  articleId: number;
  headline: string;
  source: string;
  timeAgo: string;               // "2h ago"
  imageUrl?: string;
  tickers: string[];
  impactScore: number;           // visual: dots or bar
  interpretation: string;
  tags: string[];
  url: string;                   // "Read more" → original article
  affectsPortfolio: boolean;
}

interface AlertCardBlock {
  type: "alert_card";
  severity: "warning" | "critical";
  headline: string;
  source: string;
  tickers: string[];
  impactScore: number;
  interpretation: string;
  url: string;
  actions: string[];             // ["View position", "Ask Orchestrator"]
}

interface TrendInsightBlock {
  type: "trend_insight";
  title: string;
  summary: string;
  affectedTickers: string[];
  articleCount: number;
}

interface TextBlock {
  type: "text";
  content: string;               // AI conversational response
}
```

**Visual mapping:**

```
AlertCard (critical):
┌─────────────────────────────────────────┐
│ 🔴 CRITICAL ALERT                       │
│ Tesla CEO Steps Down Effective Q3        │
│ Impact: ████████░░ -0.8 | Reuters        │
│ "This leadership change creates major    │
│  uncertainty for TSLA holders..."        │
│                                         │
│ TSLA is in your watchlist.              │
│ [View position] [Ask Orchestrator]      │
└─────────────────────────────────────────┘

NewsCard (standard):
┌─────────────────────────────────────────┐
│ 📰 Apple Announces New AI Features      │
│ Impact: ██████░░░░ +0.6 | CNBC | 2h ago│
│ "New AI features could drive upgrade    │
│  cycle and increase ASP..."             │
│ #AI #product-launch #bullish            │
│ [Read more]                             │
└─────────────────────────────────────────┘

TrendInsight:
┌─────────────────────────────────────────┐
│ 📊 TREND: Tech sector regulatory        │
│ pressure — 4 articles                    │
│ "Multiple sources report increased AI    │
│  regulation talk impacting AAPL, MSFT,   │
│  GOOGL"                                 │
│ [Details]                               │
└─────────────────────────────────────────┘
```

---

## 8. Conversational mode

When user types a question in News Agent chat:

```
User input + context → API route → Gemini/Claude → response
```

**Context sent with each question:**
- Last N analyzed articles (from store)
- User's watchlist (from config)
- User's question

**Example interactions:**
- "Summarize today's news for AAPL"
- "Is the TSLA news bad enough to worry about?"
- "What are the biggest events this week?"
- "Compare recent news sentiment for NVDA vs MSFT"

**Response format:** `TextBlock` — natural language, may reference
specific articles by headline.

---

## 9. File structure

```
stockpilot/
├── config.yaml                     ← MASTER CONFIG
├── .env.local                      ← API keys (gitignored)
│   FINNHUB_API_KEY=...
│   GEMINI_API_KEY=...
│   ANTHROPIC_API_KEY=...           (for later)
│
├── src/
│   ├── app/
│   │   ├── api/news/
│   │   │   ├── fetch/route.ts      ← triggers Finnhub fetch
│   │   │   ├── analyze/route.ts    ← triggers AI analysis
│   │   │   └── chat/route.ts       ← conversational Q&A
│   │   ├── dashboard/page.tsx
│   │   └── onboarding/page.tsx
│   │
│   ├── components/
│   │   ├── agents/
│   │   │   ├── AgentSidebar.tsx    ← round icons + badges
│   │   │   ├── AgentChat.tsx       ← chat container
│   │   │   └── news/
│   │   │       ├── NewsFeed.tsx    ← list of ChatBlocks
│   │   │       ├── NewsCard.tsx
│   │   │       ├── AlertCard.tsx
│   │   │       ├── TrendInsight.tsx
│   │   │       └── NewsInput.tsx
│   │   └── market/
│   │       ├── Chart.tsx
│   │       └── Watchlist.tsx
│   │
│   ├── lib/
│   │   ├── config.ts               ← loads & types config.yaml
│   │   ├── news/
│   │   │   ├── finnhub-client.ts   ← Finnhub API calls
│   │   │   ├── deduplicator.ts     ← step 3
│   │   │   ├── analyzer.ts         ← step 4 (AI call)
│   │   │   ├── formatter.ts        ← step 5 (→ ChatBlock[])
│   │   │   ├── scheduler.ts        ← interval from config
│   │   │   └── types.ts            ← all interfaces
│   │   └── ai/
│   │       ├── gemini.ts           ← Gemini API wrapper
│   │       └── claude.ts           ← Claude API wrapper (later)
│   │
│   └── store/
│       └── newsStore.ts            ← Zustand
│
├── fixtures/                       ← mock data for dev
│   └── finnhub-news.json
│
└── agents/                         ← system prompts (docs)
    └── NEWS_AGENT.md
```

---

## 10. Następne kroki

1. **✅ Walidacja** — tego dokumentu + config.yaml
2. **Założenie kont** — Finnhub (free key) + Gemini API key
3. **System prompt News Agenta** → `agents/NEWS_AGENT.md`
4. **Scaffold Next.js** + config loader
5. **finnhub-client.ts** — fetcher z real data
6. **UI** — AgentSidebar + NewsFeed (mock data → real data)
