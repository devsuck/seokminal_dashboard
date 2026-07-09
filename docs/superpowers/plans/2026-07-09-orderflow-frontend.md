# 오더플로우(풋프린트) + 유동성 히트맵 프론트엔드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/orderflow` 신규 페이지에서 백엔드 `/ws/orderflow/{symbol}` 스트림을 소비해 캔버스 풋프린트 차트 + 유동성 히트맵을 렌더링한다.

**Architecture:** REST(`GET /orderflow/symbols`)로 현재 수집 중인 심볼을 부가 표시하고, WS(`/ws/orderflow/{symbol}`)로 snapshot 1회 + 델타 스트림을 받는다. 델타 병합은 순수 함수로 분리(`lib/orderflow-data.ts`)해 단위 테스트하고, WS 라이프사이클은 신규 `hooks/useOrderflowSocket.ts`(이 저장소 최초의 `hooks/` 디렉터리 — 기존엔 훅이 전부 컴포넌트에 인라인이었음)가 그 순수 함수들을 이용해 상태를 갱신한다. 캔버스 렌더링은 dirty-rect 갱신(레이아웃 불변 시 변경된 셀만 다시 그림)으로 구현한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest(jsdom) — 기존 스택 그대로. 신규 의존성 추가 없음.

## Global Constraints

- 디자인 토큰만 사용: `bg-bg/panel/panel-2`, `border-border`, `text-text-1/2/3`, `text-accent/pos/neg/warn/info` (프로젝트 CLAUDE.md 프론트엔드 규칙, 전역 `app/globals.css`의 `@theme`에 정의됨). 예외: Canvas 2D `ctx.fillStyle`/`ctx.strokeStyle`는 Tailwind 클래스를 소비할 수 없으므로 `@theme`에 정의된 토큰 값과 동일한 리터럴 hex를 그대로 쓴다 — `panel-2`=`#0A0A0A`, `border`=`#2A2A2A`, `text-1`=`#F2F2F2`, `text-2`=`#A8A8A8`, `pos`=`#00D964`(rgba로 강도 표현), `neg`=`#FF3B30`(rgba), `accent`=`#FF9F0A`(rgba). 캔버스 밖 JSX 요소는 전부 클래스명으로.
- `style={{}}` 인라인 금지. 예외는 `style={{ height: "Npx" }}` 류 차트 컨테이너뿐 — 캔버스 자체 크기는 `<canvas width/height>` 속성으로 지정하므로 이 예외에 해당하지 않음
- Raw `fetch` 금지 — REST는 반드시 `lib/api.ts` 함수로. WS는 예외: 이 저장소의 기존 WS 패턴(`components/market/ChartTab.tsx`) 자체가 컴포넌트/훅 내부에서 직접 `new WebSocket()`을 쓰고, `lib/api.ts`에는 REST 함수만 존재함 — 그 관례를 그대로 따른다
- AbortController 패턴(REST 폴링에 한함): abort→create→assign ref→fetch→catch AbortError→unmount cleanup
- 기존 `/crypto`, `/ib` 페이지는 건드리지 않는다 — 이 기능이 죽어도 기존 차트 페이지 영향 없음
- 파일럿 스코프: 심볼은 `BTC.HL`, `NQ` 두 개, 한 번에 심볼 1개 뷰만
- WS 재연결 백오프 상수는 백엔드 `orderflow/manager.py`의 `RECONNECT_BASE_DELAY=2.0`/`RECONNECT_MAX_DELAY=60.0`(초)과 동일한 값으로 맞춘다(ms 단위로 2000/60000)
- 캔버스 렌더 자체·WS 라이프사이클 자체는 자동 테스트 스코프 아님(스펙의 테스트 계획에 명시) — 브라우저로 직접 확인. 델타 병합 로직만 순수 함수로 분리해 단위 테스트
- `npx tsc --noEmit`, `npm test` 통과 필수
- 백엔드 WS 메시지 계약(구현 완료 기준, 변경 없음):
  - 연결 시 1회: `{"type":"snapshot","symbol":str,"footprint":[{"bucket_ts":float,"price":float,"buy_vol":float,"sell_vol":float}],"heatmap":[{"ts":float,"price":float,"size":float}]}`
  - 델타: `{"type":"footprint_delta","bucket_ts":float,"price":float,"side":"buy"|"sell","delta_vol":float}` / `{"type":"heatmap_delta","ts":float,"price":float,"size":float}`
  - 상태: `{"type":"status","state":"reconnecting"|"live"}`

---

### Task 1: REST — `GET /orderflow/symbols` 클라이언트 함수

**Files:**
- Modify: `lib/api.ts` (기존 `getQuote` 함수 바로 다음, 168행 뒤에 삽입)
- Test: `tests/lib/api-orderflow.test.ts`

**Interfaces:**
- Consumes: 없음 (백엔드 `GET /orderflow/symbols` → `{"symbols": string[]}`, 이미 구현됨)
- Produces: `getOrderflowSymbols(signal?: AbortSignal): Promise<OrderflowSymbolsResponse>`, `interface OrderflowSymbolsResponse { symbols: string[] }` — Task 6(`app/orderflow/page.tsx`)이 그대로 임포트해 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/lib/api-orderflow.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { getOrderflowSymbols, ApiError } from "../../lib/api";

