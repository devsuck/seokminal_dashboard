import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { footprintCellRect, footprintColumnX } from "@/lib/orderflow-chart-coords";
import { computeFootprintLayout, type FootprintCell } from "@/lib/orderflow-data";

// 이 값 아래 barSpacing에서는 매수/매도 숫자가 겹쳐서 안 보이므로 색 배경만 그림.
const MIN_BAR_SPACING_FOR_TEXT = 40;

class FootprintPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: FootprintPrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    if (!this.primitive.visible) return;
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      const { cells, chart, series } = this.primitive;
      if (cells.length === 0) return;

      const barSpacing = chart.timeScale().options().barSpacing;
      const timeToX = (ts: number) => chart.timeScale().timeToCoordinate(ts as UTCTimestamp);
      const priceToY = (price: number) => series.priceToCoordinate(price);

      // 매수/매도 색 배경 — 항상 그림(저줌에서도 보여야 함, 숫자는 확대시에만).
      const layout = computeFootprintLayout(cells);
      const maxVol = Math.max(1, ...cells.map((c) => Math.max(c.buyVol, c.sellVol)));
      for (const cell of cells) {
        const rect = footprintCellRect(cell, layout.prices, timeToX, priceToY, barSpacing);
        if (!rect) continue;
        const halfWidth = rect.width / 2;
        const sellIntensity = Math.min(1, cell.sellVol / maxVol);
        const buyIntensity = Math.min(1, cell.buyVol / maxVol);
        ctx.fillStyle = `rgba(239, 68, 68, ${0.08 + sellIntensity * 0.35})`;
        ctx.fillRect(rect.x, rect.y, halfWidth, rect.height);
        ctx.fillStyle = `rgba(34, 197, 94, ${0.08 + buyIntensity * 0.35})`;
        ctx.fillRect(rect.x + halfWidth, rect.y, halfWidth, rect.height);
      }

      if (barSpacing < MIN_BAR_SPACING_FOR_TEXT) return;

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

        const delta = cell.buyVol - cell.sellVol;
        ctx.fillStyle = delta >= 0 ? "#00D964" : "#FF3B30";
        ctx.textAlign = "center";
        ctx.fillText((delta >= 0 ? "+" : "") + delta.toFixed(1), col.center, y + 11);
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
  visible = true;
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

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.requestUpdate?.();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }
}
