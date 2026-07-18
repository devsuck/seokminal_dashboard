"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type ISeriesPrimitive,
  type IPrimitivePaneView,
  type IPrimitivePaneRenderer,
  type SeriesAttachedParameter,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { IctBar, IctEvent } from "@/lib/api";
import { TOKEN, categoricalColor } from "@/lib/chart-colors";

interface IctChartProps {
  bars: IctBar[];
  events: Record<string, IctEvent[]>;
}

/** hex + alpha → rgba() 문자열. 토큰/카테고리컬 팔레트에서 파생시키기 위한 헬퍼 — 새 hex를 만들지 않는다. */
function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

const ZONE_COLORS: Record<string, { fill: string; border: string }> = {
  fvg: { fill: withAlpha(categoricalColor(4), 0.16), border: categoricalColor(4) },
  order_block: { fill: withAlpha(categoricalColor(0), 0.16), border: categoricalColor(0) },
  unicorn: { fill: withAlpha(TOKEN.warn, 0.22), border: TOKEN.warn },
  killzone: { fill: withAlpha(TOKEN.text2, 0.07), border: "transparent" },
};

const POINT_COLORS: Record<string, string> = {
  sweep: categoricalColor(2),
  market_structure: categoricalColor(4),
  ote: TOKEN.accent,
  ifvg: categoricalColor(1),
  cisd: TOKEN.hud,
  turtle_soup: categoricalColor(6),
};

export const ICT_LEGEND: { id: string; label: string; color: string; kind: "zone" | "point" }[] = [
  { id: "fvg", label: "FVG", color: ZONE_COLORS.fvg.border, kind: "zone" },
  { id: "order_block", label: "Order Block", color: ZONE_COLORS.order_block.border, kind: "zone" },
  { id: "unicorn", label: "Unicorn", color: ZONE_COLORS.unicorn.border, kind: "zone" },
  { id: "killzone", label: "Kill Zone", color: TOKEN.text2, kind: "zone" },
  { id: "sweep", label: "Sweep", color: POINT_COLORS.sweep, kind: "point" },
  { id: "market_structure", label: "BOS/CHoCH", color: POINT_COLORS.market_structure, kind: "point" },
  { id: "ote", label: "OTE", color: POINT_COLORS.ote, kind: "point" },
  { id: "ifvg", label: "iFVG", color: POINT_COLORS.ifvg, kind: "point" },
  { id: "cisd", label: "CISD", color: POINT_COLORS.cisd, kind: "point" },
  { id: "turtle_soup", label: "Turtle Soup", color: POINT_COLORS.turtle_soup, kind: "point" },
];

interface ZoneSpec {
  t1: UTCTimestamp;
  t2: UTCTimestamp;
  lo: number | null;
  hi: number | null; // null lo/hi → 전체높이 밴드(killzone)
  fill: string;
  border: string;
}

class ZoneRenderer implements IPrimitivePaneRenderer {
  constructor(
    private items: { x1: number; x2: number; y1: number | null; y2: number | null; fill: string; border: string }[]
  ) {}

  draw(target: CanvasRenderingTarget2D) {
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      for (const it of this.items) {
        const x1 = it.x1 * scope.horizontalPixelRatio;
        const x2 = it.x2 * scope.horizontalPixelRatio;
        const y1 = it.y1 == null ? 0 : it.y1 * scope.verticalPixelRatio;
        const y2 = it.y2 == null ? scope.bitmapSize.height : it.y2 * scope.verticalPixelRatio;
        const left = Math.min(x1, x2);
        const width = Math.max(1, Math.abs(x2 - x1));
        const top = Math.min(y1, y2);
        const height = Math.max(1, Math.abs(y2 - y1));
        ctx.fillStyle = it.fill;
        ctx.fillRect(left, top, width, height);
        if (it.border !== "transparent") {
          ctx.strokeStyle = it.border;
          ctx.lineWidth = 1;
          ctx.strokeRect(left, top, width, height);
        }
      }
    });
  }
}

class ZonePaneView implements IPrimitivePaneView {
  constructor(private source: ZoneOverlay) {}

