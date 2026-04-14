// ============================================================
// Chart data source — Twelve Data implementation (server-side only)
// ============================================================
import type { Candle, Timeframe, QuoteData } from './types';

// Timeframe → Twelve Data interval + candle count
const TD_CONFIG: Record<Timeframe, { interval: string; outputsize: number }> = {
  '1D': { interval: '5min',  outputsize: 78  },
  '1W': { interval: '1h',    outputsize: 35  },
  '1M': { interval: '1day',  outputsize: 30  },
  '3M': { interval: '1day',  outputsize: 90  },
  '1Y': { interval: '1week', outputsize: 52  },
};

interface TwelveDataValue {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
}

interface TwelveDataResponse {
  meta?: { symbol: string };
  values?: TwelveDataValue[];
  message?: string;
  code?: number;
}

function parseTime(datetime: string): number {
  // "2026-04-10" or "2026-04-10 09:30:00"
  const iso = datetime.includes(' ')
    ? datetime.replace(' ', 'T') + 'Z'
    : datetime + 'T00:00:00Z';
  return Math.floor(new Date(iso).getTime() / 1000);
}

export async function fetchCandles(symbol: string, timeframe: Timeframe): Promise<Candle[]> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) throw new Error('TWELVEDATA_API_KEY not set');

  const { interval, outputsize } = TD_CONFIG[timeframe];
  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${interval}&outputsize=${outputsize}&apikey=${apiKey}`;

  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Twelve Data HTTP ${res.status}`);

  const data = await res.json() as TwelveDataResponse;

  if (!data.values || data.values.length === 0) {
    throw new Error(`Twelve Data: no values (${data.message ?? 'unknown error'})`);
  }

  // Twelve Data returns newest-first → reverse to ascending
  return data.values
    .slice()
    .reverse()
    .map((v) => ({
      time: parseTime(v.datetime),
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: v.volume ? parseInt(v.volume) : undefined,
    }));
}

// ----------------------------------------------------------------
// Finnhub quote (current price + day change)
// ----------------------------------------------------------------

interface FinnhubQuote {
  c: number;  // current
  d: number;  // change
  dp: number; // change %
  h: number;  // high
  l: number;  // low
  o: number;  // open
  pc: number; // prev close
}

export async function fetchQuote(symbol: string): Promise<QuoteData> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) throw new Error('FINNHUB_API_KEY not set');

  const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Finnhub quote HTTP ${res.status}`);

  const q = await res.json() as FinnhubQuote;
  return {
    price: q.c,
    change: q.d,
    changePercent: q.dp,
    high: q.h,
    low: q.l,
    open: q.o,
  };
}
