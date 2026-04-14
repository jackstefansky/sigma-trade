# Koncepty — głębsze wyjaśnienia

Siedem tematów które warto zrozumieć dobrze, bo pojawiają się w każdym projekcie React/Next.js.

---

## 1. Server Components vs Client Components

### Co to jest

W tradycyjnym React (Vite, Create React App) cały kod uruchamia się w przeglądarce. Next.js App Router zmienił tę zasadę: teraz możesz wybrać gdzie komponent jest wykonywany.

**Server Component** (domyślny w App Router):
- Renderuje się na serwerze
- Wynik (HTML) jest wysyłany do przeglądarki
- Może używać `fs`, `process.env`, bazy danych bezpośrednio
- **Nie może** używać `useState`, `useEffect`, event handlerów, Web APIs (`window`, `document`)

**Client Component** (`'use client'` na górze pliku):
- Renderuje się na serwerze (initial HTML) **i** w przeglądarce (po hydration)
- Może używać całego React API: hooks, event handlery
- Może używać Web APIs
- **Nie może** czytać plików z dysku, używać kluczy API bezpośrednio

### Dlaczego w tym projekcie

`dashboard/page.tsx` jest Server Component. Patrz na linia 7: `const config = loadConfig()`. `loadConfig()` używa `fs.readFileSync` — Node.js API. Gdybyś dodał `'use client'`, dostałbyś błąd: `Module not found: Can't resolve 'fs'`.

Ale `MarketView` musi być Client Component bo:
- Używa `useState` przez Zustand
- Używa `useEffect` do fetchowania
- Musi reagować na kliki usera (zmiana tickera)

### Jak przekazać dane z serwera do klienta

Przez props. Server Component czyta dane i przekazuje je w dół:
```tsx
// Server Component — czyta z dysku
const tickers = config.watchlist.tickers;
return <MarketView tickers={tickers} />;

// Client Component — dostaje przez props, nie musi fetchować
function MarketView({ tickers }: { tickers: WatchlistTicker[] }) { ... }
```

### Pułapki

Nie możesz importować Client Component w Server Component i oczekiwać że funkcje serwerowe będą dostępne w klientcie — granica między serwerem a klientem jest nieprzekraczalna. Możesz importować Server Component w Client Component jako children (ale nie wywołać funkcji serwerowych z klienta).

### Na rozmowie

Pytanie: „Jak zabezpieczasz klucze API w Next.js?" — odpowiedź: Server Components i API routes, klucze w `.env.local` bez prefixu `NEXT_PUBLIC_`.

---

## 2. useEffect cleanup z bibliotekami imperatywnymi

### Co to jest

React jest **deklaratywny** — opisujesz jak UI ma wyglądać, React zajmuje się renderowaniem. Biblioteki takie jak Lightweight Charts, Google Maps, Leaflet są **imperatywne** — mówisz im dokładnie co mają robić: `createChart()`, `chart.addSeries()`, `chart.remove()`.

Integracja imperatywnych bibliotek z React robi się przez `useRef` + `useEffect`.

### Jak to działa w StockChart

```ts
// src/components/market/StockChart.tsx

useEffect(() => {
  // SETUP: stwórz chart (operacja imperatywna)
  const chart = createChart(containerRef.current, { ... });
  const series = createSeries(chart);
  chartRef.current = chart;          // zapamiętaj referencję w ref
  seriesRef.current = series;

  const ro = new ResizeObserver(([entry]) => {
    chart.applyOptions({ width: entry.contentRect.width, ... });
  });
  ro.observe(containerRef.current);

  // CLEANUP: zniszcz gdy komponent się odmontowuje
  return () => {
    ro.disconnect();   // zatrzymaj ResizeObserver
    chart.remove();    // Lightweight Charts: usuwa canvas, listenery DOM
    chartRef.current = null;
    seriesRef.current = null;
  };
}, []); // [] = "odpal raz, po pierwszym renderze"
```

### Dlaczego `useRef` a nie `useState`

