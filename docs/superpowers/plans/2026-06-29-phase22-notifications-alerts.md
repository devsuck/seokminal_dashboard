# Phase 22 — Notifications + Alert System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-side alert rules engine (threshold conditions on bot price/PnL/status) with a frontend create/list/delete UI and triggered-alerts feed.

**Architecture:** Backend stores rules in-memory dict; `GET /alerts/triggered` evaluates all rules lazily against `live_engine.get_all_statuses()` and appends new triggered entries (dedup: one entry per rule per 5 min). Frontend calls server for CRUD and caches triggered alerts in localStorage via `lib/alert-storage.ts`.

**Tech Stack:** FastAPI + Pydantic (backend), Next.js 16 / React 19 / TypeScript / Tailwind (frontend), vitest + jsdom (frontend tests), pytest + TestClient (backend tests)

## Global Constraints

- `@pytest.mark.asyncio` FORBIDDEN — `asyncio_mode="auto"` already set in pyproject.toml
- Python binary: `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`
- Frontend design tokens only: `bg-bg/panel/panel-2`, `border-border`, `text-text-1/2/3`, `text-accent/pos/neg/warn/info`
- `bg-accent text-black` — primary action buttons only (Create)
- Active tab: `border-accent text-accent bg-accent/10`
- Raw `fetch` FORBIDDEN — must use `lib/api.ts` functions
- `style={{}}` FORBIDDEN except `style={{ height: "Npx" }}` chart containers
- Hex codes in className FORBIDDEN
- NavBar groups defined in `NAV_GROUPS` array in `components/NavBar.tsx`
- Backend working dir: `seokminal-multi-venue/`; frontend: `seokminal-dashboard/`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `seokminal-multi-venue/api_server/main.py` | Add alert models, in-memory store, 4 endpoints, evaluation logic |
| Create | `seokminal-multi-venue/tests/test_alerts_api.py` | Backend tests for all 4 endpoints |
| Create | `seokminal-dashboard/lib/alert-storage.ts` | localStorage cache for triggered alerts |
| Modify | `seokminal-dashboard/lib/api.ts` | Add `AlertRule`, `TriggeredAlert` types + 4 API functions |
| Create | `seokminal-dashboard/tests/lib/alert-storage.test.ts` | Frontend storage unit tests |
| Create | `seokminal-dashboard/app/alerts/page.tsx` | Alerts UI: rule form + triggered list |
| Modify | `seokminal-dashboard/components/NavBar.tsx` | Add Alerts to Live group |

---

## Task 1: Backend — Alert Models + Endpoints + Tests

**Files:**
- Modify: `seokminal-multi-venue/api_server/main.py` (append near end, before `if __name__` if present, else at end)
- Create: `seokminal-multi-venue/tests/test_alerts_api.py`

**Interfaces:**
- Consumes: `live_engine.get_all_statuses() → dict[str, BotStatus]`, `_compute_unrealized_pnl(position, qty, last_price, entry_price) → float | None` (already in main.py)
- Produces:
  - `POST /alerts/rules` → `201 AlertRuleOut`
  - `GET /alerts/rules` → `200 AlertRulesResponse`
  - `DELETE /alerts/rules/{rule_id}` → `204`
  - `GET /alerts/triggered` → `200 TriggeredAlertsResponse`

- [ ] **Step 1: Append models + in-memory store to main.py**

Add the following block at the end of `api_server/main.py`:

