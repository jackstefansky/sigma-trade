// ============================================================
// POST /api/news/analyze
// Fetuje treść artykułu z URL, wysyła do Gemini/Claude on-demand.
// Body: { article: RawArticle }
// Returns: { article: AnalyzedArticle } | { error, message } 429/500
// ============================================================
import { NextResponse } from 'next/server';
import { analyzeArticles, RateLimitError } from '@/lib/news/analyzer';
import type { RawArticle } from '@/lib/news/types';

// ----------------------------------------------------------------
// Fetch treści artykułu z URL + strip HTML
// ----------------------------------------------------------------

async function fetchArticleContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StockPilotBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    if (!res.ok) {
      console.warn(`[analyze] fetchArticleContent ${res.status} for ${url}`);
      return '';
    }

    const html = await res.text();

    // Strip script/style bloki
    const noScript = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '');

    // Strip wszystkie tagi HTML
    const text = noScript
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const excerpt = text.slice(0, 3000);
    console.log(`[analyze] fetched content: ${excerpt.length} chars from ${url}`);
    return excerpt;
  } catch (err) {
    console.warn(`[analyze] fetchArticleContent failed for ${url}:`, err);
    return '';
  }
}

// ----------------------------------------------------------------
// Handler
// ----------------------------------------------------------------

export async function POST(req: Request): Promise<NextResponse> {
  let body: { article?: RawArticle };
  try {
    body = await req.json() as { article?: RawArticle };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.article) {
    return NextResponse.json({ error: 'Missing article' }, { status: 400 });
  }

  const article = body.article;

  // Spróbuj pobrać pełną treść z URL artykułu
  const fullContent = article.url ? await fetchArticleContent(article.url) : '';

  // Wzbogać artykuł o pełną treść jeśli udało się pobrać
  const enriched: RawArticle = fullContent
    ? { ...article, summary: fullContent }
    : article;

  console.log(`[analyze] sending to AI — id=${enriched.id} headline="${enriched.headline.slice(0, 60)}" summary_len=${enriched.summary.length}`);

  try {
    const [analyzed] = await analyzeArticles([enriched]);
    console.log(`[analyze] AI result — id=${analyzed.id} impactScore=${analyzed.impactScore} urgency=${analyzed.urgency} tags=${JSON.stringify(analyzed.tags)}`);
    return NextResponse.json({ article: analyzed });
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.warn('[analyze] rate limited by AI provider');
      return NextResponse.json(
        { error: 'rate_limit', message: err.message },
        { status: 429 },
      );
    }
    console.error('[analyze] unexpected error:', err);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
