# Odpowiedzi

Sprawdź je po tym jak napisałeś swoje odpowiedzi. Każda odpowiedź wyjaśnia nie tylko co ale dlaczego.

---

## EASY

**1.** `src/lib/news/types.ts`. Zawiera: `FinnhubArticle` (raw API), `RawArticle` (znormalizowany), `AnalyzedArticle` (po AI), `ChatBlock` union (do UI). Jeden import dla całego pipeline.

**2.** `'use client'` oznacza że komponent jest **Client Component** — renderuje się zarówno na serwerze (initial HTML), jak i w przeglądarce (po hydration). Może używać `useState`, `useEffect`, event handlerów, Web APIs. Bez tej linii komponent jest **Server Component** — renderuje się tylko na serwerze, nie może używać żadnych hooks ani event handlerów. Domyślnie w App Router wszystko jest Server Component.

**3.** `loadConfig()` używa `fs` — modułu Node.js. Node.js istnieje tylko na serwerze. `dashboard/page.tsx` jest Server Component (brak `'use client'`), wykonuje się na serwerze, `fs` jest dostępne. `MarketView.tsx` ma `'use client'` — jest Client Component, część kodu wykonuje się w przeglądarce (gdzie nie ma `fs`). Gdyby `MarketView` próbował importować `loadConfig`, dostałby błąd przy build: `Module not found: Can't resolve 'fs'`.

**4.** **Finnhub** — artykuły newsowe (`/company-news`, `/news`) oraz aktualne ceny akcji (`/quote`). **Twelve Data** — historyczne świece OHLCV (`/time_series`) dla wykresów. Finnhub jest też używany do candles historycznych ale na free tier jest zablokowany dla `/stock/candle` — stąd Twelve Data dla historii.

**5.** `cn()` to funkcja która łączy `clsx` (warunkowe łączenie klas) i `tailwind-merge` (deduplikacja klas Tailwind). `clsx` sam w sobie przy `cn('p-2 p-4')` zwróciłby `'p-2 p-4'` — dwa padding, CSS wybrałby ostatni. `tailwind-merge` wie że `p-2` i `p-4` są konfliktujące i zwróci tylko `'p-4'`. To ważne gdy przekazujesz klasy przez props (np. `className` prop) i chcesz nadpisać domyślne klasy komponentu.

**6.** `activeTicker` to string z symbolem aktualnie wybranego tickera (np. `'AAPL'`). Inicjalizowany jest w `MarketView.tsx`, linia 37–41, w `useEffect` który odpala przy mount. Bierze `tickers[0].symbol` z props (lista z config.yaml). Zmieniany przez `setActiveTicker` gdy user kliknie ticker w `TickerSidebar`.

**7.** `isFetchingRef` to guard przeciwko uruchomieniu dwóch równoległych fetchów. Jeśli `fetchNow()` jest wywołane gdy poprzedni fetch jeszcze trwa — natychmiast zwraca bez robienia czegokolwiek. `useRef` zamiast `useState`: zmiana `useRef.current` **nie powoduje rerenderowania** komponentu. Tu nie potrzebujemy rerenderowania — potrzebujemy tylko flagi. Gdyby to był `useState`, każde `setIsFetching(true/false)` trigggerowałoby rerender.

**8.** `impactScoreTooltip(0.8)` → `abs = 0.8 >= 0.7` → `"Strongly bullish — high-conviction positive signal."` + opis skali. `impactScoreTooltip(-0.1)` → `abs = 0.1 < 0.2` → `"Neutral — no significant price movement expected."` Logika jest oparta na wartości absolutnej (`Math.abs(score)`) a nie samym znaku.

**9.** `src/components/agents/NewsFeed.tsx`, linia 67: `const isAnalyzed = article.tags.length > 0`. Artykuł z Finnhub (bez analizy) ma `tags: []`. Prawdziwa analiza AI zawsze zwraca minimum 1 tag. To jest implicit convention, nie explicit flaga. Można by to poprawić dodając `analyzedAt: Date | null` do `AnalyzedArticle`.

**10.** Cały store ginie — `chartStore` żyje w pamięci przeglądarki (JavaScript heap). Przy refreshie JavaScript jest restartowany, Zustand tworzy nowy store z wartościami początkowymi: `candleCache: {}`, `quoteCache: {}`. Brak `persist` middleware to celowy wybór — dane giełdowe muszą być świeże.

---

## MEDIUM

