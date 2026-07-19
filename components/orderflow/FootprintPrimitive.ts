import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { footprintCellRect, footprintColumnX } from "@/lib/orderflow-chart-coords";
import {
  computeFootprintLayout,
  computeColumnPoc,
  detectImbalanceCells,
  detectStackedImbalances,
  type FootprintCell,
  type FootprintImbalanceCell,
  type StackedImbalance,
} from "@/lib/orderflow-data";

// 이 값 아래 barSpacing에서는 매수/매도 숫자가 겹쳐서 안 보이므로 색 배경만 그림.
const MIN_BAR_SPACING_FOR_TEXT = 40;
const ACCENT = "255, 176, 32"; // --color-accent — 캔들 POC 강조
const WARN = "255, 159, 10"; // --color-warn — 스택 임밸런스 테두리

class FootprintPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private primitive: FootprintPrimitive) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    if (!this.primitive.visible) return;
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      const { cells, chart, series, imbalances, stackedImbalances, columnPoc } = this.primitive;
      if (cells.length === 0) return;

      const barSpacing = chart.timeScale().options().barSpacing;
      const timeToX = (ts: number) => chart.timeScale().timeToCoordinate(ts as UTCTimestamp);
      const priceToY = (price: number) => series.priceToCoordinate(price);

      // 매수/매도 색 배경 — 항상 그림(저줌에서도 보여야 함, 숫자는 확대시에만).
      const layout = computeFootprintLayout(cells);
      const maxVol = Math.max(1, ...cells.map((c) => Math.max(c.buyVol, c.sellVol)));
      const imbalanceKey = (bucketTs: number, price: number) => `${bucketTs}:${price}`;
      const imbalanceBySpot = new Map(imbalances.map((im) => [imbalanceKey(im.bucketTs, im.price), im]));

      for (const cell of cells) {
        const rect = footprintCellRect(cell, layout.prices, timeToX, priceToY, barSpacing);
        if (!rect) continue;
        const halfWidth = rect.width / 2;
        const sellIntensity = Math.min(1, cell.sellVol / maxVol);
        const buyIntensity = Math.min(1, cell.buyVol / maxVol);
        ctx.fillStyle = `rgba(239, 68, 68, ${0.08 + sellIntensity * 0.35})`;
        ctx.fillRect(rect.x, rect.y, halfWidth, rect.height);
        ctx.fillStyle = `rgba(34, 197, 94, ${0.08 + buyIntensity * 0.35})`;
        ctx.fillRect(rect.x + halfWidth, rect.y, halfWidth, rect.height);

        // 임밸런스 셀(한쪽이 300%+ 우세) — 강한 테두리로 확대 안 해도 눈에 띄게.
        const im = imbalanceBySpot.get(imbalanceKey(cell.bucketTs, cell.price));
        if (im) {
          ctx.strokeStyle = im.side === "buy" ? "rgba(0, 217, 100, 0.9)" : "rgba(255, 59, 48, 0.9)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(rect.x + 0.75, rect.y + 0.75, rect.width - 1.5, rect.height - 1.5);
        }

        // 캔들 POC(그 캔들에서 제일 많이 체결된 가격) — 노란 굵은 테두리.
        if (columnPoc.get(cell.bucketTs) === cell.price) {
          ctx.strokeStyle = `rgba(${ACCENT}, 0.9)`;
          ctx.lineWidth = 2;
          ctx.strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
        }
      }

      // 스택 임밸런스(연속 3단+ 같은 방향) — 구간을 감싸는 박스로 강조, 공격적 일방향 흐름 신호.
      for (const stack of stackedImbalances) {
        const col = footprintColumnX(stack.bucketTs, timeToX, barSpacing);
        const yTop = priceToY(stack.priceHigh);
        const yBot = priceToY(stack.priceLow);
        if (!col || yTop === null || yBot === null) continue;
        const rowHeight = layout.prices.length > 1 ? Math.abs(priceToY(layout.prices[0])! - priceToY(layout.prices[1])!) : 12;
        ctx.strokeStyle = `rgba(${WARN}, 0.95)`;
        ctx.lineWidth = 2;
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(col.left + 1, yTop - rowHeight / 2 + 1, col.right - col.left - 2, yBot - yTop + rowHeight - 2);
        ctx.setLineDash([]);
      }

      if (barSpacing < MIN_BAR_SPACING_FOR_TEXT) return;

      ctx.font = "10px monospace";
      ctx.textBaseline = "middle";

      for (const cell of cells) {
        const col = footprintColumnX(cell.bucketTs, timeToX, barSpacing);
        const y = priceToY(cell.price);
        if (!col || y === null) continue;
        const isPoc = columnPoc.get(cell.bucketTs) === cell.price;
        ctx.font = isPoc ? "bold 10px monospace" : "10px monospace";

        ctx.fillStyle = "#EF4444";
        ctx.textAlign = "right";
        ctx.fillText(cell.sellVol.toFixed(1), col.center - 2, y);

        ctx.fillStyle = "#22C55E";
        ctx.textAlign = "left";
        ctx.fillText(cell.buyVol.toFixed(1), col.center + 2, y);

        const delta = cell.buyVol - cell.sellVol;
        ctx.fillStyle = delta >= 0 ? "#00D964" : "#FF3B30";
        ctx.textAlign = "center";
        ctx.fillText((delta >= 0 ? "+" : "") + delta.toFixed(1), col.center, y + 11);
      }
    });
  }
}

class FootprintPaneView implements IPrimitivePaneView {
  constructor(private primitive: FootprintPrimitive) {}
  zOrder(): "top" {
    return "top";
  }
  renderer(): IPrimitivePaneRenderer {
    return new FootprintPaneRenderer(this.primitive);
  }
}

export class FootprintPrimitive implements ISeriesPrimitive<Time> {
  cells: FootprintCell[] = [];
  imbalances: FootprintImbalanceCell[] = [];
  stackedImbalances: StackedImbalance[] = [];
  columnPoc: Map<number, number> = new Map();
  visible = true;
  chart!: SeriesAttachedParameter<Time>["chart"];
  series!: SeriesAttachedParameter<Time>["series"];
  private requestUpdate: (() => void) | null = null;
  private paneView = new FootprintPaneView(this);

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.requestUpdate = null;
  }

  updateData(cells: FootprintCell[]): void {
    this.cells = cells;
    this.imbalances = detectImbalanceCells(cells);
    this.stackedImbalances = detectStackedImbalances(cells);
    this.columnPoc = computeColumnPoc(cells);
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
