"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { CandlestickChart } from "@/components/CandlestickChart";
import { HeatmapPrimitive } from "@/components/orderflow/HeatmapPrimitive";
import { FootprintPrimitive } from "@/components/orderflow/FootprintPrimitive";
import { OrderBookPrimitive } from "@/components/orderflow/OrderBookPrimitive";
import { LargeLotPrimitive } from "@/components/orderflow/LargeLotPrimitive";
import { fetchBarsForSymbol } from "@/lib/chart-bars";
import {
  applyLargeTradeTracking,
  computeCvdSeries,
  detectAbsorption,
  diffFootprintCells,
  emptyLargeTradeTracker,
  type FootprintCell,
  type HeatmapCell,
  type LargeTradeTrackerState,
  type OrderBookState,
} from "@/lib/orderflow-data";
import type { BarOut } from "@/lib/api";

const REFRESH_INTERVAL_MS = 30_000;

interface OrderflowChartProps {
  symbol: string;
  footprint: FootprintCell[];
  heatmap: HeatmapCell[];
  book: OrderBookState;
}

export function OrderflowChart({ symbol, footprint, heatmap, book }: OrderflowChartProps) {
  const [bars, setBars] = useState<BarOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const heatmapPrimitiveRef = useRef<HeatmapPrimitive | null>(null);
  const footprintPrimitiveRef = useRef<FootprintPrimitive | null>(null);
  const bookPrimitiveRef = useRef<OrderBookPrimitive | null>(null);
  const largeLotPrimitiveRef = useRef<LargeLotPrimitive | null>(null);
  const prevFootprintRef = useRef<FootprintCell[]>([]);
  const largeTradeTrackerRef = useRef<LargeTradeTrackerState>(emptyLargeTradeTracker());
  const medianSizeRef = useRef(0);
  const footprintRef = useRef(footprint);
  const heatmapRef = useRef(heatmap);
  const bookRef = useRef(book);
  footprintRef.current = footprint;
  heatmapRef.current = heatmap;
  bookRef.current = book;

  const [absorptionMarkers, setAbsorptionMarkers] = useState<
    { time: UTCTimestamp; side: "buy" | "sell" }[]
  >([]);

  const cvdSeries = useMemo(
    () => computeCvdSeries(footprint).map((pt) => ({ time: pt.time as UTCTimestamp, value: pt.value })),
    [footprint]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const result = await fetchBarsForSymbol(symbol, "1m", ctrl.signal);
        if (!cancelled) { setBars(result); setError(null); }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }

    load();
    const id = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [symbol]);

  useEffect(() => {
    heatmapPrimitiveRef.current?.updateData(heatmap);
    footprintPrimitiveRef.current?.updateData(footprint);
    bookPrimitiveRef.current?.updateData(book);

    const changed = diffFootprintCells(prevFootprintRef.current, footprint);
    let tracker = largeTradeTrackerRef.current;
    for (const cell of changed) {
      const prevCell = prevFootprintRef.current.find(
        (c) => c.bucketTs === cell.bucketTs && c.price === cell.price
      );
      const buyDelta = cell.buyVol - (prevCell?.buyVol ?? 0);
      const sellDelta = cell.sellVol - (prevCell?.sellVol ?? 0);
      if (buyDelta > 0) {
        tracker = applyLargeTradeTracking(tracker, {
          type: "footprint_delta", bucket_ts: cell.bucketTs, price: cell.price, side: "buy", delta_vol: buyDelta,
        });
      }
      if (sellDelta > 0) {
        tracker = applyLargeTradeTracking(tracker, {
          type: "footprint_delta", bucket_ts: cell.bucketTs, price: cell.price, side: "sell", delta_vol: sellDelta,
        });
      }
    }
    largeTradeTrackerRef.current = tracker;
    prevFootprintRef.current = footprint;
    const medianSize =
      tracker.recentSizes.length > 0
        ? [...tracker.recentSizes].sort((a, b) => a - b)[Math.floor(tracker.recentSizes.length / 2)]
        : 0;
    medianSizeRef.current = medianSize;
    largeLotPrimitiveRef.current?.updateData(tracker.largeTrades, medianSize);
    setAbsorptionMarkers(
      detectAbsorption(footprint, bars, medianSize).map((m) => ({
        time: m.time as UTCTimestamp,
        side: m.side,
      }))
    );
  }, [heatmap, footprint, book, bars]);

  function handleSeriesReady(_chart: IChartApi, series: ISeriesApi<"Candlestick">) {
    const hp = new HeatmapPrimitive();
    const fp = new FootprintPrimitive();
    const bp = new OrderBookPrimitive();
    const lp = new LargeLotPrimitive();
    series.attachPrimitive(hp);
    series.attachPrimitive(fp);
    series.attachPrimitive(bp);
    series.attachPrimitive(lp);
    hp.updateData(heatmapRef.current);
    fp.updateData(footprintRef.current);
    bp.updateData(bookRef.current);
    heatmapPrimitiveRef.current = hp;
    footprintPrimitiveRef.current = fp;
    bookPrimitiveRef.current = bp;
    largeLotPrimitiveRef.current = lp;
  }

  if (error) {
    return <div className="border border-border bg-panel text-neg text-sm p-4">{error}</div>;
  }

  return (
    <div className="border border-border bg-panel">
      <CandlestickChart bars={bars} cvdSeries={cvdSeries} absorptionMarkers={absorptionMarkers} onSeriesReady={handleSeriesReady} />
    </div>
  );
}
