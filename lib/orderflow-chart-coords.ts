export interface CellRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function neighborDistance(
  sorted: number[],
  idx: number,
  toCoord: (v: number) => number | null
): number | null {
  if (sorted.length < 2) return null;
  const neighborIdx = idx < sorted.length - 1 ? idx + 1 : idx - 1;
  const c0 = toCoord(sorted[idx]);
  const c1 = toCoord(sorted[neighborIdx]);
  if (c0 === null || c1 === null) return null;
  return Math.abs(c1 - c0);
}

/**
 * heatmap 셀 1개를 캔들차트 좌표계의 사각형(x,y,width,height)으로 변환. 좌표 못 구하면 null.
 *
 * heatmap ts는 캔들 간격(candleIntervalSec)보다 촘촘한 버킷(heatmapBucketSec)이라 대부분
 * 캔들 open time과 일치하지 않는다 — timeToX(cell.ts)를 직접 호출하면 lightweight-charts가
 * 데이터에 없는 시각이라 null을 반환해 사실상 아무것도 안 그려진다. 그래서 캔들 open time으로
 * floor한 시각만 timeToX에 넘기고, 그 안에서의 위치는 barSpacing 비율로 보간한다.
 */
export function heatmapCellRect(
  cell: { ts: number; price: number },
  candleIntervalSec: number,
  heatmapBucketSec: number,
  sortedPrices: number[],
  timeToX: (ts: number) => number | null,
  priceToY: (price: number) => number | null,
  barSpacing: number
): CellRect | null {
  const barTime = Math.floor(cell.ts / candleIntervalSec) * candleIntervalSec;
  const x0 = timeToX(barTime);
  const priceIdx = sortedPrices.indexOf(cell.price);
  const y = priceToY(cell.price);
  if (x0 === null || priceIdx === -1 || y === null) return null;

  const x = x0 + ((cell.ts - barTime) / candleIntervalSec) * barSpacing;
  const width = (heatmapBucketSec / candleIntervalSec) * barSpacing;
  const height = neighborDistance(sortedPrices, priceIdx, priceToY);
  if (height === null) return null;

  return { x: x - width / 2, y: y - height / 2, width, height };
}

/** footprint 버킷(=캔들 1개) 하나의 x범위. barSpacing은 chart.timeScale().options().barSpacing. */
export function footprintColumnX(
  bucketTs: number,
  timeToX: (ts: number) => number | null,
  barSpacing: number
): { left: number; right: number; center: number } | null {
  const center = timeToX(bucketTs);
  if (center === null) return null;
  return { left: center - barSpacing / 2, right: center + barSpacing / 2, center };
}
