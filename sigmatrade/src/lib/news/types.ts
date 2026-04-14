// ============================================================
// News Agent — typy
// Źródło prawdy dla całego pipeline'u: Finnhub → dedup → AI → UI
// ============================================================

// ---- Finnhub raw response ----
export interface FinnhubArticle {
  category: string;
  datetime: number; // UNIX seconds
  headline: string;
  id: number;
  image: string;
  related: string; // ticker symbol z Finnhub
  source: string;
  summary: string;
  url: string;
}

// ---- Po normalizacji (krok 2 → 3) ----
export interface RawArticle {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  imageUrl?: string;
  publishedAt: number; // ms (nie sekundy!)
  tickers: string[]; // może być wiele po dedupie
}

// ---- Po analizie AI (krok 4) ----
export type ArticleCategory =
  | "earnings"
  | "macro"
  | "sector"
  | "company"
  | "regulatory";

export type Urgency = "low" | "medium" | "high" | "critical";

export interface AnalyzedArticle extends RawArticle {
  impactScore: number; // -1.0 .. +1.0
  category: ArticleCategory;
  urgency: Urgency;
  interpretation: string;
  affectsPortfolio: boolean;
  tags: string[];
}

export interface TrendInsight {
  type: "trend";
  title: string;
  summary: string;
  affectedTickers: string[];
  articleCount: number;
}

// ---- ChatBlock union (krok 5 → UI) ----
export interface TextBlock {
  type: "text";
  content: string;
}

export interface NewsCardBlock {
  type: "news_card";
  articleId: number;
  headline: string;
  source: string;
  timeAgo: string;
  imageUrl?: string;
  tickers: string[];
  impactScore: number;
  interpretation: string;
  tags: string[];
  url: string;
  affectsPortfolio: boolean;
}

export interface AlertCardBlock {
  type: "alert_card";
  severity: "warning" | "critical";
  headline: string;
  source: string;
  tickers: string[];
  impactScore: number;
  interpretation: string;
  url: string;
  actions: string[];
}

export interface TrendInsightBlock {
  type: "trend_insight";
  title: string;
  summary: string;
  affectedTickers: string[];
  articleCount: number;
}

export type ChatBlock =
  | TextBlock
  | NewsCardBlock
  | AlertCardBlock
  | TrendInsightBlock;

// ---- Config (zrzut z config.yaml — sekcja news_agent) ----
export interface NewsAgentConfig {
  enabled: boolean;
  fetch_interval_seconds: number;
  auto_fetch: boolean;
  max_articles_per_batch: number;
  retention_hours: number;
  include_market_news: boolean;
  ai_analysis: boolean;
  notifications: boolean;
  notification_min_impact: number;
  critical_alert_threshold: number;
}

export interface WatchlistTicker {
  symbol: string;
  name: string;
  sector: string;
}
