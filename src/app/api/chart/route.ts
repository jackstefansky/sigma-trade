// ============================================================
// GET /api/chart?symbol=AAPL&timeframe=1M
// Server-side: fetches candles (Twelve Data) + quote (Finnhub)
// API keys never leave the server
// ============================================================
import { NextResponse } from 'next/server';
import { fetchCandles, fetchQuote } from '@/lib/chart/dataSource';
import { generateMockCandles } from '@/lib/chart/mockData';
import type { Timeframe, ChartApiResponse } from '@/lib/chart/types';

// Simple in-memory TTL cache (per server instance)
const cache = new Map<string, { data: ChartApiResponse; expiresAt: number }>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

const VALID_TIMEFRAMES = new Set<Timeframe>(['1D', '1W', '1M', '3M', '1Y']);

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') ?? '').toUpperCase().trim();
  const tf = searchParams.get('timeframe') as Timeframe | null;

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
  }
  const timeframe: Timeframe = tf && VALID_TIMEFRAMES.has(tf) ? tf : '1M';

  const cacheKey = `${symbol}:${timeframe}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.data);
  }

  // Fetch candles (Twelve Data) + quote (Finnhub) concurrently
  const [candlesResult, quoteResult] = await Promise.allSettled([
    fetchCandles(symbol, timeframe),
    fetchQuote(symbol),
  ]);

  let usingMockData = false;
  let candles =
    candlesResult.status === 'fulfilled'
      ? candlesResult.value
      : (() => {
          console.warn(`[chart] candle fetch failed for ${symbol}/${timeframe}:`, candlesResult.reason);
          usingMockData = true;
          return generateMockCandles(symbol, timeframe);
        })();

  const quote =
    quoteResult.status === 'fulfilled' ? quoteResult.value : null;

  if (quoteResult.status === 'rejected') {
    console.warn(`[chart] quote fetch failed for ${symbol}:`, quoteResult.reason);
  }

  const response: ChartApiResponse = { candles, quote, usingMockData };
  cache.set(cacheKey, { data: response, expiresAt: now + TTL_MS });

  return NextResponse.json(response);
}
