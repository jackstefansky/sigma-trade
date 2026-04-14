'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  createChart,
  ColorType,
  AreaSeries,
  CandlestickSeries,
} from 'lightweight-charts';
import type {
  IChartApi,
  ISeriesApi,
  SeriesType,
  UTCTimestamp,
} from 'lightweight-charts';
import type { Candle, ChartType } from '@/lib/chart/types';

// ----------------------------------------------------------------
// Data mappers — each series type expects a different shape
// ----------------------------------------------------------------

function toAreaData(candles: Candle[]) {
  return candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close }));
}

function toCandleData(candles: Candle[]) {
  return candles.map((c) => ({
    time:  c.time as UTCTimestamp,
    open:  c.open,
    high:  c.high,
    low:   c.low,
    close: c.close,
  }));
}

// ----------------------------------------------------------------
// Theme constants
// ----------------------------------------------------------------

const CHART_OPTS = {
  layout: {
    background: { type: ColorType.Solid, color: 'transparent' },
    textColor: '#71717a',
    fontFamily: 'JetBrains Mono, monospace',
  },
  grid: {
    vertLines: { color: '#18181b' },
    horzLines: { color: '#18181b' },
  },
  crosshair: { mode: 1 },
  rightPriceScale: { borderColor: '#27272a' },
  timeScale: { borderColor: '#27272a', timeVisible: true },
} as const;

const AREA_OPTS = {
  lineColor: '#00ff88',
  lineWidth: 2 as const,
  topColor: 'rgba(0, 255, 136, 0.25)',
  bottomColor: 'rgba(0, 255, 136, 0)',
};

const CANDLE_OPTS = {
  upColor: '#00ff88',
  downColor: '#ef4444',
  borderVisible: false,
  wickUpColor: '#00ff88',
  wickDownColor: '#ef4444',
};

// ----------------------------------------------------------------
// Loading skeleton
// ----------------------------------------------------------------

function ChartSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-6 h-full">
      <div className="flex gap-2 items-end h-full">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-zinc-800 rounded-sm animate-pulse"
            style={{ height: `${30 + Math.sin(i * 0.8) * 20 + 20}%` }}
          />
        ))}
      </div>
      <div className="h-3 w-full bg-zinc-800 rounded animate-pulse" />
    </div>
  );
}

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------

interface StockChartProps {
  data: Candle[];
  chartType: ChartType;
  isLoading: boolean;
}

// ----------------------------------------------------------------
// Main chart component
// ----------------------------------------------------------------

export default function StockChart({ data, chartType, isLoading }: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);

  // Helper: create correct series type
  const createSeries = useCallback(
    (chart: IChartApi): ISeriesApi<SeriesType> => {
      if (chartType === 'candle') {
        return chart.addSeries(CandlestickSeries, CANDLE_OPTS);
      }
      return chart.addSeries(AreaSeries, AREA_OPTS);
    },
    [chartType],
  );

  // Initialize chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      ...CHART_OPTS,
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    const series = createSeries(chart);
    chartRef.current  = chart;
    seriesRef.current = series;

    // Resize observer — react to container size changes
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current  = null;
      seriesRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  // Switch series type when chartType changes (no chart rebuild)
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;
    chartRef.current.removeSeries(seriesRef.current);
    const newSeries = createSeries(chartRef.current);
    seriesRef.current = newSeries;
    if (data.length > 0) {
      newSeries.setData(
        chartType === 'candle' ? toCandleData(data) : toAreaData(data),
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType]); // intentionally excludes data & createSeries

  // Update data when it changes
  useEffect(() => {
    if (!seriesRef.current || data.length === 0) return;
    seriesRef.current.setData(
      chartType === 'candle' ? toCandleData(data) : toAreaData(data),
    );
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div className="relative w-full h-full">
      {/* Chart container always mounted so useEffect can attach the chart */}
      <div ref={containerRef} className="w-full h-full" />
      {/* Skeleton overlaid while loading — doesn't unmount the chart div */}
      {isLoading && (
        <div className="absolute inset-0 bg-bg-base">
          <ChartSkeleton />
        </div>
      )}
    </div>
  );
}
