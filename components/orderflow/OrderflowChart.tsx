"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { CandlestickChart } from "@/components/CandlestickChart";
import { HeatmapPrimitive } from "@/components/orderflow/HeatmapPrimitive";
import { FootprintPrimitive } from "@/components/orderflow/FootprintPrimitive";
import { OrderBookPrimitive } from "@/components/orderflow/OrderBookPrimitive";
import { LargeLotPrimitive } from "@/components/orderflow/LargeLotPrimitive";
import { GexLevelsPrimitive } from "@/components/orderflow/GexLevelsPrimitive";
import { VolumeProfilePrimitive } from "@/components/orderflow/VolumeProfilePrimitive";
import { ImbalanceBarPrimitive } from "@/components/orderflow/ImbalanceBarPrimitive";
import { OptionsFlowPanel } from "@/components/orderflow/OptionsFlowPanel";
import { fetchBarsForSymbol } from "@/lib/chart-bars";
import {
  applyLargeTradeTracking,
  computeCvdSeries,
  computeImbalance,
  computeVolumeProfile,
  currencyForSymbol,
  detectAbsorption,
  detectIcebergLevels,
  detectStopRuns,
  diffFootprintCells,
  emptyLargeTradeTracker,
  SVP_WINDOW_SEC,
  type FootprintCell,
  type HeatmapCell,
  type LargeTradeTrackerState,
  type OrderBookState,
} from "@/lib/orderflow-data";
import type { BarOut, GexSnapshot } from "@/lib/api";

const REFRESH_INTERVAL_MS = 30_000;

interface OrderflowChartProps {
  symbol: string;
  footprint: FootprintCell[];
  heatmap: HeatmapCell[];
  book: OrderBookState;
  gex: GexSnapshot | null;
}

