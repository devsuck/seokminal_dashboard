import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { footprintColumnX } from "@/lib/orderflow-chart-coords";
import type { VolumeBucket } from "@/lib/orderflow-data";

const POS_RGB = "0, 217, 100"; // --color-pos #00D964
const NEG_RGB = "255, 59, 48"; // --color-neg #FF3B30

// 캔들을 가리지 않도록 배경 바는 차트 하단 이 비율만큼만 차지(TradeNet 류 참고 툴의 관례적 비중).
const VOLUME_BG_HEIGHT_FRAC = 0.22;

class VolumeBackgroundPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: VolumeBackgroundPrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    if (!this.primitive.visible) return;
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const { buckets, chart } = this.primitive;
      if (buckets.length === 0) return;

      const barSpacing = chart.timeScale().options().barSpacing;
      const timeToX = (ts: number) => chart.timeScale().timeToCoordinate(ts as UTCTimestamp);
      const maxVol = Math.max(1, ...buckets.map((b) => b.buyVol + b.sellVol));
      const maxBarHeight = mediaSize.height * VOLUME_BG_HEIGHT_FRAC;
      const barWidth = Math.max(1, barSpacing * 0.8);

      for (const bucket of buckets) {
        const col = footprintColumnX(bucket.bucketTs, timeToX, barSpacing);
        if (!col) continue;
        const total = bucket.buyVol + bucket.sellVol;
        if (total <= 0) continue;

        const height = (total / maxVol) * maxBarHeight;
        const rgb = bucket.buyVol >= bucket.sellVol ? POS_RGB : NEG_RGB;
        ctx.fillStyle = `rgba(${rgb}, 0.18)`;
        ctx.fillRect(col.center - barWidth / 2, mediaSize.height - height, barWidth, height);
      }
    });
  }
}

class VolumeBackgroundPaneView implements IPrimitivePaneView {
  constructor(private primitive: VolumeBackgroundPrimitive) {}
  zOrder(): "bottom" {
    return "bottom";
  }
  renderer(): IPrimitivePaneRenderer {
    return new VolumeBackgroundPaneRenderer(this.primitive);
  }
}

/** 차트 전체폭 배경 Volume 바 — OI 아님(가격대별 OI 분포 데이터가 없어 정직성 원칙상 체결량만 표시,
 * lib/orderflow-data.ts의 computeVolumeByBucket 주석 참고). 캔들 뒤(zOrder bottom)에 깔린다. */
export class VolumeBackgroundPrimitive implements ISeriesPrimitive<Time> {
  buckets: VolumeBucket[] = [];
  visible = true;
  chart!: SeriesAttachedParameter<Time>["chart"];
  series!: SeriesAttachedParameter<Time>["series"];
  private requestUpdate: (() => void) | null = null;
  private paneView = new VolumeBackgroundPaneView(this);

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.requestUpdate = null;
  }

  updateData(buckets: VolumeBucket[]): void {
    this.buckets = buckets;
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