`chartRef` i `seriesRef` przechowują instancje obiektów. Zmieniając je nie chcemy rerenderować komponentu — chart żyje niezależnie od React render cycle. `useRef` daje mutable box który nie wywołuje rerenderów.

### Co by się stało bez cleanup

W React Dev Mode (Strict Mode) każdy effect jest odpalany dwa razy przy mount (React sprawdza czy cleanup działa poprawnie). Bez `chart.remove()`:
- Po pierwszym mount: chart tworzony ✓
- Po cleanup: chart nie usunięty ✗
- Po drugim mount: drugi chart tworzony na tym samym `<div>` → dwa charty nakładają się

Przy normalnym używaniu w produkcji: każda nawigacja away i back tworzy nowy chart bez niszczenia starego → memory leak.

### Pułapki

`useEffect(() => { ... }, [])` — pusta tablica znaczy „odpal raz po mount". Cleanup odpala przy unmount. NIGDY nie używaj pustej tablicy gdy wewnątrz efektu używasz wartości z props lub state — te wartości będą stale (stare) bo closure jest tworzony przy pierwszym renderze.

### Na rozmowie

Pytanie: „Jak integrujesz bibliotekę imperatywną z React?" → `useRef` + `useEffect` + cleanup. To klasyczny wzorzec i pojawia się w każdym projekcie który używa map, wykresów, edytorów.

---

## 3. Zustand — jak działa store i selektory

### Co to jest

Zustand to minimal state management library. Zamiast Reactowego `useState` (który jest lokalny dla komponentu), store jest globalny — każdy komponent może go odczytać i zaktualizować.

### Jak to działa

```ts
// src/lib/store/newsStore.ts
export const useNewsStore = create<NewsState & NewsActions>((set, get) => ({
  // stan początkowy
  articles: [],
  unreadCount: 0,

  // akcja — mutuje stan przez set()
  addArticles: (incoming) => {
    const { articles } = get();           // pobierz aktualny stan
    const next = [...incoming, ...articles];
    set({ articles: next, unreadCount: next.length }); // ustaw nowy stan
  },
}));
```

W komponencie:
```ts
const articles = useNewsStore((s) => s.articles);
// Komponent rerenderuje się gdy s.articles zmieni referencję
```

### Dlaczego selektory są ważne

```ts
// ZŁE — rerenderuje się gdy COKOLWIEK w store się zmieni
const store = useNewsStore();

// DOBRE — rerenderuje się tylko gdy unreadCount się zmieni
const unreadCount = useNewsStore((s) => s.unreadCount);
```

`AgentSidebar` subskrybuje tylko `unreadCount`. Gdy przychodzi nowy artykuł i `articles` tablica rośnie — `AgentSidebar` **nie rerenderuje się**, bo `unreadCount` nie zmienił się. To optymalizacja.

### Brak persist middleware

Oba store'y (`newsStore`, `chartStore`) nie mają `persist` middleware. Przy refreshie wszystko ginie. To jest okej dla paper trading:
- Newsy: Finnhub automatycznie fetchuje świeże przy mount
- Chart cache: pobiera aktualne dane z Twelve Data

Gdybyś chciał persist, dodałbyś:
```ts
import { persist } from 'zustand/middleware';
const useNewsStore = create(persist(
  (set, get) => ({ ... }),
  { name: 'news-store' }  // klucz w localStorage
));
```

### Na rozmowie

Pytanie: „Czym różni się Zustand od Redux?" → Zustand: mniej boilerplate, brak reducerów, brak action types, te same gwarancje immutability. Redux: większy ekosystem, Redux DevTools, lepszy dla bardzo dużych aplikacji z wieloma developerami.

---

## 4. Intersection Observer — wydajne śledzenie widoczności

### Co to jest

`IntersectionObserver` to Web API które mówi ci kiedy element wchodzi lub wychodzi z viewportu — bez scroll event listenerów. Scroll listenery odppalają się dziesiątki razy na sekundę. IntersectionObserver jest asynchroniczny i wydajny.

### Jak działa w AiAnalysisBlock

