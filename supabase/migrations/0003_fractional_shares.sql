-- ============================================================
-- Sigma Trade — akcje UŁAMKOWE (fractional shares)
-- ============================================================
-- Jak zastosować:
--   Supabase → SQL Editor → wklej całość → Run.
-- Idempotentne — można puścić ponownie.
--
-- Zmiana modelu: handlujemy ułamkami akcji (precyzja 6 miejsc, jak Robinhood).
--   • positions.quantity / trades.quantity: integer → numeric(18,6)
--   • DCA rezygnuje z carry_usd — kupujemy dokładnie budżet/cena, brak reszty.
-- Istniejące dane (całe akcje) pozostają poprawne po rozszerzeniu typu.
-- ============================================================

-- ── Akcje ułamkowe: rozszerz typ ilości (check quantity > 0 pozostaje ważny) ──
alter table public.positions alter column quantity type numeric(18,6);
alter table public.trades    alter column quantity type numeric(18,6);

-- ── DCA: koniec z resztą budżetu (carry) — ułamki nie zostawiają reszty ──
alter table public.dca_plans drop column if exists carry_usd;
