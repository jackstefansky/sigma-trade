'use client';

import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function AiAnalysisBlock({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '100px' },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-in-view={inView}
      className={cn('ai-analysis-block', className)}
    >
      <div className="ai-analysis-inner">{children}</div>
    </div>
  );
}
