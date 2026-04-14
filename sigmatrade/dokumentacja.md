---
name: StockPilot AI — architektura i struktura plików
description: Struktura folderów, komponenty, design system, reguły architektoniczne
type: project
---

## Design system

- Brand color (accent): `#00ff88` (neon green) — klasa Tailwind: `text-accent`, `bg-accent`, `ring-accent`
- Tło app: `bg-base: #0a0a0a`, panel: `bg-panel: #111111`, border: `border-subtle: #1f1f1f`
- Font: JetBrains Mono jako `font-mono` (zmienna `--font-jetbrains-mono`)
- Dark mode wymuszony przez `class="dark"` na `<html>`

## Layout dashboardu

```
TopBar (h-12, border-b)
├── Left panel 60%  — Market View
└── Right panel 40%
    ├── AgentSidebar 80px (w-20) — 5 awatarów pionowo
    └── Chat area flex-1
```

## Struktura plików (Etap 1+2, istniejące)

```
src/
  app/
    globals.css
    layout.tsx          — root layout, font, metadata
    page.tsx            — redirect → /dashboard
    dashboard/
      page.tsx          — async Server Component, czyta config, składa layout
  components/
    agents/
      AgentSidebar.tsx  — "use client", 5 awatarów, useState(activeAgent)
      AgentChatPlaceholder.tsx — "use client", placeholder + disabled input
    market/
      MarketViewPlaceholder.tsx — Server Component, lista tickerów z props
  lib/
    config.ts           — loadConfig(), getWatchlist(), getNewsAgentConfig()
    utils.ts            — cn() helper (clsx + tailwind-merge)
    news/
      types.ts          — wszystkie typy: RawArticle, AnalyzedArticle, ChatBlock, NewsAgentConfig, WatchlistTicker
```

## Agenci (5 awatarów w AgentSidebar)

| id           | Ikona (lucide) | Status             |
| ------------ | -------------- | ------------------ |
| news         | Newspaper      | enabled (Phase 1)  |
| technical    | BarChart3      | disabled (Phase 2) |
| sentiment    | MessageCircle  | disabled (Phase 2) |
| orchestrator | Target         | disabled (Phase 2) |
| coach        | GraduationCap  | disabled (Phase 2) |

**Why:** Tylko `news_agent.enabled === true` w config.yaml — reszta to Phase 2.
**How to apply:** Aktywność agentów sterowana przez `config.features.*_agent.enabled`. Wyłączeni mają `opacity-40`, tooltip "Coming in Phase 2".

## Reguły architektoniczne

- `loadConfig()` — tylko w Server Components (używa `fs`)
- `"use client"` — tylko gdy potrzebny stan lub event handlery
- `cn()` z `@/lib/utils` — wszędzie przy warunkowym łączeniu klas
- Bez zewnętrznych UI libraries (shadcn, MUI) — czysty Tailwind
- TypeScript strict — żadnych `any`
