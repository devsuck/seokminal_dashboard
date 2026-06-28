# Phase 20: Live Order Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual KR order placement (place/cancel/status) and a unified live dashboard showing all bot positions plus a persistent order log.

**Architecture:** Backend adds four new endpoints — `POST /orders/kr`, `POST /orders/kr/{order_no}/cancel`, `GET /orders/kr/{order_no}/status`, `GET /bots/all-live-status` — using the existing `KISOrderClient` and `live_engine`. Frontend adds `lib/order-storage.ts` (localStorage log), `lib/api.ts` additions, and `app/orders/page.tsx` (2-column: KR order form left, bot positions + order log right).

**Tech Stack:** Python/FastAPI (backend), Next.js 16 / React 19 / TypeScript / TailwindCSS 4 (frontend), vitest (frontend tests)

## Global Constraints

- Python: `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`
- `asyncio_mode = "auto"` — never use `@pytest.mark.asyncio`
- Backend test command: `pytest tests/test_orders_api.py -v` (run from `seokminal-multi-venue/`)
- Frontend test command: `npm test` (run from `seokminal-dashboard/`)
- Frontend tsc check: `npx tsc --noEmit`
- Design tokens only — no hex in `className`. `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1/2/3`, `text-accent`, `text-pos`, `text-neg`, `text-warn`.
- No `style={{}}` except chart lib config and `style={{ height: "Npx" }}` on chart containers.
- No raw `fetch` in page files — all API calls via `lib/api.ts` functions.
- `AbortController` pattern: abort prev → new ctrl → assign ref → fetch → catch AbortError silently → finally guard `abortRef.current === ctrl` → unmount cleanup `useEffect(() => () => { abortRef.current?.abort(); }, [])`.
- `bg-accent text-black` only for primary action buttons (Place Order, Refresh).
- Active/selected toggle: `border-accent text-accent bg-accent/10`.
- NavBar: add `{ href: "/orders", label: "Orders" }` to Live group **after** `{ href: "/bots", label: "Bots" }` and **before** `{ href: "/ai-trader", label: "AI Trader" }`.
- Backend lives in `seokminal-multi-venue/`; frontend in `seokminal-dashboard/`.
- Pre-existing test failure `test_backtest_happy_path_returns_all_metric_keys` — known, always ignore.

---

## Task 1: Backend — KR Order Endpoints + All Bots Status

**Repo:** `seokminal-multi-venue/`

**Files:**
- Modify: `api_server/main.py` — add 1 import + 4 models + 4 endpoints (~100 lines)
- Create: `tests/test_orders_api.py` — 8 tests

**Interfaces:**
- Produces:
  - `POST /orders/kr` body `KROrderRequest` → `KROrderResponse`
  - `POST /orders/kr/{order_no}/cancel` body `KRCancelRequest` → `KROrderResponse`
  - `GET /orders/kr/{order_no}/status?date=YYYYMMDD` → `KROrderResponse`
  - `GET /bots/all-live-status` → `AllBotsStatusResponse`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_orders_api.py`:

```python
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from api_server.main import app

client = TestClient(app)

# ── /orders/kr ────────────────────────────────────────────────────────────────

def test_place_kr_order_missing_credentials_returns_503():
    with patch.dict("os.environ", {
        "KIS_APP_KEY": "", "KIS_APP_SECRET": "",
        "KIS_CANO": "", "KIS_ACNT_PRDT_CD": "",
    }):
        r = client.post("/orders/kr", json={
            "code": "005930", "side": "BUY", "quantity": 1, "order_type": "MARKET",
        })
    assert r.status_code == 503


def test_place_kr_order_invalid_side_returns_400():
    with patch.dict("os.environ", {
        "KIS_APP_KEY": "k", "KIS_APP_SECRET": "s",
        "KIS_CANO": "c", "KIS_ACNT_PRDT_CD": "01",
    }):
        r = client.post("/orders/kr", json={
            "code": "005930", "side": "HOLD", "quantity": 1, "order_type": "MARKET",
        })
    assert r.status_code == 400


