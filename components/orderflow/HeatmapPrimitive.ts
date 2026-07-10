import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { heatmapCellRect } from "@/lib/orderflow-chart-coords";
import { aggregateHeatmapByCandle, computeHeatmapLayout, type HeatmapCell } from "@/lib/orderflow-data";

// orderflow/aggregator.py의 footprint_bucket_sec=60.0(캔들 간격)과 맞춰야 함
const CANDLE_INTERVAL_SEC = 60;

class HeatmapPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: HeatmapPrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      const { cells, chart, series } = this.primitive;
      if (cells.length === 0) return;

      const aggregated = aggregateHeatmapByCandle(cells, CANDLE_INTERVAL_SEC);
      const layout = computeHeatmapLayout(aggregated);
      const timeToX = (ts: number) => chart.timeScale().timeToCoordinate(ts as UTCTimestamp);
      const priceToY = (price: number) => series.priceToCoordinate(price);
      const barSpacing = chart.timeScale().options().barSpacing;
      const maxSize = Math.max(1, ...aggregated.map((c) => c.size));

      for (const cell of aggregated) {
        const rect = heatmapCellRect(cell, CANDLE_INTERVAL_SEC, layout.prices, timeToX, priceToY, barSpacing);
        if (!rect) continue;
        const intensity = Math.min(1, cell.size / maxSize);
        ctx.fillStyle = `rgba(255, 159, 10, ${0.1 + intensity * 0.6})`;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      }
    });
  }
}

class HeatmapPaneView implements IPrimitivePaneView {
  constructor(private primitive: HeatmapPrimitive) {}
  zOrder(): "bottom" {
    return "bottom";
  }
  renderer(): IPrimitivePaneRenderer {
    return new HeatmapPaneRenderer(this.primitive);
  }
}

export class HeatmapPrimitive implements ISeriesPrimitive<Time> {
  cells: HeatmapCell[] = [];
  chart!: SeriesAttachedParameter<Time>["chart"];
  series!: SeriesAttachedParameter<Time>["series"];
  private requestUpdate: (() => void) | null = null;
  private paneView = new HeatmapPaneView(this);

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.requestUpdate = null;
  }

  updateData(cells: HeatmapCell[]): void {
    this.cells = cells;
    this.requestUpdate?.();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }
}
