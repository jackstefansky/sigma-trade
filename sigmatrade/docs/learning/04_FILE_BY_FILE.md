# Każdy plik — co robi i dlaczego

Dla każdego pliku: co robi, dlaczego tak, i jedna ciekawostka (coś nieoczywistego). Jeśli plik używa wzorca z `03_PATTERNS_CATALOG.md`, napisano „(patrz Pattern #N)".

---

## `src/app/page.tsx`

**Co robi:** Jedyna linia to `redirect('/dashboard')`. Przekierowanie root URL na dashboard.

**Dlaczego tak:** Next.js App Router wymaga pliku `page.tsx` dla każdej ścieżki. Bez tego `/` zwróciłoby 404. To minimalny sposób żeby root URL działał bez duplikowania logiki dashboardu.

---

## `src/app/layout.tsx`

**Co robi:** Root layout — opakowuje każdą stronę. Ustawia `<html lang="pl">`, ładuje font JetBrains Mono przez Google Fonts, importuje `globals.css`.

**Dlaczego tak:** Layout jest współdzielony przez wszystkie strony (gdy będzie ich więcej). Font jest ładowany raz tu, nie w każdym komponencie osobno. `JetBrains_Mono` z `next/font/google` jest ładowany przez Next.js font optimization — zero FOUT (flash of unstyled text), preloading, subsetting.

**Ciekawostka:** `body` ma klasę `text-gray-100` — to `#f4f4f5`. To bazowy kolor tekstu dla całej aplikacji. Jeśli kiedykolwiek zobaczysz szary tekst tam gdzie spodziewasz się białego — tutaj zaczyna się dochodzenie.

---

## `src/app/globals.css`

**Co robi:** Trzy rzeczy: Tailwind directives, custom scrollbar styles, CSS dla `.ai-analysis-block`.

**Dlaczego tak:** Tailwind klas nie wystarczy do wszystkiego. `ai-analysis-block` używa animowanego gradientu i `data-*` attribute selector — tego nie da się wyrazić w Tailwind bez custom pluginu. Scrollbar customization też jest trudna w Tailwind (wymaga plugin `@tailwindcss/forms` lub inline).

**Ciekawostka:** `.ai-analysis-block[data-in-view="false"] { animation-play-state: paused; }` — ta linia pauzuje animację gdy element jest off-screen. Bez niej 20 kart z animowanymi borderami marnowałoby GPU cały czas. Wartość `data-in-view` jest ustawiana przez `AiAnalysisBlock.tsx` przez IntersectionObserver (patrz Pattern #9).

---

## `src/app/dashboard/page.tsx`

**Co robi:** Główna strona. Server Component — czyta config, buduje listę agentów, renderuje layout.

**Dlaczego tak:** Server Component może bezpiecznie wywołać `loadConfig()` (używa `fs`). Logika konfiguracji agentów (który jest enabled, jakie badgeCount domyślnie) jest tu — nie w sidebar — bo to są dane konfiguracyjne, nie UI state. (patrz Pattern #1)

**Ciekawostka:** `badgeCount: 0` dla wszystkich agentów w tej tablicy. Ale `AgentSidebar` dla agenta `'news'` ignoruje tę wartość i bierze `newsUnread` bezpośrednio ze store. To jest świadome — server nie zna aktualnego stanu newsów.

---

## `src/app/api/chart/route.ts`

**Co robi:** `GET /api/chart?symbol=AAPL&timeframe=1M`. Fetuje candles z Twelve Data i quote z Finnhub równolegle. Cache 5 minut. Fallback na mock data. (patrz Pattern #2, #10, #11)

**Dlaczego tak:** API key protection. Logika fallback jest tu — klient nigdy nie wie skąd dane, zawsze dostaje `ChartApiResponse`.

**Ciekawostka:** `VALID_TIMEFRAMES = new Set<Timeframe>([...])` — guard walidujący `timeframe` param. Bez tego user mógłby wysłać `?timeframe=cokolwiek` i serwer mógłby się zachować nieprzewidywalnie. To przykład walidacji na granicy systemowej.

---

## `src/app/api/news/fetch/route.ts`

**Co robi:** `POST /api/news/fetch`. Pipeline: Finnhub API → normalizacja → dedup → zwraca `AnalyzedArticle[]` z zerowym impactScore (analiza jest on-demand).

**Dlaczego POST zamiast GET:** Konwencjonalnie GET jest idempotentny i cache'owalny. Ten endpoint mutuje zewnętrzne zasoby (odpytuje Finnhub z aktualną datą) i nie powinien być cache'owany. POST to sygnał że „to jest akcja, nie query".

**Ciekawostka:** `dedup()` funkcja (linia 43–58) scala artykuły o tym samym `id` które przyszły dla różnych tickerów. Jeśli ten sam artykuł pojawia się dla AAPL i MSFT, wychodzi jeden artykuł z `tickers: ['AAPL', 'MSFT']`. Eleganckie.

---

## `src/app/api/news/analyze/route.ts`

**Co robi:** `POST /api/news/analyze`. Przyjmuje jeden artykuł, scrappuje jego pełną treść z URL, wysyła do Gemini/Claude, zwraca `AnalyzedArticle`.

**Dlaczego osobny endpoint od fetch:** Analiza AI jest on-demand (user klika artykuł, nie wszystkie od razu). Gdyby była w fetch route, każdy batch 20 artykułów wysyłałby 20 requestów do Gemini jednocześnie. Przy limicie 60 req/min szybko by się wyczerpał.

**Ciekawostka:** HTML stripping (linia 34–42) jest prosty ale ma pułapki — nie parsuje poprawnie zagnieżdżonych tagów, nie radzi sobie z malformed HTML. Na potrzeby tego projektu działa. Prawdziwe scraping używałoby `cheerio` lub `jsdom`.

---

## `src/lib/config.ts`

**Co robi:** Singleton loader dla `config.yaml`. Trzy convenience accessors: `getNewsAgentConfig()`, `getWatchlist()`, `getAiProvider()`. (patrz Pattern #3)

**Dlaczego tak:** Jedno miejsce dla konfiguracji, silnie typowane przez `AppConfig` interface. Zmieniasz `config.yaml` → zmiana propaguje się przez cały projekt.

**Ciekawostka:** `process.cwd()` zwraca katalog z którego odpalono Node.js — zazwyczaj root projektu. Nie jest to to samo co `__dirname` (katalog pliku). W Next.js to działa poprawnie bo serwer jest startowany z root projektu.

---

## `src/lib/news/types.ts`

**Co robi:** Single source of truth dla typów całego news pipeline. Definiuje: `FinnhubArticle` (raw API response) → `RawArticle` (znormalizowany) → `AnalyzedArticle` (po AI) → `ChatBlock` union (do UI).

**Dlaczego tak:** Wszystkie typy w jednym miejscu = jeden import, jedna zmiana propaguje się wszędzie. Alternatywa — typy przy każdym komponencie — prowadzi do duplikacji i niespójności.

**Ciekawostka:** `RawArticle.publishedAt` jest w milisekundach. Finnhub (`FinnhubArticle.datetime`) zwraca sekundy Unix. Konwersja `* 1000` dzieje się w `normalize()` w `fetch/route.ts` — to jest przykład marshallingu: adaptujesz zewnętrzny format do wewnętrznego modelu. Ważne żeby konwersja była w jednym miejscu.

---

## `src/lib/news/analyzer.ts`

**Co robi:** Logika AI analysis. Buduje prompt, wysyła do Gemini lub Claude (zależnie od config), parsuje response, mapuje po `id` na artykuły.

**Dlaczego dwa providers:** `config.yaml` ma pole `ai_provider.provider: 'gemini' | 'claude'`. Można przełączać bez zmiany kodu.

**Ciekawostka:** `RateLimitError` to custom class (linia 88–92) która rozszerza `Error`. Dlaczego własna klasa zamiast zwykłego `throw new Error()`? Bo route handler sprawdza `if (err instanceof RateLimitError)` i zwraca HTTP 429 zamiast 500. Inne błędy → 500. To jest typowe użycie custom errors do rozróżnienia typów błędów.

---

## `src/lib/chart/types.ts`

**Co robi:** Typy dla chart pipeline: `Candle`, `Timeframe`, `ChartType`, `QuoteData`, `ChartApiResponse`.

**Dlaczego osobny plik od news/types.ts:** Dwa oddzielne feature areas. Mieszanie typów chart z types news tworzyłoby bałagan w importach. (patrz `01_ARCHITECTURE_TOUR.md` — feature areas)

**Ciekawostka:** `Timeframe = '1D' | '1W' | '1M' | '3M' | '1Y'` to **string literal union**, nie enum. Różnica jest subtelna ale ważna: string literal union przekazuje się jako zwykły string (np. do URL `?timeframe=1M`), enum generuje object w JavaScript. String literals są lżejsze i czytelniejsze w URL params.

---

## `src/lib/chart/dataSource.ts`

**Co robi:** Dwie funkcje: `fetchCandles()` (Twelve Data) i `fetchQuote()` (Finnhub). Server-only. Konwersja formatów API na wewnętrzne typy.

**Dlaczego osobny plik od route.ts:** Separacja odpowiedzialności. Route obsługuje HTTP (request/response, caching, error codes). dataSource obsługuje business logic (mapowanie danych, timeframe config). Gdybyś chciał zmienić provider na Alpha Vantage, zmieniasz tylko `dataSource.ts`.

**Ciekawostka:** Twelve Data zwraca daty jako stringi `"2026-04-10"` lub `"2026-04-10 09:30:00"`. `parseTime()` (linia 31–36) obsługuje obie formy — dzienne candle nie mają godziny. Lightweight Charts wymaga Unix timestamp w sekundach, nie milisekundach — stąd `Math.floor(...getTime() / 1000)`.

---

## `src/lib/chart/mockData.ts`

**Co robi:** Generuje deterministyczne świece OHLCV jako fallback gdy API failuje.

**Dlaczego deterministyczne (seeded):** Gdyby mock generował losowe dane przy każdym załadowaniu, wykres by „skakał" przy każdym refreshie. Deterministyczne dane per `symbol:timeframe` wyglądają jak prawdziwy chart i nie dezorientują w testowaniu UI.

**Ciekawostka:** Algorytm to XOR-shift PRNG (linia 16–22) — szybki i prosty pseudo-random generator. Momentum model (linia 57–63) dodaje `momentum = momentum * 0.85 + noise` — cena nie skacze losowo ale ma tendencje. Dzięki temu mock wygląda jak prawdziwy rynek.

---

## `src/lib/utils.ts`

**Co robi:** Jedna funkcja `cn()` która łączy `clsx` i `tailwind-merge`.

**Dlaczego nie sam `clsx`:** `clsx` łączy klasy ale nie wie nic o Tailwind. `cn('p-2 p-4')` da `p-2 p-4` — dwa padding, ostatni wygra (CSS specificity). `tailwind-merge` deduplikuje klasy Tailwind — `twMerge('p-2 p-4')` da tylko `p-4`. To ważne gdy przekazujesz klasy przez props.

**Gdzie używane:** W każdym komponencie który dynamicznie składa klasy Tailwind na podstawie props lub state.

---

## `src/lib/store/newsStore.ts`

**Co robi:** Zustand store dla news. Stan: `articles`, `readIds`, `fetchStatus`, `unreadCount`, `criticalCount`. Actions: `addArticles`, `updateArticle`, `markRead`, `markAllRead`, `setFetchStatus`, `clearArticles`. Selektory eksportowane osobno.

**Dlaczego `readIds: Set<number>` a nie `readIds: number[]`:** Sprawdzenie `readIds.has(id)` to O(1). Sprawdzenie `readIds.includes(id)` na tablicy to O(n). Przy 100+ artykułach różnica jest odczuwalna.

**Ciekawostka:** `addArticles()` (linia 67–88) ma ciekawą logikę scalania. Nowe artykuły idą na górę (`fresh`), istniejące są aktualizowane w miejscu (`updated`). Dzięki temu kolejność listy nie zmienia się gdy przychodzi analiza AI dla już istniejącego artykułu — artykuł nie skacze na górę.

---

## `src/store/chartStore.ts`

**Co robi:** Zustand store dla chart. Stan: `activeTicker`, `timeframe`, `chartType`, `isLoading`, `usingMockData`, `candleCache`, `quoteCache`.

**Dlaczego `candleCache: Record<string, Candle[]>` z kluczem `symbol:timeframe`:** Jeden komponent cache'uje dane dla wielu kombinacji. Zmieniasz ticker z AAPL na MSFT i z powrotem — AAPL nie jest ponownie fetchowane. Cache żyje dopóki użytkownik nie odświeży strony.

**Ciekawostka:** Brak `persist` middleware — zamknięcie zakładki czyści cały cache. To jest świadomy wybór dla paper trading: ceny mają być zawsze aktualne, nie sprzed godziny.

---

## `src/hooks/useNewsFetch.ts`

**Co robi:** Custom hook. Wywołuje `POST /api/news/fetch` przy mount, potem co `intervalSeconds`. Guard przed double-fetch. Zwraca `{ fetchNow }`. (patrz Pattern #4, #5)

**Dlaczego hook a nie logika w komponencie:** `NewsFeed.tsx` jest już duży (~370 linii). Hook izoluje „jak i kiedy fetchować" od „jak wyświetlać dane". To separation of concerns.

**Ciekawostka:** `void fetchNow()` (linia 48) — `void` przed async funkcją oznacza „ignoruję zwracany Promise intencjonalnie". Bez `void` TypeScript/ESLint ostrzega o floating promise (promise bez .catch). Tu `fetchNow` obsługuje błędy wewnątrz siebie więc jest bezpiecznie.

---

## `src/components/agents/AgentSidebar.tsx`

**Co robi:** 5 kółek z ikonami agentów. Tylko News agent jest aktywny. Badge z unread count. Tooltip „Coming in Phase 2" dla disabled agentów.

**Dlaczego badge tylko dla news agenta:** Tylko newsStore ma tracking przeczytanych artykułów. Pozostałe agenty nie mają jeszcze zaimplementowanej logiki (Phase 2).

**Ciekawostka:** `const firstEnabled = agents.find((a) => a.enabled)?.id ?? null` na linia 43 — inicjalizuje `activeAgent` na pierwszy aktywny agent. Ale aktualnie `AgentSidebar` tylko przełącza wizualnie aktywny agent — nie przełącza panelu po prawej stronie. `activeAgent` state nie jest nigdzie używany poza renderowaniem aktywnego stylu. To kolejna rzecz na Phase 2.

---

## `src/components/agents/AgentChatPlaceholder.tsx`

**Co robi:** Placeholder UI z disabled input. Aktualnie **nieużywany** — nie jest importowany przez żaden aktywny komponent.

**Dlaczego wciąż w repo:** Historyczny plik z wcześniejszej wersji projektu, zanim `NewsFeed` zajął panel po prawej. Można by usunąć bez żadnego efektu.

---

## `src/components/agents/NewsFeed.tsx`

**Co robi:** Główny komponent right panelu. Używa `useNewsFetch`, wyświetla listę artykułów, obsługuje klikanie (trigger analizy AI), expand/collapse analizy, tooltips, impact scores.

**Dlaczego taki duży (~370 linii):** Zawiera subkomponent `ArticleCard` (linia 49–230) bezpośrednio w pliku. To debatable — można by wyciągnąć `ArticleCard` do osobnego pliku. Na tym etapie projektu jest ok, bo nie jest używany nigdzie indziej.

**Ciekawostka:** `analyzeErrors: Map<number, string>` zamiast `Record<number, string>`. W JavaScript klucze `Record` są zawsze string (nawet jak je typujesz jako number). `Record<number, string>` to TypeScript illusion — w runtime klucz i tak jest stringiem. `Map<number, string>` to prawdziwa mapa z number kluczami. To subtelna ale poprawna decyzja.

---

## `src/components/news/AiAnalysisBlock.tsx`

**Co robi:** Wrapper który dodaje animowaną zieloną ramkę do AI analizy. Używa IntersectionObserver do pauzowania animacji gdy element jest off-screen. (patrz Pattern #9)

**Dlaczego IntersectionObserver:** Lista artykułów może mieć 20+ kart, każda z animacją. Wszystkie animacje działające jednocześnie to marnowanie GPU. `rootMargin: '100px'` oznacza że animacja startuje 100px przed wejściem w viewport — płynne przejście bez „skoku".

**Ciekawostka:** `data-in-view={inView}` przekazuje boolean jako `data-attribute` do HTML. Wartości to `"true"` i `"false"` (stringi!). CSS selektor `[data-in-view="false"]` musi używać stringa — stąd cudzy stringi w CSS.

---

## `src/components/ui/Tooltip.tsx`

**Co robi:** Wrapper na Radix UI Tooltip. `TooltipProvider`, `Tooltip` komponent, `urgencyTooltip()` i `impactScoreTooltip()` helper functions.

**Dlaczego Radix a nie własny CSS tooltip:** Radix obsługuje accessibility (ARIA attributes, keyboard navigation, focus trap), portal rendering (żeby tooltip wychodził poza `overflow: hidden` rodzica), smart positioning (automatycznie flip gdy tooltip wychodzi poza viewport). Ręczne zrobienie tego jest trudne.

**Ciekawostka:** `impactScoreTooltip()` (linia 86–106) używa `\n\n` w stringu żeby tworzyć paragrafy. Tooltip rendering zaakceptuje to bo CSS ma `leading-relaxed` który respektuje białe znaki — ale technicznie to jest hacky. Lepiej byłoby przekazać JSX zamiast stringa.

---

## `src/components/market/MarketView.tsx`

**Co robi:** Container dla prawej strony left panel. Używa `dynamic()` dla StockChart, fetuje dane, zarządza loading state, wyświetla „Demo data" badge.

**Dlaczego dynamic import tu, nie w dashboard/page.tsx:** `MarketView` jest już Client Component. Można by zaimportować StockChart normalnie... ale Lightweight Charts używa `window` przy **imporcie** (nie tylko przy uruchomieniu), więc nawet w Client Component import crashuje przy SSR. `dynamic({ ssr: false })` sprawia że ten moduł w ogóle nie jest importowany po stronie serwera. (patrz Pattern #8)

**Ciekawostka:** `isLoading && candles.length === 0` (linia 97) — skeleton jest pokazywany tylko gdy ładujemy dane I nie ma jeszcze żadnych danych. Przy zmianie timeframe (gdy candles dla nowego TF są fetchowane, ale stare dane wciąż są w store) — skeleton nie wyskakuje. To lepszy UX.

---

## `src/components/market/StockChart.tsx`

**Co robi:** Lightweight Charts wrapper. Trzy useEffects: inicjalizacja (raz), switch series type, update data. Zawsze renderuje `<div ref>`, skeleton to absolute overlay. (patrz Pattern #9)

**Dlaczego trzy osobne useEffects:** Każdy odpowiada za inne zmiany. `[]` (raz) — stwórz chart. `[chartType]` — zmień typ serii bez rebuildu chartu. `[data]` — zaktualizuj dane. Gdyby to był jeden efekt `[chartType, data]`, każda zmiana danych niszczyłaby i odtwarzała serię — mignięcie na ekranie.

**Ciekawostka:** `toAreaData()` i `toCandleData()` to data mappery (linia 22–34). Lightweight Charts v5 jest bardzo restrykcyjne — `AreaSeries` przyjmuje tylko `{ time, value }`, crashuje na `{ time, open, high, low, close }`. To właśnie powodowało błąd „Area series item data value must be a number, got=undefined" — classic API mismatch.

---

## `src/components/market/TickerSidebar.tsx`

**Co robi:** Lista tickerów z watchlisty, 140px szeroka. Aktywny ticker ma zielony border po lewej i lekkie tło.

**Dlaczego subskrybuje tylko dwie wartości ze store:**
```ts
const activeTicker = useChartStore((s) => s.activeTicker);
const setActiveTicker = useChartStore((s) => s.setActiveTicker);
```
Komponent rerenderuje się tylko gdy `activeTicker` się zmieni — nie gdy zmienia się `isLoading`, `candleCache`, czy `chartType`. (patrz Pattern #7)

---

## `src/components/market/ChartHeader.tsx`

**Co robi:** Wyświetla symbol, sektor, cenę i zmianę. `isLoading` prop → skeleton pulsy zamiast ceny.

**Ciekawostka:** `const positive = (quote?.changePercent ?? 0) >= 0` — `??` to nullish coalescing, zwraca prawą stronę tylko dla `null` lub `undefined` (nie dla `0` czy `false`). Jeśli `quote` jest null (fetch quote failował), używa `0` jako default, co oznacza neutralny kolor tekstu. Dobra defensive coding.

---

## `src/components/market/ChartTypeToggle.tsx`

**Co robi:** Dwa przyciski Line/Candle w jednej grupie. Aktywny dostaje `text-accent bg-accent/10`.

**Ciekawostka:** `icon: <LineChart size={13} />` — JSX jako wartość w obiekcie. To jest możliwe bo JSX jest po prostu `React.createElement(...)` — wywołaniem funkcji, zwraca obiekt. Można go przechowywać w zmiennych, tablicach, obiektach.

---

## `src/components/market/TimeframeSelector.tsx`

**Co robi:** Rząd przycisków 1D/1W/1M/3M/1Y. Wywołuje `setTimeframe` w chartStore.

**Ciekawostka:** Brak `isLoading` disabling. User może klikać timeframe podczas gdy poprzedni fetch jeszcze trwa. `MarketView` ma `if (candleCache[cacheKey]) return` guard — nowy request nie wystartuje jeśli dane są już w cache. Jeśli nie są — stary request i nowy lecą równolegle, ostatni wygra przy `setLoading(false)`. Edge case, ale aplikacja papierowa — ok.

---

## `src/components/market/MarketViewPlaceholder.tsx`

**Co robi:** Stary placeholder z Phase 2 który wyświetlał statyczną listę tickerów zamiast chartu. Aktualnie **nieużywany** — `dashboard/page.tsx` importuje `MarketView`.

**Dlaczego wciąż w repo:** Historia projektu. Może służyć jako fallback jeśli ktoś chce zobaczyć jak wyglądał etap 2.

---

## Pliki konfiguracyjne (root)

`package.json` — zależności i skrypty. `npm run dev`, `npm run typecheck`.

`tsconfig.json` — konfiguracja TypeScript. Paths alias `@/*` → `./src/*` — stąd `import '@/lib/config'` zamiast `'../../../lib/config'`.

`tailwind.config.ts` — kolory theme: `accent` (`#00ff88`), `bg-base`, `bg-panel`, `border-subtle`. Bez tego Tailwind nie wiedziałby co to `text-accent`.

`next.config.mjs` — konfiguracja Next.js.

`postcss.config.mjs` — wymagany przez Tailwind do processowania CSS.

`config.yaml` — konfiguracja aplikacji: watchlist, AI provider, feature flags, dev settings. Edytujesz tu, nie w kodzie.
