# StockPilot AI — Faza 1: Fundament

> Status: DRAFT v0.1 — do walidacji z zespołem
> Stack: Next.js (App Router) + Claude API + real-time market data
> Deployment: localhost → Vercel

---

## 1. Wizja produktu

Aplikacja do **paper tradingu z live data**, w której użytkownik handluje wirtualnym portfelem na prawdziwych cenach giełdowych, wspierany przez zespół wyspecjalizowanych agentów AI.

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  TopBar: portfolio value | P&L | cash | notifications   │
├──────────────────────────┬──────────────────────────────┤
│                          │  Agent Workspace             │
│   Market View            │  ┌────────────────────────┐  │
│                          │  │ [News] [Tech] [Sent]   │  │
│   • Chart (candlestick)  │  │ [Orch] [Coach] [Strat] │  │
│   • Order book           │  ├────────────────────────┤  │
│   • Watchlist             │  │                        │  │
│   • Position manager     │  │  Chat + interactive     │  │
│   • Trade execution      │  │  elements:              │  │
│                          │  │  - trade proposals      │  │
│                          │  │  - inline charts        │  │
│                          │  │  - approval buttons     │  │
│                          │  │  - alerts/warnings      │  │
│                          │  │                        │  │
│                          │  ├────────────────────────┤  │
│                          │  │  [  message input  ]   │  │
│                          │  └────────────────────────┘  │
└──────────────────────────┴──────────────────────────────┘
```

Lewa strona = standardowe narzędzia tradingowe (chart, orderbook, pozycje).
Prawa strona = workspace agentów z tabami do szybkiego przełączania + czat z interaktywnymi elementami (propozycje trade'ów, mini-wykresy, przyciski akcji). Agenci wysyłają notyfikacje push.

---

## 2. Agenci AI — role i kontrakty

### 2.1 Strategy Agent (jednorazowy setup → ewolucja do dynamicznego)

**Rola:** Konfiguruje profil inwestycyjny użytkownika na podstawie konwersacji.

**Flow:**
1. Zadaje 5-7 pytań (tolerancja ryzyka, budżet, horyzont, typy instrumentów, sektory)
2. Generuje `UserStrategy` — dokument definiujący reguły portfela
3. Pozostałe agenci otrzymują `UserStrategy` jako kontekst

**Faza 1:** Statyczna konfiguracja (raz ustalona, ręczna edycja przez użytkownika).
**Faza 2:** Dynamiczna — Strategy Agent analizuje performance i sugeruje zmiany.

**Contract:**
```typescript
// Input: konwersacja z użytkownikiem
// Output:
interface UserStrategy {
  version: number;                    // wersjonowanie od dnia 0
  createdAt: string;
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  maxPositionSize: number;            // % portfela na jedną pozycję
  maxTotalExposure: number;           // % portfela zainwestowane
  instruments: ('stocks' | 'etf' | 'crypto' | 'cfd')[];
  sectors: string[];                  // preferowane sektory
  holdingPeriod: 'day' | 'swing' | 'position';  // horyzont
  stopLossDefault: number;            // domyślny stop-loss %
  takeProfitDefault: number;          // domyślny take-profit %
  weeklyBudget: number;               // max nowych inwestycji/tydzień
}
```

---

### 2.2 News Agent

**Rola:** Skanuje newsy i eventy dla obserwowanych tickerów.

**Źródła danych (do doprecyzowania):** NewsAPI, RSS financial feeds, earnings calendars.

**Contract:**
```typescript
// Input:
interface NewsRequest {
  tickers: string[];
  timeframe: '24h' | '7d' | '30d';
}

// Output:
interface NewsReport {
  ticker: string;
  events: {
    headline: string;
    source: string;
    publishedAt: string;
    category: 'earnings' | 'macro' | 'sector' | 'company' | 'regulatory';
    impactScore: number;    // -1.0 do +1.0
    summary: string;        // 2-3 zdania interpretacji
  }[];
  overallImpact: number;    // zagregowany wpływ
  keyTakeaway: string;      // jedno zdanie podsumowania
}
```

---

### 2.3 Technical Analyst Agent

**Rola:** Analizuje dane cenowe, liczy wskaźniki, interpretuje sygnały.

**Źródło danych:** API z danymi OHLCV (do doprecyzowania — kandydaci: Yahoo Finance, Alpha Vantage, Polygon.io, Twelve Data).

**Contract:**
```typescript
// Input:
interface TechnicalRequest {
  ticker: string;
  timeframe: '1d' | '1w' | '1m';
  indicators: string[];  // ['RSI', 'MACD', 'Bollinger', 'SMA_50', 'SMA_200']
}

