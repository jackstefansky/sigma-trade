'use client';

import { cn } from '@/lib/utils';
import type { QuoteData } from '@/lib/chart/types';
import type { WatchlistTicker } from '@/lib/news/types';

interface ChartHeaderProps {
  ticker: WatchlistTicker | undefined;
  quote: QuoteData | null | undefined;
  isLoading: boolean;
}

export default function ChartHeader({ ticker, quote, isLoading }: ChartHeaderProps) {
  const symbol = ticker?.symbol ?? '—';
  const name   = ticker?.name   ?? '';

  const positive = (quote?.changePercent ?? 0) >= 0;
  const changeColor = positive ? 'text-accent' : 'text-red-400';
  const sign = positive ? '+' : '';

  return (
    <div className="flex items-center gap-4 min-w-0">
      {/* Symbol + name */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-white tracking-wide">{symbol}</span>
          {ticker && (
            <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider">
              {ticker.sector}
            </span>
          )}
        </div>
        {name && (
          <p className="font-mono text-[10px] text-zinc-600 truncate">{name}</p>
        )}
      </div>

      {/* Price */}
      {isLoading ? (
        <div className="flex gap-2">
          <div className="w-20 h-4 bg-zinc-800 rounded animate-pulse" />
          <div className="w-14 h-4 bg-zinc-800 rounded animate-pulse" />
        </div>
      ) : quote ? (
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-base font-bold text-white">
            ${quote.price.toFixed(2)}
          </span>
          <span className={cn('font-mono text-xs', changeColor)}>
            {sign}{quote.change.toFixed(2)} ({sign}{quote.changePercent.toFixed(2)}%)
          </span>
        </div>
      ) : null}
    </div>
  );
}
