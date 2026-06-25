// ============================================================
// DCA — czysta logika (bez I/O), współdzielona przez API i cron.
//   • WEEKLY_MS / nextWeeklyRun — przesunięcie harmonogramu o +7 dni
//   • planDcaBuy — ile akcji (ułamkowych) kupić za budżet w danym cyklu
// ============================================================
import { floorShares } from './shares';

export const WEEKLY_MS = 7 * 24 * 60 * 60 * 1000;

// Następny termin = poprzedni + 7 dni. Gdyby plan zalegał (np. rynek był
// zamknięty kilka dni), przesuwamy aż termin wypadnie w przyszłości — bez
// „nadrabiania" wielu zakupów naraz.
export function nextWeeklyRun(from: Date, now: Date = new Date()): Date {
  let next = from.getTime() + WEEKLY_MS;
  while (next <= now.getTime()) next += WEEKLY_MS;
  return new Date(next);
}

export interface DcaBuyPlan {
  quantity: number; // akcje ułamkowe do kupienia (może być 0)
  spent: number;    // quantity × price
}

// Handlujemy akcjami UŁAMKOWYMI: za cały budżet (ograniczony dostępnym cash)
// kupujemy dokładnie `budżet / cena` akcji — nie ma reszty do przenoszenia.
export function planDcaBuy(budget: number, price: number, cash: number): DcaBuyPlan {
  if (price <= 0) return { quantity: 0, spent: 0 };

  const spend = Math.min(budget, cash);
  const quantity = floorShares(spend / price);

  return { quantity, spent: quantity * price };
}
