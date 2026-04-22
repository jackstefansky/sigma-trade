'use client';

import * as RadixTooltip from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

// ----------------------------------------------------------------
// Provider — wrap your app root or place near usage
// ----------------------------------------------------------------

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RadixTooltip.Provider delayDuration={200} skipDelayDuration={0}>
      {children}
    </RadixTooltip.Provider>
  );
}

// ----------------------------------------------------------------
// Base Tooltip
// ----------------------------------------------------------------

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'start',
  className,
}: TooltipProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            'z-50 max-w-[260px] rounded-md px-3 py-2',
            'bg-[#1a1a1a] border border-[#00ff88]/20',
            'font-mono text-[11px] text-white leading-relaxed',
            'shadow-lg shadow-black/60',
            'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            className,
          )}
        >
          {content}
          <RadixTooltip.Arrow className="fill-[#1a1a1a]" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

// ----------------------------------------------------------------
// Urgency tooltip content
// ----------------------------------------------------------------

const URGENCY_TOOLTIP: Record<string, string> = {
  low:
    'Low Impact — Minor news with little to no expected effect on the stock price. Routine update or background information. No immediate action needed.',
  medium:
    'Notable — Moderate potential to move the stock price. Could reflect a developing story or a sector-wide shift. Worth monitoring, but not urgent.',
  high:
    'High Impact — Significant event likely to cause a noticeable price move. May include earnings surprises, major partnerships, regulatory decisions, or analyst upgrades. Consider reviewing your position.',
  critical:
    'Critical Alert — Urgent news with strong potential for an immediate and large price swing. Examples: surprise CEO changes, major lawsuits, bankruptcy filings, or market-moving macro events. Act or monitor closely.',
};

export function urgencyTooltip(urgency: string): string {
  return URGENCY_TOOLTIP[urgency] ?? URGENCY_TOOLTIP.low;
}

// ----------------------------------------------------------------
// Impact score tooltip content
// ----------------------------------------------------------------

export function impactScoreTooltip(score: number): string {
  const abs = Math.abs(score);
  let signal: string;
  if (abs < 0.2) {
    signal = 'Neutral — no significant price movement expected.';
  } else if (abs < 0.4) {
    signal = score > 0
      ? 'Mildly bullish — slight upward pressure on the price.'
      : 'Mildly bearish — slight downward pressure on the price.';
  } else if (abs < 0.7) {
    signal = score > 0
      ? 'Bullish — meaningful positive event for this stock.'
      : 'Bearish — meaningful negative event for this stock.';
  } else {
    signal = score > 0
      ? 'Strongly bullish — high-conviction positive signal.'
      : 'Strongly bearish — high-conviction negative signal.';
  }

  return `Impact score: ${score >= 0 ? '+' : ''}${score.toFixed(2)}\n\nScale: −1.0 (strongly bearish) → 0 (neutral) → +1.0 (strongly bullish). ${signal}`;
}