def test_place_kr_order_limit_without_price_returns_400():
    with patch.dict("os.environ", {
        "KIS_APP_KEY": "k", "KIS_APP_SECRET": "s",
        "KIS_CANO": "c", "KIS_ACNT_PRDT_CD": "01",
    }):
        r = client.post("/orders/kr", json={
            "code": "005930", "side": "BUY", "quantity": 1, "order_type": "LIMIT",
        })
    assert r.status_code == 400


@patch("api_server.main.KISOrderClient")
def test_place_kr_order_success(mock_cls):
    mock_client = MagicMock()
    mock_client.place_order.return_value = {
        "order_id": "0001234", "status": "SUBMITTED", "filled": 0.0, "remaining": 1.0,
    }
    mock_cls.return_value = mock_client

    with patch.dict("os.environ", {
        "KIS_APP_KEY": "k", "KIS_APP_SECRET": "s",
        "KIS_CANO": "c", "KIS_ACNT_PRDT_CD": "01",
    }):
        r = client.post("/orders/kr", json={
            "code": "005930", "side": "BUY", "quantity": 1, "order_type": "MARKET",
        })

    assert r.status_code == 200
    body = r.json()
    assert body["order_id"] == "0001234"
    assert body["status"] == "SUBMITTED"
    assert body["filled"] == 0.0
    assert body["remaining"] == 1.0


@patch("api_server.main.KISOrderClient")
def test_cancel_kr_order_success(mock_cls):
    mock_client = MagicMock()
    mock_client.cancel_order.return_value = {
        "order_id": "0001234", "status": "CANCELLED", "filled": 0.0, "remaining": 0.0,
    }
    mock_cls.return_value = mock_client

    with patch.dict("os.environ", {
        "KIS_APP_KEY": "k", "KIS_APP_SECRET": "s",
        "KIS_CANO": "c", "KIS_ACNT_PRDT_CD": "01",
    }):
        r = client.post("/orders/kr/0001234/cancel", json={
            "code": "005930", "quantity": 1,
        })

    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "CANCELLED"
    assert body["order_id"] == "0001234"


@patch("api_server.main.KISOrderClient")
def test_get_kr_order_status_found(mock_cls):
    mock_client = MagicMock()
    mock_client.get_order_status.return_value = {
        "order_id": "0001234", "status": "FILLED", "filled": 1.0, "remaining": 0.0,
    }
    mock_cls.return_value = mock_client

    with patch.dict("os.environ", {
        "KIS_APP_KEY": "k", "KIS_APP_SECRET": "s",
        "KIS_CANO": "c", "KIS_ACNT_PRDT_CD": "01",
    }):
        r = client.get("/orders/kr/0001234/status", params={"date": "20260628"})

    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "FILLED"
    assert body["filled"] == 1.0


@patch("api_server.main.KISOrderClient")
def test_get_kr_order_status_not_found_returns_404(mock_cls):
    mock_client = MagicMock()
    mock_client.get_order_status.return_value = None
    mock_cls.return_value = mock_client

    with patch.dict("os.environ", {
        "KIS_APP_KEY": "k", "KIS_APP_SECRET": "s",
        "KIS_CANO": "c", "KIS_ACNT_PRDT_CD": "01",
    }):
        r = client.get("/orders/kr/9999999/status", params={"date": "20260628"})

    assert r.status_code == 404


@patch("api_server.main._load_bots")
def test_all_bots_live_status_empty_when_no_bots(mock_load):
    mock_load.return_value = {}
    r = client.get("/bots/all-live-status")
    assert r.status_code == 200
    body = r.json()
    assert body["bots"] == []
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_orders_api.py -v 2>&1 | tail -12
```
Expected: 8 failures (404 or import errors).

- [ ] **Step 3: Add import to `api_server/main.py`**

After the existing `from backends.kis.client import KISClient` line (around line 44), add:

```python
from backends.kis.order_client import KISOrderClient
```

- [ ] **Step 4: Add Pydantic models to `api_server/main.py`**

Append after the existing Spawner models (near the end of the file):

```python
# ── Orders ────────────────────────────────────────────────────────────────────

class KROrderRequest(BaseModel):
    code: str
    side: str           # "BUY" | "SELL"
    quantity: int
    order_type: str     # "MARKET" | "LIMIT"
    price: int | None = None  # required for LIMIT


