# News Agent — Architektura i źródła danych

> Pierwszy agent do implementacji. Cel: dostarczać feed newsów finansowych
> dla obserwowanych tickerów, z analizą wpływu na cenę, wyświetlany
> jako interaktywny czat w workspace agentów.

---

## 1. Zaktualizowany layout — workspace agentów

```
┌──────────────────────────┬──────────────────────────────┐
│                          │  Agent Workspace             │
│   Market View            │                              │
│                          │  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐   │
│   • Chart (candlestick)  │  │📰│ │📊│ │💬│ │🎯│ │🎓│   │
│   • Order book           │  └──┘ └──┘ └──┘ └──┘ └──┘   │
│   • Watchlist             │  News Tech  Sent Orch Coach  │
│   • Position manager     │   ●3              ●1         │
│   • Trade execution      │                              │
│                          │  ┌────────────────────────┐  │
│                          │  │  News Agent             │  │
│                          │  │                        │  │
│                          │  │  [news feed messages]  │  │
│                          │  │  [interactive cards]   │  │
│                          │  │  [impact alerts]       │  │
│                          │  │                        │  │
│                          │  ├────────────────────────┤  │
│                          │  │  [  ask news agent  ]  │  │
│                          │  └────────────────────────┘  │
└──────────────────────────┴──────────────────────────────┘

Ikony agentów = okrągłe awatary z badge'em (liczba nieprzeczytanych).
Aktywny agent = podświetlony ring.
Klik na ikonę = przełączenie czatu (z zachowaniem scrolla).
```

---

## 2. Źródła danych — porównanie

### Tier 1: Rekomendowane na start

| API | Free tier | News? | Sentiment? | Rate limit | Uwagi |
|-----|-----------|-------|------------|------------|-------|
| **Finnhub** | Tak | ✅ Company news + market news | ✅ News sentiment (premium) | 60 req/min | **Najlepszy stosunek danych/cena.** 1 rok historii newsów. Company news per ticker. WebSocket dla live data. SDK dla JS/Python. |
| **Alpha Vantage** | Tak (klucz) | ✅ News + sentiment | ✅ Wbudowany sentiment scoring | 25 req/dzień (free) | Sentiment scores wbudowane w response. Ale 25 req/dzień to za mało na live app. |

### Tier 2: Dobre uzupełnienie

| API | Free tier | News? | Sentiment? | Rate limit | Uwagi |
|-----|-----------|-------|------------|------------|-------|
| **Marketaux** | Tak | ✅ 5000+ źródeł | ✅ Entity-level sentiment | 100 req/dzień (free) | NLP entity extraction — wykrywa które tickery są w artykule. Dobry jako secondary source. |
| **FMP** | Tak | ✅ Stock news, press releases | ❌ | 250 req/dzień | Silne na fundamentals i SEC filings. News endpoint daje headline + snippet + ticker. |
| **NewsData.io** | Tak | ✅ General + business | ✅ Sentiment analysis | 200 req/dzień | Szerszy zasięg (nie tylko finance). Filtry po kategorii, języku, kraju. |

### Tier 3: Specjalistyczne / do późniejszych faz

| API | Uwagi |
|-----|-------|
| **Polygon.io** | Najlepsze dane giełdowe (tick-by-tick), ale free tier: 5 req/min — za mało. News endpoint premium only. |
| **Benzinga** | Pro-grade news z categorization, ale płatny. |
| **EODHD** | Dobry sentiment + word weights per ticker, ale 5 API calls per request. |

### Rekomendacja

**Primary: Finnhub** — najhojniejszy free tier (60 req/min), dedykowany endpoint
`/company-news` per ticker, JSON z headline + summary + source + image.
Wystarczający na MVP i development.

**Secondary (Faza 2): Marketaux** — entity-level sentiment scoring.
Gdy Finnhub nie daje wystarczającego sentymentu, Marketaux go uzupełnia.

**Sentiment via Claude** — zamiast polegać na API sentiment scores, News Agent
używa Claude do analizy sentymentu artykułów. Daje lepszą kontrolę
i jakość niż gotowe scores z API.

---

## 3. Architektura News Agenta — krok po kroku

### 3.1 Ogólny flow

