import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { footprintColumnX } from "@/lib/orderflow-chart-coords";
import type { FootprintCell } from "@/lib/orderflow-data";

const MIN_BAR_SPACING_FOR_TEXT = 40;

class FootprintPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: FootprintPrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      const { cells, chart, series } = this.primitive;
      if (cells.length === 0) return;

      const barSpacing = chart.timeScale().options().barSpacing;
      if (barSpacing < MIN_BAR_SPACING_FOR_TEXT) return;

      const timeToX = (ts: number) => chart.timeScale().timeToCoordinate(ts as UTCTimestamp);
      const priceToY = (price: number) => series.priceToCoordinate(price);

      ctx.font = "10px monospace";
      ctx.textBaseline = "middle";

      for (const cell of cells) {
        const col = footprintColumnX(cell.bucketTs, timeToX, barSpacing);
        const y = priceToY(cell.price);
        if (!col || y === null) continue;

        ctx.fillStyle = "#EF4444";
        ctx.textAlign = "right";
        ctx.fillText(cell.sellVol.toFixed(1), col.center - 2, y);

        ctx.fillStyle = "#22C55E";
        ctx.textAlign = "left";
        ctx.fillText(cell.buyVol.toFixed(1), col.center + 2, y);
      }
    });
  }
}

class FootprintPaneView implements IPrimitivePaneView {
  constructor(private primitive: FootprintPrimitive) {}
  zOrder(): "top" {
    return "top";
  }
  renderer(): IPrimitivePaneRenderer {
    return new FootprintPaneRenderer(this.primitive);
  }
}

export class FootprintPrimitive implements ISeriesPrimitive<Time> {
  cells: FootprintCell[] = [];
  chart!: SeriesAttachedParameter<Time>["chart"];
  series!: SeriesAttachedParameter<Time>["series"];
  private requestUpdate: (() => void) | null = null;
  private paneView = new FootprintPaneView(this);

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.requestUpdate = null;
  }

  updateData(cells: FootprintCell[]): void {
    this.cells = cells;
    this.requestUpdate?.();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }
}
