# Katalog wzorców

Wzorce użyte w projekcie, każdy z nazwą angielską (bo tak je znajdziesz na Stack Overflow i rozmowach kwalifikacyjnych), krótkim wyjaśnieniem i konkretnym przykładem z kodu.

---

## 1. Server vs Client Components (Next.js App Router)

**Co to:** W Next.js App Router każdy komponent jest domyślnie Server Component — renderuje się na serwerze, wynik (HTML) trafia do przeglądarki. Client Component (`'use client'`) uruchamia się też w przeglądarce i może używać stanu, event handlerów, efektów.

**W projekcie:**
`src/app/dashboard/page.tsx` — brak `'use client'`, więc jest Server Component. Może bezpiecznie wywołać `loadConfig()` która używa `fs` (Node.js API niedostępne w przeglądarce).

`src/components/market/MarketView.tsx`, linia 1: `'use client'` — musi być Client Component bo używa `useEffect`, `useState` (przez Zustand) i `fetch`.

**Reguła granica:** Dane z serwera przekazujesz w dół przez props. `dashboard/page.tsx` czyta `tickers` z config i przekazuje je jako `<MarketView tickers={tickers} />`. MarketView dostaje je jako props — nie musi robić żadnego fetcha żeby wyświetlić listę tickerów.

**Gdzie jeszcze:** W każdej Next.js App Router aplikacji. To fundamentalny podział.

---

## 2. API Routes jako proxy (Security Pattern)

**Co to:** Klucze API żyją tylko na serwerze. Klient nigdy nie rozmawia bezpośrednio z zewnętrznym API — zawsze przez własny endpoint.

**W projekcie:**
`src/app/api/chart/route.ts`, linia 35: `fetchCandles(symbol, timeframe)` — wywołanie do Twelve Data dzieje się na serwerze. Gdyby `MarketView.tsx` wywołał Twelve Data bezpośrednio, klucz `TWELVEDATA_API_KEY` musiałby być widoczny w przeglądarce (w bundle JavaScript).

`src/lib/chart/dataSource.ts`, linia 40: `const apiKey = process.env.TWELVEDATA_API_KEY` — ta zmienna środowiskowa jest dostępna tylko w Node.js. Jeśli trafisz na kod który używa `NEXT_PUBLIC_` prefix, to jest klient-side i publiczne.

**Gdzie jeszcze:** W każdej aplikacji która korzysta z zewnętrznych API z kluczami. Standardowa praktyka.

---

## 3. Singleton Pattern (Config Loader)

**Co to:** Singleton to obiekt który istnieje tylko w jednej instancji w całym programie. Pierwsze wywołanie tworzy go, kolejne zwracają ten sam.

**W projekcie:**
`src/lib/config.ts`, linia 57–64:
```ts
let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cached) return cached;          // drugi raz → ten sam obiekt
  const raw = fs.readFileSync(configPath, 'utf-8');
  cached = parse(raw) as AppConfig;   // pierwsze wywołanie → tworzy
  return cached;
}
```
Bez singletona każde wywołanie `loadConfig()` czytałoby plik z dysku. To jest wolne i niepotrzebne.

**Gdzie jeszcze:** Połączenia z bazą danych, klienty HTTP, logowanie — wszędzie gdzie inicjalizacja jest kosztowna i potrzebujesz jednej instancji.

---

## 4. Custom Hook (useNewsFetch)

**Co to:** Custom hook to funkcja której nazwa zaczyna się od `use` i używa wbudowanych hooków Reacta. Enkapsuluje logikę żeby można jej użyć w wielu komponentach.

**W projekcie:**
`src/hooks/useNewsFetch.ts` — hook enkapsuluje: inicjalny fetch przy mount, setInterval dla auto-fetch, guard przed double-fetch, obsługę błędów, update stanu w newsStore. Gdyby to wszystko siedziało w `NewsFeed.tsx`, komponent byłby dwa razy dłuższy i trudniejszy do zrozumienia.

Użycie w `NewsFeed.tsx`, linia 260: `const { fetchNow } = useNewsFetch({ intervalSeconds, autoFetch })`. Komponent dostaje tylko jeden callback — nie wie nic o intervals ani error handling.

**Gdzie jeszcze:** W każdym React projekcie. Custom hooks to standardowy sposób na reuse logiki (alternatywa do HOC i render props z czasów przed hooks).

---

## 5. Guard Ref (isFetchingRef)

**Co to:** Użycie `useRef` jako mutable flag która nie powoduje rerenderowania. Tu konkretnie: guard przed uruchomieniem tej samej async operacji dwa razy jednocześnie.

