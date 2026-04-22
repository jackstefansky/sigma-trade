# Przepływ danych — 3 scenariusze

Każdy scenariusz to sekwencja numerowana. Otwórz VS Code obok i śledź w kodzie każdy krok.

---

## Scenariusz 1: User otwiera stronę (pierwsze załadowanie)

**1. Przeglądarka wysyła request `GET /`**

`src/app/page.tsx` — Server Component. Zawiera tylko jedną linię: `redirect('/dashboard')`. Next.js przekierowuje na `/dashboard`.

**2. Next.js renderuje `dashboard/page.tsx` na serwerze**

`src/app/dashboard/page.tsx` — to jest **Server Component** (brak `'use client'`). Wykonuje się tylko raz, na serwerze, przed wysłaniem HTML do przeglądarki.

Pierwsza rzecz którą robi: `const config = loadConfig()`.

**3. `loadConfig()` czyta `config.yaml` z dysku**

`src/lib/config.ts`, linia 59. Sprawdza czy `cached !== null` — pierwsze wywołanie, więc nie ma cache. Używa `fs.readFileSync` (Node.js, niedostępny w przeglądarce) do odczytania pliku `config.yaml` z głównego katalogu projektu. Parsuje YAML przez bibliotekę `yaml`. Zapisuje do `cached` i zwraca.

Przy kolejnych wywołaniach (np. gdy Next.js pre-renderuje inne strony) — zwraca ten sam obiekt z pamięci. To jest **singleton pattern**.

**4. Server Component buduje listę agentów i renderuje JSX**

`dashboard/page.tsx`, linia 11–47: buduje tablicę `agents` z metadanymi (name, enabled, badgeCount). Renderuje layout z `<MarketView tickers={tickers} />` i `<NewsFeed ... />`.

**5. HTML trafia do przeglądarki, React hydration**

Next.js wysyła gotowy HTML. Przeglądarka go wyświetla (natychmiastowe First Paint). Potem React „hydratuje" Client Components — uruchamia JavaScript, podłącza event handlery.

**6. `MarketView` montuje się, inicjalizuje activeTicker**

`src/components/market/MarketView.tsx`, linia 37–41:
```tsx
useEffect(() => {
  if (tickers.length > 0 && !activeTicker) {
    setActiveTicker(tickers[0].symbol);  // np. 'AAPL'
  }
}, [tickers, activeTicker, setActiveTicker]);
```
Ustawia pierwszy ticker z watchlisty jako aktywny w `chartStore`.

**7. Drugi `useEffect` w `MarketView` odpala fetch chartów**

`src/components/market/MarketView.tsx`, linia 44–66: widzi że `activeTicker` się zmieniło, sprawdza cache (`candleCache['AAPL:1M']` nie istnieje), wywołuje `fetch('/api/chart?symbol=AAPL&timeframe=1M')`.

**8. `NewsFeed` montuje się, `useNewsFetch` odpala pierwszego fetcha**

`src/hooks/useNewsFetch.ts`, linia 47–54: `useEffect` z `[]` odpala `fetchNow()` od razu przy mount. Jeśli `autoFetch: true`, ustawia też `setInterval`.

**9. Oba flarety w końcu docierają do API routes i wracają dane**

Szczegóły API routes — patrz Scenariusz 2 i 3.

---

## Scenariusz 2: User klika ticker „MSFT" w sidebarze

**1. Klik → `setActiveTicker('MSFT')` w chartStore**

`src/components/market/TickerSidebar.tsx`, linia 13:
```tsx
const setActiveTicker = useChartStore((s) => s.setActiveTicker);
```
onClick wywołuje `setActiveTicker(ticker.symbol)`.

**2. Zustand aktualizuje `activeTicker` w store**

`src/store/chartStore.ts`, linia 38: `setActiveTicker: (ticker) => set({ activeTicker: ticker })`.

Zustand powiadamia wszystkie komponenty które subskrybują `activeTicker`. W tym przypadku: `MarketView`, `TickerSidebar`, `ChartHeader`.

**3. `TickerSidebar` rerenderuje — MSFT dostaje klasę aktywną**