```ts
// src/components/news/AiAnalysisBlock.tsx
useEffect(() => {
  if (!ref.current) return;
  const observer = new IntersectionObserver(
    ([entry]) => setInView(entry.isIntersecting),
    { rootMargin: '100px' }  // ← margin poza viewport
  );
  observer.observe(ref.current);
  return () => observer.disconnect();  // cleanup!
}, []);
```

`rootMargin: '100px'` — powiększa "wirtualny viewport" o 100px w każdym kierunku. Element jest „widoczny" już 100px przed wejściem w widok. Dzięki temu animacja startuje zanim element dotrze do ekranu — płynny efekt.

### Dlaczego to ważne dla performance

Aplikacja może mieć 20+ artykułów z animowanymi borderami. Jeśli user nie przewinął, połowa jest off-screen. Animacje CSS działają na GPU i nie są procesowane przez JS — ale `will-change`, `transform` i `background-position` zajmują pamięć GPU.

`data-in-view="false"` → `animation-play-state: paused` → GPU nie procesuje animacji dla niewidocznych elementów.

### Alternatywa bez IntersectionObserver

Bez obserwatora wszystkie 20 animacji działałoby zawsze. Przy niskobudżetowych urządzeniach mobilnych to marnowanie baterii i może powodować stuttering. Nie ma prostego sposobu żeby zrobić to samemu bez IntersectionObserver.

### Na rozmowie

„Jak zoptymalizowałbyś listę z wieloma animacjami?" → IntersectionObserver do pauzowania animacji off-screen, `will-change: transform` dla animowanych elementów żeby wypchnąć je na osobną warstwę kompozytora.

---

## 5. TypeScript discriminated unions i type narrowing

### Co to jest

**Discriminated union** to typ który jest jednym z kilku wariantów, każdy z unikalnym literalnym polem (discriminant). TypeScript używa tego pola do zawężenia (narrowing) typu.

### W projekcie

```ts
// src/lib/news/types.ts
export type ChatBlock =
  | TextBlock           // { type: "text"; content: string }
  | NewsCardBlock       // { type: "news_card"; headline: string; ... }
  | AlertCardBlock      // { type: "alert_card"; severity: "warning"|"critical"; ... }
  | TrendInsightBlock;  // { type: "trend_insight"; articleCount: number; ... }
```

Pole `type` to discriminant. Gdy sprawdzisz jego wartość, TypeScript wie dokładnie z jakim wariantem masz do czynienia:

```ts
function render(block: ChatBlock) {
  if (block.type === 'news_card') {
    // Tu TypeScript wie że block: NewsCardBlock
    // Ma dostęp do block.headline, block.impactScore, etc.
    console.log(block.headline);  // OK
    console.log(block.content);   // ERROR — content jest w TextBlock, nie NewsCardBlock
  }
}
```

### Exhaustiveness checking

```ts
function render(block: ChatBlock): ReactNode {
  switch (block.type) {
    case 'text': return <TextMessage content={block.content} />;
    case 'news_card': return <NewsCard {...block} />;
    case 'alert_card': return <Alert {...block} />;
    case 'trend_insight': return <TrendCard {...block} />;
    default: {
      const _exhaustive: never = block;  // TypeScript error jeśli nie obsłużyłeś wszystkich wariantów
      return null;
    }
  }
}
```

Jeśli dodasz nowy wariant do `ChatBlock` i zapomnisz dodać `case` w switch — TypeScript błąd. To jest statyczna gwarancja że obsłużysz każdy przypadek.

### Dlaczego nie `ChatBlock` z `isNewsCard: boolean`

```ts
// Zła alternatywa
interface ChatBlock {
  type: string;
  isNewsCard?: boolean;
  isAlert?: boolean;
  headline?: string;   // tylko dla news_card
  severity?: string;   // tylko dla alert_card
}
```

To jest tzw. „stringly typed" lub „kitchen sink interface" — TypeScript nie może sprawdzić że jeśli `isNewsCard` jest true, to `headline` na pewno jest string. Musisz sam dbać o spójność.

### Na rozmowie

Pytanie: „Jak modelujesz polimorficzne dane w TypeScript?" → discriminated union + exhaustiveness check. Jedne z najczęstszych pytań na frontend interview.