```
                    ┌─────────────┐
                    │  Watchlist   │  tickery które user obserwuje
                    └──────┬──────┘
                           │
                           ▼
                ┌─────────────────────┐
                │  1. DATA FETCHER    │  Next.js API route
                │     (server-side)   │  co 5 min (cron) lub on-demand
                └──────────┬──────────┘
                           │ raw articles JSON
                           ▼
                ┌─────────────────────┐
                │  2. DEDUPLICATOR    │  filtruje duplikaty
                │     + FILTER        │  i nierelevantne artykuły
                └──────────┬──────────┘
                           │ unique articles
                           ▼
                ┌─────────────────────┐
                │  3. CLAUDE ANALYST  │  Claude API call
                │     (News Agent)    │  analiza + sentiment + impact
                └──────────┬──────────┘
                           │ analyzed articles
                           ▼
                ┌─────────────────────┐
                │  4. FORMATTER       │  formatuje na ChatBlocks
                │     + PRIORITIZER   │  sortuje po impact/urgency
                └──────────┬──────────┘
                           │ ChatBlock[]
                           ▼
                ┌─────────────────────┐
                │  5. CHAT FEED       │  wyświetla w workspace
                │     + BADGE         │  aktualizuje badge count
                └─────────────────────┘
```

### 3.2 Krok 1 — Data Fetcher

**Co robi:** Pobiera surowe artykuły z Finnhub dla tickerów z watchlisty.

**Kiedy się odpala:**
- Automatycznie co 5 minut (server-side cron job / `setInterval` w dev)
- Na żądanie, gdy user doda nowy ticker do watchlisty
- Gdy user otworzy czat z News Agentem (fresh pull)

**Endpoint:** `GET /api/news/fetch`

**Logika:**
1. Pobierz listę tickerów z watchlisty usera
2. Dla każdego tickera → Finnhub `/company-news?symbol=X&from=YESTERDAY&to=TODAY`
3. Dodatkowo → Finnhub `/news?category=general` dla macro newsów
4. Zbierz wszystkie artykuły w jedną tablicę
5. Zapisz do in-memory store (lub localStorage na start)

**Finnhub response (per artykuł):**
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

**Rate limit management:**
- Finnhub: 60 req/min
- Przy 5 tickerach: 5 company-news + 1 general = 6 requestów per fetch
- Przy 20 tickerach: 20 + 1 = 21 requestów — wciąż OK
- Cache: nie rób ponownego fetcha jeśli ostatni był <5 min temu

---

### 3.3 Krok 2 — Deduplicator + Filter

**Co robi:** Czyści surowe dane zanim trafią do Claude.

**Logika:**
1. **Deduplikacja** — po `id` artykułu (Finnhub daje unikalne ID)
2. **Deduplikacja cross-ticker** — ten sam artykuł może pojawić się
   dla AAPL i MSFT jeśli dotyczy obu. Łączymy w jeden z tagami obu tickerów.
3. **Filtr czasowy** — odrzuć artykuły starsze niż 48h (chyba że user
   specjalnie pyta o starsze)
4. **Filtr jakości** — odrzuć artykuły z pustym `summary` lub `headline`
   krótszym niż 20 znaków (spam/glitch)
5. **Limit batch** — max 15 artykułów per batch do Claude
   (kontrola kosztów tokena)

**Output:** Oczyszczona tablica artykułów gotowa do analizy.

---

### 3.4 Krok 3 — Claude Analyst (serce News Agenta)

**Co robi:** Wysyła batch artykułów do Claude API z system promptem
News Agenta. Claude analizuje, ocenia wpływ, daje sentiment score.

**API call (Next.js API route → Claude):**

System prompt (skrót — pełna wersja w `agents/NEWS_AGENT.md`):
```
Jesteś News Agent — ekspert od analizy finansowych newsów.

Dostajesz batch artykułów i kontekst portfela użytkownika.

Dla każdego artykułu:
1. Oceń IMPACT SCORE (-1.0 do +1.0) na cenę tickera
2. Określ CATEGORIĘ (earnings, macro, sector, company, regulatory)
3. Napisz INTERPRETACJĘ — 2-3 zdania co to znaczy dla inwestora
4. Określ URGENCY (low, medium, high, critical)
5. Jeśli artykuł dotyczy tickera w portfelu usera, zaznacz to

Dodatkowo:
- Jeśli widzisz pattern w wielu artykułach (np. cały sektor w dół),
  wygeneruj SUMMARY INSIGHT
- Jeśli jest artykuł CRITICAL (earnings miss, CEO resign, regulatory
  action), oznacz go do natychmiastowej notyfikacji

Odpowiedz w JSON.
```