```python
# ── Alert System ──────────────────────────────────────────────
_ALERT_CONDITION_TYPES = frozenset({
    "price_above", "price_below", "pnl_above", "pnl_below",
    "bot_error", "bot_stopped",
})
_THRESHOLD_REQUIRED = frozenset({"price_above", "price_below", "pnl_above", "pnl_below"})

class CreateAlertRuleRequest(BaseModel):
    label: str
    condition_type: str
    bot_id: str
    threshold: float | None = None

class AlertRuleOut(BaseModel):
    id: str
    label: str
    condition_type: str
    bot_id: str
    threshold: float | None
    created_at: str

class AlertRulesResponse(BaseModel):
    rules: list[AlertRuleOut]

class TriggeredAlertOut(BaseModel):
    rule_id: str
    rule_label: str
    condition_type: str
    bot_id: str
    detail: str
    triggered_at: str

class TriggeredAlertsResponse(BaseModel):
    triggered: list[TriggeredAlertOut]

_alert_rules: dict[str, AlertRuleOut] = {}
_triggered_alerts: list[TriggeredAlertOut] = []
_MAX_TRIGGERED = 200
_DEDUP_SECONDS = 300


def _evaluate_alert_condition(
    rule: AlertRuleOut,
    statuses: dict[str, "BotStatus"],
) -> tuple[bool, str]:
    status = statuses.get(rule.bot_id)
    t = rule.threshold

    if rule.condition_type == "price_above":
        if status is None or status.last_price is None:
            return False, ""
        if status.last_price > t:
            return True, f"price {status.last_price:.4f} > {t:.4f}"
        return False, ""

    if rule.condition_type == "price_below":
        if status is None or status.last_price is None:
            return False, ""
        if status.last_price < t:
            return True, f"price {status.last_price:.4f} < {t:.4f}"
        return False, ""

    if rule.condition_type == "pnl_above":
        if status is None:
            return False, ""
        pnl = _compute_unrealized_pnl(
            status.position, status.qty, status.last_price, status.entry_price
        )
        if pnl is None:
            return False, ""
        if pnl > t:
            return True, f"unrealized PnL {pnl:.2f} > {t:.2f}"
        return False, ""

    if rule.condition_type == "pnl_below":
        if status is None:
            return False, ""
        pnl = _compute_unrealized_pnl(
            status.position, status.qty, status.last_price, status.entry_price
        )
        if pnl is None:
            return False, ""
        if pnl < t:
            return True, f"unrealized PnL {pnl:.2f} < {t:.2f}"
        return False, ""

    if rule.condition_type == "bot_error":
        if status is None:
            return False, ""
        if status.error:
            return True, f"error: {status.error}"
        return False, ""

    if rule.condition_type == "bot_stopped":
        if status is None:
            return True, "bot not running"
        return False, ""

    return False, ""


def _recently_triggered(rule_id: str) -> bool:
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=_DEDUP_SECONDS)
    for entry in _triggered_alerts:
        if entry.rule_id == rule_id:
            try:
                if dt.datetime.fromisoformat(entry.triggered_at) > cutoff:
                    return True
            except ValueError:
                pass
    return False


@app.post("/alerts/rules", response_model=AlertRuleOut, status_code=201)
def create_alert_rule(req: CreateAlertRuleRequest) -> AlertRuleOut:
    if req.condition_type not in _ALERT_CONDITION_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown condition_type: {req.condition_type!r}")
    if req.condition_type in _THRESHOLD_REQUIRED and req.threshold is None:
        raise HTTPException(status_code=400, detail="threshold required for this condition_type")
    rule = AlertRuleOut(
        id=str(uuid.uuid4()),
        label=req.label,
        condition_type=req.condition_type,
        bot_id=req.bot_id,
        threshold=req.threshold,
        created_at=dt.datetime.now(dt.timezone.utc).isoformat(),
    )
    _alert_rules[rule.id] = rule
    return rule


@app.get("/alerts/rules", response_model=AlertRulesResponse)
def list_alert_rules() -> AlertRulesResponse:
    return AlertRulesResponse(rules=list(_alert_rules.values()))


@app.delete("/alerts/rules/{rule_id}", status_code=204)
def delete_alert_rule(rule_id: str) -> None:
    if rule_id not in _alert_rules:
        raise HTTPException(status_code=404, detail=f"Alert rule {rule_id!r} not found")
    del _alert_rules[rule_id]


@app.get("/alerts/triggered", response_model=TriggeredAlertsResponse)
def get_triggered_alerts() -> TriggeredAlertsResponse:
    statuses = live_engine.get_all_statuses()
    now_iso = dt.datetime.now(dt.timezone.utc).isoformat()
    for rule in list(_alert_rules.values()):
        triggered, detail = _evaluate_alert_condition(rule, statuses)
        if triggered and not _recently_triggered(rule.id):
            entry = TriggeredAlertOut(
                rule_id=rule.id,
                rule_label=rule.label,
                condition_type=rule.condition_type,
                bot_id=rule.bot_id,
                detail=detail,
                triggered_at=now_iso,
            )
            _triggered_alerts.append(entry)
            if len(_triggered_alerts) > _MAX_TRIGGERED:
                _triggered_alerts.pop(0)
    return TriggeredAlertsResponse(
        triggered=list(reversed(_triggered_alerts))
    )
```