describe("getOrderflowSymbols", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the symbols list on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ symbols: ["BTC.HL", "NQ"] }),
    } as Response);
    const result = await getOrderflowSymbols();
    expect(result).toEqual({ symbols: ["BTC.HL", "NQ"] });
  });

  it("throws ApiError on non-ok response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({ detail: "boom" }),
    } as Response);
    await expect(getOrderflowSymbols()).rejects.toBeInstanceOf(ApiError);
  });

  it("passes the abort signal to fetch", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ symbols: [] }),
    } as Response);
    const ctrl = new AbortController();
    await getOrderflowSymbols(ctrl.signal);
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ signal: ctrl.signal });
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx vitest run tests/lib/api-orderflow.test.ts`
Expected: FAIL — `getOrderflowSymbols is not a function` / import error

- [ ] **Step 3: 최소 구현**

`lib/api.ts`의 기존 `getQuote` 함수(164-168행) 바로 다음에 삽입:

```ts
export interface OrderflowSymbolsResponse {
  symbols: string[];
}

/** 오더플로우 백엔드가 현재 수집 중인 심볼 목록. */
export async function getOrderflowSymbols(signal?: AbortSignal): Promise<OrderflowSymbolsResponse> {
  const response = await fetch(`${API_URL}/orderflow/symbols`, { signal });
  return handleResponse<OrderflowSymbolsResponse>(response);
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx vitest run tests/lib/api-orderflow.test.ts`
Expected: PASS (3 passed)

- [ ] **Step 5: 커밋**

```bash
git add lib/api.ts tests/lib/api-orderflow.test.ts
git commit -m "feat(orderflow): add getOrderflowSymbols REST client function"
```

---

### Task 2: 순수 델타 병합/레이아웃 함수

**Files:**
- Create: `lib/orderflow-data.ts`
- Test: `tests/lib/orderflow-data.test.ts`

**Interfaces:**
- Consumes: 없음 (백엔드 WS 메시지 셰이프만 타입으로 정의 — Global Constraints의 계약 참조)
- Produces:
  - 타입: `FootprintCell { bucketTs, price, buyVol, sellVol }`, `HeatmapCell { ts, price, size }`, `OrderflowState { footprint: Map<string, FootprintCell>, heatmap: Map<string, HeatmapCell> }`, `OrderflowSnapshot`, `FootprintDeltaMsg`, `HeatmapDeltaMsg`, `StatusMsg`, `OrderflowDeltaMsg = FootprintDeltaMsg | HeatmapDeltaMsg | StatusMsg`
  - 함수: `emptyOrderflowState(): OrderflowState`, `applySnapshot(snapshot: OrderflowSnapshot): OrderflowState`, `applyFootprintDelta(state, msg: FootprintDeltaMsg): OrderflowState`, `applyHeatmapDelta(state, msg: HeatmapDeltaMsg): OrderflowState`, `applyOrderflowMessage(state, msg: OrderflowDeltaMsg): OrderflowState`, `diffFootprintCells(prev: FootprintCell[], next: FootprintCell[]): FootprintCell[]`, `diffHeatmapCells(prev: HeatmapCell[], next: HeatmapCell[]): HeatmapCell[]`, `computeFootprintLayout(cells: FootprintCell[]): { buckets: number[]; prices: number[] }`, `computeHeatmapLayout(cells: HeatmapCell[]): { buckets: number[]; prices: number[] }`
  - Task 3(`hooks/useOrderflowSocket.ts`)이 `applySnapshot`/`applyOrderflowMessage`/`emptyOrderflowState`/타입들을 쓴다. Task 4/5(캔버스 컴포넌트)가 `diff*Cells`/`compute*Layout`을 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/lib/orderflow-data.test.ts
import { describe, it, expect } from "vitest";
import {
  applySnapshot,
  applyFootprintDelta,
  applyHeatmapDelta,
  applyOrderflowMessage,
  emptyOrderflowState,
  diffFootprintCells,
  diffHeatmapCells,
  computeFootprintLayout,
  computeHeatmapLayout,
} from "../../lib/orderflow-data";

describe("applySnapshot", () => {
  it("converts snapshot arrays into keyed maps with camelCase fields", () => {
    const state = applySnapshot({
      footprint: [{ bucket_ts: 0, price: 100, buy_vol: 1, sell_vol: 0.5 }],
      heatmap: [{ ts: 0, price: 99, size: 5 }],
    });
    expect(state.footprint.get("0:100")).toEqual({ bucketTs: 0, price: 100, buyVol: 1, sellVol: 0.5 });
    expect(state.heatmap.get("0:99")).toEqual({ ts: 0, price: 99, size: 5 });
  });
});

describe("applyFootprintDelta", () => {
  it("creates a new cell on first delta for a price/bucket", () => {
    const next = applyFootprintDelta(emptyOrderflowState(), {
      type: "footprint_delta", bucket_ts: 0, price: 100, side: "buy", delta_vol: 2,
    });
    expect(next.footprint.get("0:100")).toEqual({ bucketTs: 0, price: 100, buyVol: 2, sellVol: 0 });
  });

  it("accumulates buy_vol and sell_vol independently across repeated deltas", () => {
    let state = emptyOrderflowState();
    state = applyFootprintDelta(state, { type: "footprint_delta", bucket_ts: 0, price: 100, side: "buy", delta_vol: 2 });
    state = applyFootprintDelta(state, { type: "footprint_delta", bucket_ts: 0, price: 100, side: "sell", delta_vol: 1 });
    state = applyFootprintDelta(state, { type: "footprint_delta", bucket_ts: 0, price: 100, side: "buy", delta_vol: 3 });
    expect(state.footprint.get("0:100")).toEqual({ bucketTs: 0, price: 100, buyVol: 5, sellVol: 1 });
  });

  it("does not mutate the previous state (returns a new map)", () => {
    const state = emptyOrderflowState();
    const next = applyFootprintDelta(state, { type: "footprint_delta", bucket_ts: 0, price: 100, side: "buy", delta_vol: 2 });
    expect(state.footprint.size).toBe(0);
    expect(next.footprint.size).toBe(1);
  });
});

describe("applyHeatmapDelta", () => {
  it("replaces size for an existing ts/price key rather than accumulating", () => {
    let state = emptyOrderflowState();
    state = applyHeatmapDelta(state, { type: "heatmap_delta", ts: 0, price: 99, size: 5 });
    state = applyHeatmapDelta(state, { type: "heatmap_delta", ts: 0, price: 99, size: 8 });
    expect(state.heatmap.get("0:99")).toEqual({ ts: 0, price: 99, size: 8 });
  });
});

describe("applyOrderflowMessage", () => {
  it("routes footprint_delta and heatmap_delta, ignores status (returns same reference)", () => {
    let state = emptyOrderflowState();
    state = applyOrderflowMessage(state, { type: "footprint_delta", bucket_ts: 0, price: 100, side: "buy", delta_vol: 1 });
    state = applyOrderflowMessage(state, { type: "heatmap_delta", ts: 0, price: 99, size: 5 });
    const beforeStatus = state;
    state = applyOrderflowMessage(state, { type: "status", state: "reconnecting" });
    expect(state).toBe(beforeStatus);
    expect(state.footprint.size).toBe(1);
    expect(state.heatmap.size).toBe(1);
  });
});

describe("diffFootprintCells", () => {
  it("returns only cells whose buyVol/sellVol changed vs prev", () => {
    const prev = [{ bucketTs: 0, price: 100, buyVol: 1, sellVol: 0 }, { bucketTs: 0, price: 101, buyVol: 2, sellVol: 0 }];
    const next = [{ bucketTs: 0, price: 100, buyVol: 1, sellVol: 0 }, { bucketTs: 0, price: 101, buyVol: 3, sellVol: 0 }];
    expect(diffFootprintCells(prev, next)).toEqual([{ bucketTs: 0, price: 101, buyVol: 3, sellVol: 0 }]);
  });

  it("treats a brand new cell (not in prev) as changed", () => {
    const prev: ReturnType<typeof emptyOrderflowState>["footprint"] extends Map<string, infer C> ? C[] : never = [];
    const next = [{ bucketTs: 0, price: 100, buyVol: 1, sellVol: 0 }];
    expect(diffFootprintCells(prev, next)).toEqual(next);
  });
});

describe("diffHeatmapCells", () => {
  it("returns only cells whose size changed vs prev", () => {
    const prev = [{ ts: 0, price: 99, size: 5 }];
    const next = [{ ts: 0, price: 99, size: 8 }];
    expect(diffHeatmapCells(prev, next)).toEqual(next);
  });
});

describe("computeFootprintLayout", () => {
  it("returns distinct sorted buckets (ascending) and prices (descending)", () => {
    const cells = [
      { bucketTs: 60, price: 99, buyVol: 1, sellVol: 0 },
      { bucketTs: 0, price: 101, buyVol: 1, sellVol: 0 },
      { bucketTs: 60, price: 101, buyVol: 1, sellVol: 0 },
    ];
    expect(computeFootprintLayout(cells)).toEqual({ buckets: [0, 60], prices: [101, 99] });
  });
});

describe("computeHeatmapLayout", () => {
  it("returns distinct sorted buckets (ascending) and prices (descending)", () => {
    const cells = [
      { ts: 2, price: 99, size: 5 },
      { ts: 0, price: 101, size: 5 },
    ];
    expect(computeHeatmapLayout(cells)).toEqual({ buckets: [0, 2], prices: [101, 99] });
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npx vitest run tests/lib/orderflow-data.test.ts`
Expected: FAIL — `Cannot find module '../../lib/orderflow-data'`

- [ ] **Step 3: 최소 구현**

```ts
// lib/orderflow-data.ts
export interface FootprintCell {
  bucketTs: number;
  price: number;
  buyVol: number;
  sellVol: number;
}

export interface HeatmapCell {
  ts: number;
  price: number;
  size: number;
}

export interface OrderflowSnapshot {
  footprint: { bucket_ts: number; price: number; buy_vol: number; sell_vol: number }[];
  heatmap: { ts: number; price: number; size: number }[];
}

export interface FootprintDeltaMsg {
  type: "footprint_delta";
  bucket_ts: number;
  price: number;
  side: "buy" | "sell";
  delta_vol: number;
}

export interface HeatmapDeltaMsg {
  type: "heatmap_delta";
  ts: number;
  price: number;
  size: number;
}

export interface StatusMsg {
  type: "status";
  state: "reconnecting" | "live";
}

export type OrderflowDeltaMsg = FootprintDeltaMsg | HeatmapDeltaMsg | StatusMsg;

export interface OrderflowState {
  footprint: Map<string, FootprintCell>;
  heatmap: Map<string, HeatmapCell>;
}

function footprintKey(bucketTs: number, price: number): string {
  return `${bucketTs}:${price}`;
}

function heatmapKey(ts: number, price: number): string {
  return `${ts}:${price}`;
}

export function emptyOrderflowState(): OrderflowState {
  return { footprint: new Map(), heatmap: new Map() };
}

export function applySnapshot(snapshot: OrderflowSnapshot): OrderflowState {
  const footprint = new Map<string, FootprintCell>();
  for (const c of snapshot.footprint) {
    footprint.set(footprintKey(c.bucket_ts, c.price), {
      bucketTs: c.bucket_ts,
      price: c.price,
      buyVol: c.buy_vol,
      sellVol: c.sell_vol,
    });
  }
  const heatmap = new Map<string, HeatmapCell>();
  for (const c of snapshot.heatmap) {
    heatmap.set(heatmapKey(c.ts, c.price), { ts: c.ts, price: c.price, size: c.size });
  }
  return { footprint, heatmap };
}

export function applyFootprintDelta(state: OrderflowState, msg: FootprintDeltaMsg): OrderflowState {
  const key = footprintKey(msg.bucket_ts, msg.price);
  const existing = state.footprint.get(key);
  const next: FootprintCell = existing
    ? {
        ...existing,
        buyVol: existing.buyVol + (msg.side === "buy" ? msg.delta_vol : 0),
        sellVol: existing.sellVol + (msg.side === "sell" ? msg.delta_vol : 0),
      }
    : {
        bucketTs: msg.bucket_ts,
        price: msg.price,
        buyVol: msg.side === "buy" ? msg.delta_vol : 0,
        sellVol: msg.side === "sell" ? msg.delta_vol : 0,
      };
  const footprint = new Map(state.footprint);
  footprint.set(key, next);
  return { ...state, footprint };
}

export function applyHeatmapDelta(state: OrderflowState, msg: HeatmapDeltaMsg): OrderflowState {
  const key = heatmapKey(msg.ts, msg.price);
  const heatmap = new Map(state.heatmap);
  heatmap.set(key, { ts: msg.ts, price: msg.price, size: msg.size });
  return { ...state, heatmap };
}

export function applyOrderflowMessage(state: OrderflowState, msg: OrderflowDeltaMsg): OrderflowState {
  if (msg.type === "footprint_delta") return applyFootprintDelta(state, msg);
  if (msg.type === "heatmap_delta") return applyHeatmapDelta(state, msg);
  return state;
}

export function diffFootprintCells(prev: FootprintCell[], next: FootprintCell[]): FootprintCell[] {
  const prevByKey = new Map(prev.map((c) => [footprintKey(c.bucketTs, c.price), c]));
  return next.filter((c) => {
    const p = prevByKey.get(footprintKey(c.bucketTs, c.price));
    return !p || p.buyVol !== c.buyVol || p.sellVol !== c.sellVol;
  });
}

export function diffHeatmapCells(prev: HeatmapCell[], next: HeatmapCell[]): HeatmapCell[] {
  const prevByKey = new Map(prev.map((c) => [heatmapKey(c.ts, c.price), c]));
  return next.filter((c) => {
    const p = prevByKey.get(heatmapKey(c.ts, c.price));
    return !p || p.size !== c.size;
  });
}

export function computeFootprintLayout(cells: FootprintCell[]): { buckets: number[]; prices: number[] } {
  const buckets = Array.from(new Set(cells.map((c) => c.bucketTs))).sort((a, b) => a - b);
  const prices = Array.from(new Set(cells.map((c) => c.price))).sort((a, b) => b - a);
  return { buckets, prices };
}

export function computeHeatmapLayout(cells: HeatmapCell[]): { buckets: number[]; prices: number[] } {
  const buckets = Array.from(new Set(cells.map((c) => c.ts))).sort((a, b) => a - b);
  const prices = Array.from(new Set(cells.map((c) => c.price))).sort((a, b) => b - a);
  return { buckets, prices };
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npx vitest run tests/lib/orderflow-data.test.ts`
Expected: PASS (9 passed)

- [ ] **Step 5: 커밋**

```bash
git add lib/orderflow-data.ts tests/lib/orderflow-data.test.ts
git commit -m "feat(orderflow): add pure delta-merge and layout functions"
```

---

### Task 3: `useOrderflowSocket` 훅 (WS 라이프사이클 + 재연결 백오프)

**Files:**
- Create: `hooks/useOrderflowSocket.ts` (이 저장소 최초의 `hooks/` 디렉터리 — 기존엔 훅이 전부 컴포넌트 내부에 인라인이었다. 재사용성 때문에 여기서 새로 분리한다.)

**Interfaces:**
- Consumes: `lib/api.ts`의 `WS_URL`(이미 export됨, 1289행), `lib/orderflow-data.ts`(Task 2)의 `applySnapshot`/`applyOrderflowMessage`/`emptyOrderflowState`와 타입들
- Produces: `useOrderflowSocket(symbol: string): { footprint: FootprintCell[]; heatmap: HeatmapCell[]; connectionState: "connecting" | "live" | "reconnecting" | "error" }`. Task 6(`app/orderflow/page.tsx`)이 그대로 호출한다.

캔버스/WS 라이프사이클은 스펙의 테스트 계획에서 "브라우저로 직접 확인"으로 명시적으로 스코프 아웃되어 있다(순수 병합 로직만 단위 테스트 대상). 이 훅도 마찬가지 — 자동 테스트 없이 타입체크 + Task 6의 수동 브라우저 확인으로 검증한다. 이 저장소엔 `WebSocket` 모킹 테스트 선례가 없다(신규 패턴을 만드는 대신 스펙이 정한 스코프를 따른다).

- [ ] **Step 1: 구현**

```ts
// hooks/useOrderflowSocket.ts
"use client";

import { useEffect, useState } from "react";
import { WS_URL } from "@/lib/api";
import {
  applyOrderflowMessage,
  applySnapshot,
  emptyOrderflowState,
  type FootprintCell,
  type HeatmapCell,
  type OrderflowDeltaMsg,
  type OrderflowSnapshot,
  type OrderflowState,
} from "@/lib/orderflow-data";

const RECONNECT_BASE_DELAY_MS = 2000;
const RECONNECT_MAX_DELAY_MS = 60000;

export type OrderflowConnectionState = "connecting" | "live" | "reconnecting" | "error";

interface UseOrderflowSocketResult {
  footprint: FootprintCell[];
  heatmap: HeatmapCell[];
  connectionState: OrderflowConnectionState;
}

function isSnapshotMsg(msg: unknown): msg is { type: "snapshot" } & OrderflowSnapshot {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "snapshot";
}

export function useOrderflowSocket(symbol: string): UseOrderflowSocketResult {
  const [state, setState] = useState<OrderflowState>(emptyOrderflowState);
  const [connectionState, setConnectionState] = useState<OrderflowConnectionState>("connecting");

  useEffect(() => {
    let closedByEffect = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let delay = RECONNECT_BASE_DELAY_MS;

    setState(emptyOrderflowState());
    setConnectionState("connecting");

    function connect() {
      ws = new WebSocket(`${WS_URL}/ws/orderflow/${encodeURIComponent(symbol)}`);

      ws.onopen = () => {
        delay = RECONNECT_BASE_DELAY_MS;
      };

      ws.onmessage = (evt) => {
        let msg: unknown;
        try {
          msg = JSON.parse(evt.data);
        } catch {
          return;
        }
        if (isSnapshotMsg(msg)) {
          setState(applySnapshot(msg));
          setConnectionState("live");
          return;
        }
        const parsed = msg as OrderflowDeltaMsg;
        if (parsed.type === "status") {
          setConnectionState(parsed.state === "live" ? "live" : "reconnecting");
          return;
        }
        setState((prev) => applyOrderflowMessage(prev, parsed));
      };

      ws.onerror = () => {
        setConnectionState("error");
      };

      ws.onclose = () => {
        if (closedByEffect) return;
        setConnectionState("reconnecting");
        reconnectTimer = setTimeout(() => {
          delay = Math.min(delay * 2, RECONNECT_MAX_DELAY_MS);
          connect();
        }, delay);
      };
    }

    connect();

    return () => {
      closedByEffect = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [symbol]);

  return {
    footprint: Array.from(state.footprint.values()),
    heatmap: Array.from(state.heatmap.values()),
    connectionState,
  };
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (기존 에러가 있었다면 그 개수에서 늘지 않아야 함)

- [ ] **Step 3: 커밋**

```bash
git add hooks/useOrderflowSocket.ts
git commit -m "feat(orderflow): add useOrderflowSocket WS lifecycle hook with backoff reconnect"
```

---

### Task 4: `FootprintChart` 캔버스 컴포넌트

**Files:**
- Create: `components/orderflow/FootprintChart.tsx`

**Interfaces:**
- Consumes: `lib/orderflow-data.ts`(Task 2)의 `FootprintCell`, `diffFootprintCells`, `computeFootprintLayout`
- Produces: `FootprintChart({ cells: FootprintCell[] }): JSX.Element`. Task 6이 `useOrderflowSocket()`의 `footprint` 배열을 그대로 넘긴다.

캔버스 렌더 자체는 스펙상 자동 테스트 스코프 아님(Task 3과 동일 사유) — 타입체크 + Task 6의 수동 브라우저 확인으로 검증한다.

- [ ] **Step 1: 구현**

```tsx
// components/orderflow/FootprintChart.tsx
"use client";

import { useEffect, useRef } from "react";
import { computeFootprintLayout, diffFootprintCells, type FootprintCell } from "@/lib/orderflow-data";

const CELL_WIDTH = 60;
const CELL_HEIGHT = 24;
const LABEL_GUTTER = 70;

interface FootprintChartProps {
  cells: FootprintCell[];
}

export function FootprintChart({ cells }: FootprintChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevCellsRef = useRef<FootprintCell[]>([]);
  const prevLayoutRef = useRef<{ buckets: number[]; prices: number[] }>({ buckets: [], prices: [] });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const layout = computeFootprintLayout(cells);
    const prevLayout = prevLayoutRef.current;
    const layoutChanged =
      layout.buckets.length !== prevLayout.buckets.length ||
      layout.prices.length !== prevLayout.prices.length ||
      layout.buckets.some((b, i) => b !== prevLayout.buckets[i]) ||
      layout.prices.some((p, i) => p !== prevLayout.prices[i]);

    const width = LABEL_GUTTER + layout.buckets.length * CELL_WIDTH;
    const height = layout.prices.length * CELL_HEIGHT;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    function cellPos(bucketTs: number, price: number): { x: number; y: number } | null {
      const col = layout.buckets.indexOf(bucketTs);
      const row = layout.prices.indexOf(price);
      if (col === -1 || row === -1) return null;
      return { x: LABEL_GUTTER + col * CELL_WIDTH, y: row * CELL_HEIGHT };
    }

    function drawCell(cell: FootprintCell) {
      const pos = cellPos(cell.bucketTs, cell.price);
      if (!pos || !ctx) return;
      const total = cell.buyVol + cell.sellVol;
      const buyRatio = total > 0 ? cell.buyVol / total : 0;
      ctx.fillStyle = "#0A0A0A";
      ctx.fillRect(pos.x, pos.y, CELL_WIDTH, CELL_HEIGHT);
      ctx.fillStyle =
        buyRatio >= 0.5
          ? `rgba(0, 217, 100, ${0.2 + buyRatio * 0.6})`
          : `rgba(255, 59, 48, ${0.2 + (1 - buyRatio) * 0.6})`;
      ctx.fillRect(pos.x, pos.y, CELL_WIDTH, CELL_HEIGHT);
      ctx.strokeStyle = "#2A2A2A";
      ctx.strokeRect(pos.x, pos.y, CELL_WIDTH, CELL_HEIGHT);
      ctx.fillStyle = "#F2F2F2";
      ctx.font = "10px monospace";
      ctx.fillText(`${cell.buyVol.toFixed(1)}/${cell.sellVol.toFixed(1)}`, pos.x + 4, pos.y + CELL_HEIGHT / 2 + 3);
    }

    function drawPriceLabels() {
      if (!ctx) return;
      ctx.fillStyle = "#0A0A0A";
      ctx.fillRect(0, 0, LABEL_GUTTER, height);
      ctx.fillStyle = "#A8A8A8";
      ctx.font = "10px monospace";
      layout.prices.forEach((price, row) => {
        ctx.fillText(price.toFixed(2), 4, row * CELL_HEIGHT + CELL_HEIGHT / 2 + 3);
      });
    }

    if (layoutChanged) {
      ctx.clearRect(0, 0, width, height);
      drawPriceLabels();
      for (const cell of cells) drawCell(cell);
    } else {
      for (const cell of diffFootprintCells(prevCellsRef.current, cells)) drawCell(cell);
    }

    prevCellsRef.current = cells;
    prevLayoutRef.current = layout;
  }, [cells]);

  return (
    <div className="border border-border bg-panel overflow-auto">
      <canvas ref={canvasRef} />
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add components/orderflow/FootprintChart.tsx
git commit -m "feat(orderflow): add FootprintChart canvas component with dirty-rect updates"
```

---

### Task 5: `LiquidityHeatmap` 캔버스 컴포넌트

**Files:**
- Create: `components/orderflow/LiquidityHeatmap.tsx`

**Interfaces:**
- Consumes: `lib/orderflow-data.ts`(Task 2)의 `HeatmapCell`, `diffHeatmapCells`, `computeHeatmapLayout`
- Produces: `LiquidityHeatmap({ cells: HeatmapCell[] }): JSX.Element`. Task 6이 `useOrderflowSocket()`의 `heatmap` 배열을 그대로 넘긴다.

Task 4와 동일한 사유로 자동 테스트 스코프 아님 — 타입체크 + Task 6의 수동 브라우저 확인.

- [ ] **Step 1: 구현**

```tsx
// components/orderflow/LiquidityHeatmap.tsx
"use client";

import { useEffect, useRef } from "react";
import { computeHeatmapLayout, diffHeatmapCells, type HeatmapCell } from "@/lib/orderflow-data";

const COLUMN_WIDTH = 6;
const ROW_HEIGHT = 4;
const LABEL_GUTTER = 70;
const MAX_COLUMNS = 300;

interface LiquidityHeatmapProps {
  cells: HeatmapCell[];
}

export function LiquidityHeatmap({ cells }: LiquidityHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevCellsRef = useRef<HeatmapCell[]>([]);
  const prevLayoutRef = useRef<{ buckets: number[]; prices: number[] }>({ buckets: [], prices: [] });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fullLayout = computeHeatmapLayout(cells);
    const buckets = fullLayout.buckets.slice(-MAX_COLUMNS);
    const layout = { buckets, prices: fullLayout.prices };
    const visibleCells = cells.filter((c) => buckets.includes(c.ts));

    const prevLayout = prevLayoutRef.current;
    const layoutChanged =
      layout.buckets.length !== prevLayout.buckets.length ||
      layout.prices.length !== prevLayout.prices.length ||
      layout.buckets.some((b, i) => b !== prevLayout.buckets[i]) ||
      layout.prices.some((p, i) => p !== prevLayout.prices[i]);

    const width = LABEL_GUTTER + layout.buckets.length * COLUMN_WIDTH;
    const height = layout.prices.length * ROW_HEIGHT;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    function cellPos(ts: number, price: number): { x: number; y: number } | null {
      const col = layout.buckets.indexOf(ts);
      const row = layout.prices.indexOf(price);
      if (col === -1 || row === -1) return null;
      return { x: LABEL_GUTTER + col * COLUMN_WIDTH, y: row * ROW_HEIGHT };
    }

    const maxSize = Math.max(1, ...visibleCells.map((c) => c.size));

    function drawCell(cell: HeatmapCell) {
      const pos = cellPos(cell.ts, cell.price);
      if (!pos || !ctx) return;
      const intensity = Math.min(1, cell.size / maxSize);
      ctx.fillStyle = `rgba(255, 159, 10, ${0.1 + intensity * 0.8})`;
      ctx.fillRect(pos.x, pos.y, COLUMN_WIDTH, ROW_HEIGHT);
    }

    if (layoutChanged) {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#0A0A0A";
      ctx.fillRect(0, 0, LABEL_GUTTER, height);
      ctx.fillStyle = "#A8A8A8";
      ctx.font = "10px monospace";
      layout.prices.forEach((price, row) => {
        if (row % 5 === 0 && ctx) ctx.fillText(price.toFixed(2), 4, row * ROW_HEIGHT + ROW_HEIGHT);
      });
      for (const cell of visibleCells) drawCell(cell);
    } else {
      for (const cell of diffHeatmapCells(prevCellsRef.current, visibleCells)) drawCell(cell);
    }

    prevCellsRef.current = visibleCells;
    prevLayoutRef.current = layout;
  }, [cells]);

  return (
    <div className="border border-border bg-panel overflow-auto">
      <canvas ref={canvasRef} />
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add components/orderflow/LiquidityHeatmap.tsx
git commit -m "feat(orderflow): add LiquidityHeatmap canvas component with column scroll-out"
```

---

### Task 6: `/orderflow` 페이지 조립 + 심볼 셀렉터 + 네비게이션 등록

**Files:**
- Create: `app/orderflow/page.tsx`
- Modify: `components/InstrumentSelect.tsx` (`KNOWN_INSTRUMENTS` 배열, 파일럿 심볼 `NQ` 추가 — `BTC.HL`/`ETH.HL`은 이미 있음)
- Modify: `components/Sidebar.tsx` ("마켓" 그룹의 `items` 배열, `{ href: "/ib", label: t("nav.ib") }` 다음 줄)

**Interfaces:**
- Consumes: `lib/api.ts`(Task 1)의 `getOrderflowSymbols`, `hooks/useOrderflowSocket.ts`(Task 3)의 `useOrderflowSocket`, `components/orderflow/FootprintChart.tsx`(Task 4), `components/orderflow/LiquidityHeatmap.tsx`(Task 5), 기존 `components/InstrumentSelect.tsx`의 `InstrumentSelect`, 기존 `components/Jarvis.tsx`의 `LivePulse`
- Produces: 없음 (최종 통합 지점)

이 태스크가 완료되면 스펙의 테스트 계획대로 브라우저에서 직접 확인한다 — Task 3/4/5의 자동 테스트 미커버 부분(WS 라이프사이클, 캔버스 렌더)이 여기서 실제로 검증된다.

- [ ] **Step 1: `InstrumentSelect.tsx`에 파일럿 심볼 추가**

`components/InstrumentSelect.tsx`의 `KNOWN_INSTRUMENTS` 배열 끝에 `"NQ"` 추가:

```ts
const KNOWN_INSTRUMENTS = [
  "AAPL.NASDAQ",
  "MSFT.NASDAQ",
  "NVDA.NASDAQ",
  "TSLA.NASDAQ",
  "GOOGL.NASDAQ",
  "SPY.ARCA",
  "005930.XKRX",
  "000660.XKRX",
  "035420.XKRX",
  "035720.XKRX",
  "BTC.HL",
  "ETH.HL",
  "NQ",
];
```

- [ ] **Step 2: `Sidebar.tsx`에 네비게이션 링크 추가**

`components/Sidebar.tsx`의 "마켓" 그룹에서:

```ts
    {
      label: "마켓", icon: <IconMarket />,
      items: [
        { href: "/market",   label: t("nav.market") },
        { href: "/news",     label: t("nav.news") },
        { href: "/calendar", label: t("nav.calendar") },
        { href: "/ib",       label: t("nav.ib") },
      ],
    },
```

를 다음으로 교체(`/ib` 다음에 `/orderflow` 추가):

```ts
    {
      label: "마켓", icon: <IconMarket />,
      items: [
        { href: "/market",    label: t("nav.market") },
        { href: "/news",      label: t("nav.news") },
        { href: "/calendar",  label: t("nav.calendar") },
        { href: "/ib",        label: t("nav.ib") },
        { href: "/orderflow", label: "오더플로우" },
      ],
    },
```

- [ ] **Step 3: 페이지 구현**

```tsx
// app/orderflow/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { InstrumentSelect } from "@/components/InstrumentSelect";
import { LivePulse } from "@/components/Jarvis";
import { FootprintChart } from "@/components/orderflow/FootprintChart";
import { LiquidityHeatmap } from "@/components/orderflow/LiquidityHeatmap";
import { useOrderflowSocket, type OrderflowConnectionState } from "@/hooks/useOrderflowSocket";
import { getOrderflowSymbols } from "@/lib/api";

const CONNECTION_TONE: Record<OrderflowConnectionState, "pos" | "accent" | "neg"> = {
  connecting: "accent",
  live: "pos",
  reconnecting: "accent",
  error: "neg",
};

const CONNECTION_LABEL: Record<OrderflowConnectionState, string> = {
  connecting: "연결 중",
  live: "라이브",
  reconnecting: "재연결 중",
  error: "오류",
};

export default function OrderflowPage() {
  const [symbol, setSymbol] = useState("BTC.HL");
  const [activeSymbols, setActiveSymbols] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const { footprint, heatmap, connectionState } = useOrderflowSocket(symbol);

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    getOrderflowSymbols(ctrl.signal)
      .then((res) => setActiveSymbols(res.symbols))
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setActiveSymbols([]);
      });
    return () => ctrl.abort();
  }, [symbol]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4">
        <InstrumentSelect value={symbol} onChange={setSymbol} />
        <LivePulse tone={CONNECTION_TONE[connectionState]} label={CONNECTION_LABEL[connectionState]} />
        {activeSymbols.length > 0 && (
          <span className="text-text-3 text-xs">현재 수집 중: {activeSymbols.join(", ")}</span>
        )}
      </div>
      <div>
        <h2 className="text-text-2 text-sm mb-2">풋프린트</h2>
        <FootprintChart cells={footprint} />
      </div>
      <div>
        <h2 className="text-text-2 text-sm mb-2">유동성 히트맵</h2>
        <LiquidityHeatmap cells={heatmap} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 타입체크 + 전체 테스트**