---

## 6. CSS Animation Performance — dlaczego nie conic-gradient

### Dwie kategorie animacji CSS

**Źle** (powoduje layout lub paint):
- `width`, `height`, `top`, `left` — layout (reflow) → paint → composite
- `background-color`, `color`, `box-shadow` — paint → composite
- Przeglądarka musi przeliczać geometrię lub malować piksele od nowa

**Dobrze** (tylko composite):
- `transform: translate/scale/rotate` — tylko composite
- `opacity` — tylko composite
- `background-position` (przy `background-size: 300%`) — to jest na granicy, ale nowoczesne przeglądarki compositorują animacje gradientu gdy element jest na własnej warstwie

### W projekcie — dlaczego background-position a nie conic-gradient

Oryginalna implementacja używała `::before` pseudoelemenu z `conic-gradient` i `@keyframes { transform: rotate(360deg) }`. Dla prostokątnego (nie kwadratowego) kontenera powodowało to efekt „spotlight" — gradient był wyśrodkowany na środku elementu.

Aktualna implementacja:
```css
.ai-analysis-block {
  background: linear-gradient(135deg, rgba(0,255,136,0.5) 0%, ... 100%);
  background-size: 300% 300%;
  animation: ai-border-shimmer 6s linear infinite;
}

@keyframes ai-border-shimmer {
  0%   { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
}
```

Gradient „przesuwa się" przez 300% swojej własnej szerokości. Efekt: shimmer przechodzi od lewej do prawej, niezależnie od rozmiaru kontenera.

### Dlaczego `padding: 1px` zamiast `border`

Animowany `border` w CSS nie działa elegancko — `border-color` można animować, ale nie można animować `border-image` przez standardowe animacje. Trick `padding: 1px + wewnętrzny div z pełnym tłem` to klasyczny sposób na „border z gradientem". Zewnętrzny div ma gradient jako `background`, wewnętrzny div przykrywa wszystko poza 1px marginesem.

### `@media (prefers-reduced-motion: reduce)`

To media query sprawdza czy user ustawił w systemie opcję „redukcja ruchu" (dostępność dla osób z epilepsją, vestibular disorders). Gdy aktywne — animacja jest wyłączona, gradient jest statyczny.

---

## 7. Seeded PRNG i deterministyczne mock data

### Problem z Math.random()

`Math.random()` jest różny przy każdym wywołaniu, zawsze. Gdyby mock data używało `Math.random()`, wykres AAPL wyglądałby inaczej przy każdym załadowaniu strony — confusing przy testowaniu UI.

### XOR-shift PRNG

```ts
// src/lib/chart/mockData.ts
function makeRng(seed: number) {
  let s = seed >>> 0;  // konwersja na unsigned 32-bit integer
  return () => {
    s ^= s << 13;   // XOR z przesunięciem bitowym
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;  // normalizacja do [0, 1)
  };
}
```

XOR-shift to jeden z najprostszych algorytmów pseudo-random. Dla tego samego `seed` zawsze zwraca tę samą sekwencję liczb. Seed pochodzi z `hashString('AAPL:1M')` — dla każdej kombinacji symbol+timeframe jest inny.

### Hash function

```ts
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
```

To jest wariant DJB2 hash — prosty, szybki, dobre rozproszenie dla krótkich stringów.

### Momentum model

```ts
let momentum = 0;
for (let i = 0; i < count; i++) {
  const noise = (rng() - 0.5) * 0.015;
  momentum = momentum * 0.85 + noise;    // wygładzanie
  const changePercent = momentum + (rng() - 0.5) * 0.008;
  ...
}
```

`momentum * 0.85` to exponential moving average — momentum stopniowo gaśnie jeśli nie ma nowego impulsu. Wynik: cena ma tendencje (trendy) zamiast skakać losowo. Przypomina prawdziwy chart.

### Na rozmowie

Pytanie: „Jak robisz deterministyczne testy z losowymi danymi?" → seeded PRNG — to samo podejście używane w unit testach (np. `faker.js` z seed). Możesz odtworzyć ten sam „losowy" scenariusz.
