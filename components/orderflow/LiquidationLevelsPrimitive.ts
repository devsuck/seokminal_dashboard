import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
} from "lightweight-charts";
import type { LiqHeatmapSample, LiqLevel } from "@/lib/orderflow-data";

const NEG = "255, 59, 48"; // --color-neg #FF3B30 — 롱 청산(하방)
const POS = "0, 217, 100"; // --color-pos #00D964 — 숏 청산(상방)

class LiquidationLevelsPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: LiquidationLevelsPrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    if (!this.primitive.visible) return;
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const { levels, heatmapSamples, series } = this.primitive;
      if (levels.length === 0 && heatmapSamples.length === 0) return;

      // 연속 그라디언트 배경 — 촘촘한 로그간격 샘플을 additive 블렌딩으로 겹쳐 매끈한 청산 클러스터 색감을 만든다.
      // 아래 5-tier 점선 레벨이 정확한 참조값이고, 이 배경은 그 사이를 시각적으로 이어줄 뿐.
      if (heatmapSamples.length > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const maxSampleWeight = Math.max(1e-9, ...heatmapSamples.map((s) => s.weight));
        const bandHalfHeight = 14;
        for (const s of heatmapSamples) {
          const y = series.priceToCoordinate(s.price);
          if (y === null) continue;
          const intensity = s.weight / maxSampleWeight;
          const color = s.side === "long" ? NEG : POS;
          const peakAlpha = 0.015 + intensity * 0.05;
          const gradient = ctx.createLinearGradient(0, y - bandHalfHeight, 0, y + bandHalfHeight);
          gradient.addColorStop(0, `rgba(${color}, 0)`);
          gradient.addColorStop(0.5, `rgba(${color}, ${peakAlpha})`);
          gradient.addColorStop(1, `rgba(${color}, 0)`);
          ctx.fillStyle = gradient;
          ctx.fillRect(0, y - bandHalfHeight, mediaSize.width, bandHalfHeight * 2);
        }
        ctx.restore();
      }

      if (levels.length === 0) return;
      const maxWeight = Math.max(1e-9, ...levels.map((lv) => lv.weight));

      for (const lv of levels) {
        const y = series.priceToCoordinate(lv.price);
        if (y === null) continue;

        const intensity = lv.weight / maxWeight;
        const color = lv.side === "long" ? NEG : POS;
        // 얇은 점선 대신 부드러운 글로우 밴드 — 딱딱한 박스가 아니라 중심에서 바깥으로 옅어지는 그라디언트
        const bandHalfHeight = 6 + intensity * 10;
        const peakAlpha = 0.05 + intensity * 0.22;

        const gradient = ctx.createLinearGradient(0, y - bandHalfHeight, 0, y + bandHalfHeight);
        gradient.addColorStop(0, `rgba(${color}, 0)`);
        gradient.addColorStop(0.5, `rgba(${color}, ${peakAlpha})`);
        gradient.addColorStop(1, `rgba(${color}, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, y - bandHalfHeight, mediaSize.width, bandHalfHeight * 2);

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(mediaSize.width, y);
        ctx.strokeStyle = `rgba(${color}, ${0.25 + intensity * 0.35})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = "9px ui-monospace, monospace";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillStyle = `rgba(${color}, ${0.5 + intensity * 0.4})`;
        ctx.fillText(`${lv.leverage}x 청산(추정)`, mediaSize.width - 4, y - bandHalfHeight - 5);
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
  heatmapSamples: LiqHeatmapSample[] = [];
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

  updateHeatmap(samples: LiqHeatmapSample[]): void {
    this.heatmapSamples = samples;
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