Run: `npx tsc --noEmit`
Expected: 에러 없음

Run: `npm test`
Expected: 전체 통과 (Task 1/2에서 추가한 테스트 포함, 기존 테스트 회귀 없음)

- [ ] **Step 5: 수동 브라우저 확인**

```bash
# 백엔드 (별도 터미널)
cd ../seokminal-multi-venue
uvicorn api_server.main:app --reload

# 프론트엔드
npm run dev
```

`http://localhost:3000/orderflow` 접속:
- 사이드바 "마켓" 그룹에 "오더플로우" 링크가 보이고 클릭하면 이 페이지로 이동하는지 확인
- 기본 심볼 `BTC.HL`로 접속 시 `LivePulse`가 "연결 중" → "라이브"로 바뀌는지, 풋프린트/히트맵 캔버스에 셀이 그려지는지 확인
- `InstrumentSelect`에 `NQ` 입력 후 심볼 전환 시 이전 WS가 정리되고 새 WS로 재연결되는지(브라우저 devtools Network 탭에서 WS 프레임 확인) 확인
- 백엔드를 잠시 내렸다 올려서 `LivePulse`가 "재연결 중"으로 전환됐다가 재연결 시 데이터가 유지된 채(초기화 없이) 이어지는지 확인
- `/crypto`, `/ib` 페이지가 기존과 동일하게 동작하는지 확인(회귀 없음)

- [ ] **Step 6: 커밋**

```bash
git add app/orderflow/page.tsx components/InstrumentSelect.tsx components/Sidebar.tsx
git commit -m "feat(orderflow): add /orderflow page, wire nav link and pilot symbol"
```

---

## 완료 후 다음 단계

프론트엔드 6개 태스크 완료·리뷰 후, 최종 whole-branch 리뷰(가장 강력한 모델)를 거쳐 `superpowers:finishing-a-development-branch`로 마무리한다. 이 프로젝트는 main 직접 커밋 컨벤션이므로 별도 브랜치/PR 없이 "테스트 통과, 이미 main" 경로로 종료될 가능성이 높다.
