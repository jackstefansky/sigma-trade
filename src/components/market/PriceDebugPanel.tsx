'use client';

// ============================================================
// [DEBUG — do usunięcia] Pływający panel pokazujący aktualną cenę
// NVDA z obu źródeł (Finnhub vs TwelveData) — żeby na żywo zobaczyć
// które API zwraca poprawną cenę, a które się wykłada.
// ============================================================
import { useState, useEffect, useCallback } from 'react';

interface SourceResult {
  ok: boolean;
  price: number | null;
  raw: unknown;
}

interface DebugResponse {
  symbol: string;
  finnhub: SourceResult;
  twelve: SourceResult;
}

export default function PriceDebugPanel() {
  const [data, setData] = useState<DebugResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [ts, setTs] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/debug/price?symbol=NVDA', { cache: 'no-store' });
      setData(await res.json());
      setTs(new Date().toLocaleTimeString());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const Row = ({ label, r }: { label: string; r: SourceResult | undefined }) => (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      {r ? (
        <span className={r.ok ? 'text-accent' : 'text-red-400'}>
          {r.ok ? `$${r.price?.toFixed(2)}` : '✗ błąd / rate limit'}
        </span>
      ) : (
        <span className="text-zinc-600">—</span>
      )}
    </div>
  );

  return (
    <div className="fixed bottom-3 right-3 z-[100] w-56 rounded-lg border border-accent/40 bg-bg-panel/95 p-3 font-mono text-[11px] shadow-lg backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-bold uppercase tracking-wider text-accent">
          DEBUG · NVDA
        </span>
        <button
          onClick={() => void load()}
          className="rounded border border-zinc-700 px-1.5 py-0.5 text-zinc-400 hover:border-accent hover:text-accent"
        >
          {loading ? '…' : '↻'}
        </button>
      </div>
      <div className="space-y-1">
        <Row label="Finnhub" r={data?.finnhub} />
        <Row label="TwelveData" r={data?.twelve} />
      </div>
      {ts && <div className="mt-2 text-[9px] text-zinc-600">odświeżono {ts}</div>}
    </div>
  );
}