**11.** Trzy `useEffect` w `StockChart.tsx`:
- `useEffect(() => { ... }, [])` — dependency array puste. Odpala raz po pierwszym mount. Tworzy chart, ResizeObserver, referencje. Cleanup: `chart.remove()`, `ro.disconnect()`.
- `useEffect(() => { ... }, [chartType])` — odpala gdy `chartType` (line/candle) się zmieni. Usuwa starą serię, tworzy nową, ustawia dane.
- `useEffect(() => { ... }, [data])` — odpala gdy `data` (tablica świec) się zmieni. Aktualizuje dane serii.

Dlaczego nie jeden efekt: gdyby zmieniać typ serii i dane jednocześnie w jednym efekcie z `[chartType, data]`, każda zmiana danych niszczyłaby i odtwarzała serię — niepotrzebne mignięcie. Podział daje precyzyjną kontrolę co dzieje się w każdym scenariuszu.

**12.** Nie odpali się fetch. `MarketView.tsx`, linia 46–47: `const cacheKey = 'MSFT:1M'; if (candleCache[cacheKey]) return;`. Dane MSFT są już w cache z pierwszego kliknięcia. Zmieni się tylko `activeTicker` w store → TickerSidebar rerenderuje highlight, ChartHeader pokazuje dane MSFT z `quoteCache`, StockChart nie dostaje nowych props `data` (te same świece co wcześniej).

**13.** Batch analiza AI przy fetchu artykułów byłaby złym UX i nieefektywna. 20 artykułów = 20 requestów do Gemini jednocześnie, każdy ~2-5 sekund → user czekałby ~5-10 sekund zanim cokolwiek by zobaczył. Poza tym wielu artykułów user nigdy nie przeczyta — po co je analizować? On-demand przy kliknięciu jest szybsze (user widzi artykuły natychmiast) i tańsze (analizuje tylko to co czyta).

**14.** Bez cleanup:
- **Dev mode (Strict Mode)**: React w dev odpala każdy effect dwa razy (mount → cleanup → mount). Bez cleanup przy pierwszym mount tworzony jest chart, cleanup nic nie robi, przy drugim mount tworzony jest drugi chart na tym samym `<div>`. Wynik: dwa charty nałożone.
- **Produkcja**: Za każdym razem gdy komponent się odmontowuje (nawigacja, conditional rendering) i montuje z powrotem — nowy chart, stary żyje dalej. Przy 10 przejściach: 10 instancji Lightweight Charts w pamięci, każda z ResizeObserverem. Memory leak, spowalnianie, potencjalny crash przeglądarki.

**15.** `dedup()` (linia 43–58) scali oba artykuły w jeden. Zobaczy że `map.get(article.id)` już istnieje → merguje tickery: `new Set([...['AAPL'], ...['MSFT']])` → `['AAPL', 'MSFT']`. Wynik: jeden artykuł z `tickers: ['AAPL', 'MSFT']`. W karcie artykułu pojawią się oba tickers.

**16.** `Promise.allSettled` zwróci: `candlesResult.status === 'rejected'` (Twelve Data fail) i `quoteResult.status === 'fulfilled'` (Finnhub OK). W UI: `usingMockData: true` → pojawi się badge „Demo data", wykres pokaże deterministyczne mock dane zamiast prawdziwych. Cena w `ChartHeader` będzie prawdziwa (z Finnhub). User widzi chart (mock) z prawdziwą ceną — half-functional.

**17.** `ChatBlock` to przygotowanie pod Phase 3 — Orchestrator Agent który będzie miksował różne typy wiadomości (newsy, alerty, trendy, tekst) w jeden feed. Aktualnie `NewsFeed.tsx` renderuje `AnalyzedArticle[]` bezpośrednio, z pominięciem `ChatBlock`. Gdy Phase 3 będzie gotowa, `NewsFeed` zostanie przepisany żeby renderować `ChatBlock[]`, z case statement dla każdego `type`.

**18.** Artykuł zostaje w tym samym miejscu listy. `addArticles()`, linia 77–83: `fresh` to tylko nowe artykuły (nie ma ich w storze). `updated` to kopia aktualnej tablicy z podmienionymi danymi tam gdzie `id` matchuje. Wynik: `[...fresh, ...updated]`. Istniejący artykuł jest na tej samej pozycji co poprzednio — tylko jego dane są zaktualizowane. Lista nie przeskakuje.

**19.** `rootMargin: '100px'` powiększa "okno widoczności" o 100px we wszystkich kierunkach. Element jest traktowany jako widoczny zanim fizycznie wejdzie w viewport. Efekt: animacja startuje 100px przed wejściem elementu na ekran — user widzi animowany border już gdy element wjeżdża, nie ma skoku z "brak animacji" do "jest animacja". Z `'0px'` animacja startowałaby dokładnie w momencie wejścia w viewport — mógłby być krótki flash statycznego stylu.

