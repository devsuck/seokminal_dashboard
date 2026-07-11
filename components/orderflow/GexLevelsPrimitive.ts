import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
} from "lightweight-charts";
import type { GexLevel } from "@/lib/api";

const ACCENT = "255, 159, 10"; // --color-accent #FF9F0A
const TEXT_3 = "107, 107, 107"; // --color-text-3 #6B6B6B

class GexLevelsPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: GexLevelsPrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    if (!this.primitive.visible) return;
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const { levels, series } = this.primitive;
      if (levels.length === 0) return;

      const maxAbs = Math.max(1, ...levels.map((lv) => Math.abs(lv.net_gex)));
      const wallStrike = levels.reduce((best, lv) =>
        Math.abs(lv.net_gex) > Math.abs(best.net_gex) ? lv : best
      ).strike;

      for (const lv of levels) {
        const y = series.priceToCoordinate(lv.strike);
        if (y === null) continue;

        const intensity = Math.abs(lv.net_gex) / maxAbs;
        const isWall = lv.strike === wallStrike;

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(mediaSize.width, y);
        if (isWall) {
          ctx.strokeStyle = `rgba(${ACCENT}, 0.9)`;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
        } else {
          ctx.strokeStyle = `rgba(${TEXT_3}, ${0.1 + intensity * 0.3})`;
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }
}

class GexLevelsPaneView implements IPrimitivePaneView {
  constructor(private primitive: GexLevelsPrimitive) {}
  zOrder(): "bottom" {
    return "bottom";
  }
  renderer(): IPrimitivePaneRenderer {
    return new GexLevelsPaneRenderer(this.primitive);
  }
}

export class GexLevelsPrimitive implements ISeriesPrimitive<Time> {
  levels: GexLevel[] = [];
  visible = true;
  chart!: SeriesAttachedParameter<Time>["chart"];
  series!: SeriesAttachedParameter<Time>["series"];
  private requestUpdate: (() => void) | null = null;
  private paneView = new GexLevelsPaneView(this);

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.requestUpdate = null;
  }

  updateData(levels: GexLevel[]): void {
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
