# DCA — cykliczny zakup („kup za X$ co tydzień")

Automatyczny, powtarzalny market-buy: użytkownik zakłada plan „kupuj **za X$**
danego tickera **co tydzień**", a egzekucja dzieje się **w tle** — także gdy
user nie ma otwartej aplikacji. Per-portfel, chronione RLS.

> Faza 1 świadomie ogranicza się do interwału **tygodniowego** i akcji
> **long-only** (jak reszta portfela — patrz `portfolio.md`). Handlujemy
> akcjami **ułamkowymi** (precyzja 6 miejsc).

---

## Zasady

- **Budżet, nie liczba akcji.** Plan trzyma kwotę USD na cykl (`amount_usd`),
  nie ilość akcji. Co tydzień kupujemy `budżet / cena` akcji (ułamkowych).
- **Brak reszty.** Skoro handlujemy ułamkami, cały budżet jest inwestowany co do
  centa — nie ma „reszty" do przenoszenia (kolumna `carry_usd` została usunięta).
- **Pierwszy zakup od razu.** Tworząc plan (`POST /api/dca`) wykonujemy pierwszy
  zakup natychmiast po świeżej cenie; `next_run_at` ustawiamy na +7 dni. User
  od razu widzi pozycję, nie czeka na nocny skan crona.
- **Rynek zamknięty → zakup po ostatniej cenie zamknięcia (demo mode).** Cron
  **nie** odracza przebiegu — żeby dało się pracować/demować w weekend. (Docelowo
  można przywrócić blokadę — patrz `portfolio.md`, backlog.)
- **Limit cash.** Jeśli portfel nie ma środków, cykl kupuje za tyle ile zostało
  (lub jest pomijany przy zerowym cash); harmonogram i tak rusza o tydzień.

---

## Pipeline

```
UŻYTKOWNIK (zakładanie planu):
  DcaPanel → dcaStore.createPlan
    → POST /api/dca { ticker, amountUsd }      (klient usera, RLS)
         cena = getExecutionPrice(ticker)   ← waliduje ticker + pierwszy zakup
         { quantity } = planDcaBuy(amount, cena, cash)
         quantity > 0 → executeMarketOrder(buy)   ← PIERWSZY ZAKUP OD RAZU
         insert dca_plans: last_run_at = now(), next_run_at = +7 dni

CRON (kolejne cykle w tle, codziennie):
  Vercel Cron  "0 15 * * 1-5"
    → GET /api/dca/run   (Authorization: Bearer CRON_SECRET)
         service-role client (omija RLS):
           select dca_plans where status='active' and next_run_at <= now
           dla każdego planu:
             cena = getExecutionPrice(ticker)
             { quantity } = planDcaBuy(amount, cena, cash)
             quantity > 0 → executeMarketOrder(buy)   (positions/cash/trades)
             update plan: last_run_at, next_run_at += 7 dni
```

**Dlaczego dzienny skan, a nie harmonogram tygodniowy:** Vercel Hobby uruchamia
cron **maks. raz dziennie**. Dlatego cron odpala się codziennie i wybiera plany
„due dziś" po `next_run_at` — kadencja tygodniowa wynika z `next_run_at += 7 dni`,
nie z wyrażenia cron.

---

## Model danych

```
dca_plans (
  portfolio_id  → portfolios(id)   -- per-portfel, kaskada przy usunięciu
  ticker        text
  amount_usd    numeric            -- budżet na cykl
  status        active|paused|cancelled
  next_run_at   timestamptz        -- kiedy plan jest „due"
  last_run_at   timestamptz | null
)
```

> `carry_usd` usunięte w `0003_fractional_shares.sql` — przy akcjach ułamkowych
> nie ma reszty budżetu.

RLS: user operuje tylko na planach swojego portfela (`portfolio_id in (select id
from portfolios where user_id = auth.uid())`) — wzorzec z `0001`. Cron pomija RLS
kluczem **service-role**, więc każdy filtr per-portfel w `/api/dca/run` jest jawny.

