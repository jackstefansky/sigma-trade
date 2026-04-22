# Jak korzystać z tej dokumentacji

Masz przed sobą 7 dokumentów zaprojektowanych specjalnie pod **naukę**, nie pod referencję.
Różnica jest prosta: dokumentacja referencyjna opisuje co kod robi. Ta opisuje **dlaczego**, **co by się stało gdyby zrobić inaczej**, i **jak to się nazywa na rozmowie kwalifikacyjnej**.

---

## Sugerowana kolejność

**Dzień 1 (~45 min)**
1. `01_ARCHITECTURE_TOUR.md` — zacznij tu. Zanim zaczniesz rozumieć detale, musisz widzieć big picture. Czytaj od góry, nie przeskakuj.
2. `02_DATA_FLOW.md` — trzy konkretne scenariusze. Otwórz VS Code obok i śledź w kodzie każdy krok.

**Dzień 2 (~45 min)**
3. `03_PATTERNS_CATALOG.md` — wzorce. Dla każdego: przeczytaj, znajdź w kodzie, zamknij dokument i spróbuj wytłumaczyć własnymi słowami co to robi i dlaczego.
4. `04_FILE_BY_FILE.md` — przejrzyj szybko. Wróć tu gdy masz pytanie o konkretny plik.

**Dzień 3 (~45 min)**
5. `05_CONCEPTS_DEEP_DIVE.md` — 7 tematów które zasługują na więcej uwagi. Czytaj powoli.
6. `06_STUDY_QUESTIONS.md` — **otwórz, przeczytaj pytania, zamknij i odpowiedz pisemnie** (dosłownie, zapisz gdzieś odpowiedzi). Nie zaglądaj do `07_ANSWERS.md` dopóki nie skończysz.
7. `07_ANSWERS.md` — sprawdź odpowiedzi.

---

## Jak testować swoją wiedzę

Najlepszy sposób nauki to **active recall** — zamiast czytać i myśleć „rozumiem", zamknij dokument i spróbuj odtworzyć to co przeczytałeś.

Dla każdego dokumentu: po przeczytaniu sekcji, zamknij i napisz własnymi słowami o czym była. Jeśli nie możesz — wróć i przeczytaj jeszcze raz. To niekomfortowe, ale tak działa pamięć długoterminowa.

`06_STUDY_QUESTIONS.md` — pytania są podzielone na Easy / Medium / Hard. Zanim sprawdzisz odpowiedzi, przypisz sobie pewność: „wiem", „nie jestem pewien", „nie wiem". To pomaga zobaczyć gdzie są luki.

---

## Gdzie szukać gdy coś jest niejasne

Dokumenty tłumaczą *dlaczego*, ale nie zastąpią oficjalnej dokumentacji gdy potrzebujesz szczegółów implementacji.

- **React** — https://react.dev (nie stary reactjs.org). Sekcja „Learn" to kurs, sekcja „Reference" to API.
- **Next.js App Router** — https://nextjs.org/docs/app. Kluczowe sekcje: „Routing", „Data Fetching", „Rendering".
- **Zustand** — https://zustand.docs.pmnd.rs. Bardzo krótka dokumentacja, można przeczytać całą w godzinę.
- **Lightweight Charts v5** — https://tradingview.github.io/lightweight-charts/. Sprawdź „Migration guide" jeśli znajdziesz przykłady w internecie — 90% to v4 i API jest inne.
- **TypeScript** — https://www.typescriptlang.org/docs/handbook/2/everyday-types.html. Zacznij od „Everyday Types".
- **MDN** — https://developer.mozilla.org — dla wszystkiego przeglądarkowego (IntersectionObserver, ResizeObserver, fetch, AbortSignal).

---

## Szacowany czas

Czytanie dokumentów: ~2.5 godziny łącznie.
Aktywne śledzenie w kodzie: dodaj ~1 godzinę.
Pytania z `06`: ~30 minut.

Nie spiesz się. Lepiej dobrze zrozumieć 3 koncepty niż pobieżnie przejść 10.