class KROrderResponse(BaseModel):
    order_id: str
    status: str
    filled: float
    remaining: float


class KRCancelRequest(BaseModel):
    code: str
    quantity: int


class BotLiveEntry(BaseModel):
    bot_id: str
    name: str
    instrument_id: str
    running: bool
    position: str
    qty: float
    last_price: float | None
    last_signal: str | None
    error: str | None


class AllBotsStatusResponse(BaseModel):
    bots: list[BotLiveEntry]
```

- [ ] **Step 5: Add `POST /orders/kr` endpoint**

```python
@app.post("/orders/kr", response_model=KROrderResponse)
def place_kr_order(req: KROrderRequest) -> KROrderResponse:
    app_key = os.environ.get("KIS_APP_KEY", "")
    app_secret = os.environ.get("KIS_APP_SECRET", "")
    cano = os.environ.get("KIS_CANO", "")
    acnt_prdt_cd = os.environ.get("KIS_ACNT_PRDT_CD", "")
    if not all([app_key, app_secret, cano, acnt_prdt_cd]):
        raise HTTPException(status_code=503, detail="KIS credentials not configured")
    if req.side not in ("BUY", "SELL"):
        raise HTTPException(status_code=400, detail=f"invalid side: {req.side!r}")
    if req.order_type not in ("MARKET", "LIMIT"):
        raise HTTPException(status_code=400, detail=f"invalid order_type: {req.order_type!r}")
    if req.order_type == "LIMIT" and req.price is None:
        raise HTTPException(status_code=400, detail="price required for LIMIT order")
    try:
        order_client = KISOrderClient(app_key, app_secret, cano, acnt_prdt_cd)
        result = order_client.place_order(
            req.code, req.side, req.quantity, req.order_type, req.price
        )
        return KROrderResponse(**result)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
```

- [ ] **Step 6: Add `POST /orders/kr/{order_no}/cancel` endpoint**

```python
@app.post("/orders/kr/{order_no}/cancel", response_model=KROrderResponse)
def cancel_kr_order(order_no: str, req: KRCancelRequest) -> KROrderResponse:
    app_key = os.environ.get("KIS_APP_KEY", "")
    app_secret = os.environ.get("KIS_APP_SECRET", "")
    cano = os.environ.get("KIS_CANO", "")
    acnt_prdt_cd = os.environ.get("KIS_ACNT_PRDT_CD", "")
    if not all([app_key, app_secret, cano, acnt_prdt_cd]):
        raise HTTPException(status_code=503, detail="KIS credentials not configured")
    try:
        order_client = KISOrderClient(app_key, app_secret, cano, acnt_prdt_cd)
        result = order_client.cancel_order(order_no, req.code, req.quantity)
        return KROrderResponse(**result)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
```

- [ ] **Step 7: Add `GET /orders/kr/{order_no}/status` endpoint**

```python
@app.get("/orders/kr/{order_no}/status", response_model=KROrderResponse)
def get_kr_order_status(
    order_no: str,
    date: str = Query(..., description="Order date YYYYMMDD"),
) -> KROrderResponse:
    app_key = os.environ.get("KIS_APP_KEY", "")
    app_secret = os.environ.get("KIS_APP_SECRET", "")
    cano = os.environ.get("KIS_CANO", "")
    acnt_prdt_cd = os.environ.get("KIS_ACNT_PRDT_CD", "")
    if not all([app_key, app_secret, cano, acnt_prdt_cd]):
        raise HTTPException(status_code=503, detail="KIS credentials not configured")
    try:
        order_client = KISOrderClient(app_key, app_secret, cano, acnt_prdt_cd)
        result = order_client.get_order_status(date, order_no)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail=f"order {order_no!r} not found for date {date!r}")
    return KROrderResponse(**result)