**Claude response (per artykuł):**
```json
{
  "articleId": 123456,
  "ticker": "AAPL",
  "impactScore": 0.6,
  "category": "company",
  "urgency": "medium",
  "interpretation": "Apple's new AI features could drive upgrade cycle...",
  "affectsPortfolio": true,
  "tags": ["AI", "product-launch", "bullish"]
}
```

**Kiedy wywoływać Claude:**
- Nowy batch artykułów po fetch (co 5 min)
- Gdy user zadaje pytanie w czacie News Agenta
- NIE wywoływać jeśli batch jest identyczny jak poprzedni (cache)

**Optymalizacja kosztów:**
- Batch artykuły w jednym callu (nie 1 call per artykuł)
- Używaj `claude-sonnet-4-20250514` (tańszy, wystarczający na news analysis)
- Cache wyników — ten sam artykuł nie jest analizowany dwa razy
- Limit 15 artykułów per batch ≈ ~2000 tokenów input + ~1500 output

---

### 3.5 Krok 4 — Formatter + Prioritizer

**Co robi:** Konwertuje przeanalizowane artykuły na `ChatBlock[]`
i sortuje po priorytecie.

**Logika sortowania:**
1. **Critical** → na górze, z alert badge
2. **High + affects portfolio** → następne
3. **High** → dalej
4. **Medium** → standardowy feed
5. **Low** → zwinięte pod "więcej newsów"

**Typy ChatBlocków generowanych:**

```
┌─────────────────────────────────────────┐
│ 🔴 CRITICAL ALERT                       │
│ Tesla CEO Steps Down Effective Q3        │
│ Impact: -0.8 | Source: Reuters           │
│ "This leadership change creates major    │
│  uncertainty for TSLA holders..."        │
│                                         │
│ TSLA jest w Twoim portfelu.             │
│ [Zobacz pozycję] [Zapytaj Orchestrator] │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📰 Apple Announces New AI Features      │
│ Impact: +0.6 ●●●○○ | CNBC | 2h ago    │
│ "New AI features could drive upgrade    │
│  cycle and increase ASP..."             │
│ #AI #product-launch #bullish            │
│ [Czytaj więcej] [Dodaj do watchlist]    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📊 TREND INSIGHT                        │
│ 4 artykuły wskazują na presję w         │
│ sektorze tech z powodu regulacji AI     │
│ Dotknięte tickery: AAPL, MSFT, GOOGL   │
│ [Szczegóły] [Analizuj wpływ]           │
└─────────────────────────────────────────┘
```

---

### 3.6 Krok 5 — Chat Feed + Badge

**Co robi:** Wyświetla ChatBlocki w workspace agenta + zarządza badge'ami.

**Badge logic:**
- Nowe artykuły po analizie → inkrementuj badge na ikonie News Agenta
- User otwiera czat News Agenta → badge = 0
- Critical alert → badge kolor zmienia się na czerwony
- Standardowe wiadomości → badge kolor niebieski

**Interakcje w czacie:**

Użytkownik może:
- **Scrollować feed** — chronologicznie, najnowsze na dole
- **Kliknąć "Czytaj więcej"** — otwiera oryginalny artykuł w nowej karcie
- **Kliknąć "Zapytaj Orchestrator"** — przekierowuje pytanie do Orchestratora
  z kontekstem artykułu (cross-agent communication — Faza 2)
- **Napisać pytanie** — np. "Co ten news znaczy dla mojego portfela?"
  → Claude odpowiada z kontekstem artykułu + portfela

**Pytania użytkownika (conversational mode):**