**20.** To jest fix na konkretny bug. Jeśli `isLoading` warunkowo zwracałoby `<ChartSkeleton />` zamiast `<div ref={containerRef}>`, to `useEffect([], [])` odpalony przy pierwszym mount miałby `containerRef.current = null` (div nie istnieje gdy skeleton jest renderowany). Chart nie zostałby stworzony. Gdy loading skończyłby się i div by się pojawił, `useEffect` już nie odpalił się ponownie (dependency array `[]` — tylko raz). Rozwiązanie: zawsze renderuj `<div ref>`, nakładaj skeleton jako `absolute` overlay nie zastępując diva.

---

## HARD

**21.** Musisz przeprojektować `chartStore.ts`. Aktualnie: `activeTicker: string` — jeden ticker. Potrzeba: `activeTickers: [string, string]` lub bardziej elastyczne `charts: Record<string, ChartConfig>`. `candleCache` i `quoteCache` już są keyowane po symbolu — to zostaje. `isLoading` musiałby być `isLoading: Record<string, boolean>` (osobny stan dla każdego chartu). `MarketView.tsx` musiałby renderować dwa `<StockChart>` z różnymi danymi. `TickerSidebar` musiałby wiedzieć w którym panelu ustawia ticker. To niebłaha zmiana — zarówno state shape jak i UI.

**22.** Trzy problemy:
1. **Memory leak po czasie** — cache nigdy nie jest czyszczone (tylko TTL przez `expiresAt > now`, ale stare wpisy nie są usuwane z Map). Przy wystarczającej liczbie requestów Map rośnie w nieskończoność. Fix: LRU cache (Least Recently Used).
2. **Brak współdzielenia między instancjami** — Vercel/AWS uruchamia wiele instancji Next.js. Każda ma swój własny `cache: Map`. Request usera A trafia do instancji 1, request usera B do instancji 2 — oba fetchują Twelve Data dla AAPL:1M. Fix: Redis lub inny shared cache.
3. **Reset przy deploy** — każdy nowy deploy restartuje serwer, cache ginie. Nie jest to bug ale może powodować spike requestów do Twelve Data zaraz po deploymencie. Fix: cache w Redis (persists deploys).

**23.** `if (err.message.includes('rate limit'))` to antywzorzec — kruche i podatne na refactoring. Jeśli ktoś zmieni treść wiadomości błędu, check przestaje działać. Własna klasa `RateLimitError extends Error` pozwala na `instanceof` check — niezawodny niezależnie od treści wiadomości. Klasa może też nieść dodatkowe dane (provider name) i być rozszerzona w przyszłości. To jest standard w TypeScript/Node.js dla różnicowania typów błędów.

**24.** Tak, to jest problem semantyczny. `AnalyzedArticle` sugeruje że artykuł ma analizę, ale artykuły z `/api/news/fetch` mają `tags: []`, `impactScore: 0`, `interpretation: ''` — to są puste wartości fallback, nie prawdziwa analiza. Lepszym modelem byłoby:
```ts
type ArticleState = RawArticle | AnalyzedArticle;
// lub
interface MaybeAnalyzed extends RawArticle {
  analysis: AnalyzedFields | null;
}
```
Aktualne podejście działa bo `isAnalyzed = tags.length > 0` jest poprawnym implicit check. Ale TypeScript nie daje gwarancji — możesz przypadkowo wyświetlić `article.impactScore` (0) dla nieanalizowanego artykułu i nie dostać błędu kompilacji. Na rozmowie: „zauważam że tu mamy implicit null przez puste tablice — explicit null byłoby bezpieczniejsze".

**25.** Sekwencja:
1. **Click** `TimeframeSelector.tsx`: `setTimeframe('1Y')` → `chartStore.timeframe = '1Y'`
2. **MarketView rerenderuje**, `useEffect([activeTicker, timeframe])` odpala (timeframe zmienił się)
3. `cacheKey = 'AAPL:1Y'` → `candleCache['AAPL:1Y']` nie istnieje → `setLoading(true)`, `setUsingMockData(false)`
4. `fetch('/api/chart?symbol=AAPL&timeframe=1Y')` lecí
5. **`chart/route.ts`** sprawdza in-memory cache — brak → `Promise.allSettled([fetchCandles('AAPL', '1Y'), fetchQuote('AAPL')])`
6. **`dataSource.ts` `fetchCandles`**: konfiguracja `1Y → interval: '1week', outputsize: 52`. Request do Twelve Data. Response (52 tygodniowe świece, newest-first) → `.reverse()` → parsowanie na `Candle[]`
7. **`dataSource.ts` `fetchQuote`**: Finnhub `/quote?symbol=AAPL` → `QuoteData`
8. Route zwraca `{ candles, quote, usingMockData: false }`, zapisuje do serwer cache
9. **`MarketView`** dostaje response: `setCandleCache('AAPL:1Y', candles)`, `setQuoteCache('AAPL', quote)`, `setLoading(false)`
10. **`StockChart`** dostaje nowe `data` props → `useEffect([data])` odpala → `series.setData(toAreaData(candles))` → `timeScale().fitContent()`
11. Wykres rerenderuje z 52 świecami rocznymi

