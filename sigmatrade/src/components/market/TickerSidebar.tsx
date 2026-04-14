'use client';

import { cn } from '@/lib/utils';
import { useChartStore } from '@/store/chartStore';
import type { WatchlistTicker } from '@/lib/news/types';

interface TickerSidebarProps {
  tickers: WatchlistTicker[];
}

export default function TickerSidebar({ tickers }: TickerSidebarProps) {
  const activeTicker  = useChartStore((s) => s.activeTicker);
  const setActiveTicker = useChartStore((s) => s.setActiveTicker);

  return (
    <div className="w-[140px] shrink-0 border-r border-border-subtle flex flex-col overflow-y-auto">
      <div className="px-3 py-2 border-b border-border-subtle shrink-0">
        <span className="font-mono text-[10px] text-zinc-600 uppercase tracking-wider">Watchlist</span>
      </div>

      <div className="flex flex-col">
        {tickers.map((ticker) => {
          const isActive = ticker.symbol === activeTicker;
          return (
            <button
              key={ticker.symbol}
              onClick={() => setActiveTicker(ticker.symbol)}
              className={cn(
                'text-left px-3 py-3 border-b border-border-subtle transition-colors duration-150',
                isActive
                  ? 'border-l-2 border-l-accent bg-accent/5'
                  : 'border-l-2 border-l-transparent hover:bg-zinc-900',
              )}
            >
              <span
                className={cn(
                  'block font-mono text-xs font-bold tracking-wide',
                  isActive ? 'text-accent' : 'text-zinc-400',
                )}
              >
                {ticker.symbol}
              </span>
              <span className="block font-mono text-[10px] text-zinc-600 truncate mt-0.5">
                {ticker.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