// Output:
interface TechnicalReport {
  ticker: string;
  price: { current: number; change24h: number; change7d: number };
  indicators: {
    name: string;
    value: number | object;
    signal: 'bullish' | 'bearish' | 'neutral';
    interpretation: string;  // "RSI at 72 suggests overbought conditions"
  }[];
  support: number[];
  resistance: number[];
  overallSignal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  confidence: number;  // 0-1
}
```

---

### 2.4 Sentiment Agent

**Rola:** Analizuje sentyment rynkowy z social media i nagłówków.

**Źródła:** Reddit API (r/wallstreetbets, r/investing, r/stocks), nagłówki newsów.

**Contract:**
```typescript
// Input:
interface SentimentRequest {
  ticker: string;
  timeframe: '24h' | '7d';
}

// Output:
interface SentimentReport {
  ticker: string;
  overallSentiment: number;  // -1.0 do +1.0
  volume: number;            // liczba wzmianek
  trend: 'rising' | 'falling' | 'stable';  // zmiana sentymentu
  sources: {
    platform: string;
    sentiment: number;
    sampleSize: number;
    topMentions: string[];   // przykładowe tematy
  }[];
  alerts: string[];  // np. "Unusual spike in mentions on WSB"
}
```

---

### 2.5 Orchestrator Agent

**Rola:** Syntetyzuje raporty od News, Technical i Sentiment agentów. Generuje finalną rekomendację.

**Contract:**
```typescript
// Input: raporty od trzech agentów + UserStrategy
interface OrchestratorInput {
  news: NewsReport;
  technical: TechnicalReport;
  sentiment: SentimentReport;
  strategy: UserStrategy;
  portfolio: PortfolioState;
}

// Output:
interface Recommendation {
  ticker: string;
  action: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number;          // 0-1
  reasoning: string;           // 3-5 zdań uzasadnienia
  breakdown: {
    technical: { weight: number; signal: string };
    news: { weight: number; signal: string };
    sentiment: { weight: number; signal: string };
  };
  suggestedEntry?: number;     // sugerowana cena wejścia
  suggestedStopLoss?: number;
  suggestedTakeProfit?: number;
  positionSize?: number;       // sugerowany % portfela
  riskWarnings: string[];      // np. "Exceeds your max position size"
}
```

---

### 2.6 Coach Agent (Asystent samouczka)

**Rola:** Monitoruje ruchy użytkownika, uczy, chwali za dobre decyzje, ostrzega przed złymi wzorcami.

**Kluczowe zachowania:**
- **Proaktywny:** Nie czeka na pytanie. Reaguje na akcje użytkownika.
- **Debrief po trade'ach:** Po zamknięciu pozycji analizuje co poszło dobrze/źle.
- **Wykrywanie wzorców:** Identyfikuje powtarzające się błędy (np. "3 razy z rzędu kupiłeś na szczycie RSI").
- **Edukacja kontekstowa:** Gdy użytkownik napotka nowy koncept, wyjaśnia go w kontekście aktualnej sytuacji.
- **Pozytywne wzmocnienie:** Chwali trafne decyzje z wyjaśnieniem dlaczego były dobre.
- **Eskalacja:** Jeśli użytkownik konsekwentnie ignoruje ostrzeżenia, eskaluje ton.

**Contract:**
```typescript
// Input:
interface CoachInput {
  action: UserAction;           // co użytkownik właśnie zrobił
  portfolio: PortfolioState;    // aktualny stan portfela
  strategy: UserStrategy;       // profil użytkownika
  tradeHistory: Trade[];        // historia transakcji
  previousCoachMessages: Message[];  // kontekst konwersacji
}

