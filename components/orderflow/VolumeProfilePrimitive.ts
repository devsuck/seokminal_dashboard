import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
} from "lightweight-charts";
import { stackedInsetColumns, SVP_COLUMN_WIDTH_PX, CVP_COLUMN_WIDTH_PX, COB_COLUMN_WIDTH_PX } from "@/lib/orderflow-chart-coords";
import type { VolumeProfileLevel } from "@/lib/orderflow-data";

const POS_RGB = "0, 217, 100"; // --color-pos #00D964
const NEG_RGB = "255, 59, 48"; // --color-neg #FF3B30
const COLUMN_WIDTHS = [SVP_COLUMN_WIDTH_PX, CVP_COLUMN_WIDTH_PX, COB_COLUMN_WIDTH_PX];

class VolumeProfilePaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: VolumeProfilePrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    if (!this.primitive.visible) return;
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const { levels, series, columnIndex } = this.primitive;
      if (levels.length === 0) return;

      const col = stackedInsetColumns(mediaSize.width, COLUMN_WIDTHS)[columnIndex];
      const columnWidth = col.right - col.left;

      ctx.font = "9px ui-monospace, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillText(columnIndex === 0 ? "SVP·30분" : "CVP·전체", col.left + 3, 3);

      const sortedPrices = Array.from(new Set(levels.map((l) => l.price))).sort((a, b) => b - a);
      if (sortedPrices.length === 0) return;

      const priceToY = (price: number) => series.priceToCoordinate(price);
      const maxVol = Math.max(1, ...levels.map((l) => l.buyVol + l.sellVol));
      const byPrice = new Map(levels.map((l) => [l.price, l]));

      // Handle single price level case to avoid neighbor-lookup failure
      if (sortedPrices.length === 1) {
        const price = sortedPrices[0];
        const y = priceToY(price);
        if (y === null) return;

        const height = 20; // Fixed height for single price level
        const top = y - height / 2;

        const level = byPrice.get(price);
        if (!level) return;
        const total = level.buyVol + level.sellVol;
        const width = Math.min(columnWidth, (total / maxVol) * columnWidth);
        const buyWidth = total > 0 ? (level.buyVol / total) * width : 0;

        ctx.fillStyle = `rgba(${NEG_RGB}, 0.5)`;
        ctx.fillRect(col.right - width, top, width - buyWidth, height - 1);
        ctx.fillStyle = `rgba(${POS_RGB}, 0.5)`;
        ctx.fillRect(col.right - buyWidth, top, buyWidth, height - 1);

        return;
      }

      sortedPrices.forEach((price, idx) => {
        const y = priceToY(price);
        if (y === null) return;
        const neighborIdx = idx < sortedPrices.length - 1 ? idx + 1 : idx - 1;
        const neighborY = priceToY(sortedPrices[neighborIdx]);
        if (neighborY === null) return;
        const height = Math.max(1, Math.abs(neighborY - y));
        const top = y - height / 2;

        const level = byPrice.get(price);
        if (!level) return;
        const total = level.buyVol + level.sellVol;
        const width = Math.min(columnWidth, (total / maxVol) * columnWidth);
        const buyWidth = total > 0 ? (level.buyVol / total) * width : 0;

        ctx.fillStyle = `rgba(${NEG_RGB}, 0.5)`;
        ctx.fillRect(col.right - width, top, width - buyWidth, height - 1);
        ctx.fillStyle = `rgba(${POS_RGB}, 0.5)`;
        ctx.fillRect(col.right - buyWidth, top, buyWidth, height - 1);
      });

      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.strokeRect(col.left, 0, columnWidth, mediaSize.height);
    });
  }
}

class VolumeProfilePaneView implements IPrimitivePaneView {
  constructor(private primitive: VolumeProfilePrimitive) {}
  zOrder(): "top" {
    return "top";
  }
  renderer(): IPrimitivePaneRenderer {
    return new VolumeProfilePaneRenderer(this.primitive);
  }
}

export class VolumeProfilePrimitive implements ISeriesPrimitive<Time> {
  levels: VolumeProfileLevel[] = [];
  visible = true;
  chart!: SeriesAttachedParameter<Time>["chart"];
  series!: SeriesAttachedParameter<Time>["series"];
  readonly columnIndex: 0 | 1;
  private requestUpdate: (() => void) | null = null;
  private paneView = new VolumeProfilePaneView(this);

  constructor(columnIndex: 0 | 1) {
    this.columnIndex = columnIndex;
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.requestUpdate = null;
  }

  updateData(levels: VolumeProfileLevel[]): void {
    this.levels = levels;
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