- [ ] **Step 2: Write tests/test_alerts_api.py**

```python
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from api_server.main import app, _alert_rules, _triggered_alerts

client = TestClient(app)


def setup_function():
    _alert_rules.clear()
    _triggered_alerts.clear()


# ── POST /alerts/rules ────────────────────────────────────────

def test_create_rule_price_above_returns_201():
    r = client.post("/alerts/rules", json={
        "label": "AAPL high", "condition_type": "price_above",
        "bot_id": "bot1", "threshold": 200.0,
    })
    assert r.status_code == 201
    body = r.json()
    assert body["label"] == "AAPL high"
    assert body["condition_type"] == "price_above"
    assert body["threshold"] == 200.0
    assert "id" in body
    assert "created_at" in body


def test_create_rule_bot_stopped_no_threshold_ok():
    r = client.post("/alerts/rules", json={
        "label": "bot down", "condition_type": "bot_stopped", "bot_id": "bot1",
    })
    assert r.status_code == 201
    assert r.json()["threshold"] is None


def test_create_rule_unknown_condition_type_returns_400():
    r = client.post("/alerts/rules", json={
        "label": "bad", "condition_type": "unknown_type", "bot_id": "bot1",
    })
    assert r.status_code == 400


def test_create_rule_price_above_missing_threshold_returns_400():
    r = client.post("/alerts/rules", json={
        "label": "no threshold", "condition_type": "price_above", "bot_id": "bot1",
    })
    assert r.status_code == 400


def test_create_rule_pnl_below_missing_threshold_returns_400():
    r = client.post("/alerts/rules", json={
        "label": "pnl check", "condition_type": "pnl_below", "bot_id": "bot1",
    })
    assert r.status_code == 400


# ── GET /alerts/rules ─────────────────────────────────────────

def test_list_rules_empty():
    r = client.get("/alerts/rules")
    assert r.status_code == 200
    assert r.json()["rules"] == []


def test_list_rules_returns_created_rules():
    client.post("/alerts/rules", json={
        "label": "rule A", "condition_type": "bot_error", "bot_id": "bot1",
    })
    client.post("/alerts/rules", json={
        "label": "rule B", "condition_type": "bot_stopped", "bot_id": "bot2",
    })
    r = client.get("/alerts/rules")
    assert r.status_code == 200
    assert len(r.json()["rules"]) == 2


# ── DELETE /alerts/rules/{id} ─────────────────────────────────

def test_delete_rule_returns_204():
    create_r = client.post("/alerts/rules", json={
        "label": "to delete", "condition_type": "bot_stopped", "bot_id": "bot1",
    })
    rule_id = create_r.json()["id"]
    r = client.delete(f"/alerts/rules/{rule_id}")
    assert r.status_code == 204


def test_delete_rule_removes_from_list():
    create_r = client.post("/alerts/rules", json={
        "label": "to delete", "condition_type": "bot_stopped", "bot_id": "bot1",
    })
    rule_id = create_r.json()["id"]
    client.delete(f"/alerts/rules/{rule_id}")
    r = client.get("/alerts/rules")
    assert all(rule["id"] != rule_id for rule in r.json()["rules"])


def test_delete_nonexistent_rule_returns_404():
    r = client.delete("/alerts/rules/does-not-exist")
    assert r.status_code == 404


# ── GET /alerts/triggered ─────────────────────────────────────

def test_triggered_empty_when_no_rules():
    r = client.get("/alerts/triggered")
    assert r.status_code == 200
    assert r.json()["triggered"] == []


def test_triggered_bot_stopped_when_bot_not_in_engine():
    client.post("/alerts/rules", json={
        "label": "bot down", "condition_type": "bot_stopped", "bot_id": "ghost_bot",
    })
    with patch("api_server.main.live_engine") as mock_engine:
        mock_engine.get_all_statuses.return_value = {}
        r = client.get("/alerts/triggered")
    assert r.status_code == 200
    triggered = r.json()["triggered"]
    assert len(triggered) == 1
    assert triggered[0]["condition_type"] == "bot_stopped"
    assert triggered[0]["bot_id"] == "ghost_bot"


def test_triggered_price_above_when_condition_met():
    client.post("/alerts/rules", json={
        "label": "high price", "condition_type": "price_above",
        "bot_id": "bot1", "threshold": 100.0,
    })
    mock_status = MagicMock()
    mock_status.last_price = 150.0
    mock_status.position = "FLAT"
    mock_status.qty = 0.0
    mock_status.entry_price = None
    mock_status.error = None
    with patch("api_server.main.live_engine") as mock_engine:
        mock_engine.get_all_statuses.return_value = {"bot1": mock_status}
        r = client.get("/alerts/triggered")
    assert r.status_code == 200
    triggered = r.json()["triggered"]
    assert len(triggered) == 1
    assert "150" in triggered[0]["detail"]


def test_triggered_no_duplicate_within_dedup_window():
    client.post("/alerts/rules", json={
        "label": "bot down", "condition_type": "bot_stopped", "bot_id": "ghost_bot",
    })
    with patch("api_server.main.live_engine") as mock_engine:
        mock_engine.get_all_statuses.return_value = {}
        client.get("/alerts/triggered")
        r = client.get("/alerts/triggered")
    assert len(r.json()["triggered"]) == 1


def test_triggered_condition_not_met_no_entry():
    client.post("/alerts/rules", json={
        "label": "low price", "condition_type": "price_below",
        "bot_id": "bot1", "threshold": 50.0,
    })
    mock_status = MagicMock()
    mock_status.last_price = 100.0
    mock_status.error = None
    with patch("api_server.main.live_engine") as mock_engine:
        mock_engine.get_all_statuses.return_value = {"bot1": mock_status}
        r = client.get("/alerts/triggered")
    assert r.json()["triggered"] == []
```