**W projekcie:**
`src/hooks/useNewsFetch.ts`, linia 20–21:
```ts
const isFetchingRef = useRef(false);

const fetchNow = useCallback(async () => {
  if (isFetchingRef.current) return;  // już trwa fetch → ignoruj
  isFetchingRef.current = true;
  ...
  isFetchingRef.current = false;      // w finally
```

Dlaczego `useRef` a nie `useState`? `useState` powoduje rerender przy każdej zmianie. `useRef` nie. Tu nie potrzebujemy rerenderowania — potrzebujemy tylko flagi. React Dev Tools w trybie Strict Mode podwójnie odpala effects — bez tej flagi dostałbyś dwa równoległe fety przy każdym mount.

**Gdzie jeszcze:** W każdej sytuacji gdzie masz async operację która może być wywołana wiele razy szybko (np. debouncing ręczny, guard przed double-submit formularza).

---

## 6. Discriminated Union + Type Guard (TypeScript)

**Co to:** Union type gdzie każdy wariant ma unikalne literalne pole (zwykle `type`). TypeScript po sprawdzeniu `if (block.type === 'news_card')` wie że to `NewsCardBlock` i daje dostęp do jego pól.

**W projekcie:**
`src/lib/news/types.ts`, linia 99–103:
```ts
export type ChatBlock =
  | TextBlock           // type: "text"
  | NewsCardBlock       // type: "news_card"
  | AlertCardBlock      // type: "alert_card"
  | TrendInsightBlock;  // type: "trend_insight"
```

Gdybyś renderował te bloki:
```ts
function renderBlock(block: ChatBlock) {
  switch (block.type) {
    case 'news_card': return <NewsCard {...block} />; // TypeScript wie: NewsCardBlock
    case 'alert_card': return <Alert {...block} />;
    // brak 'text' i 'trend_insight' → TypeScript error
  }
}
```

Uwaga: `ChatBlock` jest zdefiniowany w typach, ale nie jest jeszcze renderowany w UI. To jest przygotowanie pod Phase 3.

**Gdzie jeszcze:** W każdej aplikacji z heterogenicznym contentem: edytory blokowe, chat messages, notification feed.

---

## 7. Zustand Selectors (Performance Pattern)

**Co to:** Zamiast subskrybować cały store, komponent subskrybuje tylko konkretne pole. Rerenderuje się tylko gdy to konkretne pole się zmieni.

**W projekcie:**
`src/components/agents/AgentSidebar.tsx`, linia 47–48:
```ts
const newsUnread = useNewsStore(selectUnreadCount);
const newsCritical = useNewsStore(selectCriticalCount);
```

Selektory z `newsStore.ts`, linia 133–138:
```ts
export const selectUnreadCount = (s: NewsState) => s.unreadCount;
export const selectCriticalCount = (s: NewsState) => s.criticalCount;
```

`AgentSidebar` rerenderuje się tylko gdy `unreadCount` lub `criticalCount` się zmieni — nie gdy `articles` array dostaje nowy artykuł, nie gdy `fetchStatus` się zmienia. To optymalizacja.

Porównaj z `NewsFeed.tsx`, linia 253–258 — tu selecty są używane inline:
```ts
const articles = useNewsStore(selectArticles);
```

**Gdzie jeszcze:** W każdej aplikacji Zustand lub Redux. W Redux to `reselect` biblioteka, w Zustand to wbudowane.

---

## 8. dynamic import z SSR disabled

**Co to:** Next.js domyślnie pre-renderuje komponenty na serwerze (SSR). Niektóre biblioteki używają browser APIs (`window`, `document`, `ResizeObserver`) które na serwerze nie istnieją. `dynamic()` z `ssr: false` mówi Next.js żeby nie próbował renderować tego komponentu serwerowo.

**W projekcie:**
`src/components/market/MarketView.tsx`, linia 14–21:
```ts
const StockChart = dynamic(() => import('./StockChart'), {
  ssr: false,
  loading: () => (
    <div>Loading chart…</div>
  ),
});
```

Lightweight Charts próbuje przy imporcie czytać `window` i `document`. Na serwerze Node.js one nie istnieją → crash. `ssr: false` sprawia że ten import w ogóle nie dzieje się na serwerze.

**Gdzie jeszcze:** Mapy (Leaflet, Google Maps), edytory kodu (Monaco), biblioteki canvas. Wszędzie gdzie biblioteka zakłada że jesteś w przeglądarce.

---

## 9. useEffect Cleanup (Imperative Library Pattern)

**Co to:** Gdy useEffect tworzy zasoby zewnętrzne (timery, event listenery, observer, biblioteki imperatywne), musi je zwolnić w funkcji cleanup. Brak cleanup → memory leak.