---

## Kluczowe pliki

| Plik | Rola |
|---|---|
| `supabase/migrations/0002_dca_plans.sql` | tabela `dca_plans` + RLS + indeks pod skan |
| `supabase/migrations/0003_fractional_shares.sql` | ułamki (qty → numeric) + drop `carry_usd` |
| `src/lib/portfolio/types.ts` | `DcaPlan`, `DcaPlanRequest`, `DcaStatus` |
| `src/lib/portfolio/dca.ts` | czysta logika: `planDcaBuy` (ułamkowa qty), `nextWeeklyRun` (+7d) |
| `src/lib/portfolio/shares.ts` | precyzja akcji ułamkowych: `floorShares`/`roundShares`/`fmtShares` |
| `src/lib/portfolio/execute.ts` | `executeMarketOrder` — wspólna egzekucja buy/sell (cron + API) |
| `src/lib/supabase/service.ts` | klient service-role (TYLKO serwer, omija RLS) |
| `src/app/api/dca/route.ts` | GET / POST / DELETE planów (sesja usera) |
| `src/app/api/dca/run/route.ts` | endpoint crona — skan i egzekucja due-planów |
| `vercel.json` | harmonogram crona `0 15 * * 1-5` (sesja US) |
| `src/store/dcaStore.ts` | Zustand: lista planów + create/delete |
| `src/components/market/DcaPanel.tsx` | zakładka „DCA" — formularz + lista planów |
| `src/components/market/MarketRail.tsx` | ikona zakładki DCA (Repeat) |

---

## API

| Metoda / trasa | Auth | Działanie |
|---|---|---|
| `GET /api/dca` | sesja usera | lista planów usera |
| `POST /api/dca` | sesja usera | utwórz plan `{ ticker, amountUsd }` (waliduje ticker + pierwszy zakup od razu) |
| `DELETE /api/dca?id=` | sesja usera | usuń plan |
| `GET /api/dca/run` | `CRON_SECRET` | skan + egzekucja (Vercel Cron) |

---

## Zmienne środowiskowe

| Zmienna | Kiedy | Skąd |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | egzekucja w tle (cron) | Supabase → Settings → API |
| `CRON_SECRET` | autoryzacja `/api/dca/run` | dowolny losowy sekret; Vercel sam dokłada go w nagłówku `Authorization` |
| `FINNHUB_API_KEY` | cena egzekucji | — (już używane przez portfel) |

> Klucz service-role **omija RLS** — nigdy w kliencie. Bez `CRON_SECRET`
> endpoint `/api/dca/run` zwraca 401 (chroni przed publicznym wyzwalaniem).

---

## Wdrożenie (kroki ręczne)

1. **Migracje:** Supabase → SQL Editor → wklej `0002_dca_plans.sql`, potem
   `0003_fractional_shares.sql` → Run.
2. **Env:** ustaw `SUPABASE_SERVICE_ROLE_KEY` i `CRON_SECRET` na Vercel
   (Production + Preview) oraz lokalnie w `.env`.
3. Cron rejestruje się automatycznie z `vercel.json` przy deployu.

---

## Znane pułapki

| Problem | Fix / wyjaśnienie |
|---|---|
| Cron zwraca 401 | brak / zły `CRON_SECRET` w env Vercel |
| „SUPABASE_SERVICE_ROLE_KEY not set" | brak env; cron nie ma sesji usera, klucz jest wymagany |
| Plan założony w weekend kupuje od razu | poprawne (demo mode) — egzekucja po ostatniej cenie zamknięcia, bez odraczania |
| Zerowy cash → brak zakupu | poprawne — `planDcaBuy` zwraca quantity 0, cykl pominięty, harmonogram rusza dalej |
| Cron na Hobby nie odpala częściej niż raz/dzień | limit planu — kadencję tygodniową daje `next_run_at`, nie cron |
| Wiele planów na ten sam portfel w jednym przebiegu | cash pobierany świeżo per plan (sekwencyjnie), brak stale cache |