- [ ] **Step 3: Run backend tests**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_alerts_api.py -v
```

Expected: 15 tests pass

- [ ] **Step 4: Run full backend suite**

```bash
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/ -q
```

Expected: previous count + 15 new pass; pre-existing failures (test_auth × 3, test_backtest_happy_path) still present

- [ ] **Step 5: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
git add api_server/main.py tests/test_alerts_api.py
git commit -m "feat: add alert rules engine with 4 endpoints (phase 22)"
```

---

## Task 2: Frontend — alert-storage.ts + api.ts additions + Tests

**Files:**
- Create: `seokminal-dashboard/lib/alert-storage.ts`
- Modify: `seokminal-dashboard/lib/api.ts` (append types + 4 functions)
- Create: `seokminal-dashboard/tests/lib/alert-storage.test.ts`

**Interfaces:**
- Consumes: `API_BASE` from `lib/api.ts`
- Produces:
  - `AlertRule`, `TriggeredAlert` types (used by alerts page)
  - `createAlertRule(req, signal?)`, `getAlertRules(signal?)`, `deleteAlertRule(id, signal?)`, `getTriggeredAlerts(signal?)` — all exported from `lib/api.ts`
  - `getCachedTriggered()`, `mergeTriggered(incoming)`, `clearCachedTriggered()` — from `lib/alert-storage.ts`

- [ ] **Step 1: Append types + functions to lib/api.ts**

Read `lib/api.ts` first to find `API_BASE` and the last function, then append:

```typescript
// ── Alert System ──────────────────────────────────────────────

export type AlertConditionType =
  | "price_above"
  | "price_below"
  | "pnl_above"
  | "pnl_below"
  | "bot_error"
  | "bot_stopped";

export interface AlertRule {
  id: string;
  label: string;
  condition_type: AlertConditionType;
  bot_id: string;
  threshold: number | null;
  created_at: string;
}

export interface CreateAlertRuleRequest {
  label: string;
  condition_type: AlertConditionType;
  bot_id: string;
  threshold?: number;
}

export interface AlertRulesResponse {
  rules: AlertRule[];
}

export interface TriggeredAlert {
  rule_id: string;
  rule_label: string;
  condition_type: AlertConditionType;
  bot_id: string;
  detail: string;
  triggered_at: string;
}

export interface TriggeredAlertsResponse {
  triggered: TriggeredAlert[];
}

export async function createAlertRule(
  req: CreateAlertRuleRequest,
  signal?: AbortSignal,
): Promise<AlertRule> {
  const r = await fetch(`${API_BASE}/alerts/rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(err.detail ?? r.statusText);
  }
  return r.json();
}

export async function getAlertRules(signal?: AbortSignal): Promise<AlertRule[]> {
  const r = await fetch(`${API_BASE}/alerts/rules`, { signal });
  if (!r.ok) throw new Error(r.statusText);
  const data: AlertRulesResponse = await r.json();
  return data.rules;
}

export async function deleteAlertRule(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  const r = await fetch(`${API_BASE}/alerts/rules/${id}`, {
    method: "DELETE",
    signal,
  });
  if (!r.ok && r.status !== 204) throw new Error(r.statusText);
}

export async function getTriggeredAlerts(
  signal?: AbortSignal,
): Promise<TriggeredAlert[]> {
  const r = await fetch(`${API_BASE}/alerts/triggered`, { signal });
  if (!r.ok) throw new Error(r.statusText);
  const data: TriggeredAlertsResponse = await r.json();
  return data.triggered;
}
```

- [ ] **Step 2: Create lib/alert-storage.ts**

```typescript
import type { TriggeredAlert } from "./api";

const TRIGGERED_KEY = "seokminal_triggered_alerts";
const MAX_STORED = 100;

export function getCachedTriggered(): TriggeredAlert[] {
  try {
    return JSON.parse(localStorage.getItem(TRIGGERED_KEY) ?? "[]") as TriggeredAlert[];
  } catch {
    return [];
  }
}

export function mergeTriggered(incoming: TriggeredAlert[]): TriggeredAlert[] {
  const existing = getCachedTriggered();
  const seen = new Set(existing.map(e => `${e.rule_id}|${e.triggered_at}`));
  const merged = [...existing];
  for (const item of incoming) {
    const key = `${item.rule_id}|${item.triggered_at}`;
    if (!seen.has(key)) {
      merged.push(item);
      seen.add(key);
    }
  }
  merged.sort((a, b) => b.triggered_at.localeCompare(a.triggered_at));
  const capped = merged.slice(0, MAX_STORED);
  localStorage.setItem(TRIGGERED_KEY, JSON.stringify(capped));
  return capped;
}