Gdy user pisze w czacie, News Agent przechodzi w tryb konwersacyjny:
1. Wiadomość usera + kontekst (ostatnie artykuły + portfel) → Claude
2. Claude odpowiada naturalnie, powołując się na konkretne artykuły
3. Może generować dodatkowe ChatBlocki (np. mini-chart porównawczy)

Przykłady pytań:
- "Podsumuj dzisiejsze newsy dla AAPL"
- "Czy te newsy o regulacjach wpływają na moje pozycje?"
- "Jakie są najważniejsze eventy w tym tygodniu?"
- "Porównaj sentyment TSLA vs NVDA na podstawie newsów"

---

## 4. Dane Finnhub — endpointy które wykorzystamy

```
# Newsy per ticker (primary)
GET /company-news?symbol=AAPL&from=2026-03-10&to=2026-03-11

# Newsy ogólne (macro context)
GET /news?category=general

# Earnings calendar (uzupełnienie — wiemy kiedy są wyniki)
GET /calendar/earnings?from=2026-03-10&to=2026-03-17

# Cena aktualna (do kontekstu w analizie)
GET /quote?symbol=AAPL

# Rekomendacje analityków (dodatkowy sygnał)
GET /recommendation?symbol=AAPL
```

Wszystko na free tier, z zapasem w rate limicie.

---

## 5. Struktura plików (Next.js)

```
src/
├── app/
│   ├── api/
│   │   └── news/
│   │       ├── fetch/route.ts      ← cron fetch z Finnhub
│   │       └── analyze/route.ts    ← wysyłka do Claude
│   ├── dashboard/
│   │   └── page.tsx                ← główny layout
│   └── onboarding/
│       └── page.tsx
├── components/
│   ├── agents/
│   │   ├── AgentSidebar.tsx        ← okrągłe ikony + badge
│   │   ├── AgentChat.tsx           ← kontener czatu
│   │   └── NewsAgent/
│   │       ├── NewsFeed.tsx        ← lista ChatBlocków
│   │       ├── NewsCard.tsx        ← pojedynczy news
│   │       ├── AlertCard.tsx       ← critical alert
│   │       ├── TrendInsight.tsx    ← pattern summary
│   │       └── NewsInput.tsx       ← pole do pytań
│   └── market/
│       ├── Chart.tsx
│       ├── Watchlist.tsx
│       └── OrderBook.tsx
├── lib/
│   ├── finnhub.ts                  ← Finnhub API client
│   ├── claude.ts                   ← Claude API wrapper
│   └── news/
│       ├── fetcher.ts              ← krok 1
│       ├── deduplicator.ts         ← krok 2
│       ├── analyzer.ts             ← krok 3 (Claude call)
│       ├── formatter.ts            ← krok 4
│       └── types.ts                ← interfejsy
├── store/
│   └── newsStore.ts                ← stan newsów (Zustand)
└── agents/
    └── news-agent-prompt.ts        ← system prompt News Agenta
```

---

## 6. Otwarte pytania do News Agenta

| # | Pytanie | Rekomendacja |
|---|---------|-------------|
| 1 | Jak często fetchować newsy? | Co 5 min automatycznie + on-demand per ticker. W dev: manual trigger. |
| 2 | Ile artykułów trzymać w pamięci? | Ostatnie 48h. Starsze archiwizować / usuwać. |
| 3 | Język artykułów? | EN only na start. Finnhub ma głównie anglojęzyczne źródła. |
| 4 | Czy News Agent odpowiada po polsku? | System prompt w EN, ale jeśli user pisze po polsku → odpowiedź po polsku. |
| 5 | Ile kosztuje Claude per batch? | ~15 artykułów × Sonnet ≈ $0.01-0.02 per batch. Przy fetchu co 5 min = ~$3-6/dzień. Cache redukuje to znacząco. |

---

## 7. Następne kroki

1. **Walidacja tego dokumentu** — uwagi, zmiany
2. **Założenie konta Finnhub** — klucz API (free tier)
3. **Pisanie system promptu** News Agenta (`agents/NEWS_AGENT.md`)
4. **Scaffold projektu** — Next.js + podstawowa struktura
5. **Implementacja Krok 1-2** — fetcher + deduplicator (bez Claude)
6. **Implementacja Krok 3-5** — Claude analysis + feed UI
