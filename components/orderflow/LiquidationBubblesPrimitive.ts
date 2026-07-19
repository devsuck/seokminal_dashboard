import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { footprintColumnX } from "@/lib/orderflow-chart-coords";
import type { LiqEvent } from "@/lib/orderflow-data";

// long 청산(강제매도) = 매도압력 = neg, short 청산(강제매수) = 매수압력 = pos.
// LargeLotPrimitive(체결 원)와 같은 팔레트를 쓰되 다이아몬드 마커로 구분해 "실제 청산"임을 시각적으로도 분리.
const POS_RGB = "0, 217, 100"; // --color-pos #00D964
const NEG_RGB = "255, 59, 48"; // --color-neg #FF3B30

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function radiusFor(size: number, medianSize: number): number {
  if (medianSize <= 0) return 4;
  const scaled = 4 + Math.log2(size / medianSize) * 2;
  return Math.min(11, Math.max(4, scaled));
}

class LiquidationBubblesPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: LiquidationBubblesPrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    if (!this.primitive.visible) return;
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      const { liquidations, medianSize, candleIntervalSec, chart, series } = this.primitive;
      if (liquidations.length === 0) return;

      const barSpacing = chart.timeScale().options().barSpacing;
      const timeToX = (ts: number) => chart.timeScale().timeToCoordinate(ts as UTCTimestamp);
      const priceToY = (price: number) => series.priceToCoordinate(price);

      for (const liq of liquidations) {
        const barTime = Math.floor(liq.ts / candleIntervalSec) * candleIntervalSec;
        const col = footprintColumnX(barTime, timeToX, barSpacing);
        const y = priceToY(liq.price);
        if (!col || y === null) continue;

        const radius = radiusFor(liq.size, medianSize);
        const rgb = liq.side === "long" ? NEG_RGB : POS_RGB;
        ctx.beginPath();
        ctx.moveTo(col.center, y - radius);
        ctx.lineTo(col.center + radius, y);
        ctx.lineTo(col.center, y + radius);
        ctx.lineTo(col.center - radius, y);
        ctx.closePath();
        ctx.fillStyle = `rgba(${rgb}, 0.2)`;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(${rgb}, 0.55)`;
        ctx.stroke();
      }
    });
  }
}

class LiquidationBubblesPaneView implements IPrimitivePaneView {
  constructor(private primitive: LiquidationBubblesPrimitive) {}
  zOrder(): "top" {
    return "top";
  }
  renderer(): IPrimitivePaneRenderer {
    return new LiquidationBubblesPaneRenderer(this.primitive);
  }
}

/** 실제 강제청산 체결("Liq Bubbles") — Binance forceOrder 소스, HL 자체 청산 아님(참고용 타 거래소 데이터). */
export class LiquidationBubblesPrimitive implements ISeriesPrimitive<Time> {
  liquidations: LiqEvent[] = [];
  medianSize = 0;
  candleIntervalSec = 60;
  visible = true;
  chart!: SeriesAttachedParameter<Time>["chart"];
  series!: SeriesAttachedParameter<Time>["series"];
  private requestUpdate: (() => void) | null = null;
  private paneView = new LiquidationBubblesPaneView(this);

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.requestUpdate = null;
  }

  updateData(liquidations: LiqEvent[], candleIntervalSec: number): void {
    this.liquidations = liquidations;
    this.medianSize = median(liquidations.map((l) => l.size));
    this.candleIntervalSec = candleIntervalSec;
    this.requestUpdate?.();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.requestUpdate?.();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }
}