export function clearCachedTriggered(): void {
  localStorage.setItem(TRIGGERED_KEY, "[]");
}
```

- [ ] **Step 3: Write tests/lib/alert-storage.test.ts**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { getCachedTriggered, mergeTriggered, clearCachedTriggered } from "../../lib/alert-storage";
import type { TriggeredAlert } from "../../lib/api";

function makeAlert(ruleId: string, ts: string): TriggeredAlert {
  return {
    rule_id: ruleId,
    rule_label: "Test Rule",
    condition_type: "bot_stopped",
    bot_id: "bot1",
    detail: "bot not running",
    triggered_at: ts,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("getCachedTriggered", () => {
  it("returns empty array when nothing cached", () => {
    expect(getCachedTriggered()).toEqual([]);
  });

  it("returns stored triggered alerts", () => {
    const alerts = [makeAlert("r1", "2026-06-29T10:00:00+00:00")];
    localStorage.setItem("seokminal_triggered_alerts", JSON.stringify(alerts));
    expect(getCachedTriggered()).toHaveLength(1);
  });
});

describe("mergeTriggered", () => {
  it("stores incoming alerts", () => {
    const result = mergeTriggered([makeAlert("r1", "2026-06-29T10:00:00+00:00")]);
    expect(result).toHaveLength(1);
    expect(getCachedTriggered()).toHaveLength(1);
  });

  it("deduplicates by rule_id + triggered_at", () => {
    const alert = makeAlert("r1", "2026-06-29T10:00:00+00:00");
    mergeTriggered([alert]);
    const result = mergeTriggered([alert]);
    expect(result).toHaveLength(1);
  });

  it("merges new alerts with existing ones", () => {
    mergeTriggered([makeAlert("r1", "2026-06-29T10:00:00+00:00")]);
    const result = mergeTriggered([makeAlert("r2", "2026-06-29T11:00:00+00:00")]);
    expect(result).toHaveLength(2);
  });

  it("sorts by triggered_at descending", () => {
    const result = mergeTriggered([
      makeAlert("r1", "2026-06-29T09:00:00+00:00"),
      makeAlert("r2", "2026-06-29T11:00:00+00:00"),
      makeAlert("r3", "2026-06-29T10:00:00+00:00"),
    ]);
    expect(result[0].rule_id).toBe("r2");
    expect(result[1].rule_id).toBe("r3");
    expect(result[2].rule_id).toBe("r1");
  });

  it("caps stored alerts at 100", () => {
    const alerts = Array.from({ length: 105 }, (_, i) =>
      makeAlert(`r${i}`, `2026-06-29T${String(i).padStart(2, "0")}:00:00+00:00`),
    );
    const result = mergeTriggered(alerts);
    expect(result).toHaveLength(100);
  });
});

describe("clearCachedTriggered", () => {
  it("removes all cached triggered alerts", () => {
    mergeTriggered([makeAlert("r1", "2026-06-29T10:00:00+00:00")]);
    clearCachedTriggered();
    expect(getCachedTriggered()).toEqual([]);
  });
});
```

- [ ] **Step 4: Run frontend tests**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test -- tests/lib/alert-storage.test.ts
```

Expected: 9 tests pass

- [ ] **Step 5: Run full frontend suite**

```bash
npm test
```

Expected: previous count (147) + 9 new = 156 pass

- [ ] **Step 6: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add lib/alert-storage.ts lib/api.ts tests/lib/alert-storage.test.ts
git commit -m "feat: add alert-storage and api.ts alert functions (phase 22)"
```

---

## Task 3: Frontend — Alerts Page

**Files:**
- Create: `seokminal-dashboard/app/alerts/page.tsx`

**Interfaces:**
- Consumes:
  - `createAlertRule(req, signal)`, `getAlertRules(signal)`, `deleteAlertRule(id, signal)`, `getTriggeredAlerts(signal)` from `lib/api.ts`
  - `AlertRule`, `TriggeredAlert`, `AlertConditionType`, `CreateAlertRuleRequest` from `lib/api.ts`
  - `mergeTriggered`, `getCachedTriggered`, `clearCachedTriggered` from `lib/alert-storage.ts`
- Produces: `/alerts` page route

- [ ] **Step 1: Create app/alerts/page.tsx**

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  AlertRule,
  AlertConditionType,
  TriggeredAlert,
  createAlertRule,
  getAlertRules,
  deleteAlertRule,
  getTriggeredAlerts,
} from "@/lib/api";
import { mergeTriggered, getCachedTriggered, clearCachedTriggered } from "@/lib/alert-storage";

const CONDITION_LABELS: Record<AlertConditionType, string> = {
  price_above: "Price Above",
  price_below: "Price Below",
  pnl_above:   "PnL Above",
  pnl_below:   "PnL Below",
  bot_error:   "Bot Error",
  bot_stopped: "Bot Stopped",
};

const THRESHOLD_REQUIRED: AlertConditionType[] = [
  "price_above", "price_below", "pnl_above", "pnl_below",
];