**26.** Bez `observer.disconnect()`: observer jest podłączony do elementu `ref.current`. Gdy `AiAnalysisBlock` odmontowuje się (np. artykuł jest usuwany ze store, lub rodzic odmontowuje) — React usuwa element z DOM, ale observer wciąż go obserwuje. Observer ma referencję do elementu i do closure `setInView` który ma referencję do komponentu. Komponent nie może być garbage collected → memory leak. Konkretny scenariusz: user klika „clear articles" (`clearArticles()` w newsStore) → 20 kart odmontowuje się → 20 observers żyje dalej → 20 referencji do unmounted komponentów w pamięci.

**27.** `'use client'` musi być przed importami, bo Next.js analizuje plik statycznie (bez jego wykonywania) żeby zdecydować czy to Server czy Client Component. Jest to dyrektyw dla bundlera, nie dla JavaScript runtime. Technicznie Next.js szuka `'use client'` jako pierwszy statement w pliku. Import statements są hoisted przez JavaScript, ale `'use client'` jest analizowane przez Next.js parser zanim JS się uruchomi. W praktyce: Next.js/TypeScript pokazuje błąd jeśli `'use client'` nie jest pierwszą linią.

**28.** Trzy scenariusze gdzie scraping nie zadziała:
1. **Paywall** — Reuters, Bloomberg, FT wymagają subskrypcji. Serwer dostanie HTML strony paywall z komunikatem „subscribe to read", nie treść artykułu. Fix: użyj API agregatorów (NewsAPI, Diffbot) lub sprawdź `res.ok` i fallback na `article.summary`.
2. **Bot detection / Cloudflare** — wiele serwisów finansowych blokuje nieznanych User-Agentów lub używa JavaScript challenges. `fetch` z Node.js nie uruchamia JS. Fix: headless browser (Puppeteer), ale to heavy. Realistically: akceptuj że część artykułów nie będzie scrapowalna.
3. **Timeout** — `AbortSignal.timeout(5000)` daje 5 sekund. Wolne serwery z dużymi stronami mogą przekraczać limit. Artykuł dostaje `fullContent = ''` i jest analizowany tylko na podstawie oryginalnego summary z Finnhub.

**29.** Tak, to jest prawidłowe i lepsze niż `useCallback`. `toAreaData` i `toCandleData` to czyste funkcje (pure functions) — nie zależą od żadnego stanu czy props, nie mają side effects. Definiując je **poza** komponentem, są tworzone raz przy załadowaniu modułu, nie przy każdym renderze. `useCallback` wewnątrz komponentu tworzy nową referencję funkcji przy każdym renderze (zapamiętuje ją, ale ma overhead). Czyste funkcje utility które nie potrzebują dostępu do closure komponentu zawsze powinny być poza nim.

**30.** Zmiany w `newsStore.ts`:
```ts
import { persist } from 'zustand/middleware';

const useNewsStore = create(persist(
  (set, get) => ({ ... }),
  {
    name: 'news-store',
    partialize: (state) => ({ readIds: state.readIds }),  // tylko readIds, nie articles
  }
));
```

Edge case z `Set<number>` i JSON: `JSON.stringify(new Set([1, 2, 3]))` → `"{}"` — Set nie jest serializowalny! Trzeba custom serializer:
```ts
storage: {
  getItem: (key) => {
    const str = localStorage.getItem(key);
    const data = JSON.parse(str);
    data.state.readIds = new Set(data.state.readIds);  // tablica → Set
    return data;
  },
  setItem: (key, value) => {
    const data = JSON.parse(value);
    data.state.readIds = [...data.state.readIds];  // Set → tablica (serializable)
    localStorage.setItem(key, JSON.stringify(data));
  },
  removeItem: (key) => localStorage.removeItem(key),
}
```
Dodatkowy edge case: `articles` nie powinny być persist'owane (stare newsy z wczoraj), dlatego `partialize` wybiera tylko `readIds`.
