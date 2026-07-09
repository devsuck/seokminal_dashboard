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

/** heatmap 셀 1개를 캔들차트 좌표계의 사각형(x,y,width,height)으로 변환. 좌표 못 구하면 null. */
export function heatmapCellRect(
  cell: { ts: number; price: number },
  sortedBuckets: number[],
  sortedPrices: number[],
  timeToX: (ts: number) => number | null,
  priceToY: (price: number) => number | null
): CellRect | null {
  const bucketIdx = sortedBuckets.indexOf(cell.ts);
  const priceIdx = sortedPrices.indexOf(cell.price);
  if (bucketIdx === -1 || priceIdx === -1) return null;

  const x = timeToX(cell.ts);
  const y = priceToY(cell.price);
  if (x === null || y === null) return null;

  const width = neighborDistance(sortedBuckets, bucketIdx, timeToX);
  const height = neighborDistance(sortedPrices, priceIdx, priceToY);
  if (width === null || height === null) return null;

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
