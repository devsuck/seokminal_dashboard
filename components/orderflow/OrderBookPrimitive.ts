import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
} from "lightweight-charts";
import { bookBarLayout } from "@/lib/orderflow-chart-coords";
import type { BookLevel, OrderBookState } from "@/lib/orderflow-data";

const INSET_WIDTH_PX = 90;
const POS_RGB = "0, 217, 100"; // --color-pos #00D964
const NEG_RGB = "255, 59, 48"; // --color-neg #FF3B30

class OrderBookPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: OrderBookPrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const { book } = this.primitive;
      if (book.bids.length === 0 && book.asks.length === 0) return;

      const chartHeight = mediaSize.height;
      const chartWidth = mediaSize.width;
      const right = chartWidth;
      const left = chartWidth - INSET_WIDTH_PX;

      const maxVisibleSize = Math.max(
        1,
        ...book.bids.map((l) => l.size),
        ...book.asks.map((l) => l.size)
      );
      const rowHeight = chartHeight / 2 / this.primitive.levels;

      const drawSide = (levels: BookLevel[], side: "bid" | "ask", rgb: string) => {
        levels.slice(0, this.primitive.levels).forEach((lvl, i) => {
          const layout = bookBarLayout(i, maxVisibleSize, lvl.size, chartHeight, side, this.primitive.levels);
          if (!layout) return;
          const barWidth = layout.widthFrac * INSET_WIDTH_PX;
          const y = layout.yFrac * chartHeight;
          ctx.fillStyle = `rgba(${rgb}, 0.35)`;
          ctx.fillRect(right - barWidth, y, barWidth, rowHeight - 1);
        });
      };

      drawSide(book.asks, "ask", NEG_RGB);
      drawSide(book.bids, "bid", POS_RGB);

      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.strokeRect(left, 0, INSET_WIDTH_PX, chartHeight);
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
  book: OrderBookState = { bids: [], asks: [] };
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

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }
}
