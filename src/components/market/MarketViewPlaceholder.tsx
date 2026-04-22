import type { WatchlistTicker } from '@/lib/news/types';

interface MarketViewPlaceholderProps {
  tickers: WatchlistTicker[];
}

export default function MarketViewPlaceholder({ tickers }: MarketViewPlaceholderProps) {
  return (
    <div className="flex flex-col h-full p-6">
      <div className="mb-6">
        <h2 className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-1">
          Market View
        </h2>
        <div className="h-px bg-border-subtle" />
      </div>

      <div className="flex flex-col gap-2">
        {tickers.map((ticker) => (
          <div
            key={ticker.symbol}
            className="flex items-center justify-between px-3 py-2 rounded border border-border-subtle bg-bg-panel"
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-semibold text-accent tracking-wide">
                {ticker.symbol}
              </span>
              <span className="font-mono text-xs text-gray-500 truncate max-w-[160px]">
                {ticker.name}
              </span>
            </div>
            <span className="font-mono text-xs text-gray-600 uppercase tracking-wider">
              {ticker.sector}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-6">
        <p className="font-mono text-xs text-gray-700 text-center">
          — charts coming in Phase 3 —
        </p>
      </div>
    </div>
  );
}
