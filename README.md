# StockPilot AI

Aplikacja do paper tradingu z wykorzystaniem AI agentów wspierających decyzje inwestycyjne. Umożliwia handel wirtualnym portfelem na podstawie rzeczywistych danych giełdowych.

## Funkcje

- **Market View**: Wykresy świecowe, order book, watchlist, zarządzanie pozycjami
- **AI Agenci**: News Agent (aktywny), Technical, Sentiment, Orchestrator, Coach (w fazie rozwoju)
- **Dashboard**: Interaktywny workspace z czatem i propozycjami trade'ów
- **Real-time Data**: Integracja z live market data

## Technologie

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS
- **Backend**: API routes w Next.js
- **AI**: Claude API
- **Charts**: Lightweight Charts v5
- **State Management**: Zustand

## Wymagania

- Node.js 18+
- npm lub yarn

## Instalacja

1. Sklonuj repozytorium:

   ```bash
   git clone <repo-url>
   cd sigma-trade
   ```

2. Zainstaluj zależności:

   ```bash
   npm install
   ```

3. Skonfiguruj środowisko (config.yaml)

## Uruchomienie

```bash
npm run dev
```

Aplikacja będzie dostępna na `http://localhost:3000`

## Struktura projektu

- `src/app/` - Strony Next.js
- `src/components/` - Komponenty React
- `src/lib/` - Narzędzia i konfiguracja
- `Docs/` - Dokumentacja projektu

## Dokumentacja

Szczegółowa dokumentacja znajduje się w folderze `Docs/`. Zalecana kolejność czytania:

1. `Docs/learning/00_START_HERE.md`
2. `Docs/PHASE_1_PLAN.md`
3. `Docs/dokumentacja.md`

## CI/CD

Pipeline składa się z trzech warstw:

| Trigger | Narzędzie | Co się dzieje |
|---|---|---|
| Commit w otwartym PR | Vercel GitHub Integration | Automatyczny preview URL widoczny w zakładce Checks PR |
| PR do `main` | GitHub Actions (`ci.yml`) | Równoległe joby: lint, typecheck, build — merge zablokowany do czasu przejścia wszystkich |
| Push tagu `v*` | GitHub Actions (`deploy-production.yml`) | Sprawdzenie jakości → deploy na Vercel Production |

**Flow dla dewelopera:**

1. Otwierasz PR → Vercel automatycznie buduje preview i wstawia link do Checks.
2. GitHub Actions uruchamia `npm run lint`, `npm run typecheck`, `npm run build` równolegle — merge do `main` wymaga ich przejścia.
3. Po gotowości do releasu tworzysz tag i wypychasz go:
   ```bash
   git tag v1.2.0
   git push origin v1.2.0
   ```
   Actions ponownie sprawdza jakość, a jeśli przejdzie — deployuje na produkcję.

Szczegółowa dokumentacja pipeline'u: [docs/CI.md](docs/CI.md).

## Status

Projekt w fazie rozwoju. Obecnie zaimplementowana Faza 1 z podstawowymi funkcjami market view i News Agent.