// Output:
interface CoachResponse {
  type: 'praise' | 'warning' | 'lesson' | 'debrief' | 'alert';
  priority: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  relatedConcept?: string;      // np. "stop-loss", "position sizing"
  suggestedReading?: string;    // link do lekcji
  patternDetected?: {
    name: string;               // np. "FOMO buying"
    occurrences: number;
    description: string;
  };
  notification: boolean;        // czy wysłać jako push notification
}
```

---

## 3. Model danych — PortfolioState

```typescript
interface PortfolioState {
  userId: string;
  cash: number;
  initialBalance: number;
  positions: Position[];
  totalValue: number;          // cash + market value of positions
  totalPnL: number;
  totalPnLPercent: number;
}

interface Position {
  id: string;
  ticker: string;
  side: 'long' | 'short';
  quantity: number;
  avgEntryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  stopLoss?: number;
  takeProfit?: number;
  openedAt: string;
  triggeredBy: string;         // 'user' | 'orchestrator_recommendation'
}

interface Trade {
  id: string;
  ticker: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  executedAt: string;
  reason: string;              // dlaczego użytkownik wykonał trade
  recommendationId?: string;   // powiązanie z rekomendacją agenta
  pnl?: number;                // jeśli zamknięcie pozycji
}

interface UserAction {
  type: 'open_position' | 'close_position' | 'modify_stop_loss'
        | 'ignore_recommendation' | 'follow_recommendation'
        | 'add_to_watchlist' | 'ask_question';
  payload: Record<string, any>;
  timestamp: string;
}
```

---

## 4. Onboarding Flow

```
┌─────────────────────────────────────────┐
│  1. WELCOME                             │
│  "Witaj w StockPilot AI"                │
│  Krótkie intro: co to jest paper        │
│  trading, jak działa app                │
├─────────────────────────────────────────┤
│  2. KNOWLEDGE CHECK (Coach Agent)       │
│  Quiz 5-8 pytań:                        │
│  - Co to jest akcja?                    │
│  - Co oznacza P/E ratio?               │
│  - Co to stop-loss?                     │
│  - Różnica ETF vs akcje?               │
│  → Określenie poziomu: beginner /       │
│    intermediate / advanced              │
│  → Coach dostosowuje szczegółowość     │
│    wyjaśnień                            │
├─────────────────────────────────────────┤
│  3. STRATEGY SETUP (Strategy Agent)     │
│  Konwersacja:                           │
│  - Ile chcesz zainwestować wirtualnie? │
│  - Jaki poziom ryzyka akceptujesz?     │
│  - Jakie instrumenty Cię interesują?   │
│  - Preferowane sektory?                │
│  - Horyzont inwestycyjny?              │
│  → Generacja UserStrategy              │
│  → Preview + potwierdzenie             │
├─────────────────────────────────────────┤
│  4. GUIDED FIRST TRADE                  │
│  Coach prowadzi za rękę:               │
│  - "Dodajmy AAPL do watchlisty"        │
│  - "Zobacz co mówią agenci"            │
│  - "Spróbuj złożyć pierwszy order"     │
│  → Pierwszy trade z pełnym             │
│    komentarzem Coacha                   │
└─────────────────────────────────────────┘
```

---

## 5. Interaktywne elementy w czacie agentów

Czat z agentami to nie zwykły tekst — zawiera interaktywne bloki:

```typescript
type ChatBlock =
  | { type: 'text'; content: string }
  | { type: 'trade_proposal'; data: Recommendation; actions: ['accept', 'reject', 'modify'] }
  | { type: 'mini_chart'; ticker: string; timeframe: string; indicators: string[] }
  | { type: 'alert'; severity: 'info' | 'warning' | 'danger'; message: string }
  | { type: 'quiz'; question: string; options: string[]; correctIndex: number }
  | { type: 'comparison'; items: { label: string; value: number }[] }
  | { type: 'position_summary'; position: Position }
  | { type: 'lesson_card'; title: string; content: string; concept: string };
