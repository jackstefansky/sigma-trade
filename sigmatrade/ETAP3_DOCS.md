# StockPilot AI — Etap 3: Dokumentacja

Wszystkie pliki stworzone lub zmodyfikowane w Etapie 3.

---

## Przepływ danych (end-to-end)

```
config.yaml
  └── fetch_interval_seconds, auto_fetch, include_market_news
        └── dashboard/page.tsx (Server Component)
              └── <NewsFeed intervalSeconds autoFetch />
                    └── useNewsFetch (Client hook)
                          └── POST /api/news/fetch
                                └── Finnhub API → RawArticle[] → fallback AnalyzedArticle[]
                          └── newsStore.addArticles()
                                └── NewsFeed re-render (lista artykułów)

  Kliknięcie artykułu:
    ArticleCard.handleClick()
      └── newsStore.markRead(id)
      └── POST /api/news/analyze  { article }
            └── analyzer.ts → Gemini / Claude API
            └── { article: AnalyzedArticle }
      └── newsStore.updateArticle(article)
            └── ArticleCard re-render (realne impactScore, urgency, interpretation)
```

---

## 1. `src/lib/news/types.ts`

**Co robi:** Źródło prawdy dla wszystkich typów w pipeline'u News Agenta.

**Kluczowe typy:**

```ts
FinnhubArticle    // surowa odpowiedź z Finnhub API (datetime w sekundach)
RawArticle        // po normalizacji (datetime → publishedAt w ms, tickers: string[])
AnalyzedArticle   // extends RawArticle + pola AI: impactScore, urgency, interpretation, tags
ArticleCategory   // 'earnings' | 'macro' | 'sector' | 'company' | 'regulatory'
Urgency           // 'low' | 'medium' | 'high' | 'critical'
NewsAgentConfig   // zrzut sekcji news_agent z config.yaml
WatchlistTicker   // { symbol, name, sector }
```

**Sygnał "przeanalizowany przez AI":** `tags.length > 0`
- `tags: []` → artykuł z fallbackiem (nie analizowany)
- `tags: ['...']` → realna analiza AI

---

## 2. `src/lib/store/newsStore.ts`

**Co robi:** Zustand store — centralne miejsce stanu News Agenta.

**Stan:**

```ts
articles: AnalyzedArticle[]   // wszystkie artykuły, nowe na górze
readIds: Set<number>           // id artykułów klikniętych przez usera
unreadCount: number            // computed automatycznie
criticalCount: number          // unread z urgency === 'critical'
fetchStatus: 'idle' | 'fetching' | 'error'
lastFetchedAt: number | null   // timestamp ms ostatniego udanego fetcha
errorMessage: string | null
```

**Akcje:**

```ts
addArticles(incoming)
// Dedup + merge: nowe ID → na górę listy, istniejące ID → update in-place
// Używane gdy nowe artykuły przychodzą z /api/news/fetch

updateArticle(article)
// Zastępuje jeden artykuł po id — używane po on-demand AI analizie
// Nie zmienia kolejności na liście

markRead(id)        // dodaje do readIds, przelicza badge
markAllRead()       // czyści unreadCount i criticalCount
setFetchStatus()    // ustawia fetchStatus + errorMessage
clearArticles()     // reset całego stanu
```

**Selektory (mniej re-renderów):**

```ts
export const selectUnreadCount   = (s) => s.unreadCount;
export const selectCriticalCount = (s) => s.criticalCount;
export const selectArticles      = (s) => s.articles;
export const selectFetchStatus   = (s) => s.fetchStatus;
export const selectLastFetchedAt = (s) => s.lastFetchedAt;
```

---

## 3. `src/lib/news/analyzer.ts`

**Co robi:** Server-only moduł. Przyjmuje `RawArticle[]`, wysyła do Gemini lub Claude, zwraca `AnalyzedArticle[]`.

**Kluczowe elementy:**

```ts
// RateLimitError — osobna klasa dla 429, propagowana do route
export class RateLimitError extends Error { ... }
// Route łapie ją i zwraca 429 do klienta, inne błędy idą do fallbacku
```

```ts
// extractJson — stripuje markdown code fences z odpowiedzi AI
// Gemini/Claude czasem opakowują JSON w ```json ... ``` mimo instrukcji
function extractJson(raw: string): string {
  const match = stripped.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
  return match ? match[1].trim() : stripped;
}
```