export function OrderflowChart({ symbol, footprint, heatmap, book, gex }: OrderflowChartProps) {
  const [bars, setBars] = useState<BarOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const heatmapPrimitiveRef = useRef<HeatmapPrimitive | null>(null);
  const footprintPrimitiveRef = useRef<FootprintPrimitive | null>(null);
  const bookPrimitiveRef = useRef<OrderBookPrimitive | null>(null);
  const largeLotPrimitiveRef = useRef<LargeLotPrimitive | null>(null);
  const gexLevelsPrimitiveRef = useRef<GexLevelsPrimitive | null>(null);
  const svpPrimitiveRef = useRef<VolumeProfilePrimitive | null>(null);
  const cvpPrimitiveRef = useRef<VolumeProfilePrimitive | null>(null);
  const imbalancePrimitiveRef = useRef<ImbalanceBarPrimitive | null>(null);
  const currency = currencyForSymbol(symbol);
  const gexRef = useRef(gex);
  gexRef.current = gex;
  const prevFootprintRef = useRef<FootprintCell[]>([]);
  const largeTradeTrackerRef = useRef<LargeTradeTrackerState>(emptyLargeTradeTracker());
  const footprintRef = useRef(footprint);
  const heatmapRef = useRef(heatmap);
  const bookRef = useRef(book);
  footprintRef.current = footprint;
  heatmapRef.current = heatmap;
  bookRef.current = book;

  const [absorptionMarkers, setAbsorptionMarkers] = useState<
    { time: UTCTimestamp; side: "buy" | "sell" }[]
  >([]);
  const [trackerSnapshot, setTrackerSnapshot] = useState<LargeTradeTrackerState>(emptyLargeTradeTracker());

  const cvdSeries = useMemo(
    () => computeCvdSeries(footprint).map((pt) => ({ time: pt.time as UTCTimestamp, value: pt.value })),
    [footprint]
  );

  // 대량체결 트래커의 이동중앙값 — Iceberg/Stop-run 노이즈플로어, 임밸런스 volBuyPct의 표본원으로 재사용.
  const medianSize = useMemo(() => {
    const sizes = trackerSnapshot.recentSizes;
    return sizes.length > 0 ? [...sizes].sort((a, b) => a - b)[Math.floor(sizes.length / 2)] : 0;
  }, [trackerSnapshot]);

  const cvpProfile = useMemo(() => computeVolumeProfile(footprint), [footprint]);
  const svpProfile = useMemo(() => {
    const latestBucketTs = footprint.reduce((max, c) => Math.max(max, c.bucketTs), 0);
    return computeVolumeProfile(footprint, latestBucketTs - SVP_WINDOW_SEC);
  }, [footprint]);

  const icebergLevels = useMemo(
    () => detectIcebergLevels(cvpProfile, book, medianSize),
    [cvpProfile, book, medianSize]
  );

  const stopRunMarkers = useMemo(
    () =>
      detectStopRuns(bars, footprint, medianSize).map((m) => ({
        time: m.time as UTCTimestamp,
        side: m.side,
      })),
    [bars, footprint, medianSize]
  );

  const imbalance = useMemo(() => computeImbalance(book, trackerSnapshot), [book, trackerSnapshot]);

  // 심볼 전환 시 이전 심볼의 롤링 중앙값/대형 트레이드 상태가 새 심볼에 섞이지 않도록 초기화.
  useEffect(() => {
    largeTradeTrackerRef.current = emptyLargeTradeTracker();
    prevFootprintRef.current = [];
    largeLotPrimitiveRef.current?.updateData([], 0);
    setAbsorptionMarkers([]);
    setTrackerSnapshot(emptyLargeTradeTracker());
  }, [symbol]);

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
    const localMedianSize =
      tracker.recentSizes.length > 0
        ? [...tracker.recentSizes].sort((a, b) => a - b)[Math.floor(tracker.recentSizes.length / 2)]
        : 0;
    largeLotPrimitiveRef.current?.updateData(tracker.largeTrades, localMedianSize);
    setAbsorptionMarkers(
      detectAbsorption(footprint, bars, localMedianSize).map((m) => ({
        time: m.time as UTCTimestamp,
        side: m.side,
      }))
    );
    setTrackerSnapshot(tracker);
  }, [heatmap, footprint, book, bars]);

  useEffect(() => {
    if (currency && gex) {
      gexLevelsPrimitiveRef.current?.updateData(gex.levels);
    } else {
      gexLevelsPrimitiveRef.current?.updateData([]);
    }
  }, [currency, gex]);

  useEffect(() => {
    svpPrimitiveRef.current?.updateData(svpProfile);
    cvpPrimitiveRef.current?.updateData(cvpProfile);
  }, [svpProfile, cvpProfile]);

  useEffect(() => {
    bookPrimitiveRef.current?.updateIcebergLevels(icebergLevels);
  }, [icebergLevels]);

  useEffect(() => {
    imbalancePrimitiveRef.current?.updateData(imbalance);
  }, [imbalance]);

  function handleSeriesReady(_chart: IChartApi, series: ISeriesApi<"Candlestick">) {
    const hp = new HeatmapPrimitive();
    const fp = new FootprintPrimitive();
    const bp = new OrderBookPrimitive();
    const lp = new LargeLotPrimitive();
    const gp = new GexLevelsPrimitive();
    const svp = new VolumeProfilePrimitive(0);
    const cvp = new VolumeProfilePrimitive(1);
    const ip = new ImbalanceBarPrimitive();
    series.attachPrimitive(hp);
    series.attachPrimitive(fp);
    series.attachPrimitive(svp);
    series.attachPrimitive(cvp);
    series.attachPrimitive(bp);
    series.attachPrimitive(lp);
    series.attachPrimitive(gp);
    series.attachPrimitive(ip);
    hp.updateData(heatmapRef.current);
    fp.updateData(footprintRef.current);
    bp.updateData(bookRef.current);
    gp.updateData(currency && gexRef.current ? gexRef.current.levels : []);
    heatmapPrimitiveRef.current = hp;
    footprintPrimitiveRef.current = fp;
    bookPrimitiveRef.current = bp;
    largeLotPrimitiveRef.current = lp;
    gexLevelsPrimitiveRef.current = gp;
    svpPrimitiveRef.current = svp;
    cvpPrimitiveRef.current = cvp;
    imbalancePrimitiveRef.current = ip;
  }

  if (error) {
    return <div className="border border-border bg-panel text-neg text-sm p-4">{error}</div>;
  }

  return (
    <div className="border border-border bg-panel">
      <CandlestickChart
        bars={bars}
        cvdSeries={cvdSeries}
        absorptionMarkers={absorptionMarkers}
        stopRunMarkers={stopRunMarkers}
        onSeriesReady={handleSeriesReady}
        height={720}
      />
      {currency && (
        <div className="border-t border-border">
          <OptionsFlowPanel currency={currency} gex={gex} />
        </div>
      )}
    </div>
  );
}
