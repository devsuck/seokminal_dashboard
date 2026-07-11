import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { footprintColumnX } from "@/lib/orderflow-chart-coords";
import type { LargeTrade } from "@/lib/orderflow-data";

const POS_RGB = "0, 217, 100"; // --color-pos #00D964
const NEG_RGB = "255, 59, 48"; // --color-neg #FF3B30

function radiusFor(size: number, medianSize: number): number {
  if (medianSize <= 0) return 4;
  const scaled = 4 + Math.log2(size / medianSize) * 2;
  return Math.min(12, Math.max(4, scaled));
}

class LargeLotPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: LargeLotPrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    if (!this.primitive.visible) return;
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      const { trades, medianSize, chart, series } = this.primitive;
      if (trades.length === 0) return;

      const barSpacing = chart.timeScale().options().barSpacing;
      const timeToX = (ts: number) => chart.timeScale().timeToCoordinate(ts as UTCTimestamp);
      const priceToY = (price: number) => series.priceToCoordinate(price);

      for (const trade of trades) {
        const col = footprintColumnX(trade.bucketTs, timeToX, barSpacing);
        const y = priceToY(trade.price);
        if (!col || y === null) continue;

        const radius = radiusFor(trade.size, medianSize);
        const rgb = trade.side === "buy" ? POS_RGB : NEG_RGB;
        ctx.beginPath();
        ctx.arc(col.center, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, 0.4)`;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = `rgba(${rgb}, 1)`;
        ctx.stroke();
      }
    });
  }
}

class LargeLotPaneView implements IPrimitivePaneView {
  constructor(private primitive: LargeLotPrimitive) {}
  zOrder(): "top" {
    return "top";
  }
  renderer(): IPrimitivePaneRenderer {
    return new LargeLotPaneRenderer(this.primitive);
  }
}

export class LargeLotPrimitive implements ISeriesPrimitive<Time> {
  trades: LargeTrade[] = [];
  medianSize = 0;
  visible = true;
  chart!: SeriesAttachedParameter<Time>["chart"];
  series!: SeriesAttachedParameter<Time>["series"];
  private requestUpdate: (() => void) | null = null;
  private paneView = new LargeLotPaneView(this);

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.requestUpdate = null;
  }

  updateData(trades: LargeTrade[], medianSize: number): void {
    this.trades = trades;
    this.medianSize = medianSize;
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
