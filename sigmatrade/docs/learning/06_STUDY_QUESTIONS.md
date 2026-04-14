# Pytania testujące zrozumienie

Podzielone na trzy poziomy. Zanim sprawdzisz odpowiedzi w `07_ANSWERS.md`, zapisz swoje odpowiedzi gdzieś — dosłownie, na papierze lub w notatniku. Przypisz sobie pewność: ✓ wiem / ? nie jestem pewien / ✗ nie wiem.

---

## EASY — czy czytałeś dokumenty?

**1.** W którym pliku definiowane są typy dla całego news pipeline (od Finnhub do UI)?

**2.** Co oznacza `'use client'` na górze pliku? Co się zmienia bez tej linii?

**3.** Dlaczego `loadConfig()` może używać `fs.readFileSync`, a `MarketView.tsx` nie może?

**4.** Jakie dwa zewnętrzne API używa projekt do danych giełdowych i za co każde odpowiada?

**5.** Czym jest `cn()` funkcja w `src/lib/utils.ts` i po co są dwie biblioteki zamiast jednej?

**6.** Co to jest `activeTicker` w `chartStore` i gdzie jest pierwsza raz ustawiany?

**7.** Po co jest `isFetchingRef` w `useNewsFetch.ts`? Dlaczego `useRef` a nie `useState`?

**8.** Co zwraca `impactScoreTooltip(0.8)` a co `impactScoreTooltip(-0.1)`? Opisz logikę.

**9.** Jak komponent wie że artykuł jest „przeanalizowany" przez AI (`isAnalyzed === true`)?

**10.** Co dzieje się z chart cache gdy użytkownik odświeży stronę przeglądarki?

---

## MEDIUM — czy rozumiesz jak to działa?

**11.** `StockChart.tsx` ma trzy `useEffect`. Napisz dla każdego: jaki ma dependency array i co robi. Dlaczego nie połączono ich w jeden?

**12.** User klika ticker MSFT w sidebarze drugi raz (już był wybrany wcześniej w tej samej sesji). Co dokładnie się dzieje — czy odpali się fetch do API?

**13.** Dlaczego `POST /api/news/fetch` nie zwraca artykułów z wypełnioną analizą AI (impactScore, urgency, tags), tylko z zerowymi wartościami?

**14.** Co by się stało gdybyś usunął `return () => { chart.remove(); ro.disconnect(); }` z `StockChart.tsx`? Opisz konkretnie co by się stało w dev mode i w produkcji.

**15.** Finnhub zwraca ten sam artykuł dla tickera AAPL i MSFT (obie spółki wspomniane). Co zrobi `dedup()` funkcja w `news/fetch/route.ts`?

**16.** `Promise.allSettled` w `chart/route.ts` — co konkretnie zwróci jeśli Twelve Data jest niedostępne ale Finnhub działa? Co pojawi się w UI?

**17.** Dlaczego `ChatBlock` union type jest zdefiniowany w typach ale nie jest renderowany w żadnym komponencie?

**18.** `addArticles()` w newsStore — co się stanie z kolejnością artykułów jeśli artykuł który już jest na liście dostanie zaktualizowaną analizę AI?

**19.** Co to `rootMargin: '100px'` w `AiAnalysisBlock.tsx`? Zmień go w myślach na `'0px'` — co by się zmieniło w zachowaniu animacji?

**20.** Dlaczego `StockChart` zawsze renderuje `<div ref={containerRef}>` nawet gdy `isLoading` jest true, zamiast warunkowo renderować skeleton?

---

## HARD — rozumowanie, implikacje, rozmowa kwalifikacyjna

**21.** Wyobraź sobie że chcesz dodać drugi panel z wykresem (split view — dwa tickery obok siebie). Jakie pliki musiałbyś zmodyfikować? Czy `chartStore.ts` wystarczy, czy potrzebujesz go przeprojektować?

**22.** Projekt używa in-memory cache w `chart/route.ts` (zwykła `Map`). Jakie są trzy konkretne problemy z tym podejściem gdy ten projekt poszedłby na produkcję z wieloma userami?

**23.** `RateLimitError` w `analyzer.ts` jest custom klasą. Dlaczego nie użyto zwykłego `throw new Error('rate limit')` i sprawdzenia `err.message.includes('rate limit')`?

**24.** `newsStore.addArticles()` przyjmuje `AnalyzedArticle[]` — ale artykuły z `/api/news/fetch` nie mają prawdziwej analizy (tags: [], impactScore: 0). Czy to jest problem typów? Czy `AnalyzedArticle` jest właściwym typem dla artykułów bez analizy?

**25.** Describe the complete chain of events when a user changes the timeframe from `1M` to `1Y` — starting from the button click, through all state changes, API calls, and ending with the chart rendering new data. Name specific files and functions at each step.

**26.** W `AiAnalysisBlock.tsx` IntersectionObserver ma `return () => observer.disconnect()` cleanup. Co by się stało bez tej linii? Dodaj konkretny scenariusz.

**27.** Dlaczego `'use client'` musi być dosłownie pierwszą linią pliku (przed importami)? Co się stanie gdy przeniesiesz ją za pierwsze `import`?

**28.** Projekt scrappuje treść artykułów przez `fetchArticleContent()` w `analyze/route.ts`. Wymień trzy konkretne sytuacje gdy to nie zadziała i jak można by to naprawić.

**29.** `toAreaData()` i `toCandleData()` w `StockChart.tsx` — zdefiniowane jako zwykłe funkcje poza komponentem (nie `useCallback`). Czy to jest prawidłowe? Czy dodanie `useCallback` byłoby lepsze?

**30.** Gdybyś chciał żeby nieuczytane artykuły były zapisywane w `localStorage` i przetrwały refresh strony — co konkretnie byś zmienił w `newsStore.ts`? Jakie edge case musisz rozważyć przy serializacji `Set<number>` do JSON?
