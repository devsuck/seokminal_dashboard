import { describe, it, expect } from "vitest";
import { heatmapCellRect, footprintColumnX } from "../../lib/orderflow-chart-coords";

describe("heatmapCellRect", () => {
  // candleIntervalSec=60, heatmapBucketSec=2, barSpacing=20px → 캔들 하나 폭 20px
  const timeToX = (ts: number) => (ts < 0 ? null : (ts / 60) * 20); // barTime(캔들 open time)만 넘어옴
  const priceToY = (p: number) => (p === -1 ? null : 100 - p); // 가격 낮을수록 y 큼

  it("캔들 open time에서 barSpacing 비율로 보간한다", () => {
    // ts=62 → barTime=60, offset=2/60, x0=timeToX(60)=20, x=20+(2/60)*20
    const rect = heatmapCellRect({ ts: 62, price: 50 }, 60, 2, [40, 50, 60], timeToX, priceToY, 20);
    const x0 = 20;
    const x = x0 + (2 / 60) * 20;
    const width = (2 / 60) * 20;
    expect(rect).toEqual({ x: x - width / 2, y: 50 - 10 / 2, width, height: 10 });
  });

  it("ts가 캔들 구간 첫 버킷이면 offset 0 (barTime과 동일한 x)", () => {
    const rect = heatmapCellRect({ ts: 60, price: 50 }, 60, 2, [40, 50, 60], timeToX, priceToY, 20);
    const width = (2 / 60) * 20;
    expect(rect).toEqual({ x: 20 - width / 2, y: 50 - 10 / 2, width, height: 10 });
  });

  it("가격이 sortedPrices에 없으면 null", () => {
    expect(heatmapCellRect({ ts: 62, price: 999 }, 60, 2, [40, 50, 60], timeToX, priceToY, 20)).toBeNull();
  });

  it("timeToX(barTime)가 null을 반환하면 null (범위 밖)", () => {
    expect(heatmapCellRect({ ts: -1, price: 50 }, 60, 2, [40, 50, 60], timeToX, priceToY, 20)).toBeNull();
  });

  it("가격이 1개뿐이면(이웃 없음) null", () => {
    expect(heatmapCellRect({ ts: 62, price: 50 }, 60, 2, [50], timeToX, priceToY, 20)).toBeNull();
  });

  it("마지막 가격은 이전 이웃과의 거리로 계산한다", () => {
    const rect = heatmapCellRect({ ts: 62, price: 40 }, 60, 2, [40, 50, 60], timeToX, priceToY, 20);
    const x0 = 20;
    const x = x0 + (2 / 60) * 20;
    const width = (2 / 60) * 20;
    expect(rect).toEqual({ x: x - width / 2, y: 60 - 10 / 2, width, height: 10 });
  });
});

describe("footprintColumnX", () => {
  const timeToX = (ts: number) => (ts === -1 ? null : ts * 10);

  it("center ± barSpacing/2로 left/right 계산", () => {
    expect(footprintColumnX(5, timeToX, 8)).toEqual({ left: 46, right: 54, center: 50 });
  });

  it("timeToX가 null이면 null", () => {
    expect(footprintColumnX(-1, timeToX, 8)).toBeNull();
  });
});
