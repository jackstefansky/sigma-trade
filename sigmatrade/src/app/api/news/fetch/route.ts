// ============================================================
// POST /api/news/fetch
// Pipeline: Finnhub → normalizacja → dedup → AI analiza → AnalyzedArticle[]
// ============================================================
import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import type { FinnhubArticle, RawArticle, AnalyzedArticle } from '@/lib/news/types';

// Fallback gdy ai_analysis: false — zwraca artykuł bez AI enrichment
function rawToAnalyzed(article: RawArticle): AnalyzedArticle {
  return {
    ...article,
    impactScore: 0,
    category: 'company',
    urgency: 'low',
    interpretation: '',
    affectsPortfolio: false,
    tags: [],
  };
}

// ----------------------------------------------------------------
// Normalizacja FinnhubArticle → RawArticle
// ----------------------------------------------------------------

function normalize(raw: FinnhubArticle, ticker: string): RawArticle {
  return {
    id: raw.id,
    headline: raw.headline,
    summary: raw.summary,
    source: raw.source,
    url: raw.url,
    imageUrl: raw.image || undefined,
    publishedAt: raw.datetime * 1000, // Finnhub zwraca sekundy → ms
    tickers: [ticker.toUpperCase()],
  };
}

// ----------------------------------------------------------------
// Dedup: scalamy artykuły o tym samym id (ten sam news dla >1 tickera)
// ----------------------------------------------------------------

function dedup(articles: RawArticle[]): RawArticle[] {
  const map = new Map<number, RawArticle>();

  for (const article of articles) {
    const existing = map.get(article.id);
    if (existing) {
      // Dołącz tickery których jeszcze nie ma
      const merged = new Set([...existing.tickers, ...article.tickers]);
      map.set(article.id, { ...existing, tickers: [...merged] });
    } else {
      map.set(article.id, article);
    }
  }

  return [...map.values()];
}

// ----------------------------------------------------------------
// Fetch z Finnhub dla jednego tickera
// ----------------------------------------------------------------

async function fetchForTicker(
  ticker: string,
  baseUrl: string,
  endpoint: string,
  apiKey: string,
  from: string,
  to: string,
): Promise<RawArticle[]> {
  const url = new URL(`${baseUrl}${endpoint}`);
  url.searchParams.set('symbol', ticker);
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);
  url.searchParams.set('token', apiKey);

  const res = await fetch(url.toString(), { cache: 'no-store' });

  if (!res.ok) {
    console.error(`[news/fetch] Finnhub error for ${ticker}: ${res.status}`);
    return [];
  }

  const data = (await res.json()) as FinnhubArticle[];
  return Array.isArray(data) ? data.map((a) => normalize(a, ticker)) : [];
}

// ----------------------------------------------------------------
// Fetch ogólnych wiadomości rynkowych (include_market_news: true)
// ----------------------------------------------------------------

async function fetchMarketNews(
  baseUrl: string,
  endpoint: string,
  apiKey: string,
): Promise<RawArticle[]> {
  const url = new URL(`${baseUrl}${endpoint}`);
  url.searchParams.set('category', 'general');
  url.searchParams.set('token', apiKey);

  const res = await fetch(url.toString(), { cache: 'no-store' });

  if (!res.ok) {
    console.error(`[news/fetch] Finnhub market news error: ${res.status}`);
    return [];
  }

  const data = (await res.json()) as FinnhubArticle[];
  // Market news nie ma ticker — oznaczamy jako 'MARKET'
  return Array.isArray(data) ? data.map((a) => normalize(a, 'MARKET')) : [];
}

// ----------------------------------------------------------------
// Handler
// ----------------------------------------------------------------

export async function POST(): Promise<NextResponse> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'FINNHUB_API_KEY not set' },
      { status: 500 },
    );
  }

  const config = loadConfig();
  const { base_url, endpoints } = config.data_provider;
  const {
    max_articles_per_batch,
    retention_hours,
    include_market_news,
  } = config.features.news_agent;
  const tickers = config.watchlist.tickers.map((t) => t.symbol);

  // Zakres dat: ostatnie retention_hours godzin
  const now = new Date();
  const from = new Date(now.getTime() - retention_hours * 60 * 60 * 1000);
  const toStr = now.toISOString().slice(0, 10);
  const fromStr = from.toISOString().slice(0, 10);

  // Fetch równolegle dla wszystkich tickerów + opcjonalnie market news
  const fetchPromises = tickers.map((ticker) =>
    fetchForTicker(ticker, base_url, endpoints.company_news, apiKey, fromStr, toStr),
  );

  if (include_market_news) {
    fetchPromises.push(fetchMarketNews(base_url, endpoints.market_news, apiKey));
  }

  const perSource = await Promise.all(fetchPromises);
  const flat = perSource.flat();
  const deduped = dedup(flat);

  // Sortuj od najnowszych, ogranicz do max_articles_per_batch
  const sorted = deduped
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, max_articles_per_batch);

  if (config.dev.verbose_logging) {
    console.log(`[news/fetch] fetched=${flat.length} deduped=${deduped.length} returning=${sorted.length}`);
  }

  // AI analiza odbywa się on-demand przy kliknięciu (POST /api/news/analyze)
  return NextResponse.json({ articles: sorted.map(rawToAnalyzed) });
}
