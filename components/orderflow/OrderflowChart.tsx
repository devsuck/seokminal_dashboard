"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LineStyle, type IChartApi, type IPriceLine, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { CandlestickChart } from "@/components/CandlestickChart";
import { HeatmapPrimitive } from "@/components/orderflow/HeatmapPrimitive";
import { FootprintPrimitive } from "@/components/orderflow/FootprintPrimitive";
import { OrderBookPrimitive } from "@/components/orderflow/OrderBookPrimitive";
import { LargeLotPrimitive } from "@/components/orderflow/LargeLotPrimitive";
import { GexLevelsPrimitive } from "@/components/orderflow/GexLevelsPrimitive";
import { LiquidationLevelsPrimitive } from "@/components/orderflow/LiquidationLevelsPrimitive";
import { LiquidationBubblesPrimitive } from "@/components/orderflow/LiquidationBubblesPrimitive";
import { VolumeBackgroundPrimitive } from "@/components/orderflow/VolumeBackgroundPrimitive";
import { PositionLevelsPrimitive } from "@/components/orderflow/PositionLevelsPrimitive";
import { useHLPosition } from "@/hooks/useHLPosition";
import { VolumeProfilePrimitive } from "@/components/orderflow/VolumeProfilePrimitive";
import { ImbalanceBarPrimitive } from "@/components/orderflow/ImbalanceBarPrimitive";
import { OptionsFlowPanel } from "@/components/orderflow/OptionsFlowPanel";
import { FundingPanel } from "@/components/orderflow/FundingPanel";
import { OrderflowLegend, DEFAULT_LAYERS, type LayerKey } from "@/components/orderflow/OrderflowLegend";
import { OrderflowSignalPanel } from "@/components/orderflow/OrderflowSignalPanel";
import { OrderBookLadder } from "@/components/orderflow/OrderBookLadder";
import { TradeTape } from "@/components/orderflow/TradeTape";
import { fetchBarsForSymbol } from "@/lib/chart-bars";
import {
  applyLargeTradeTracking,
  computeCompositeValueArea,
  computeCvdSeries,
  computeDeltaSeries,
  computeImbalance,
  computeSessionLevels,
  computeValueArea,
  computeVolumeProfile,
  computeTpoProfile,
  computeVolumeByBucket,
  computeVwapBands,
  currencyForSymbol,
  detectAbsorption,
  detectDeltaDivergence,
  detectIcebergLevels,
  detectStopRuns,
  diffFootprintCells,
  emptyLargeTradeTracker,
  computeFibLevels,
  computeFootprintAbsorptionLevels,
  computeNakedPocs,
  estimateLiquidationHeatmap,
  estimateLiquidationLevels,
  hlCoinForSymbol,
  MIN_WARMUP_SAMPLES,
  splitFootprintByUtcDay,
  SVP_WINDOW_SEC,
  type FootprintCell,
  type HeatmapCell,
  type LargeTradeTrackerState,
  type LiqEvent,
  type OrderBookState,
  type RecentTrade,
  type SpoofAlert,
  type VwapPeriod,
} from "@/lib/orderflow-data";
import type { BarOut, FundingSnapshot, GexSnapshot } from "@/lib/api";
import { TOKEN } from "@/lib/chart-colors";

const REFRESH_INTERVAL_MS = 30_000;
// footprint 버킷(aggregator 기본 60s) = fetchBarsForSymbol(symbol, "1m", ...) 캔들 간격과 동일.
const CANDLE_INTERVAL_SEC = 60;
const LAYERS_STORAGE_KEY = "orderflow-layers";
const VWAP_PERIOD_STORAGE_KEY = "orderflow-vwap-period";
const DEFAULT_VWAP_PERIOD: VwapPeriod = "day";

function loadStoredLayers(): Record<LayerKey, boolean> {
  if (typeof window === "undefined") return DEFAULT_LAYERS;
  try {
    const raw = window.localStorage.getItem(LAYERS_STORAGE_KEY);
    return raw ? { ...DEFAULT_LAYERS, ...JSON.parse(raw) } : DEFAULT_LAYERS;
  } catch {
    return DEFAULT_LAYERS;
  }
}

