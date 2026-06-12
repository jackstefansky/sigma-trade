// ============================================================
// [DEBUG — do usunięcia] GET /api/debug/price?symbol=NVDA
// Surowo odpytuje OBA źródła ceny (Finnhub + TwelveData) i zwraca
// ich odpowiedzi obok siebie. Służy do rozstrzygnięcia czy zła cena
// to problem API (rate limit / złe dane) czy implementacji.
// ============================================================
import { NextResponse } from 'next/server';

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') ?? 'NVDA').toUpperCase().trim();

  const finnhubKey = process.env.FINNHUB_API_KEY;
  const twelveKey = process.env.TWELVEDATA_API_KEY;

  // ── Finnhub /quote ──────────────────────────────────────────
  const finnhub = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`,
    { cache: 'no-store' },
  )
    .then((r) => r.json())
    .then((q) => ({
      ok: typeof q.c === 'number' && q.c > 0,
      price: q.c ?? null,
      raw: q,
    }))
    .catch((e) => ({ ok: false, price: null, raw: { error: String(e) } }));

  // ── TwelveData /quote ───────────────────────────────────────
  const twelve = await fetch(
    `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${twelveKey}`,
    { cache: 'no-store' },
  )
    .then((r) => r.json())
    .then((q) => ({
      ok: q.status !== 'error' && q.close != null,
      price: q.close != null ? parseFloat(q.close) : null,
      raw: q,
    }))
    .catch((e) => ({ ok: false, price: null, raw: { error: String(e) } }));

  return NextResponse.json({ symbol, finnhub, twelve });
}
