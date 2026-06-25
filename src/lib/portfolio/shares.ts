// ============================================================
// Akcje ułamkowe — wspólna precyzja i helpery konwersji $ ↔ ilość.
//   • SHARES_DECIMALS — ile miejsc po przecinku trzymamy (jak Robinhood: 6)
//   • floorShares     — zaokrąglenie W DÓŁ (zakup: nigdy nie przekroczyć budżetu)
//   • roundShares     — zaokrąglenie do precyzji (ilość podana wprost)
//   • fmtShares       — wyświetlanie bez zbędnych zer (10 → "10", 0.3606 → "0.3606")
// ============================================================

export const SHARES_DECIMALS = 6;
const FACTOR = 10 ** SHARES_DECIMALS;

export const floorShares = (n: number): number => Math.floor(n * FACTOR) / FACTOR;
export const roundShares = (n: number): number => Math.round(n * FACTOR) / FACTOR;

export const fmtShares = (n: number): string =>
  n.toLocaleString('en-US', { maximumFractionDigits: SHARES_DECIMALS });