```ts
// callGemini — raw fetch, bez SDK
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
// Odpowiedź: candidates[0].content.parts[0].text → extractJson → JSON.parse
// 429 → throw RateLimitError (nie retryuje — każda próba pali quota)

// callClaude — raw fetch, bez SDK
// Headers: x-api-key, anthropic-version: '2023-06-01'
// Odpowiedź: content[].find(b => b.type === 'text').text → extractJson → JSON.parse
// 429 → throw RateLimitError
```

```ts
// fallbackAnalysis — gdy AI failuje (sieć, 500, zły JSON)
// tags: [] ← kluczowe: sygnalizuje brak AI analizy w UI
{ impactScore: 0, urgency: 'low', interpretation: 'AI analysis unavailable.', tags: [] }
```

```ts
// Po AI: merge wyników po id + clamp impactScore do [-1, 1]
const aiMap = new Map(aiResults.map(r => [r.id, r]));
return articles.map(article => ({ ...article, ...aiMap.get(article.id) }));
```

**Prompt:** artykuły okrojone do `id + headline + summary (max 300 znaków) + tickers`. AI dostaje watchlist żeby wiedział co to `affectsPortfolio`.

---

## 4. `src/app/api/news/fetch/route.ts`

**Co robi:** `POST /api/news/fetch` — pipeline Finnhub → normalize → dedup → fallback artykuły. **Bez AI** — analiza odbywa się on-demand przy kliknięciu.

**Kluczowe:**

```ts
// normalize: FinnhubArticle → RawArticle
publishedAt: raw.datetime * 1000  // Finnhub daje sekundy, store chce ms

// dedup: ten sam artykuł dla AAPL i MSFT → jeden obiekt, oba tickery
const merged = new Set([...existing.tickers, ...article.tickers]);

// include_market_news: true → fetchuje też /news?category=general (ticker: 'MARKET')

// Zwraca artykuły przez rawToAnalyzed() — tags: [], impactScore: 0, bez AI
// Analiza następuje dopiero przy kliknięciu (POST /api/news/analyze)
```

---

## 5. `src/app/api/news/analyze/route.ts` *(nowy)*

**Co robi:** `POST /api/news/analyze` — analizuje **jeden** artykuł on-demand (przy kliknięciu w UI).

**Request body:** `{ article: RawArticle }`
**Response sukces:** `{ article: AnalyzedArticle }`
**Response rate limit:** `{ error: 'rate_limit', message }` + status 429

```ts
// Wywołuje analyzeArticles([body.article]) — tablica z 1 elementem
// RateLimitError → 429 do klienta (UI pokazuje error per artykuł)
// Inne błędy → 500 + console.error
```

**Dlaczego on-demand a nie batch przy fetchu:**
- 1 artykuł = mały prompt = mniej tokenów = mniej szans na rate limit
- User kontroluje które artykuły analizować
- Fetch działa natychmiast (zero czekania na AI)

---

## 6. `src/hooks/useNewsFetch.ts`

**Co robi:** Client hook. Wywołuje `POST /api/news/fetch` przy montowaniu, ustawia `setInterval` dla auto-fetch, zapisuje wyniki do store.

**Kluczowe:**

```ts
// isFetchingRef — zapobiega równoległym fetchom (interval + kliknięcie)
const isFetchingRef = useRef(false);
if (isFetchingRef.current) return;

// useEffect — fetch przy mount + opcjonalny interval
void fetchNow();
const id = setInterval(() => void fetchNow(), intervalSeconds * 1000);
return () => clearInterval(id); // cleanup przy odmontowaniu
```

---

## 7. `src/components/agents/NewsFeed.tsx`

**Co robi:** Client Component. Renderuje listę artykułów z store, obsługuje kliknięcie (mark as read + trigger AI analyze), pokazuje stan analizy per artykuł.

**Kluczowe:**

```ts
// isAnalyzed — oparty o tags.length > 0 (pewny sygnał realnej AI)
// NIE używaj interpretation !== '' — stare fallbacki mają niepusty string
const isAnalyzed = article.tags.length > 0;
```

```ts
// Stan per artykuł — trzymany w NewsFeed (rodzic), nie w ArticleCard
const [analyzingIds, setAnalyzingIds] = useState<Set<number>>(new Set());
const [analyzeErrors, setAnalyzeErrors] = useState<Map<number, string>>(new Map());
```