  zOrder(): "bottom" {
    return "bottom";
  }

  renderer(): IPrimitivePaneRenderer | null {
    const { chart, series, zones } = this.source;
    if (!chart || !series) return null;
    const timeScale = chart.timeScale();
    const items = zones
      .map((z) => {
        const x1 = timeScale.timeToCoordinate(z.t1);
        const x2 = timeScale.timeToCoordinate(z.t2);
        if (x1 == null || x2 == null) return null;
        const y1 = z.hi == null ? null : series.priceToCoordinate(z.hi);
        const y2 = z.lo == null ? null : series.priceToCoordinate(z.lo);
        return { x1, x2, y1, y2, fill: z.fill, border: z.border };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return new ZoneRenderer(items);
  }
}

class ZoneOverlay implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null;
  series: ISeriesApi<"Candlestick"> | null = null;
  zones: ZoneSpec[] = [];
  private views: ZonePaneView[];

  constructor() {
    this.views = [new ZonePaneView(this)];
  }

  attached(param: SeriesAttachedParameter<Time>) {
    this.chart = param.chart;
    this.series = param.series as ISeriesApi<"Candlestick">;
  }

  updateAllViews() {}

  paneViews() {
    return this.views;
  }

  setZones(zones: ZoneSpec[]) {
    this.zones = zones;
  }
}

export function IctChart({ bars, events }: IctChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || bars.length === 0) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 480,
      layout: {
        background: { color: TOKEN.panel2 },
        textColor: TOKEN.text3,
        fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: TOKEN.border },
        horzLines: { color: TOKEN.border },
      },
      crosshair: {
        vertLine: { color: TOKEN.accent, labelBackgroundColor: TOKEN.accent },
        horzLine: { color: TOKEN.accent, labelBackgroundColor: TOKEN.accent },
      },
      rightPriceScale: { borderColor: TOKEN.border },
      timeScale: { borderColor: TOKEN.border, timeVisible: true },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: TOKEN.pos,
      downColor: TOKEN.neg,
      borderUpColor: TOKEN.pos,
      borderDownColor: TOKEN.neg,
      wickUpColor: TOKEN.pos,
      wickDownColor: TOKEN.neg,
    });

    candleSeries.setData(
      bars.map((b) => ({ time: b.ts as UTCTimestamp, open: b.o, high: b.h, low: b.l, close: b.c }))
    );

    const overlay = new ZoneOverlay();
    candleSeries.attachPrimitive(overlay);

    const zones: ZoneSpec[] = [];
    const markers: SeriesMarker<UTCTimestamp>[] = [];
    const lastIdx = bars.length - 1;

    for (const [prim, evts] of Object.entries(events)) {
      const zoneColor = ZONE_COLORS[prim];
      const pointColor = POINT_COLORS[prim];
      for (const e of evts) {
        const bar1 = bars[Math.min(Math.max(e.idx, 0), lastIdx)];
        if (!bar1) continue;
        if (zoneColor) {
          const idxEnd = Math.min(Math.max(e.idx_end ?? e.idx, 0), lastIdx);
          const bar2 = bars[idxEnd] ?? bar1;
          zones.push({
            t1: bar1.ts as UTCTimestamp,
            t2: bar2.ts as UTCTimestamp,
            lo: e.lo ?? null,
            hi: e.hi ?? null,
            fill: zoneColor.fill,
            border: zoneColor.border,
          });
        } else if (pointColor) {
          markers.push({
            time: bar1.ts as UTCTimestamp,
            position: e.type === "bearish" ? "aboveBar" : "belowBar",
            color: pointColor,
            shape: e.type === "bearish" ? "arrowDown" : "arrowUp",
            text: prim,
          });
        }
      }
    }

    overlay.setZones(zones);
    if (markers.length) {
      markers.sort((a, b) => (a.time as number) - (b.time as number));
      createSeriesMarkers(candleSeries, markers);
    }

    chart.timeScale().fitContent();

    const onResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
    };
  }, [bars, events]);

  return <div ref={containerRef} className="w-full rounded-b-lg" />;
}