```

---

## 6. Plan zadań — Faza 1

### Krok 1: Decyzje architektoniczne [TO DO — wymaga dyskusji]
- [ ] Wybór API do danych giełdowych (porównanie: latency, darmowy tier, coverage)
- [ ] Wybór state management (Zustand? Jotai? Context?)
- [ ] Real-time updates: WebSocket vs polling
- [ ] Struktura projektu Next.js (App Router, layout, routing)
- [ ] Storage: na razie localStorage / in-memory, potem Supabase/Firebase

### Krok 2: Scaffold projektu
- [ ] Inicjalizacja Next.js + Tailwind + shadcn/ui
- [ ] Podstawowy layout: 2-panel split
- [ ] Routing: /onboarding, /dashboard, /settings
- [ ] Placeholder komponenty dla każdego panelu

### Krok 3: Onboarding
- [ ] Welcome screen
- [ ] Knowledge quiz (Coach Agent integration)
- [ ] Strategy setup conversation (Strategy Agent)
- [ ] Strategy preview + confirm
- [ ] Guided first trade flow

### Krok 4: Data pipeline (single ticker)
- [ ] Podłączenie API z danymi giełdowymi
- [ ] Real-time price feed → chart
- [ ] OHLCV data → Technical Analyst Agent
- [ ] News feed → News Agent
- [ ] Sentiment data → Sentiment Agent
- [ ] Orchestrator syntetyzuje raporty

---

## 7. Otwarte pytania do rozstrzygnięcia

| # | Pytanie | Opcje | Decyzja |
|---|---------|-------|---------|
| 1 | Źródło danych giełdowych | Yahoo Finance (darmowy, limity) / Alpha Vantage (klucz, 5 req/min) / Polygon.io (płatny, solidny) / Twelve Data (dobry free tier) | TBD |
| 2 | State management | Zustand (lekki) / Jotai (atomowy) / Redux Toolkit | TBD |
| 3 | Real-time updates | WebSocket (jeśli API wspiera) / Polling co 5-15s / SSE | TBD |
| 4 | Agenci: server-side czy client-side? | API routes (Next.js) — bezpieczniejsze dla kluczy API | Rekomendacja: server |
| 5 | Ile tickerów na start? | 1 (AAPL) / 5 (FAANG) / konfigurowalne | TBD |
| 6 | Waluta wirtualnego portfela | USD / PLN / konfigurowalne | TBD |
| 7 | Nazwa projektu | StockPilot AI / inna | TBD |

---

## 8. Strategia promptów — jak to przełożymy na repozytorium

Po zatwierdzeniu tego planu, stworzymy pełną strukturę promptów:

```
stockpilot/
├── AGENTS.md                     ← punkt startowy dla claude code
├── PROJECT_SPEC.md               ← ten dokument → rozbudowany
│
├── agents/                       ← system prompty agentów AI
│   ├── STRATEGY_AGENT.md
│   ├── NEWS_AGENT.md
│   ├── TECHNICAL_AGENT.md
│   ├── SENTIMENT_AGENT.md
│   ├── ORCHESTRATOR_AGENT.md
│   └── COACH_AGENT.md
│
├── spec/
│   ├── data-model/SCHEMA.md      ← typy TS z sekcji 3
│   ├── flows/
│   │   ├── ONBOARDING.md
│   │   ├── TRADE_EXECUTION.md
│   │   ├── AGENT_PIPELINE.md     ← jak agenci komunikują się między sobą
│   │   └── NOTIFICATION.md
│   └── ui/
│       ├── DESIGN_SYSTEM.md
│       ├── LAYOUT.md             ← wireframe z sekcji 1
│       └── CHAT_BLOCKS.md        ← interaktywne elementy z sekcji 5
│
├── prompts/
│   ├── setup/INIT_PROJECT.md
│   ├── components/
│   ├── features/
│   └── api/
│
└── tasks/
    ├── TASK_ORDER.md
    └── 01-XX_*.md
```

---

## Następne kroki

1. **Przegląd tego dokumentu** — uwagi, zmiany, decyzje na otwarte pytania
2. **Rozstrzygnięcie źródła danych giełdowych** — to blokuje Krok 4
3. **Zatwierdzenie agent contracts** — to blokuje pisanie system promptów
4. Po zatwierdzeniu: generujemy pełne `PROJECT_SPEC.md` i system prompty agentów
