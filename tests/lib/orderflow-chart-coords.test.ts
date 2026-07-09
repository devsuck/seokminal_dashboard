import { describe, it, expect } from "vitest";
import { heatmapCellRect, footprintColumnX } from "../../lib/orderflow-chart-coords";

describe("heatmapCellRect", () => {
  const timeToX = (ts: number) => (ts === -1 ? null : ts * 10); // 1초=10px
  const priceToY = (p: number) => (p === -1 ? null : 100 - p);  // 가격 낮을수록 y 큼

  it("이웃 버킷/가격으로 폭/높이를 계산한다", () => {
    const rect = heatmapCellRect({ ts: 2, price: 50 }, [0, 2, 4], [40, 50, 60], timeToX, priceToY);
    expect(rect).toEqual({ x: 20 - 20 / 2, y: 50 - 10 / 2, width: 20, height: 10 });
  });

  it("버킷이 sortedBuckets에 없으면 null", () => {
    expect(heatmapCellRect({ ts: 99, price: 50 }, [0, 2, 4], [40, 50, 60], timeToX, priceToY)).toBeNull();
  });

  it("가격이 sortedPrices에 없으면 null", () => {
    expect(heatmapCellRect({ ts: 2, price: 999 }, [0, 2, 4], [40, 50, 60], timeToX, priceToY)).toBeNull();
  });

  it("timeToX가 null을 반환하면 null (범위 밖)", () => {
    expect(heatmapCellRect({ ts: -1, price: 50 }, [-1, 2, 4], [40, 50, 60], timeToX, priceToY)).toBeNull();
  });

  it("버킷이 1개뿐이면(이웃 없음) null", () => {
    expect(heatmapCellRect({ ts: 2, price: 50 }, [2], [40, 50, 60], timeToX, priceToY)).toBeNull();
  });

  it("마지막 버킷/가격은 이전 이웃과의 거리로 계산한다", () => {
    const rect = heatmapCellRect({ ts: 4, price: 40 }, [0, 2, 4], [40, 50, 60], timeToX, priceToY);
    expect(rect).toEqual({ x: 40 - 20 / 2, y: 60 - 10 / 2, width: 20, height: 10 });
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