**W projekcie, trzy przykłady:**

`src/components/market/StockChart.tsx`, linia 122–148:
```ts
useEffect(() => {
  const chart = createChart(...);
  const ro = new ResizeObserver(...);
  ro.observe(containerRef.current);

  return () => {       // ← CLEANUP
    ro.disconnect();   // zatrzymaj ResizeObserver
    chart.remove();    // zniszczyć chart (usuwa canvas, event listenery)
    chartRef.current = null;
  };
}, []);
```

`src/hooks/useNewsFetch.ts`, linia 53: `return () => clearInterval(id)` — zatrzymuje interval gdy komponent się odmontowuje.

`src/components/news/AiAnalysisBlock.tsx`, linia 22: `return () => observer.disconnect()` — zatrzymuje IntersectionObserver.

**Co by się stało bez cleanup:** Przy każdym hot-reload w dev (lub unmount/remount komponentu) tworzyłby się nowy chart, nowy ResizeObserver, nowy interval — stare żyłyby dalej, zjadały pamięć, wywoływały callbacks do komponentów które już nie istnieją.

**Gdzie jeszcze:** Każdy useEffect który tworzy cokolwiek co nie jest "reaktywne" z natury React.

---

## 10. Promise.allSettled (Parallel Fetch z partial failure)

**Co to:** `Promise.all` failuje jeśli **choć jeden** z promises się odrzuci. `Promise.allSettled` czeka na wszystkie, każdy może się odrzucić niezależnie.

**W projekcie:**
`src/app/api/chart/route.ts`, linia 35–38:
```ts
const [candlesResult, quoteResult] = await Promise.allSettled([
  fetchCandles(symbol, timeframe),
  fetchQuote(symbol),
]);
```

Potem:
- `candlesResult.status === 'rejected'` → użyj mock data (chart musi być)
- `quoteResult.status === 'rejected'` → `quote = null` (cena w headerze po prostu znika)

Gdyby użyto `Promise.all` — jeden fail Twelve Data crashowałby cały endpoint, łącznie z Finnhub quote który mógł działać.

**Gdzie jeszcze:** Wszędzie gdzie fetchujesz dane z wielu niezależnych źródeł i chcesz wyświetlić tyle ile się udało zamiast nic.

---

## 11. In-Memory TTL Cache

**Co to:** Cache w pamięci serwera z czasem wygaśnięcia. Zamiast odpytywać zewnętrzne API przy każdym requescie, przechowujesz wynik przez N minut.

**W projekcie:**
`src/app/api/chart/route.ts`, linia 12–30:
```ts
const cache = new Map<string, { data: ChartApiResponse; expiresAt: number }>();
const TTL_MS = 5 * 60 * 1000; // 5 minut

// sprawdzenie
const cached = cache.get(cacheKey);
if (cached && cached.expiresAt > now) return cached.data;

// zapisanie po fetchu
cache.set(cacheKey, { data: response, expiresAt: now + TTL_MS });
```

Ważna uwaga: ta `Map` żyje **w pamięci procesu Node.js**. Przy restarcie serwera ginie. Na produkcji z wieloma instancjami każda ma swój cache — potrzeba Redis lub innego shared cache. Na papier trading w dev — ok.

**Gdzie jeszcze:** Wszędzie gdzie zewnętrzne API ma limit requestów lub jest wolne. Next.js ma też wbudowane cache przez `fetch` z opcją `{ next: { revalidate: 300 } }` (użyte w `dataSource.ts` dla Twelve Data).

---

## 12. Immutable State Updates

**Co to:** Nigdy nie mutuj stanu bezpośrednio. Zawsze tworz nowe obiekty/tablice. React (i Zustand) wykrywa zmiany przez porównanie referencji — jeśli zmutowałeś obiekt, referencja jest ta sama → React nie wie że coś się zmieniło.

**W projekcie:**
`src/lib/store/newsStore.ts`, linia 98–100:
```ts
markRead: (id) => {
  const { articles, readIds } = get();
  const next = new Set(readIds).add(id);  // nowy Set, nie modyfikacja starego
  set({ readIds: next, ...computeBadge(articles, next) });
},
```

Gdyby napisać `readIds.add(id); set({ readIds })` — Zustand nie zauważyłby zmiany (ta sama referencja do tego samego Set). Konieczność tworzenia nowego obiektu.

To samo w `addArticles`, linia 83: `const next = [...fresh, ...updated]` — nowa tablica zamiast `push` do istniejącej.

**Gdzie jeszcze:** W każdym React/Zustand/Redux projekcie. To jedna z najczęstszych pułapek dla początkujących.
