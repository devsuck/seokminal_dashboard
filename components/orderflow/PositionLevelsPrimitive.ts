import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
} from "lightweight-charts";
import type { HLPositionSnapshot } from "@/hooks/useHLPosition";
import type { HLOpenOrder } from "@/lib/api";

const POS = "0, 217, 100"; // --color-pos
const NEG = "255, 59, 48"; // --color-neg
const WARN = "255, 159, 10"; // --color-warn
const ACCENT = "255, 176, 32"; // --color-accent (근사, 실제 accent와 유사 톤)

interface OrderRow extends HLOpenOrder {
  paper: boolean;
}

class PositionLevelsPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: PositionLevelsPrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    if (!this.primitive.visible) return;
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const { positions, openOrders, series } = this.primitive;

      for (const snap of positions) {
        const szi = parseFloat(snap.position.szi);
        const entryPx = snap.position.entryPx ? parseFloat(snap.position.entryPx) : null;
        if (szi === 0 || entryPx === null) continue;
        const side = szi > 0 ? "롱" : "숏";
        const y = series.priceToCoordinate(entryPx);
        if (y !== null) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(mediaSize.width, y);
          ctx.strokeStyle = `rgba(${ACCENT}, 0.8)`;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          const pnl = parseFloat(snap.position.unrealizedPnl);
          const pnlColor = pnl >= 0 ? POS : NEG;
          ctx.font = "10px ui-monospace, monospace";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillStyle = `rgba(${ACCENT}, 0.95)`;
          const tag = snap.paper ? " (페이퍼)" : "";
          ctx.fillText(`진입 ${side} ${Math.abs(szi)}${tag}`, 4, y - 6);
          ctx.fillStyle = `rgba(${pnlColor}, 0.95)`;
          ctx.fillText(`${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} PnL`, 4, y + 6);
        }

        const liqPx = snap.position.liquidationPx ? parseFloat(snap.position.liquidationPx) : null;
        if (liqPx !== null) {
          const ly = series.priceToCoordinate(liqPx);
          if (ly !== null) {
            ctx.beginPath();
            ctx.moveTo(0, ly);
            ctx.lineTo(mediaSize.width, ly);
            ctx.strokeStyle = `rgba(${NEG}, 0.7)`;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 2]);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.font = "9px ui-monospace, monospace";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillStyle = `rgba(${NEG}, 0.9)`;
            ctx.fillText(`청산가${snap.paper ? " (페이퍼)" : ""}`, 4, ly - 5);
          }
        }
      }

      for (const order of openOrders) {
        const px = parseFloat(order.limitPx);
        const y = series.priceToCoordinate(px);
        if (y === null) continue;
        const isBuy = order.side === "B" || order.side.toLowerCase() === "buy";
        const rgb = isBuy ? POS : NEG;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(16, y);
        ctx.strokeStyle = `rgba(${rgb}, 0.7)`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = "9px ui-monospace, monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = `rgba(${WARN}, 0.9)`;
        ctx.fillText(`주문 ${order.sz}${order.paper ? " (페이퍼)" : ""}`, 20, y);
      }
    });
  }
}

class PositionLevelsPaneView implements IPrimitivePaneView {
  constructor(private primitive: PositionLevelsPrimitive) {}
  zOrder(): "top" {
    return "top";
  }
  renderer(): IPrimitivePaneRenderer {
    return new PositionLevelsPaneRenderer(this.primitive);
  }
}

export class PositionLevelsPrimitive implements ISeriesPrimitive<Time> {
  positions: HLPositionSnapshot[] = [];
  openOrders: OrderRow[] = [];
  visible = true;
  chart!: SeriesAttachedParameter<Time>["chart"];
  series!: SeriesAttachedParameter<Time>["series"];
  private requestUpdate: (() => void) | null = null;
  private paneView = new PositionLevelsPaneView(this);

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.requestUpdate = null;
  }

  updateData(positions: HLPositionSnapshot[], openOrders: OrderRow[]): void {
    this.positions = positions;
    this.openOrders = openOrders;
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