function loadStoredVwapPeriod(): VwapPeriod {
  if (typeof window === "undefined") return DEFAULT_VWAP_PERIOD;
  const raw = window.localStorage.getItem(VWAP_PERIOD_STORAGE_KEY);
  return raw === "day" || raw === "week" || raw === "month" ? raw : DEFAULT_VWAP_PERIOD;
}

interface OrderflowChartProps {
  symbol: string;
  footprint: FootprintCell[];
  heatmap: HeatmapCell[];
  book: OrderBookState;
  tapeSpeed: number | null;
  spoofAlerts: SpoofAlert[];
  recentTrades: RecentTrade[];
  liquidations: LiqEvent[];
  gex: GexSnapshot | null;
  funding: FundingSnapshot | null;
}

export function OrderflowChart({
  symbol,
  footprint,
  heatmap,
  book,
  tapeSpeed,
  spoofAlerts,
  recentTrades,
  liquidations,
  gex,
  funding,
}: OrderflowChartProps) {
  const [bars, setBars] = useState<BarOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const heatmapPrimitiveRef = useRef<HeatmapPrimitive | null>(null);
  const footprintPrimitiveRef = useRef<FootprintPrimitive | null>(null);
  const bookPrimitiveRef = useRef<OrderBookPrimitive | null>(null);
  const largeLotPrimitiveRef = useRef<LargeLotPrimitive | null>(null);
  const gexLevelsPrimitiveRef = useRef<GexLevelsPrimitive | null>(null);
  const liqLevelsPrimitiveRef = useRef<LiquidationLevelsPrimitive | null>(null);
  const positionLevelsPrimitiveRef = useRef<PositionLevelsPrimitive | null>(null);
  const svpPrimitiveRef = useRef<VolumeProfilePrimitive | null>(null);
  const cvpPrimitiveRef = useRef<VolumeProfilePrimitive | null>(null);
  const imbalancePrimitiveRef = useRef<ImbalanceBarPrimitive | null>(null);
  const liqBubblesPrimitiveRef = useRef<LiquidationBubblesPrimitive | null>(null);
  const volumeBgPrimitiveRef = useRef<VolumeBackgroundPrimitive | null>(null);
  const candleSeriesApiRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const absorptionPriceLinesRef = useRef<IPriceLine[]>([]);
  const currency = currencyForSymbol(symbol);
  const hlCoin = hlCoinForSymbol(symbol);
  const { positions, openOrders } = useHLPosition(hlCoin ?? "");
  const positionsRef = useRef(positions);
  const openOrdersRef = useRef(openOrders);
  positionsRef.current = positions;
  openOrdersRef.current = openOrders;
  const gexRef = useRef(gex);
  gexRef.current = gex;
  const prevFootprintRef = useRef<FootprintCell[]>([]);
  const largeTradeTrackerRef = useRef<LargeTradeTrackerState>(emptyLargeTradeTracker());
  const footprintRef = useRef(footprint);
  const heatmapRef = useRef(heatmap);
  const bookRef = useRef(book);
  const liquidationsRef = useRef(liquidations);
  footprintRef.current = footprint;
  heatmapRef.current = heatmap;
  bookRef.current = book;
  liquidationsRef.current = liquidations;

  const [absorptionMarkers, setAbsorptionMarkers] = useState<
    { time: UTCTimestamp; side: "buy" | "sell" }[]
  >([]);
  const [trackerSnapshot, setTrackerSnapshot] = useState<LargeTradeTrackerState>(emptyLargeTradeTracker());
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>(DEFAULT_LAYERS);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const layersFirstEffectRef = useRef(true);
  const [vwapPeriod, setVwapPeriod] = useState<VwapPeriod>(DEFAULT_VWAP_PERIOD);
  const vwapPeriodFirstEffectRef = useRef(true);

  useEffect(() => {
    setLayers(loadStoredLayers());
    setVwapPeriod(loadStoredVwapPeriod());
  }, []);

  useEffect(() => {
    // layers와 동일한 이유로 마운트 첫 실행은 건너뜀 — 로드 effect 반영 전 기본값 덮어쓰기 방지.
    if (!vwapPeriodFirstEffectRef.current) {
      try {
        window.localStorage.setItem(VWAP_PERIOD_STORAGE_KEY, vwapPeriod);
      } catch {
        // localStorage 불가 환경에서는 세션 내 상태만 유지.
      }
    }
    vwapPeriodFirstEffectRef.current = false;
  }, [vwapPeriod]);

  const cvdSeries = useMemo(
    () => computeCvdSeries(footprint).map((pt) => ({ time: pt.time as UTCTimestamp, value: pt.value })),
    [footprint]
  );

  // 대량체결 트래커의 이동중앙값 — Iceberg/Stop-run 노이즈플로어, 임밸런스 volBuyPct의 표본원으로 재사용.
  const medianSize = useMemo(() => {
    const sizes = trackerSnapshot.recentSizes;
    return sizes.length > 0 ? [...sizes].sort((a, b) => a - b)[Math.floor(sizes.length / 2)] : 0;
  }, [trackerSnapshot]);

  const volumeBuckets = useMemo(() => computeVolumeByBucket(footprint), [footprint]);
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

  const vwapBands = useMemo(
    () => computeVwapBands(bars, vwapPeriod).map((p) => ({ ...p, time: p.time as UTCTimestamp })),
    [bars, vwapPeriod]
  );
  const deltaSeries = useMemo(
    () => computeDeltaSeries(footprint).map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
    [footprint]
  );
  const divergenceMarkers = useMemo(
    () =>
      detectDeltaDivergence(bars, footprint).map((m) => ({
        time: m.time as UTCTimestamp,
        side: m.side,
      })),
    [bars, footprint]
  );
  const valueArea = useMemo(() => computeValueArea(cvpProfile), [cvpProfile]);
  const compositeValueArea = useMemo(
    () => computeCompositeValueArea(splitFootprintByUtcDay(footprint).map((cells) => computeVolumeProfile(cells))),
    [footprint]
  );
  const tpoProfile = useMemo(() => computeTpoProfile(footprint), [footprint]);
  const sessionLevels = useMemo(() => computeSessionLevels(bars), [bars]);
  const fibLevels = useMemo(
    () => (sessionLevels ? computeFibLevels(sessionLevels.sessionHigh, sessionLevels.sessionLow) : []),
    [sessionLevels]
  );
  const absorptionLevels = useMemo(() => computeFootprintAbsorptionLevels(footprint), [footprint]);
  const nakedPocs = useMemo(() => computeNakedPocs(footprint, bars), [footprint, bars]);
  const liqLevels = useMemo(
    () => estimateLiquidationLevels(funding?.mark_px ?? 0, funding?.open_interest ?? 0, funding?.funding ?? 0),
    [funding]
  );
  const liqLevelsRef = useRef(liqLevels);
  liqLevelsRef.current = liqLevels;
  const liqHeatmapSamples = useMemo(
    () => estimateLiquidationHeatmap(funding?.mark_px ?? 0, funding?.open_interest ?? 0, funding?.funding ?? 0),
    [funding]
  );
  const liqHeatmapSamplesRef = useRef(liqHeatmapSamples);
  liqHeatmapSamplesRef.current = liqHeatmapSamples;

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
    liqLevelsPrimitiveRef.current?.updateData(liqLevels);
  }, [liqLevels]);

  useEffect(() => {
    liqLevelsPrimitiveRef.current?.updateHeatmap(liqHeatmapSamples);
  }, [liqHeatmapSamples]);

  useEffect(() => {
    positionLevelsPrimitiveRef.current?.updateData(positions, openOrders);
  }, [positions, openOrders]);

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

  useEffect(() => {
    volumeBgPrimitiveRef.current?.updateData(volumeBuckets);
  }, [volumeBuckets]);

  useEffect(() => {
    liqBubblesPrimitiveRef.current?.updateData(liquidations, CANDLE_INTERVAL_SEC);
  }, [liquidations]);

  useEffect(() => {
    // 마운트 첫 실행(layers=DEFAULT_LAYERS, 아직 localStorage 미로드)은 건너뜀 —
    // 안 그러면 로드 effect가 실제 값을 반영하기 전에 기본값으로 덮어씀.
    if (!layersFirstEffectRef.current) {
      try {
        window.localStorage.setItem(LAYERS_STORAGE_KEY, JSON.stringify(layers));
      } catch {
        // localStorage 불가 환경(프라이빗 모드 등)에서는 세션 내 상태만 유지.
      }
    }
    layersFirstEffectRef.current = false;
    heatmapPrimitiveRef.current?.setVisible(layers.heatmap);
    footprintPrimitiveRef.current?.setVisible(layers.footprint);
    svpPrimitiveRef.current?.setVisible(layers.svp);
    cvpPrimitiveRef.current?.setVisible(layers.cvp);
    bookPrimitiveRef.current?.setVisible(layers.book);
    largeLotPrimitiveRef.current?.setVisible(layers.bubbles);
    gexLevelsPrimitiveRef.current?.setVisible(layers.gex);
    imbalancePrimitiveRef.current?.setVisible(layers.imbalance);
    liqLevelsPrimitiveRef.current?.setVisible(layers.liqHeatmap);
    positionLevelsPrimitiveRef.current?.setVisible(layers.positions);
    liqBubblesPrimitiveRef.current?.setVisible(layers.liqBubbles);
    volumeBgPrimitiveRef.current?.setVisible(layers.volBg);
  }, [layers]);

  function toggleLayer(key: LayerKey) {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // POC/VA + 세션 고저 수평선 — 캔들 시리즈의 price line으로 그림 (매 갱신 제거 후 재생성).
  useEffect(() => {
    const series = candleSeriesApiRef.current;
    if (!series) return;
    for (const pl of priceLinesRef.current) series.removePriceLine(pl);
    priceLinesRef.current = [];

    const add = (price: number, title: string, color: string, lineStyle: LineStyle, axisLabelVisible: boolean) => {
      priceLinesRef.current.push(
        series.createPriceLine({ price, title, color, lineWidth: 1, lineStyle, axisLabelVisible })
      );
    };
    if (layers.valueArea && valueArea) {
      add(valueArea.poc, "POC", TOKEN.accent, LineStyle.Solid, true);
      add(valueArea.vah, "VAH", TOKEN.accent, LineStyle.Dashed, false);
      add(valueArea.val, "VAL", TOKEN.accent, LineStyle.Dashed, false);
    }
    if (layers.compositeValueArea && compositeValueArea) {
      add(compositeValueArea.poc, `cPOC(${compositeValueArea.sessionCount}일)`, TOKEN.info, LineStyle.Solid, true);
      add(compositeValueArea.vah, "cVAH", TOKEN.info, LineStyle.Dashed, false);
      add(compositeValueArea.val, "cVAL", TOKEN.info, LineStyle.Dashed, false);
    }
    if (layers.sessionLevels && sessionLevels) {
      add(sessionLevels.sessionHigh, "금일고", TOKEN.text2, LineStyle.Dotted, false);
      add(sessionLevels.sessionLow, "금일저", TOKEN.text2, LineStyle.Dotted, false);
      if (sessionLevels.prevHigh !== null) add(sessionLevels.prevHigh, "전일고", TOKEN.text3, LineStyle.Dotted, false);
      if (sessionLevels.prevLow !== null) add(sessionLevels.prevLow, "전일저", TOKEN.text3, LineStyle.Dotted, false);
    }
    if (layers.fib) {
      // 0%/100%(세션 고저 자체)는 sessionLevels 라인과 중복이라 생략, 중간 되돌림 비율만 그림.
      // axisLabelVisible 항상 false — 라벨 박스가 다른 레벨들과 겹쳐서 지저분해짐. 대신 50%(프리미엄/디스카운트 경계)만
      // 색으로 구분해서 라벨 없이도 한눈에 띄게, 나머지는 배경처럼 옅게.
      for (const fib of fibLevels) {
        if (fib.ratio === 0 || fib.ratio === 1) continue;
        const color = fib.ratio === 0.5 ? TOKEN.warn : fib.isOte ? TOKEN.pos : TOKEN.text3;
        add(fib.price, fib.label, color, LineStyle.Dotted, false);
      }
    }
  }, [valueArea, compositeValueArea, sessionLevels, fibLevels, layers.valueArea, layers.compositeValueArea, layers.sessionLevels, layers.fib]);

  // 흡수 레벨은 footprint(실시간 틱마다 갱신)에서 나온 값이라 POC/VA 등 정적 레벨과 이펙트를 분리 —
  // 안 그러면 틱마다 위 이펙트가 전체 라인을 지웠다 다시 그려서 깜빡임/낭비 발생.
  useEffect(() => {
    const series = candleSeriesApiRef.current;
    if (!series) return;
    for (const pl of absorptionPriceLinesRef.current) series.removePriceLine(pl);
    absorptionPriceLinesRef.current = [];
    if (!layers.footprint) return;
    for (const lvl of absorptionLevels) {
      absorptionPriceLinesRef.current.push(
        series.createPriceLine({
          price: lvl.price,
          title: "흡수",
          color: TOKEN.info,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
        })
      );
    }
    for (const poc of nakedPocs) {
      absorptionPriceLinesRef.current.push(
        series.createPriceLine({
          price: poc.price,
          title: `nPOC ${poc.ageDays}일전`,
          color: TOKEN.warn,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
        })
      );
    }
  }, [absorptionLevels, nakedPocs, layers.footprint]);

  function handleSeriesReady(_chart: IChartApi, series: ISeriesApi<"Candlestick">) {
    candleSeriesApiRef.current = series;
    priceLinesRef.current = [];
    const hp = new HeatmapPrimitive();
    const fp = new FootprintPrimitive();
    const bp = new OrderBookPrimitive();
    const lp = new LargeLotPrimitive();
    const gp = new GexLevelsPrimitive();
    const qp = new LiquidationLevelsPrimitive();
    const pp = new PositionLevelsPrimitive();
    const svp = new VolumeProfilePrimitive(0);
    const cvp = new VolumeProfilePrimitive(1);
    const ip = new ImbalanceBarPrimitive();
    const vbg = new VolumeBackgroundPrimitive();
    const lqb = new LiquidationBubblesPrimitive();
    series.attachPrimitive(vbg);
    series.attachPrimitive(hp);
    series.attachPrimitive(fp);
    series.attachPrimitive(svp);
    series.attachPrimitive(cvp);
    series.attachPrimitive(bp);
    series.attachPrimitive(lp);
    series.attachPrimitive(lqb);
    series.attachPrimitive(gp);
    series.attachPrimitive(qp);
    series.attachPrimitive(pp);
    series.attachPrimitive(ip);
    hp.updateData(heatmapRef.current);
    fp.updateData(footprintRef.current);
    bp.updateData(bookRef.current);
    gp.updateData(currency && gexRef.current ? gexRef.current.levels : []);
    qp.updateData(liqLevelsRef.current);
    qp.updateHeatmap(liqHeatmapSamplesRef.current);
    pp.updateData(positionsRef.current, openOrdersRef.current);
    vbg.updateData(computeVolumeByBucket(footprintRef.current));
    lqb.updateData(liquidationsRef.current, CANDLE_INTERVAL_SEC);
    const initialLayers = layersRef.current;
    hp.setVisible(initialLayers.heatmap);
    fp.setVisible(initialLayers.footprint);
    svp.setVisible(initialLayers.svp);
    cvp.setVisible(initialLayers.cvp);
    bp.setVisible(initialLayers.book);
    lp.setVisible(initialLayers.bubbles);
    gp.setVisible(initialLayers.gex);
    qp.setVisible(initialLayers.liqHeatmap);
    pp.setVisible(initialLayers.positions);
    ip.setVisible(initialLayers.imbalance);
    vbg.setVisible(initialLayers.volBg);
    lqb.setVisible(initialLayers.liqBubbles);
    heatmapPrimitiveRef.current = hp;
    footprintPrimitiveRef.current = fp;
    bookPrimitiveRef.current = bp;
    largeLotPrimitiveRef.current = lp;
    gexLevelsPrimitiveRef.current = gp;
    liqLevelsPrimitiveRef.current = qp;
    positionLevelsPrimitiveRef.current = pp;
    svpPrimitiveRef.current = svp;
    cvpPrimitiveRef.current = cvp;
    imbalancePrimitiveRef.current = ip;
    volumeBgPrimitiveRef.current = vbg;
    liqBubblesPrimitiveRef.current = lqb;
  }

  if (error) {
    return <div className="border border-border bg-panel text-neg text-sm p-4">{error}</div>;
  }

  return (
    <div className="border border-border bg-panel">
      <OrderflowLegend
        layers={layers}
        onToggle={toggleLayer}
        vwapPeriod={vwapPeriod}
        onVwapPeriodChange={setVwapPeriod}
      />
      <div className="flex">
        <div className="flex-1 min-w-0">
          <CandlestickChart
            bars={bars}
            cvdSeries={cvdSeries}
            absorptionMarkers={absorptionMarkers}
            stopRunMarkers={stopRunMarkers}
            divergenceMarkers={divergenceMarkers}
            vwapSeries={layers.vwap ? vwapBands : undefined}
            deltaSeries={layers.deltaHist ? deltaSeries : undefined}
            onSeriesReady={handleSeriesReady}
            height={720}
          />
        </div>
        {layers.book && (
          <div className="w-[480px] shrink-0 h-[720px]">
            <OrderBookLadder book={book} icebergLevels={icebergLevels} />
          </div>
        )}
        {layers.tape && (
          <div className="w-44 shrink-0 h-[720px]">
            <TradeTape trades={recentTrades} />
          </div>
        )}
        <div className="w-72 shrink-0 border-l border-border h-[720px] overflow-y-auto">
          <OrderflowSignalPanel
            imbalance={imbalance}
            icebergLevels={icebergLevels}
            cvdSeries={cvdSeries}
            largeTrades={trackerSnapshot.largeTrades}
            absorptionMarkers={absorptionMarkers}
            stopRunMarkers={stopRunMarkers}
            divergenceMarkers={divergenceMarkers}
            spoofAlerts={spoofAlerts}
            valueArea={valueArea}
            compositeValueArea={compositeValueArea}
            tpoLevels={tpoProfile.levels}
            tpoValueArea={tpoProfile.valueArea}
            sessionLevels={sessionLevels}
            vwapLast={vwapBands.length > 0 ? vwapBands[vwapBands.length - 1].vwap : null}
            lastPrice={bars.length > 0 ? bars[bars.length - 1].close : null}
            tapeSpeed={tapeSpeed}
            warmedUp={trackerSnapshot.recentSizes.length >= MIN_WARMUP_SAMPLES}
          />
        </div>
      </div>
      {(hlCoin || currency) && (
        <div className="grid grid-cols-2 border-t border-border">
          {hlCoin && (
            <div className={currency ? "border-r border-border" : "col-span-2"}>
              <FundingPanel coin={hlCoin} funding={funding} />
            </div>
          )}
          {currency && (
            <div className={hlCoin ? "" : "col-span-2"}>
              <OptionsFlowPanel currency={currency} gex={gex} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
