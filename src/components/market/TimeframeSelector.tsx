'use client';

import { cn } from '@/lib/utils';
import { useChartStore } from '@/store/chartStore';
import type { Timeframe } from '@/lib/chart/types';

const TIMEFRAMES: Timeframe[] = ['1D', '1W', '1M', '3M', '1Y'];

export default function TimeframeSelector() {
  const timeframe = useChartStore((s) => s.timeframe);
  const setTimeframe = useChartStore((s) => s.setTimeframe);

  return (
    <div className="flex items-center justify-center gap-1 px-4 py-2 border-t border-border-subtle shrink-0">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          onClick={() => setTimeframe(tf)}
          className={cn(
            'px-3 py-1 font-mono text-[11px] rounded transition-colors duration-150',
            timeframe === tf
              ? 'text-accent bg-accent/10'
              : 'text-zinc-600 hover:text-zinc-400',
          )}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}
