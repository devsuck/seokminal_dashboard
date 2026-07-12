import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
} from "lightweight-charts";
import type { LiqLevel } from "@/lib/orderflow-data";

const NEG = "255, 59, 48"; // --color-neg #FF3B30 — 롱 청산(하방)
const POS = "0, 217, 100"; // --color-pos #00D964 — 숏 청산(상방)

class LiquidationLevelsPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: LiquidationLevelsPrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    if (!this.primitive.visible) return;
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const { levels, series } = this.primitive;
      if (levels.length === 0) return;

      const maxWeight = Math.max(1e-9, ...levels.map((lv) => lv.weight));

      for (const lv of levels) {
        const y = series.priceToCoordinate(lv.price);
        if (y === null) continue;

        const intensity = lv.weight / maxWeight;
        const color = lv.side === "long" ? NEG : POS;

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(mediaSize.width, y);
        ctx.strokeStyle = `rgba(${color}, ${0.08 + intensity * 0.35})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = "9px ui-monospace, monospace";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillStyle = `rgba(${color}, ${0.5 + intensity * 0.4})`;
        ctx.fillText(`${lv.leverage}x 청산(추정)`, mediaSize.width - 4, y - 5);
      }
    });
  }
}

class LiquidationLevelsPaneView implements IPrimitivePaneView {
  constructor(private primitive: LiquidationLevelsPrimitive) {}
  zOrder(): "bottom" {
    return "bottom";
  }
  renderer(): IPrimitivePaneRenderer {
    return new LiquidationLevelsPaneRenderer(this.primitive);
  }
}

export class LiquidationLevelsPrimitive implements ISeriesPrimitive<Time> {
  levels: LiqLevel[] = [];
  visible = true;
  chart!: SeriesAttachedParameter<Time>["chart"];
  series!: SeriesAttachedParameter<Time>["series"];
  private requestUpdate: (() => void) | null = null;
  private paneView = new LiquidationLevelsPaneView(this);

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.requestUpdate = null;
  }

  updateData(levels: LiqLevel[]): void {
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
