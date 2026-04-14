'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useChartStore } from '@/store/chartStore';
import type { WatchlistTicker } from '@/lib/news/types';
import type { ChartApiResponse } from '@/lib/chart/types';
import TickerSidebar from './TickerSidebar';
import ChartHeader from './ChartHeader';
import ChartTypeToggle from './ChartTypeToggle';
import TimeframeSelector from './TimeframeSelector';

// SSR: Lightweight Charts needs browser APIs
const StockChart = dynamic(() => import('./StockChart'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="font-mono text-xs text-zinc-700">Loading chart…</div>
    </div>
  ),
});

interface MarketViewProps {
  tickers: WatchlistTicker[];
}

export default function MarketView({ tickers }: MarketViewProps) {
  const {
    activeTicker, timeframe, chartType,
    isLoading, usingMockData,
    candleCache, quoteCache,
    setActiveTicker, setLoading, setUsingMockData,
    setCandleCache, setQuoteCache,
  } = useChartStore();

  // Init: set first ticker on mount
  useEffect(() => {
    if (tickers.length > 0 && !activeTicker) {
      setActiveTicker(tickers[0].symbol);
    }
  }, [tickers, activeTicker, setActiveTicker]);

  // Fetch when ticker or timeframe changes
  useEffect(() => {
    if (!activeTicker) return;
    const cacheKey = `${activeTicker}:${timeframe}`;
    if (candleCache[cacheKey]) return; // already cached

    setLoading(true);
    setUsingMockData(false);

    fetch(`/api/chart?symbol=${activeTicker}&timeframe=${timeframe}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ChartApiResponse>;
      })
      .then((data) => {
        setCandleCache(cacheKey, data.candles);
        if (data.quote) setQuoteCache(activeTicker, data.quote);
        setUsingMockData(data.usingMockData);
      })
      .catch((err) => {
        console.warn('[MarketView] fetch failed:', err);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTicker, timeframe]);

  const cacheKey = `${activeTicker}:${timeframe}`;
  const candles  = candleCache[cacheKey] ?? [];
  const quote    = activeTicker ? quoteCache[activeTicker] : undefined;
  const activeMeta = tickers.find((t) => t.symbol === activeTicker);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Ticker sidebar */}
      <TickerSidebar tickers={tickers} />

      {/* Chart area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle shrink-0 gap-4">
          <ChartHeader ticker={activeMeta} quote={quote} isLoading={isLoading} />
          <div className="flex items-center gap-2 shrink-0">
            {usingMockData && (
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-600 uppercase tracking-wider">
                Demo data
              </span>
            )}
            <ChartTypeToggle />
          </div>
        </div>

        {/* Chart — fills remaining space */}
        <div className="flex-1 relative overflow-hidden">
          <StockChart data={candles} chartType={chartType} isLoading={isLoading && candles.length === 0} />
        </div>

        {/* Timeframe selector */}
        <TimeframeSelector />
      </div>
    </div>
  );
}