Podświetlenie zmienia się natychmiastowo — `activeTicker` jest już w store, nie trzeba czekać na fetch.

**4. `MarketView` rerenderuje, `useEffect([activeTicker, timeframe])` odpala**

`src/components/market/MarketView.tsx`, linia 44:
```tsx
useEffect(() => {
  if (!activeTicker) return;
  const cacheKey = `${activeTicker}:${timeframe}`;  // 'MSFT:1M'
  if (candleCache[cacheKey]) return;  // czy jest w cache?
  ...
  fetch(`/api/chart?symbol=MSFT&timeframe=1M`)
```
Jeśli user wcześniej przeglądał MSFT — dane są w cache i fetch **nie odpala się**. Jeśli pierwszy raz — fetch idzie.

**5. `setLoading(true)` → `StockChart` pokazuje skeleton**

`src/components/market/MarketView.tsx`, linia 49. Stan loading trafia do `chartStore`. `StockChart` dostaje `isLoading={true && candles.length === 0}` — wyświetla skeleton overlay.

**6. Request trafia do `GET /api/chart?symbol=MSFT&timeframe=1M`**

`src/app/api/chart/route.ts`, linia 17. Sprawdza in-memory cache serwera (5 minut TTL). Jeśli brak — wywołuje równolegle:
```ts
const [candlesResult, quoteResult] = await Promise.allSettled([
  fetchCandles('MSFT', '1M'),
  fetchQuote('MSFT'),
]);
```

**7. `fetchCandles` wysyła request do Twelve Data**

`src/lib/chart/dataSource.ts`, linia 39. Konfiguracja dla `'1M'`: `interval: '1day', outputsize: 30`. Twelve Data zwraca 30 dziennych świec, od najnowszej do najstarszej. Funkcja odwraca tablicę (`.reverse()`), parsuje daty na Unix timestamp w sekundach, konwertuje stringi na floaty.

**8. `fetchQuote` wysyła request do Finnhub**

`src/lib/chart/dataSource.ts`, linia 83. Finnhub `/quote` zwraca `{ c, d, dp, h, l, o, pc }` (skrócone nazwy pól). Funkcja mapuje to na czytelny interfejs `QuoteData`.

**9. Jeśli Twelve Data failuje — fallback na mock data**

`src/app/api/chart/route.ts`, linia 41–48: `candlesResult.status === 'rejected'` → `generateMockCandles('MSFT', '1M')`. Ustawia `usingMockData: true`. Quote może być null jeśli Finnhub też failuje.

**10. API zwraca `ChartApiResponse`, `MarketView` aktualizuje store**

`src/components/market/MarketView.tsx`, linia 57–60:
```ts
setCandleCache('MSFT:1M', data.candles);
if (data.quote) setQuoteCache('MSFT', data.quote);
setUsingMockData(data.usingMockData);
```
`setLoading(false)` odpala rerenderowanie. Skeleton znika, pojawia się wykres.

**11. `StockChart` dostaje nowe `data` → `useEffect([data])` odpala `setData`**

`src/components/market/StockChart.tsx`, linia 166–172:
```ts
useEffect(() => {
  if (!seriesRef.current || data.length === 0) return;
  seriesRef.current.setData(
    chartType === 'candle' ? toCandleData(data) : toAreaData(data),
  );
  chartRef.current?.timeScale().fitContent();
}, [data]);
```
Lightweight Charts przerysowuje wykres.

**12. `ChartHeader` dostaje nowe `quote` → wyświetla cenę MSFT**

`src/components/market/ChartHeader.tsx` renderuje `$420.15 +2.34 (+0.56%)`.

---

## Scenariusz 3: User klika artykuł (analiza AI)

**1. Klik na artykuł → `handleClick()` w `ArticleCard`**

`src/components/agents/NewsFeed.tsx`, linia 71–75:
```ts
function handleClick() {
  onRead(article.id);       // markRead w newsStore
  if (!isAnalyzed && !isAnalyzing) {
    onAnalyze(article);     // wysyła do Gemini
  }
}
```
`isAnalyzed` sprawdza `article.tags.length > 0`. Artykuł po fetchu z Finnhub ma `tags: []` — więc trigger analizy odpali się.

