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
 * heatmap 셀 1개(aggregateHeatmapByCandle로 캔들당 1개로 합쳐진 것)를 캔들차트 좌표계의
 * 사각형(x,y,width,height)으로 변환. 좌표 못 구하면 null.
 *
 * cell.ts는 이미 캔들 open time으로 floor되어 있어야 한다(aggregateHeatmapByCandle 참고) —
 * 원본 2초 단위 ts를 그대로 넘기면 lightweight-charts의 timeToCoordinate가 데이터에 없는
 * 시각이라 null을 반환해 아무것도 안 그려진다. 폭은 캔들 하나(barSpacing) 전체를 채운다.
 */
export function heatmapCellRect(
  cell: { ts: number; price: number },
  candleIntervalSec: number,
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

  const height = neighborDistance(sortedPrices, priceIdx, priceToY);
  if (height === null) return null;

  return { x: x0 - barSpacing / 2, y: y - height / 2, width: barSpacing, height };
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

/**
 * footprint 셀 1개(bucketTs, price)를 캔들차트 좌표계의 사각형으로 변환 — 매수/매도 색 배경용.
 * 좌표 못 구하면 null. 세로 높이는 heatmapCellRect와 동일하게 이웃 가격과의 거리로 계산.
 */
export function footprintCellRect(
  cell: { bucketTs: number; price: number },
  sortedPrices: number[],
  timeToX: (ts: number) => number | null,
  priceToY: (price: number) => number | null,
  barSpacing: number
): CellRect | null {
  const col = footprintColumnX(cell.bucketTs, timeToX, barSpacing);
  const priceIdx = sortedPrices.indexOf(cell.price);
  const y = priceToY(cell.price);
  if (col === null || priceIdx === -1 || y === null) return null;

  const height = neighborDistance(sortedPrices, priceIdx, priceToY);
  if (height === null) return null;

  return { x: col.left, y: y - height / 2, width: col.right - col.left, height };
}

// 우측 인셋 컬럼 스택 폭. OrderBookPrimitive의 기존 인셋 폭(90px)을 COB 컬럼 폭으로 유지한다.
export const SVP_COLUMN_WIDTH_PX = 50;
export const CVP_COLUMN_WIDTH_PX = 50;
export const COB_COLUMN_WIDTH_PX = 90;

/**
 * 우측 인셋 컬럼 스택(SVP/CVP/COB 등)의 좌우 x좌표를 계산한다. widths는 왼쪽→오른쪽 순서,
 * 마지막 컬럼의 오른쪽 끝이 차트 우측(플롯 영역 끝, native price axis 직전)에 붙는다.
 */
export function stackedInsetColumns(chartWidth: number, widths: number[]): { left: number; right: number }[] {
  const totalWidth = widths.reduce((s, w) => s + w, 0);
  let left = chartWidth - totalWidth;
  return widths.map((w) => {
    const col = { left, right: left + w };
    left += w;
    return col;
  });
}