```

- [ ] **Step 8: Add `GET /bots/all-live-status` endpoint**

**Important:** This endpoint must be declared **before** the existing `@app.post("/bots/{bot_id}/start")` route, otherwise FastAPI will interpret `"all-live-status"` as a `bot_id` path parameter. Place it right after `@app.get("/bots", ...)` in the file. Find the `/bots` GET endpoint and insert after its closing brace.

Actually, since main.py is large and appending is the established pattern, place the endpoint code at the end of the file but ensure the route path `"/bots/all-live-status"` does NOT conflict with `"/bots/{bot_id}/..."` routes. In FastAPI, literal path segments take priority over path parameters when declared FIRST. Since the existing `/bots/{bot_id}/*` routes come first in the file, add a comment explaining the ordering issue and declare the path as `/bots/all-live-status` — FastAPI resolves fixed paths before dynamic ones regardless of declaration order in most cases.

```python
@app.get("/bots/all-live-status", response_model=AllBotsStatusResponse)
def get_all_bots_live_status() -> AllBotsStatusResponse:
    bots = _load_bots()
    all_statuses = live_engine.get_all_statuses()
    entries = []
    for bot_id, bot_data in bots.items():
        status = all_statuses.get(bot_id)
        if status is not None:
            entries.append(
                BotLiveEntry(
                    bot_id=bot_id,
                    name=bot_data["name"],
                    instrument_id=bot_data["instrument_id"],
                    running=True,
                    position=status.position,
                    qty=status.qty,
                    last_price=status.last_price,
                    last_signal=status.last_signal,
                    error=status.error,
                )
            )
        else:
            entries.append(
                BotLiveEntry(
                    bot_id=bot_id,
                    name=bot_data["name"],
                    instrument_id=bot_data["instrument_id"],
                    running=False,
                    position="FLAT",
                    qty=0.0,
                    last_price=None,
                    last_signal=None,
                    error=None,
                )
            )
    return AllBotsStatusResponse(bots=entries)
```

- [ ] **Step 9: Run tests to verify they pass**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_orders_api.py -v 2>&1 | tail -12
```
Expected: 8/8 pass.

Full suite regression check:
```bash
pytest tests/ -q 2>&1 | tail -5
```
Expected: 1 pre-existing failure (`test_backtest_happy_path_returns_all_metric_keys`), all others pass.

- [ ] **Step 10: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
git add api_server/main.py tests/test_orders_api.py
git commit -m "feat(api): add /orders/kr and /bots/all-live-status endpoints"
```

---

## Task 2: Frontend — Order Storage + API Types + Orders Page + NavBar

**Repo:** `seokminal-dashboard/`

**Files:**
- Create: `lib/order-storage.ts`
- Create: `tests/lib/order-storage.test.ts` — 7 tests
- Modify: `lib/api.ts` — append 5 types + 4 functions
- Create: `app/orders/page.tsx` — orders dashboard (~280 lines)
- Modify: `components/NavBar.tsx` — add Orders to Live group
- Modify: `docs/progress.md` — prepend Phase 20 section
- Modify: `docs/roadmap.md` — update HEAD + Phase 20 commit range

**Interfaces:**
- Consumes (from Task 1):
  - `POST /orders/kr` → `KROrderResponse`
  - `POST /orders/kr/{order_no}/cancel` → `KROrderResponse`
  - `GET /orders/kr/{order_no}/status?date=` → `KROrderResponse`
  - `GET /bots/all-live-status` → `AllBotsStatusResponse`

---

### Subtask A: `lib/order-storage.ts` + tests

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/order-storage.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { getOrderLog, addOrderEntry, clearOrderLog, type OrderLogEntry } from "../../lib/order-storage";

beforeEach(() => {
  localStorage.clear();
});

describe("getOrderLog", () => {
  it("returns [] when storage is empty", () => {
    expect(getOrderLog()).toEqual([]);
  });

  it("returns [] when storage contains invalid JSON", () => {
    localStorage.setItem("nautilus_order_log", "bad");
    expect(getOrderLog()).toEqual([]);
  });
});

describe("addOrderEntry", () => {
  it("appends entry with generated id and submitted_at", () => {
    const result = addOrderEntry({
      code: "005930",
      side: "BUY",
      qty: 1,
      order_type: "MARKET",
      order_id: "0001234",
      status: "SUBMITTED",
    });
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("005930");
    expect(result[0].id).toBeTruthy();
    expect(result[0].submitted_at).toBeTruthy();
  });

  it("returns updated list with multiple entries", () => {
    addOrderEntry({ code: "005930", side: "BUY", qty: 1, order_type: "MARKET", order_id: "001", status: "SUBMITTED" });
    const result = addOrderEntry({ code: "000660", side: "SELL", qty: 2, order_type: "MARKET", order_id: "002", status: "SUBMITTED" });
    expect(result).toHaveLength(2);
  });

  it("persists entries across getOrderLog calls", () => {
    addOrderEntry({ code: "005930", side: "BUY", qty: 1, order_type: "MARKET", order_id: "001", status: "SUBMITTED" });
    expect(getOrderLog()).toHaveLength(1);
  });
});

describe("clearOrderLog", () => {
  it("empties the order log", () => {
    addOrderEntry({ code: "005930", side: "BUY", qty: 1, order_type: "MARKET", order_id: "001", status: "SUBMITTED" });
    clearOrderLog();
    expect(getOrderLog()).toEqual([]);
  });

  it("is a no-op when already empty", () => {
    clearOrderLog();
    expect(getOrderLog()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test -- --reporter=verbose tests/lib/order-storage.test.ts 2>&1 | tail -12
```
Expected: errors about missing module.

- [ ] **Step 3: Create `lib/order-storage.ts`**

```typescript
export interface OrderLogEntry {
  id: string;
  code: string;
  side: "BUY" | "SELL";
  qty: number;
  order_type: "MARKET" | "LIMIT";
  price?: number;
  order_id: string;
  status: string;
  submitted_at: string;
}

const STORAGE_KEY = "nautilus_order_log";

export function getOrderLog(): OrderLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as OrderLogEntry[];
  } catch {
    return [];
  }
}

export function addOrderEntry(
  entry: Omit<OrderLogEntry, "id" | "submitted_at">,
): OrderLogEntry[] {
  const log = getOrderLog();
  const full: OrderLogEntry = {
    ...entry,
    id: Math.random().toString(36).slice(2),
    submitted_at: new Date().toISOString(),
  };
  log.push(full);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  return log;
}

export function clearOrderLog(): void {
  localStorage.setItem(STORAGE_KEY, "[]");
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test -- --reporter=verbose tests/lib/order-storage.test.ts 2>&1 | tail -10
```
Expected: 7/7 passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add lib/order-storage.ts tests/lib/order-storage.test.ts
git commit -m "feat(orders): order-storage localStorage module + 7 tests"
```

---

### Subtask B: `lib/api.ts` additions

- [ ] **Step 6: Append to `lib/api.ts`**

```typescript
// ── Orders ────────────────────────────────────────────────────────────────────

export interface KROrderRequest {
  code: string;
  side: "BUY" | "SELL";
  quantity: number;
  order_type: "MARKET" | "LIMIT";
  price?: number;
}

export interface KROrderResponse {
  order_id: string;
  status: string;
  filled: number;
  remaining: number;
}

export interface KRCancelRequest {
  code: string;
  quantity: number;
}

export interface BotLiveEntry {
  bot_id: string;
  name: string;
  instrument_id: string;
  running: boolean;
  position: string;
  qty: number;
  last_price: number | null;
  last_signal: string | null;
  error: string | null;
}

export interface AllBotsStatusResponse {
  bots: BotLiveEntry[];
}

export async function placeKROrder(
  req: KROrderRequest,
  signal?: AbortSignal,
): Promise<KROrderResponse> {
  const r = await fetch(`${API_URL}/orders/kr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  return handleResponse<KROrderResponse>(r);
}

export async function cancelKROrder(
  orderNo: string,
  req: KRCancelRequest,
  signal?: AbortSignal,
): Promise<KROrderResponse> {
  const r = await fetch(`${API_URL}/orders/kr/${encodeURIComponent(orderNo)}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  return handleResponse<KROrderResponse>(r);
}

export async function getKROrderStatus(
  orderNo: string,
  date: string,
  signal?: AbortSignal,
): Promise<KROrderResponse> {
  const r = await fetch(
    `${API_URL}/orders/kr/${encodeURIComponent(orderNo)}/status?date=${encodeURIComponent(date)}`,
    { signal },
  );
  return handleResponse<KROrderResponse>(r);
}

export async function getAllBotsLiveStatus(
  signal?: AbortSignal,
): Promise<AllBotsStatusResponse> {
  const r = await fetch(`${API_URL}/bots/all-live-status`, { signal });
  return handleResponse<AllBotsStatusResponse>(r);
}
```

- [ ] **Step 7: Verify tsc passes**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npx tsc --noEmit 2>&1 | head -5
```
Expected: 0 errors.

---

### Subtask C: `app/orders/page.tsx`

- [ ] **Step 8: Create `app/orders/page.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  placeKROrder,
  getAllBotsLiveStatus,
  type KROrderResponse,
  type BotLiveEntry,
} from "@/lib/api";
import {
  getOrderLog,
  addOrderEntry,
  clearOrderLog,
  type OrderLogEntry,
} from "@/lib/order-storage";

// ── Types ─────────────────────────────────────────────────────────────────────

type Side = "BUY" | "SELL";
type OrderType = "MARKET" | "LIMIT";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  // Form state
  const [code, setCode] = useState("005930");
  const [side, setSide] = useState<Side>("BUY");
  const [qty, setQty] = useState("1");
  const [orderType, setOrderType] = useState<OrderType>("MARKET");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<KROrderResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitAbortRef = useRef<AbortController | null>(null);

  // Bot positions state
  const [bots, setBots] = useState<BotLiveEntry[]>([]);
  const [botsError, setBotsError] = useState<string | null>(null);
  const [botsLoading, setBotsLoading] = useState(false);
  const botsAbortRef = useRef<AbortController | null>(null);

  // Order log state
  const [orderLog, setOrderLog] = useState<OrderLogEntry[]>([]);

  // Load order log on mount
  useEffect(() => {
    setOrderLog(getOrderLog());
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    submitAbortRef.current?.abort();
    botsAbortRef.current?.abort();
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handlePlaceOrder() {
    const qtyNum = parseInt(qty);
    if (!code.trim() || isNaN(qtyNum) || qtyNum <= 0) {
      setSubmitError("Code and quantity are required.");
      return;
    }
    if (orderType === "LIMIT" && (!price || isNaN(parseFloat(price)))) {
      setSubmitError("Price required for LIMIT order.");
      return;
    }

    submitAbortRef.current?.abort();
    const ctrl = new AbortController();
    submitAbortRef.current = ctrl;
    setSubmitting(true);
    setSubmitResult(null);
    setSubmitError(null);

    try {
      const req = {
        code: code.trim(),
        side,
        quantity: qtyNum,
        order_type: orderType,
        ...(orderType === "LIMIT" ? { price: parseInt(price) } : {}),
      };
      const result = await placeKROrder(req, ctrl.signal);
      if (submitAbortRef.current !== ctrl) return;
      setSubmitResult(result);
      const updated = addOrderEntry({
        code: code.trim(),
        side,
        qty: qtyNum,
        order_type: orderType,
        ...(orderType === "LIMIT" ? { price: parseInt(price) } : {}),
        order_id: result.order_id,
        status: result.status,
      });
      setOrderLog(updated);
    } catch (e) {
      if (submitAbortRef.current !== ctrl) return;
      if (e instanceof Error && e.name === "AbortError") return;
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      if (submitAbortRef.current === ctrl) setSubmitting(false);
    }
  }

  async function handleRefreshBots() {
    botsAbortRef.current?.abort();
    const ctrl = new AbortController();
    botsAbortRef.current = ctrl;
    setBotsLoading(true);
    setBotsError(null);

    try {
      const res = await getAllBotsLiveStatus(ctrl.signal);
      if (botsAbortRef.current !== ctrl) return;
      setBots(res.bots);
    } catch (e) {
      if (botsAbortRef.current !== ctrl) return;
      if (e instanceof Error && e.name === "AbortError") return;
      setBotsError(e instanceof Error ? e.message : String(e));
    } finally {
      if (botsAbortRef.current === ctrl) setBotsLoading(false);
    }
  }

  // Auto-refresh bot positions on mount
  useEffect(() => {
    handleRefreshBots();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClearLog() {
    clearOrderLog();
    setOrderLog([]);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-bg text-text-1 p-6">
      <h1 className="text-xl font-bold mb-6">Live Order Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: KR Order Form ── */}
        <section className="space-y-4">
          <div className="bg-panel border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide mb-4">
              KR Manual Order
            </h2>

            <div className="space-y-3">
              {/* Code */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-text-2 w-24 shrink-0">Code</label>
                <input
                  className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm font-mono"
                  placeholder="005930"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                />
              </div>

              {/* Side toggle */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-text-2 w-24 shrink-0">Side</label>
                <div className="flex rounded overflow-hidden border border-border">
                  {(["BUY", "SELL"] as Side[]).map(s => (
                    <button
                      key={s}
                      className={`px-4 py-1.5 text-sm font-medium ${
                        side === s
                          ? s === "BUY"
                            ? "bg-pos text-bg"
                            : "bg-neg text-bg"
                          : "bg-panel-2 text-text-2 hover:bg-panel"
                      }`}
                      onClick={() => setSide(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-text-2 w-24 shrink-0">Qty</label>
                <input
                  type="number"
                  className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm"
                  min="1"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                />
              </div>

              {/* Order type toggle */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-text-2 w-24 shrink-0">Type</label>
                <div className="flex rounded overflow-hidden border border-border">
                  {(["MARKET", "LIMIT"] as OrderType[]).map(t => (
                    <button
                      key={t}
                      className={`px-4 py-1.5 text-sm font-medium ${
                        orderType === t
                          ? "border-accent text-accent bg-accent/10"
                          : "bg-panel-2 text-text-2 hover:bg-panel"
                      }`}
                      onClick={() => setOrderType(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price (LIMIT only) */}
              {orderType === "LIMIT" && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-text-2 w-24 shrink-0">Price</label>
                  <input
                    type="number"
                    className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm"
                    placeholder="limit price (KRW)"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                className="bg-accent text-black text-sm font-medium rounded px-5 py-2 disabled:opacity-40"
                onClick={handlePlaceOrder}
                disabled={submitting}
              >
                {submitting ? "Placing…" : "Place Order"}
              </button>
              {submitResult && (
                <span className="text-sm text-pos font-mono">
                  #{submitResult.order_id} · {submitResult.status}
                </span>
              )}
              {submitError && (
                <span className="text-sm text-neg">{submitError}</span>
              )}
            </div>
          </div>

          {/* Order Log */}
          <div className="bg-panel border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide">
                Order Log
              </h2>
              {orderLog.length > 0 && (
                <button
                  className="text-xs text-neg hover:underline"
                  onClick={handleClearLog}
                >
                  Clear
                </button>
              )}
            </div>
            {orderLog.length === 0 ? (
              <p className="text-sm text-text-3">No orders placed yet.</p>
            ) : (
              <div className="overflow-auto max-h-48">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-3 border-b border-border">
                      <th className="py-1 text-left font-medium">Code</th>
                      <th className="py-1 text-left font-medium">Side</th>
                      <th className="py-1 text-right font-medium">Qty</th>
                      <th className="py-1 text-left font-medium">Order ID</th>
                      <th className="py-1 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...orderLog].reverse().map(entry => (
                      <tr key={entry.id} className="border-b border-border/50">
                        <td className="py-1.5 text-text-1 font-mono">{entry.code}</td>
                        <td className={`py-1.5 font-medium ${entry.side === "BUY" ? "text-pos" : "text-neg"}`}>
                          {entry.side}
                        </td>
                        <td className="py-1.5 text-text-1 text-right">{entry.qty}</td>
                        <td className="py-1.5 text-text-2 font-mono">{entry.order_id}</td>
                        <td className="py-1.5 text-text-2">{entry.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* ── Right: Bot Positions ── */}
        <section>
          <div className="bg-panel border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide">
                Bot Positions
              </h2>
              <button
                className="bg-accent text-black text-xs font-medium rounded px-3 py-1 disabled:opacity-40"
                onClick={handleRefreshBots}
                disabled={botsLoading}
              >
                {botsLoading ? "Loading…" : "Refresh"}
              </button>
            </div>

            {botsError && (
              <p className="text-sm text-neg mb-2">{botsError}</p>
            )}

            {bots.length === 0 && !botsLoading && !botsError ? (
              <p className="text-sm text-text-3">No bots found.</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-3 border-b border-border">
                      <th className="py-1 text-left font-medium">Bot</th>
                      <th className="py-1 text-left font-medium">Instrument</th>
                      <th className="py-1 text-left font-medium">Status</th>
                      <th className="py-1 text-left font-medium">Position</th>
                      <th className="py-1 text-right font-medium">Qty</th>
                      <th className="py-1 text-right font-medium">Price</th>
                      <th className="py-1 text-left font-medium">Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bots.map(bot => (
                      <tr key={bot.bot_id} className="border-b border-border/50">
                        <td className="py-1.5 text-text-1 font-mono text-xs">{bot.bot_id}</td>
                        <td className="py-1.5 text-text-2">{bot.instrument_id}</td>
                        <td className="py-1.5">
                          <span className={`text-xs font-medium ${bot.running ? "text-pos" : "text-text-3"}`}>
                            {bot.running ? "RUNNING" : "STOPPED"}
                          </span>
                        </td>
                        <td className={`py-1.5 font-medium ${
                          bot.position === "LONG" ? "text-pos"
                            : bot.position === "SHORT" ? "text-neg"
                            : "text-text-3"
                        }`}>
                          {bot.position}
                        </td>
                        <td className="py-1.5 text-text-1 text-right">{bot.qty}</td>
                        <td className="py-1.5 text-text-1 text-right font-mono">
                          {bot.last_price != null ? bot.last_price.toFixed(2) : "—"}
                        </td>
                        <td className="py-1.5 text-text-2 text-xs">{bot.last_signal ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {bots.some(b => b.error) && (
              <div className="mt-3 space-y-1">
                {bots.filter(b => b.error).map(b => (
                  <p key={b.bot_id} className="text-xs text-neg">
                    {b.bot_id}: {b.error}
                  </p>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 9: Verify tsc passes**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npx tsc --noEmit 2>&1 | head -5
```
Expected: 0 errors.

---

### Subtask D: NavBar + Docs + Final Commit

- [ ] **Step 10: Add Orders to NavBar**

In `components/NavBar.tsx`, find the Live group and add Orders after Bots:

Find:
```tsx
      { href: "/bots",      label: "Bots" },
      { href: "/ai-trader", label: "AI Trader" },
```

Replace with:
```tsx
      { href: "/bots",      label: "Bots" },
      { href: "/orders",    label: "Orders" },
      { href: "/ai-trader", label: "AI Trader" },
```

- [ ] **Step 11: Run full test suite**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test 2>&1 | tail -5
npx tsc --noEmit 2>&1 | head -5
```
Expected: 141/141 passed (134 existing + 7 new order-storage tests), 0 tsc errors.

- [ ] **Step 12: Update docs**

Prepend to `docs/progress.md`:

```markdown
## Phase 20 — Live Order Dashboard (2026-06-28) ✅ SHIPPED

### 완료된 작업
- Backend: `POST /orders/kr` (KIS 수동 주문), `POST /orders/kr/{no}/cancel`, `GET /orders/kr/{no}/status`, `GET /bots/all-live-status`
- Frontend: `lib/order-storage.ts` (localStorage 주문 로그), `lib/api.ts` (+5 types +4 functions)
- `/orders` 페이지 — KR 주문 폼, 봇 포지션 테이블, 주문 로그
- NavBar: Orders 추가 (Live 그룹, Bots 뒤)

### 변경된 파일
**Backend:** `api_server/main.py`, `tests/test_orders_api.py`
**Frontend:** `lib/order-storage.ts`, `lib/api.ts`, `app/orders/page.tsx`, `components/NavBar.tsx`, `docs/`

### 다음 할 일
- (로드맵 완료)

---
```

Update `docs/roadmap.md`:
- Change `**HEAD:**` to the latest commit hash after this task
- Change `| 20 | ... | TBD |` to `| 20 | ... | <prev-HEAD>..<new-HEAD> |`

- [ ] **Step 13: Final commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add lib/order-storage.ts tests/lib/order-storage.test.ts lib/api.ts app/orders/page.tsx components/NavBar.tsx docs/progress.md docs/roadmap.md
git commit -m "feat(orders): live order dashboard, order storage, api types, NavBar + docs"
```

Note: if storage/api.ts already committed in earlier steps, commit only the remaining files. Check `git status` before committing.
