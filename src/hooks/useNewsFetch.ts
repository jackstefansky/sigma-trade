'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useNewsStore } from '@/lib/store/newsStore';
import type { AnalyzedArticle } from '@/lib/news/types';

interface UseNewsFetchOptions {
  intervalSeconds: number;
  autoFetch: boolean;
}

interface UseNewsFetchReturn {
  fetchNow: () => Promise<void>;
}

export function useNewsFetch({ intervalSeconds, autoFetch }: UseNewsFetchOptions): UseNewsFetchReturn {
  const addArticles = useNewsStore((s) => s.addArticles);
  const setFetchStatus = useNewsStore((s) => s.setFetchStatus);

  const isFetchingRef = useRef(false);

  const fetchNow = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setFetchStatus('fetching');

    try {
      const res = await fetch('/api/news/fetch', { method: 'POST' });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as { articles: AnalyzedArticle[] };
      addArticles(data.articles);
      setFetchStatus('idle');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useNewsFetch]', message);
      setFetchStatus('error', message);
    } finally {
      isFetchingRef.current = false;
    }
  }, [addArticles, setFetchStatus]);

  useEffect(() => {
    void fetchNow();

    if (!autoFetch || intervalSeconds <= 0) return;

    const id = setInterval(() => void fetchNow(), intervalSeconds * 1000);
    return () => clearInterval(id);
  }, [fetchNow, autoFetch, intervalSeconds]);

  return { fetchNow };
}
