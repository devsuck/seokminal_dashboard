import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
} from "lightweight-charts";

const POS_RGB = "0, 217, 100"; // --color-pos #00D964
const NEG_RGB = "255, 59, 48"; // --color-neg #FF3B30
const BAR_WIDTH = 120;
const BAR_HEIGHT = 8;
const BAR_GAP = 4;
const OFFSET_X = 12;
const OFFSET_Y = 12;

export interface ImbalanceData {
  bookBidPct: number;
  volBuyPct: number;
}

class ImbalanceBarPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: ImbalanceBarPrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    if (!this.primitive.visible) return;
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      const { data } = this.primitive;
      if (!data) return;

      ctx.font = "9px ui-monospace, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      const drawBar = (y: number, pct: number, label: string) => {
        const posWidth = pct * BAR_WIDTH;
        ctx.fillStyle = `rgba(${NEG_RGB}, 0.6)`;
        ctx.fillRect(OFFSET_X, y, BAR_WIDTH, BAR_HEIGHT);
        ctx.fillStyle = `rgba(${POS_RGB}, 0.85)`;
        ctx.fillRect(OFFSET_X, y, posWidth, BAR_HEIGHT);
        ctx.fillStyle = "rgba(255,255,255,0.65)";
        ctx.fillText(`${label} 매수 ${Math.round(pct * 100)}%`, OFFSET_X + BAR_WIDTH + 6, y + BAR_HEIGHT / 2);
      };

      drawBar(OFFSET_Y, data.bookBidPct, "호가");
      drawBar(OFFSET_Y + BAR_HEIGHT + BAR_GAP, data.volBuyPct, "체결");
    });
  }
}

class ImbalanceBarPaneView implements IPrimitivePaneView {
  constructor(private primitive: ImbalanceBarPrimitive) {}
  zOrder(): "top" {
    return "top";
  }
  renderer(): IPrimitivePaneRenderer {
    return new ImbalanceBarPaneRenderer(this.primitive);
  }
}

export class ImbalanceBarPrimitive implements ISeriesPrimitive<Time> {
  data: ImbalanceData | null = null;
  visible = true;
  chart!: SeriesAttachedParameter<Time>["chart"];
  series!: SeriesAttachedParameter<Time>["series"];
  private requestUpdate: (() => void) | null = null;
  private paneView = new ImbalanceBarPaneView(this);

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.requestUpdate = null;
  }

  updateData(data: ImbalanceData | null): void {
    this.data = data;
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
