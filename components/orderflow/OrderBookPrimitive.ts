import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
} from "lightweight-charts";
import { stackedInsetColumns, SVP_COLUMN_WIDTH_PX, CVP_COLUMN_WIDTH_PX, COB_COLUMN_WIDTH_PX } from "@/lib/orderflow-chart-coords";
import type { BookLevel, OrderBookState, IcebergLevel } from "@/lib/orderflow-data";

const POS_RGB = "0, 217, 100"; // --color-pos #00D964
const NEG_RGB = "255, 59, 48"; // --color-neg #FF3B30
const WARN_RGB = "255, 159, 10"; // --color-warn #FF9F0A
const COLUMN_WIDTHS = [SVP_COLUMN_WIDTH_PX, CVP_COLUMN_WIDTH_PX, COB_COLUMN_WIDTH_PX];
const BAR_HEIGHT_PX = 2;

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
      const { book, icebergLevels, series } = this.primitive;
      if (book.bids.length === 0 && book.asks.length === 0) return;

      const col = stackedInsetColumns(mediaSize.width, COLUMN_WIDTHS)[2];
      const { left, right } = col;
      const insetWidth = right - left;

      const maxVisibleSize = Math.max(
        1,
        ...book.bids.map((l) => l.size),
        ...book.asks.map((l) => l.size)
      );
      const icebergByKey = new Map(icebergLevels.map((lv) => [`${lv.side}:${lv.price}`, lv]));

      // 실제 가격축(series.priceToCoordinate)에 앵커 — 랭크 순으로 차트 절반을 균등 분할하면
      // 현재가 근처(스프레드)가 텅 비고 벽이 화면 위/아래 끝에 몰려 보이는 문제가 있었음.
      const drawSide = (levels: BookLevel[], side: "bid" | "ask", rgb: string) => {
        levels.slice(0, this.primitive.levels).forEach((lvl) => {
          const y = series.priceToCoordinate(lvl.price);
          if (y === null) return;
          const barWidth = Math.min(1, lvl.size / maxVisibleSize) * insetWidth;
          ctx.fillStyle = `rgba(${rgb}, 0.45)`;
          ctx.fillRect(right - barWidth, y - BAR_HEIGHT_PX / 2, barWidth, BAR_HEIGHT_PX);

          if (icebergByKey.has(`${side}:${lvl.price}`)) {
            ctx.strokeStyle = `rgba(${WARN_RGB}, 0.9)`;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(right - barWidth, y - BAR_HEIGHT_PX / 2, barWidth, BAR_HEIGHT_PX);
          }
        });
      };

      drawSide(book.asks, "ask", NEG_RGB);
      drawSide(book.bids, "bid", POS_RGB);

      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.strokeRect(left, 0, insetWidth, mediaSize.height);

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