**2. `markRead(id)` aktualizuje newsStore**

`src/lib/store/newsStore.ts`, linia 97–100. Dodaje `id` do `readIds: Set<number>`. Store przelicza `unreadCount` i `criticalCount`. `AgentSidebar` rerenderuje, zmniejsza badge.

**3. `handleAnalyze(article)` uruchamia się**

`src/components/agents/NewsFeed.tsx`, linia 265. Czyści poprzedni błąd dla tego artykułu, dodaje `article.id` do `analyzingIds`. Artykuł pokazuje spinner `<Loader2 animate-spin>`.

**4. `POST /api/news/analyze` z body `{ article }`**

Request idzie do `src/app/api/news/analyze/route.ts`.

**5. Route pobiera pełną treść artykułu przez scraping**

`src/app/api/news/analyze/route.ts`, linia 15–55:
```ts
async function fetchArticleContent(url: string): Promise<string>
```
Wysyła GET do URL artykułu z User-Agent przeglądarki (żeby paywalle go wpuściły). Dostaje HTML, strippuje tagi `<script>` i `<style>`, usuwa wszystkie tagi HTML, decode'uje HTML entities (`&nbsp;` → spacja), przycina do 3000 znaków.

**6. Wzbogacony artykuł trafia do `analyzeArticles()`**

`src/lib/news/analyzer.ts`, linia 180. Buduje prompt — JSON z id, headline, summary (teraz pełna treść ze scrapingu), tickers. Wysyła do Gemini.

Format promptu (linia 55–73): szczegółowa instrukcja co ma zwrócić — JSON array z `impactScore`, `category`, `urgency`, `interpretation`, `affectsPortfolio`, `tags`. Prompt mówi „Return ONLY the raw JSON array. No markdown" — ale Gemini często i tak opakowuje w `` ```json ``` ``.

**7. `extractJson()` wyciąga JSON z odpowiedzi**

`src/lib/news/analyzer.ts`, linia 80–85: regex sprawdza czy response jest owrapowany w code fence i wyciąga zawartość. Defensywne programowanie.

**8. AI wyniki są mapowane na `AnalyzedArticle` po `id`**

`src/lib/news/analyzer.ts`, linia 204–223:
```ts
const aiMap = new Map<number, AIAnalysisItem>(aiResults.map((r) => [r.id, r]));
return articles.map((article) => {
  const ai = aiMap.get(article.id);
  if (!ai) return fallbackAnalysis(article);
  return { ...article, impactScore: Math.max(-1, Math.min(1, ai.impactScore)), ... };
});
```
`impactScore` jest clamped do `[-1, 1]` — ochrona przed AI które zwróciło np. `1.5`.

**9. Route zwraca `{ article: AnalyzedArticle }`**

Jeśli Gemini odpowie 429 (rate limit) — route zwraca `{ status: 429, error: 'rate_limit' }`.

**10. `handleAnalyze` dostaje response, wywołuje `updateArticle`**

`src/components/agents/NewsFeed.tsx`, linia 279: `updateArticle(data.article)` → `newsStore` aktualizuje artykuł w tablicy `articles`. Usuwa `article.id` z `analyzingIds`.

**11. `ArticleCard` rerenderuje z nową analizą**

Teraz `article.tags.length > 0` → `isAnalyzed = true`. Pojawia się `<AiAnalysisBlock>` z interpretation, urgency badge z kolorem, impact score z tooltipem.

---

## Skąd wiedzieć że `isAnalyzed === true`?

To jest ciekawy detal. Nie ma flagi `analyzed: boolean` w typach. Zamiast tego:

```ts
// src/components/agents/NewsFeed.tsx, linia 67
const isAnalyzed = article.tags.length > 0;
```

Fallback (artykuł bez analizy) zawsze ma `tags: []`. Prawdziwa analiza AI zawsze zwraca co najmniej 1 tag. To implicit convention — działa, ale jest trochę hacky. Na rozmowie możesz powiedzieć „zrobiłbym to lepiej przez osobne pole `analyzedAt: Date | null`".
