import { create } from 'zustand';
import type { AnalyzedArticle } from '@/lib/news/types';

// ----------------------------------------------------------------
// Typy stanu
// ----------------------------------------------------------------

export type FetchStatus = 'idle' | 'fetching' | 'error';

interface NewsState {
  // Dane
  articles: AnalyzedArticle[];
  readIds: Set<number>;         // które artykuły user już widział

  // Status fetchu
  fetchStatus: FetchStatus;
  lastFetchedAt: number | null; // timestamp ms ostatniego sukcesu
  errorMessage: string | null;

  // Computed — badge
  unreadCount: number;          // artykuły w readIds nie ma
  criticalCount: number;        // unread z urgency === 'critical'
}

interface NewsActions {
  addArticles: (incoming: AnalyzedArticle[]) => void;
  updateArticle: (article: AnalyzedArticle) => void; // on-demand AI analiza

  markRead: (id: number) => void;
  markAllRead: () => void;

  setFetchStatus: (status: FetchStatus, errorMessage?: string) => void;
  clearArticles: () => void;
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function computeBadge(
  articles: AnalyzedArticle[],
  readIds: Set<number>,
): Pick<NewsState, 'unreadCount' | 'criticalCount'> {
  const unread = articles.filter((a) => !readIds.has(a.id));
  return {
    unreadCount: unread.length,
    criticalCount: unread.filter((a) => a.urgency === 'critical').length,
  };
}

// ----------------------------------------------------------------
// Store
// ----------------------------------------------------------------

export const useNewsStore = create<NewsState & NewsActions>((set, get) => ({
  // --- stan początkowy ---
  articles: [],
  readIds: new Set(),
  fetchStatus: 'idle',
  lastFetchedAt: null,
  errorMessage: null,
  unreadCount: 0,
  criticalCount: 0,

  // --- actions ---

  addArticles: (incoming) => {
    const { articles, readIds } = get();

    if (incoming.length === 0) return;

    // Mapa istniejących po id — do in-place update (np. fallback → AI analiza)
    const existingMap = new Map(articles.map((a) => [a.id, a]));
    const incomingIds = new Set(incoming.map((a) => a.id));

    // Nowe artykuły (nie ma ich w storze) — idą na górę
    const fresh = incoming.filter((a) => !existingMap.has(a.id));
    // Istniejące — zastąp nowymi danymi (mogą mieć lepszą analizę)
    const updated = articles.map((a) =>
      incomingIds.has(a.id) ? (incoming.find((n) => n.id === a.id) ?? a) : a,
    );

    const next = [...fresh, ...updated];
    set({
      articles: next,
      lastFetchedAt: Date.now(),
      ...computeBadge(next, readIds),
    });
  },

  updateArticle: (article) => {
    const { articles, readIds } = get();
    const next = articles.map((a) => (a.id === article.id ? article : a));
    set({ articles: next, ...computeBadge(next, readIds) });
  },

  markRead: (id) => {
    const { articles, readIds } = get();
    const next = new Set(readIds).add(id);
    set({ readIds: next, ...computeBadge(articles, next) });
  },

  markAllRead: () => {
    const { articles } = get();
    const next = new Set(articles.map((a) => a.id));
    set({ readIds: next, unreadCount: 0, criticalCount: 0 });
  },

  setFetchStatus: (status, errorMessage) => {
    set({
      fetchStatus: status,
      errorMessage: errorMessage ?? null,
    });
  },

  clearArticles: () => {
    set({
      articles: [],
      readIds: new Set(),
      unreadCount: 0,
      criticalCount: 0,
      lastFetchedAt: null,
      errorMessage: null,
      fetchStatus: 'idle',
    });
  },
}));

// ----------------------------------------------------------------
// Selektory (użyj w komponentach zamiast selectowania całego stanu)
// ----------------------------------------------------------------

export const selectUnreadCount = (s: NewsState) => s.unreadCount;
export const selectCriticalCount = (s: NewsState) => s.criticalCount;
export const selectArticles = (s: NewsState) => s.articles;
export const selectFetchStatus = (s: NewsState) => s.fetchStatus;
export const selectLastFetchedAt = (s: NewsState) => s.lastFetchedAt;
