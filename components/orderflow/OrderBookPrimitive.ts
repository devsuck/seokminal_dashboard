import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
} from "lightweight-charts";
import { bookBarLayout, stackedInsetColumns, SVP_COLUMN_WIDTH_PX, CVP_COLUMN_WIDTH_PX, COB_COLUMN_WIDTH_PX } from "@/lib/orderflow-chart-coords";
import type { BookLevel, OrderBookState, IcebergLevel } from "@/lib/orderflow-data";

const POS_RGB = "0, 217, 100"; // --color-pos #00D964
const NEG_RGB = "255, 59, 48"; // --color-neg #FF3B30
const WARN_RGB = "255, 159, 10"; // --color-warn #FF9F0A
const COLUMN_WIDTHS = [SVP_COLUMN_WIDTH_PX, CVP_COLUMN_WIDTH_PX, COB_COLUMN_WIDTH_PX];
const MIN_ROW_HEIGHT_FOR_TEXT = 9;

const VENUE_LABELS: Record<string, string> = {
  hyperliquid: "HL",
  "binance-depth": "BIN",
  "okx-depth": "OKX",
};

class OrderBookPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: OrderBookPrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    if (!this.primitive.visible) return;
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const { book, icebergLevels } = this.primitive;
      if (book.bids.length === 0 && book.asks.length === 0) return;

      const chartHeight = mediaSize.height;
      const col = stackedInsetColumns(mediaSize.width, COLUMN_WIDTHS)[2];
      const { left, right } = col;
      const insetWidth = right - left;

      const maxVisibleSize = Math.max(
        1,
        ...book.bids.map((l) => l.size),
        ...book.asks.map((l) => l.size)
      );
      const rowHeight = chartHeight / 2 / this.primitive.levels;
      const icebergByKey = new Map(icebergLevels.map((lv) => [`${lv.side}:${lv.price}`, lv]));

      const drawSide = (levels: BookLevel[], side: "bid" | "ask", rgb: string) => {
        levels.slice(0, this.primitive.levels).forEach((lvl, i) => {
          const layout = bookBarLayout(i, maxVisibleSize, lvl.size, chartHeight, side, this.primitive.levels);
          if (!layout) return;
          const barWidth = layout.widthFrac * insetWidth;
          const y = layout.yFrac * chartHeight;
          ctx.fillStyle = `rgba(${rgb}, 0.35)`;
          ctx.fillRect(right - barWidth, y, barWidth, rowHeight - 1);

          if (icebergByKey.has(`${side}:${lvl.price}`)) {
            ctx.strokeStyle = `rgba(${WARN_RGB}, 0.9)`;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(right - barWidth, y, barWidth, rowHeight - 1);
          }

          if (rowHeight >= MIN_ROW_HEIGHT_FOR_TEXT) {
            ctx.save();
            ctx.font = "9px monospace";
            ctx.fillStyle = "rgba(255,255,255,0.65)";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(lvl.size.toFixed(2), left + 2, y + rowHeight / 2);
            ctx.restore();
          }
        });
      };

      drawSide(book.asks, "ask", NEG_RGB);
      drawSide(book.bids, "bid", POS_RGB);

      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.strokeRect(left, 0, insetWidth, chartHeight);

      if (book.venues.length > 0) {
        ctx.save();
        ctx.font = "9px sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.fillText(book.venues.map((v) => VENUE_LABELS[v] ?? v).join(" "), right - 4, 2);
        ctx.restore();
      }
    });
  }
}

class OrderBookPaneView implements IPrimitivePaneView {
  constructor(private primitive: OrderBookPrimitive) {}
  zOrder(): "top" {
    return "top";
  }
  renderer(): IPrimitivePaneRenderer {
    return new OrderBookPaneRenderer(this.primitive);
  }
}

export class OrderBookPrimitive implements ISeriesPrimitive<Time> {
  book: OrderBookState = { bids: [], asks: [], venues: [], byVenue: {} };
  visible = true;
  icebergLevels: IcebergLevel[] = [];
  readonly levels = 20;
  chart!: SeriesAttachedParameter<Time>["chart"];
  series!: SeriesAttachedParameter<Time>["series"];
  private requestUpdate: (() => void) | null = null;
  private paneView = new OrderBookPaneView(this);

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.requestUpdate = null;
  }

  updateData(book: OrderBookState): void {
    this.book = book;
    this.requestUpdate?.();
  }

  updateIcebergLevels(icebergLevels: IcebergLevel[]): void {
    this.icebergLevels = icebergLevels;
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