export default function AlertsPage() {
  const [rules, setRules]           = useState<AlertRule[]>([]);
  const [triggered, setTriggered]   = useState<TriggeredAlert[]>([]);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [trigError, setTrigError]   = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);

  const [label, setLabel]                     = useState("");
  const [conditionType, setConditionType]     = useState<AlertConditionType>("price_above");
  const [botId, setBotId]                     = useState("");
  const [threshold, setThreshold]             = useState("");
  const [createError, setCreateError]         = useState<string | null>(null);
  const [creating, setCreating]               = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const loadRules = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const data = await getAlertRules(ctrl.signal);
      setRules(data);
      setRulesError(null);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setRulesError(e instanceof Error ? e.message : "Failed to load rules");
    }
  }, []);

  const loadTriggered = useCallback(async () => {
    try {
      const fresh = await getTriggeredAlerts();
      const merged = mergeTriggered(fresh);
      setTriggered(merged);
      setTrigError(null);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setTrigError(e instanceof Error ? e.message : "Failed to load triggered alerts");
      setTriggered(getCachedTriggered());
    }
  }, []);

  useEffect(() => {
    loadRules();
    loadTriggered();
    return () => { abortRef.current?.abort(); };
  }, [loadRules, loadTriggered]);

  const handleCreate = async () => {
    if (!label.trim() || !botId.trim()) {
      setCreateError("Label and Bot ID are required");
      return;
    }
    const needsThreshold = THRESHOLD_REQUIRED.includes(conditionType);
    if (needsThreshold && !threshold) {
      setCreateError("Threshold is required for this condition type");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await createAlertRule({
        label: label.trim(),
        condition_type: conditionType,
        bot_id: botId.trim(),
        threshold: needsThreshold ? parseFloat(threshold) : undefined,
      });
      setLabel("");
      setBotId("");
      setThreshold("");
      await loadRules();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAlertRule(id);
      setRules(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      setRulesError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleClearTriggered = () => {
    clearCachedTriggered();
    setTriggered([]);
  };

  const needsThreshold = THRESHOLD_REQUIRED.includes(conditionType);

  return (
    <div className="min-h-screen bg-bg p-6">
      <h1 className="text-text-1 text-2xl font-semibold mb-6">Alerts</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Rules Panel ── */}
        <div className="bg-panel border border-border rounded-lg p-4 flex flex-col gap-4">
          <h2 className="text-text-1 font-medium">Alert Rules</h2>

          {/* Create form */}
          <div className="bg-panel-2 rounded-md p-3 flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-text-3 text-xs">Label</label>
              <input
                className="bg-bg border border-border rounded px-2 py-1 text-text-1 text-sm"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="My alert"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-text-3 text-xs">Condition</label>
              <select
                className="bg-bg border border-border rounded px-2 py-1 text-text-1 text-sm"
                value={conditionType}
                onChange={e => setConditionType(e.target.value as AlertConditionType)}
              >
                {(Object.keys(CONDITION_LABELS) as AlertConditionType[]).map(ct => (
                  <option key={ct} value={ct}>{CONDITION_LABELS[ct]}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-text-3 text-xs">Bot ID</label>
                <input
                  className="bg-bg border border-border rounded px-2 py-1 text-text-1 text-sm"
                  value={botId}
                  onChange={e => setBotId(e.target.value)}
                  placeholder="bot_id"
                />
              </div>
              {needsThreshold && (
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-text-3 text-xs">Threshold</label>
                  <input
                    type="number"
                    className="bg-bg border border-border rounded px-2 py-1 text-text-1 text-sm font-data"
                    value={threshold}
                    onChange={e => setThreshold(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>
            {createError && <p className="text-neg text-xs">{createError}</p>}
            <button
              onClick={handleCreate}
              disabled={creating}
              className="bg-accent text-black rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 self-start"
            >
              {creating ? "Creating…" : "Create Rule"}
            </button>
          </div>

          {/* Rules list */}
          {rulesError && <p className="text-neg text-sm">{rulesError}</p>}
          {rules.length === 0 ? (
            <p className="text-text-3 text-sm">No alert rules yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {rules.map(rule => (
                <div
                  key={rule.id}
                  className="bg-panel-2 border border-border rounded-md p-3 flex items-start justify-between gap-2"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-text-1 text-sm font-medium truncate">{rule.label}</span>
                    <span className="text-text-3 text-xs">
                      {CONDITION_LABELS[rule.condition_type as AlertConditionType]} · bot: {rule.bot_id}
                      {rule.threshold !== null && ` · ${rule.threshold}`}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="text-neg text-xs border border-neg rounded px-2 py-0.5 shrink-0"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Triggered Panel ── */}
        <div className="bg-panel border border-border rounded-lg p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-text-1 font-medium">Triggered Alerts</h2>
            <div className="flex gap-2">
              <button
                onClick={loadTriggered}
                disabled={loading}
                className="text-accent text-xs border border-accent rounded px-2 py-0.5"
              >
                Refresh
              </button>
              <button
                onClick={handleClearTriggered}
                className="text-text-3 text-xs border border-border rounded px-2 py-0.5"
              >
                Clear
              </button>
            </div>
          </div>

          {trigError && <p className="text-warn text-xs">{trigError} (showing cached)</p>}
          {triggered.length === 0 ? (
            <p className="text-text-3 text-sm">No triggered alerts.</p>
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[60vh]">
              {triggered.map((t, i) => (
                <div
                  key={`${t.rule_id}-${t.triggered_at}-${i}`}
                  className="bg-panel-2 border border-border rounded-md p-3 flex flex-col gap-0.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-warn text-sm font-medium truncate">{t.rule_label}</span>
                    <span className="text-text-3 text-xs shrink-0">
                      {new Date(t.triggered_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <span className="text-text-2 text-xs">
                    {CONDITION_LABELS[t.condition_type as AlertConditionType]} · bot: {t.bot_id}
                  </span>
                  {t.detail && (
                    <span className="text-text-3 text-xs font-data">{t.detail}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add app/alerts/page.tsx
git commit -m "feat: add alerts page with rule CRUD and triggered feed (phase 22)"
```

---

## Task 4: NavBar — Add Alerts to Live Group

**Files:**
- Modify: `seokminal-dashboard/components/NavBar.tsx`

**Interfaces:**
- Consumes: existing `NAV_GROUPS` array
- Produces: `/alerts` nav link in Live group (after Orders, before AI Trader)

- [ ] **Step 1: Add Alerts entry to Live group**

In `components/NavBar.tsx`, find the Live group items array:

```typescript
    items: [
      { href: "/spawner",   label: "Spawner" },
      { href: "/bots",      label: "Bots" },
      { href: "/orders",    label: "Orders" },
      { href: "/ai-trader", label: "AI Trader" },
    ],
```

Change to:

```typescript
    items: [
      { href: "/spawner",   label: "Spawner" },
      { href: "/bots",      label: "Bots" },
      { href: "/orders",    label: "Orders" },
      { href: "/alerts",    label: "Alerts" },
      { href: "/ai-trader", label: "AI Trader" },
    ],
```

- [ ] **Step 2: Run full test suite**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test
```

Expected: 156/156 pass (147 previous + 9 from Task 2)

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add components/NavBar.tsx
git commit -m "feat: add Alerts nav link to Live group (phase 22)"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] `POST /alerts/rules` — Task 1
- [x] `GET /alerts/triggered` — Task 1
- [x] `DELETE /alerts/rules/{id}` — Task 1
- [x] `GET /alerts/rules` — Task 1 (required for UI; implied by spec)
- [x] `lib/alert-storage.ts` — Task 2
- [x] `/alerts` page — Task 3
- [x] NavBar: Alerts in Live group — Task 4

**Placeholder scan:** None. All steps contain complete code.

**Type consistency:**
- `AlertConditionType` defined in `lib/api.ts`, imported in `lib/alert-storage.ts` and `app/alerts/page.tsx` ✓
- `TriggeredAlert` defined in `lib/api.ts`, used in `mergeTriggered()` parameter + return ✓
- `AlertRule` defined in `lib/api.ts`, returned by `getAlertRules()`, used in rules state ✓
- Backend `AlertRuleOut.condition_type: str` matches frontend `AlertConditionType` (string union) ✓
- `_compute_unrealized_pnl(position, qty, last_price, entry_price)` signature matches existing usage ✓
