// ============================================================
// Chart types — shared between client and server
// ============================================================

export type Timeframe = '1D' | '1W' | '1M' | '3M' | '1Y';
export type ChartType = 'line' | 'candle';

/** OHLCV candle — time in Unix seconds (UTC) */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** Current price data from Finnhub /quote */
export interface QuoteData {
  price: number;       // current price
  change: number;      // day change $
  changePercent: number; // day change %
  high: number;
  low: number;
  open: number;
}

/** API response shape */
export interface ChartApiResponse {
  candles: Candle[];
  quote: QuoteData | null;
  usingMockData: boolean;
}
