# Architektura StockPilot AI

## Co ta aplikacja robi

StockPilot AI to paper trading dashboard — pokazuje wykresy giełdowe i newsy finansowe, a AI (Gemini) analizuje każdy artykuł i ocenia jak bardzo powinien wpłynąć na cenę akcji. „Paper trading" znaczy że nie ma prawdziwych pieniędzy — to środowisko do nauki inwestowania.

Aplikacja jest zbudowana dla jednego usera. Brak logowania, brak bazy danych, brak multi-tenancy. To ważne — wiele decyzji architektonicznych (np. in-memory cache, brak persist w Zustand) ma sens właśnie dlatego.

---

## Stack i dlaczego tak

**Next.js 15 zamiast Vite + React**

Vite to bundler — daje czysty React bez żadnych konwencji. Next.js to framework z opiniami: routing plikowy, Server Components, API routes wbudowane. Tu kluczowy powód: API keys. Klucze do Finnhub, Gemini, Twelve Data nie mogą trafić do przeglądarki (każdy mógłby je ukraść z DevTools). Next.js daje API routes — kawałki kodu serwerowego które żyją w tym samym projekcie co frontend, ale wykonują się tylko na serwerze. Bez Next.js potrzebowałbyś osobnego backendu (Express, Fastify...).

**Zustand zamiast Redux**

Redux to przemysłowy standard z lat 2010s. Potężny, ale wymaga dużo boilerplate: actions, reducers, dispatchers, selectors, middleware. Zustand robi to samo w 1/5 kodu. Dla projektu tej skali Redux byłby over-engineering. Zustand 5.x nie ma nawet `persist` middleware w bundlu — trzeba go doinstalować osobno. Tu go nie ma, bo nie trzeba: stan resettuje się przy refreshu i to jest ok (newsy i tak trzeba refetchować).

**Lightweight Charts zamiast Recharts / Chart.js**

Recharts i Chart.js są zbudowane w React lub jako ogólne biblioteki. Lightweight Charts to biblioteka stworzona przez TradingView specjalnie do wykresów finansowych — candlestick, time series, crosshair, zoom. Recharts przy 10 000 świeczkach zwalnia. Lightweight Charts obsługuje miliony punktów płynnie. Jest też mniejszy.

**TypeScript**

Projekt jest w TypeScript, nie JavaScript. Dla kogoś z miesiącem nauki może wydawać się dodatkową komplikacją. Ale tu jest bardzo wart uwagi konkretny przykład: `ChatBlock = TextBlock | NewsCardBlock | AlertCardBlock | TrendInsightBlock`. Ten union type sprawia że TypeScript nie pozwoli ci zapomnieć o obsłudze jednego z przypadków. Bez TS dowiedziałbyś się o tym dopiero w runtime, przy userze.

---

## Diagram: jak dane płyną przez aplikację

```
USER
  │
  ▼
[ browser ]
  │
  ├─ reads config.yaml ──► Server Component (dashboard/page.tsx)
  │                              │ props (tickers, features)
  │                              ▼
  ├─────────────────────► MarketView (Client Component)
  │                              │
  │                              ├─ fetch("/api/chart?symbol=AAPL&timeframe=1M")
  │                              │         │
  │                              │    [ API route: chart/route.ts ]
  │                              │         │ Twelve Data → candles
  │                              │         │ Finnhub     → quote
  │                              │         ▼
  │                              │    chartStore (Zustand)
  │                              │         │
  │                              │    StockChart (Lightweight Charts)
  │                              │
  └─────────────────────► NewsFeed (Client Component)
                                 │
                                 ├─ POST("/api/news/fetch") on mount
                                 │         │
                                 │    [ API route: news/fetch/route.ts ]
                                 │         │ Finnhub company news → normalize → dedup
                                 │         │ fallback AI analysis (zerowy impactScore)
                                 │         ▼
                                 │    newsStore (Zustand) ──► AgentSidebar badge
                                 │
                                 └─ user clicks article
                                           │
                                    POST("/api/news/analyze")
                                           │
                                    [ API route: news/analyze/route.ts ]
                                           │ fetchArticleContent(url) — scraping HTML
                                           │ analyzeArticles() → Gemini/Claude API
                                           ▼
                                    newsStore.updateArticle()
                                           │
                                    ArticleCard re-renders z AI analysis
```

---

## Podział na Server / Client

To jest kluczowy podział w Next.js App Router. Wrócimy do niego szczegółowo w `05_CONCEPTS_DEEP_DIVE.md`, ale zapamiętaj jedną regułę:

> Wszystko co używa `useState`, `useEffect`, onClick, lub bibliotek przeglądarkowych — musi być Client Component (`'use client'` na górze).
> Wszystko co może zostać wygenerowane raz na serwerze i wysłane jako gotowy HTML — może być Server Component (domyślnie w App Router).

W tym projekcie:
- `dashboard/page.tsx` — Server Component. Czyta config, przekazuje tickers jako props.
- `MarketView`, `NewsFeed`, `AgentSidebar` — Client Components. Używają Zustand, event handlerów, efektów.
- API routes (`route.ts`) — działają tylko na serwerze. Tu żyją klucze API.

---

## Gdyby projekt miał urosnąć

Kilka rzeczy które zmieniłyby się przy skalowaniu:

**Baza danych** — teraz nie ma żadnej. Artykuły żyją w pamięci przeglądarki (Zustand), chart cache żyje w pamięci serwera (zwykła `Map`). Przy wielu userach lub gdy chcesz pamiętać historię, potrzeba bazy (PostgreSQL przez Prisma, albo prosto Redis do cache'owania).

**Auth** — teraz nie ma logowania. Dodanie NextAuth lub Clerk to ~100 linii konfiguracji, ale wymaga też zmiany API routes (sprawdzanie sesji przed każdym endpointem).

**WebSocket do real-time cen** — teraz cena odświeża się przy zmianie tickera/timeframe. Prawdziwy trading dashboard potrzebuje WebSocket (np. Finnhub ma `/ws` endpoint) który pushuje ceny co sekundę.

**ChatBlock UI** — typy `TextBlock`, `AlertCardBlock`, `TrendInsightBlock` są zdefiniowane w `src/lib/news/types.ts` ale nie ma jeszcze komponentów które je renderują. To jest szkielet pod Phase 3 — orchestrator agent który będzie miksował różne typy wiadomości w jeden feed.

**Rate limiting** — teraz każdy user (a właściwie każde odpalenie dev serwera) współdzieli ten sam API key. Gdyby było wielu userów, potrzeba kolejki żądań i backoff przy 429.