```ts
// handleAnalyze — wywołany przy kliknięciu nieanalyzeowanego artykułu
// 1. Czyści poprzedni błąd, dodaje id do analyzingIds → spinner
// 2. POST /api/news/analyze
// 3. OK  → updateArticle() w store → re-render z realną analizą
// 4. 429 → pokazuje "Rate limited — spróbuj za chwilę" pod headlinem
// 5. finally → usuwa z analyzingIds (spinner znika)
```

```ts
// Opacity: szarzeje dopiero po analizie (nie podczas niej)
isRead && !isAnalyzing ? 'opacity-50' : 'opacity-100'
```

**Stany artykułu w UI:**

| Stan | Wyświetlanie |
|------|-------------|
| Nie analizowany | `✦ Click to analyze`, impact bar pusta |
| Analizowanie | `⟳ Analyzing…` (spinner), pełna widoczność mimo read |
| Zanalizowany | interpretacja AI, kolorowa impact bar, urgency badge |
| Błąd (429 etc.) | `⚠ Rate limited — spróbuj za chwilę` |

```ts
// Impact bar — widoczna tylko gdy isAnalyzed
if (score >= 0.3)  return 'bg-accent';   // bullish — zielony
if (score <= -0.3) return 'bg-red-500';  // bearish — czerwony
return 'bg-gray-600';                    // neutralny
// Szerokość: Math.abs(score) * 100 → 0–100%
```

---

## 8. `src/components/agents/AgentSidebar.tsx` *(zmodyfikowany)*

**Co robi:** Sidebar z 5 awatarami agentów. Badge dla News Agenta pochodzi z Zustand store (live), nie z props z Server Component.

```ts
// Live badge — czyta ze store, nie z props
const newsUnread   = useNewsStore(selectUnreadCount);
const newsCritical = useNewsStore(selectCriticalCount);

// Dla id === 'news': live dane; dla pozostałych: props (zawsze 0)
const badgeCount   = agent.id === 'news' ? newsUnread   : agent.badgeCount;
const badgeVariant = agent.id === 'news'
  ? (newsCritical > 0 ? 'critical' : 'default')
  : agent.badgeVariant;

// 'critical' → bg-red-500 (są unread z urgency critical)
// 'default'  → bg-blue-500
```

---

## 9. `src/app/dashboard/page.tsx` *(zmodyfikowany)*

**Co robi:** Async Server Component. Czyta config, składa layout, przekazuje props do klientów.

```tsx
// badgeCount: 0 — live badge obsługiwany przez AgentSidebar + store
{ id: 'news', enabled: features.news_agent.enabled, badgeCount: 0 }

// NewsFeed dostaje tylko wartości z config — NIE czyta configa po stronie klienta
<NewsFeed
  intervalSeconds={features.news_agent.fetch_interval_seconds}
  autoFetch={features.news_agent.auto_fetch}
/>
```

---

## Wymagane zmienne środowiskowe

| Zmienna | Kiedy potrzebna |
|---------|----------------|
| `FINNHUB_API_KEY` | zawsze (bez niej route zwraca 500) |
| `GEMINI_API_KEY` | gdy `ai_provider.provider: gemini` |
| `ANTHROPIC_API_KEY` | gdy `ai_provider.provider: claude` |

Utwórz `.env.local` w root projektu. **Po zmianie klucza: restart dev servera** (`Ctrl+C` → `npm run dev`).

---

## Znane pułapki i ich fixy

| Problem | Przyczyna | Fix |
|---------|-----------|-----|
| Artykuły wyświetlają 0% po kolejnym fetchu | `addArticles` traktował re-fetch jako duplikat i ignorował | Update in-place po id (nowe ID → góra, istniejące → podmiana) |
| `AI analysis unavailable.` mimo działającego klucza | Gemini zwraca JSON w ` ```json ``` ` → `JSON.parse` failuje | `extractJson()` stripuje code fences przed parsowaniem |
| Click to analyze nie triggeruje analizy | `isAnalyzed` oparty o `interpretation !== ''` — stare fallbacki mają niepusty string | Zmiana na `tags.length > 0` |
| Rate limit 429 przy każdym requescie | Free tier: 1 500 req/dzień, wyczerpane podczas debugowania | Nowy projekt GCP lub włączenie billingu |
| Artykuł szarzeje i nie widać spinnera | `opacity-50` na read tłumiło cały content łącznie ze spinnerem | `isRead && !isAnalyzing ? 'opacity-50' : 'opacity-100'` |
| `RateLimitError` jako czerwony error w konsoli | `console.error` dla wszystkich błędów w catch | `console.warn` dla rate limit, `console.error` dla reszty |
