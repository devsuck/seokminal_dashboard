# Phase 19: Strategy Spawner UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two backend endpoints for spawn-rule validation and historical evaluation, a localStorage-backed spawner storage module, and a full `/spawner` page where users can build condition rules visually, save/load them, and evaluate them against catalog data.

**Architecture:** The backend exposes `GET /spawner/validate` (pure JSON parsing via `ConditionParser`) and `POST /spawner/evaluate` (runs `ConditionEvaluator` against `ParquetDataCatalog` bars). The frontend has a `lib/spawner-storage.ts` module for localStorage CRUD, `lib/api.ts` additions for the two endpoints, and `app/spawner/page.tsx` — a two-column page with a visual condition builder on the left and saved-rules/evaluate panel on the right.

**Tech Stack:** Python/FastAPI (backend), Next.js 16 / React 19 / TypeScript / TailwindCSS 4 (frontend), vitest (frontend tests)

## Global Constraints

- Python: `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`
- `asyncio_mode = "auto"` in `pyproject.toml` — never use `@pytest.mark.asyncio`
- Backend test command (run from `seokminal-multi-venue/`): `pytest tests/test_api_server.py tests/test_spawner_condition_api.py -v`
- Frontend test command (run from `seokminal-dashboard/`): `npm test`
- Frontend tsc check: `npx tsc --noEmit`
- Design tokens only — no hex colors in `className`. `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1/2/3`, `text-accent`, `text-pos`, `text-neg`. Hex in JS config objects (lw-charts, D3) is OK.
- No `style={{}}` except chart lib config and `style={{ height: "Npx" }}` on chart container divs.
- No raw `fetch` in page files — all API calls via `lib/api.ts` functions.
- `AbortController` pattern: abort prev → new ctrl → assign ref → fetch → catch AbortError silently → finally guard `abortRef.current === ctrl` → unmount cleanup `useEffect(() => () => { abortRef.current?.abort(); }, [])`.
- `bg-accent text-black` only for primary action buttons (Validate, Save, Run).
- Active/selected items: `border-accent text-accent bg-accent/10`.
- NavBar: add `{ href: "/spawner", label: "Spawner" }` to the **Live** group (`NAV_GROUPS`, inside `{ label: "Live", items: [...] }`), before `{ href: "/bots", label: "Bots" }`.
- Spawner backends live in `seokminal-multi-venue/`; frontend in `seokminal-dashboard/`.
- No `strategy` key required in spawn_rules JSON for validate/evaluate (only `condition` is parsed).

---

## Task 1: Backend — Spawn Validate + Evaluate Endpoints

**Repos:** `seokminal-multi-venue/`

**Files:**
- Modify: `api_server/main.py` — add imports + 5 Pydantic models + 2 endpoints (~85 lines)
- Create: `tests/test_spawner_condition_api.py` — 10 tests

**Interfaces:**
- Produces: `GET /spawner/validate?spawn_rules=<url-encoded JSON>` → `SpawnValidateResponse`
- Produces: `POST /spawner/evaluate` body `SpawnEvaluateRequest` → `SpawnEvaluateResponse`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_spawner_condition_api.py`:

```python
import json
import pytest
from fastapi.testclient import TestClient
from api_server.main import app

client = TestClient(app)

# ── /spawner/validate ──────────────────────────────────────────────────────────

def test_validate_valid_rule_returns_true():
    rules = [
        {
            "condition": {
                "combinator": "AND",
                "conditions": [
                    {
                        "left": {
                            "indicator": "RSI",
                            "bar_type": "AAPL.NASDAQ-1-DAY-LAST-EXTERNAL",
                            "params": {"period": 14},
                        },
                        "op": "<",
                        "right": {"value": 30},
                    }
                ],
            }
        }
    ]
    r = client.get("/spawner/validate", params={"spawn_rules": json.dumps(rules)})
    assert r.status_code == 200
    body = r.json()
    assert body["valid"] is True
    assert body["errors"] == []
    assert len(body["rules"]) == 1
    info = body["rules"][0]
    assert info["rule_index"] == 0
    assert info["combinator"] == "AND"
    assert info["condition_count"] == 1
    assert "RSI" in info["indicators"]


def test_validate_invalid_json_returns_422():
    r = client.get("/spawner/validate", params={"spawn_rules": "not json"})
    assert r.status_code == 422


def test_validate_unknown_indicator_returns_errors():
    rules = [
        {
            "condition": {
                "combinator": "AND",
                "conditions": [
                    {
                        "left": {"indicator": "NOPE", "bar_type": "AAPL.NASDAQ-1-DAY-LAST-EXTERNAL", "params": {}},
                        "op": "<",
                        "right": {"value": 30},
                    }
                ],
            }
        }
    ]
    r = client.get("/spawner/validate", params={"spawn_rules": json.dumps(rules)})
    assert r.status_code == 200
    body = r.json()
    assert body["valid"] is False
    assert len(body["errors"]) == 1
    assert body["errors"][0]["rule_index"] == 0


def test_validate_missing_rsi_period_returns_errors():
    rules = [
        {
            "condition": {
                "combinator": "AND",
                "conditions": [
                    {
                        "left": {"indicator": "RSI", "bar_type": "AAPL.NASDAQ-1-DAY-LAST-EXTERNAL", "params": {}},
                        "op": "<",
                        "right": {"value": 30},
                    }
                ],
            }
        }
    ]
    r = client.get("/spawner/validate", params={"spawn_rules": json.dumps(rules)})
    assert r.status_code == 200
    body = r.json()
    assert body["valid"] is False
    assert body["errors"][0]["rule_index"] == 0


def test_validate_empty_rules_returns_valid():
    r = client.get("/spawner/validate", params={"spawn_rules": json.dumps([])})
    assert r.status_code == 200
    body = r.json()
    assert body["valid"] is True
    assert body["rules"] == []
    assert body["errors"] == []


# ── /spawner/evaluate ─────────────────────────────────────────────────────────

def _never_true_rules():
    return [
        {
            "condition": {
                "combinator": "AND",
                "conditions": [
                    {"left": {"value": 1}, "op": ">", "right": {"value": 2}}
                ],
            }
        }
    ]


def test_evaluate_returns_response_structure():
    r = client.post(
        "/spawner/evaluate",
        json={
            "spawn_rules": _never_true_rules(),
            "instrument_id": "AAPL.NASDAQ",
            "start": "2024-01-01",
            "end": "2026-12-31",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert set(body.keys()) == {"instrument_id", "start", "end", "bar_count", "trigger_events"}
    assert body["instrument_id"] == "AAPL.NASDAQ"
    assert body["bar_count"] > 0


def test_evaluate_never_true_condition_returns_empty_triggers():
    r = client.post(
        "/spawner/evaluate",
        json={
            "spawn_rules": _never_true_rules(),
            "instrument_id": "AAPL.NASDAQ",
            "start": "2024-01-01",
            "end": "2026-12-31",
        },
    )
    assert r.status_code == 200
    assert r.json()["trigger_events"] == []


def test_evaluate_unknown_instrument_returns_400():
    r = client.post(
        "/spawner/evaluate",
        json={
            "spawn_rules": _never_true_rules(),
            "instrument_id": "NOPE.NASDAQ",
            "start": "2024-01-01",
            "end": "2026-12-31",
        },
    )
    assert r.status_code == 400


def test_evaluate_invalid_condition_returns_422():
    r = client.post(
        "/spawner/evaluate",
        json={
            "spawn_rules": [{"condition": {"combinator": "BAD", "conditions": []}}],
            "instrument_id": "AAPL.NASDAQ",
            "start": "2024-01-01",
            "end": "2026-12-31",
        },
    )
    assert r.status_code == 422


def test_evaluate_trigger_date_format():
    """RSI < 100 (always true once initialized) should produce a trigger event with YYYY-MM-DD date."""
    rules = [
        {
            "condition": {
                "combinator": "AND",
                "conditions": [
                    {
                        "left": {
                            "indicator": "RSI",
                            "bar_type": "AAPL.NASDAQ-1-DAY-LAST-EXTERNAL",
                            "params": {"period": 2},
                        },
                        "op": "<",
                        "right": {"value": 100},
                    }
                ],
            }
        }
    ]
    r = client.post(
        "/spawner/evaluate",
        json={
            "spawn_rules": rules,
            "instrument_id": "AAPL.NASDAQ",
            "start": "2024-01-01",
            "end": "2026-12-31",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["trigger_events"]) == 1
    ev = body["trigger_events"][0]
    assert ev["rule_index"] == 0
    # Date must be YYYY-MM-DD
    import re
    assert re.match(r"^\d{4}-\d{2}-\d{2}$", ev["trigger_date"])
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_spawner_condition_api.py -v 2>&1 | tail -15
```
Expected: all 10 tests fail with 404 or import errors.

- [ ] **Step 3: Add imports to `api_server/main.py`**

After the existing imports block (after line `from kr_universe.client import ...`), add:

```python
from condition_engine.parser import ConditionParser
from condition_engine.evaluator import ConditionEvaluator
from condition_engine.indicator_registry import IndicatorRegistry
```

- [ ] **Step 4: Add Pydantic models to `api_server/main.py`**

Append after the existing models (after all existing `class ... BaseModel` definitions, before the first `@app.get`). In practice, append near the end of the file, after the `KISWebSocketClient` import block:

```python
# ── Spawner ───────────────────────────────────────────────────────────────────

class ConditionInfo(BaseModel):
    rule_index: int
    combinator: str
    condition_count: int
    indicators: list[str]


class SpawnValidationError(BaseModel):
    rule_index: int
    error: str


class SpawnValidateResponse(BaseModel):
    valid: bool
    errors: list[SpawnValidationError]
    rules: list[ConditionInfo]


class TriggerEvent(BaseModel):
    rule_index: int
    trigger_date: str  # YYYY-MM-DD


class SpawnEvaluateRequest(BaseModel):
    spawn_rules: list[dict]
    instrument_id: str
    start: str  # YYYY-MM-DD
    end: str    # YYYY-MM-DD


class SpawnEvaluateResponse(BaseModel):
    instrument_id: str
    start: str
    end: str
    bar_count: int
    trigger_events: list[TriggerEvent]
```

- [ ] **Step 5: Add `GET /spawner/validate` endpoint**

```python
@app.get("/spawner/validate", response_model=SpawnValidateResponse)
def validate_spawn_rules(
    spawn_rules: str = Query(..., description="URL-encoded JSON array of spawn rules"),
) -> SpawnValidateResponse:
    try:
        rules_json: list[dict] = json.loads(spawn_rules)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"invalid JSON: {exc}") from exc

    if not isinstance(rules_json, list):
        raise HTTPException(status_code=422, detail="spawn_rules must be a JSON array")

    errors: list[SpawnValidationError] = []
    infos: list[ConditionInfo] = []

    for i, rule in enumerate(rules_json):
        try:
            condition_dict = rule.get("condition", {})
            condition_set = ConditionParser.parse(condition_dict)
            indicators = sorted({
                c.left.indicator
                for c in condition_set.comparisons
                if hasattr(c.left, "indicator")
            } | {
                c.right.indicator
                for c in condition_set.comparisons
                if hasattr(c.right, "indicator")
            })
            infos.append(
                ConditionInfo(
                    rule_index=i,
                    combinator=condition_set.combinator,
                    condition_count=len(condition_set.comparisons),
                    indicators=indicators,
                )
            )
        except (ValueError, KeyError) as exc:
            errors.append(SpawnValidationError(rule_index=i, error=str(exc)))

    return SpawnValidateResponse(valid=not errors, errors=errors, rules=infos)
```

- [ ] **Step 6: Add `POST /spawner/evaluate` endpoint**

```python
@app.post("/spawner/evaluate", response_model=SpawnEvaluateResponse)
def evaluate_spawn_rules(req: SpawnEvaluateRequest) -> SpawnEvaluateResponse:
    # Parse all conditions first (fail fast on invalid rules)
    condition_sets = []
    for i, rule in enumerate(req.spawn_rules):
        try:
            condition_sets.append(ConditionParser.parse(rule.get("condition", {})))
        except (ValueError, KeyError) as exc:
            raise HTTPException(status_code=422, detail=f"rule {i}: {exc}") from exc

    # Fetch bars from catalog
    try:
        instrument_id = InstrumentId.from_str(req.instrument_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"invalid instrument_id: {exc}") from exc

    start_ns = date_to_ns(req.start)
    end_ns = date_to_ns(req.end)

    catalog = ParquetDataCatalog(CATALOG_PATH)
    bar_type_str = str(bar_type_for(instrument_id))
    all_bars = catalog.bars(bar_types=[bar_type_str])
    bars = [b for b in all_bars if start_ns <= b.ts_event <= end_ns]

    if not bars:
        raise HTTPException(
            status_code=400,
            detail=f"no bars found for {req.instrument_id!r} in [{req.start}, {req.end}]",
        )

    # Build one evaluator per rule
    evaluators = [
        {
            "rule_index": i,
            "evaluator": ConditionEvaluator(cs, IndicatorRegistry()),
            "triggered": False,
        }
        for i, cs in enumerate(condition_sets)
    ]

    trigger_events: list[TriggerEvent] = []
    for bar in bars:
        for entry in evaluators:
            if entry["triggered"]:
                continue
            entry["evaluator"].on_bar(bar)
            if entry["evaluator"].evaluate():
                entry["triggered"] = True
                trigger_date = dt.datetime.fromtimestamp(
                    bar.ts_event / 1e9, tz=dt.timezone.utc
                ).strftime("%Y-%m-%d")
                trigger_events.append(
                    TriggerEvent(rule_index=entry["rule_index"], trigger_date=trigger_date)
                )

    return SpawnEvaluateResponse(
        instrument_id=req.instrument_id,
        start=req.start,
        end=req.end,
        bar_count=len(bars),
        trigger_events=trigger_events,
    )
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_spawner_condition_api.py -v 2>&1 | tail -15
```
Expected: 10/10 passed.

Also run full suite to catch regressions:
```bash
pytest tests/ -q 2>&1 | tail -5
```
Expected: 1 pre-existing failure (`test_backtest_happy_path_returns_all_metric_keys`), all others pass.

- [ ] **Step 8: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
git add api_server/main.py tests/test_spawner_condition_api.py
git commit -m "feat(api): add /spawner/validate and /spawner/evaluate endpoints"
```

---

## Task 2: Frontend — Spawner Storage + API Types + Page + NavBar

**Repos:** `seokminal-dashboard/`

**Files:**
- Create: `lib/spawner-storage.ts` — localStorage CRUD for saved spawn rules
- Create: `tests/lib/spawner-storage.test.ts` — 7 tests
- Modify: `lib/api.ts` — append 6 types + 2 functions
- Create: `app/spawner/page.tsx` — full spawner UI (~340 lines)
- Modify: `components/NavBar.tsx` — add Spawner to Live group
- Modify: `docs/progress.md` — prepend Phase 19 section
- Modify: `docs/roadmap.md` — update HEAD + Phase 19 commit range

**Interfaces:**
- Consumes (from Task 1):
  - `GET /spawner/validate?spawn_rules=<json>` → `SpawnValidateResponse`
  - `POST /spawner/evaluate` body → `SpawnEvaluateResponse`
- Produces (for NavBar): `{ href: "/spawner", label: "Spawner" }` in Live group

---

### Subtask A: `lib/spawner-storage.ts` + tests

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/spawner-storage.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { listSavedRules, saveRule, deleteRule, type SavedSpawnRule } from "@/lib/spawner-storage";

beforeEach(() => {
  localStorage.clear();
});

describe("listSavedRules", () => {
  it("returns [] when storage is empty", () => {
    expect(listSavedRules()).toEqual([]);
  });

  it("returns [] when storage contains invalid JSON", () => {
    localStorage.setItem("nautilus_spawn_rules", "not-json");
    expect(listSavedRules()).toEqual([]);
  });
});

describe("saveRule", () => {
  it("appends a new rule and returns updated list", () => {
    const result = saveRule("Rule A", "[{}]");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Rule A");
    expect(result[0].json).toBe("[{}]");
    expect(result[0].savedAt).toBeTruthy();
  });

  it("replaces existing rule with same name", () => {
    saveRule("Rule A", "[{}]");
    const result = saveRule("Rule A", "[{updated: true}]");
    expect(result).toHaveLength(1);
    expect(result[0].json).toBe("[{updated: true}]");
  });

  it("persists rules across listSavedRules calls", () => {
    saveRule("Rule A", "[{}]");
    saveRule("Rule B", "[{}]");
    expect(listSavedRules()).toHaveLength(2);
  });
});

describe("deleteRule", () => {
  it("removes a rule by name", () => {
    saveRule("Rule A", "[{}]");
    saveRule("Rule B", "[{}]");
    const result = deleteRule("Rule A");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Rule B");
  });

  it("is a no-op when name not found", () => {
    saveRule("Rule A", "[{}]");
    const result = deleteRule("Rule X");
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test -- --reporter=verbose tests/lib/spawner-storage.test.ts 2>&1 | tail -15
```
Expected: errors about missing module.

- [ ] **Step 3: Create `lib/spawner-storage.ts`**

```typescript
export interface SavedSpawnRule {
  name: string;
  json: string;
  savedAt: string;
}

const STORAGE_KEY = "nautilus_spawn_rules";

export function listSavedRules(): SavedSpawnRule[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as SavedSpawnRule[];
  } catch {
    return [];
  }
}

export function saveRule(name: string, json: string): SavedSpawnRule[] {
  const rules = listSavedRules();
  const idx = rules.findIndex(r => r.name === name);
  const entry: SavedSpawnRule = { name, json, savedAt: new Date().toISOString() };
  if (idx >= 0) {
    rules[idx] = entry;
  } else {
    rules.push(entry);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  return rules;
}

export function deleteRule(name: string): SavedSpawnRule[] {
  const rules = listSavedRules().filter(r => r.name !== name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  return rules;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test -- --reporter=verbose tests/lib/spawner-storage.test.ts 2>&1 | tail -10
```
Expected: 7/7 passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add lib/spawner-storage.ts tests/lib/spawner-storage.test.ts
git commit -m "feat(spawner): spawner-storage localStorage CRUD + 7 tests"
```

---

### Subtask B: `lib/api.ts` additions

- [ ] **Step 6: Append types and functions to `lib/api.ts`**

Append at the very end of `lib/api.ts`:

```typescript
// ── Spawner ───────────────────────────────────────────────────────────────────

export interface ConditionInfo {
  rule_index: number;
  combinator: string;
  condition_count: number;
  indicators: string[];
}

export interface SpawnValidationError {
  rule_index: number;
  error: string;
}

export interface SpawnValidateResponse {
  valid: boolean;
  errors: SpawnValidationError[];
  rules: ConditionInfo[];
}

export interface TriggerEvent {
  rule_index: number;
  trigger_date: string;
}

export interface SpawnEvaluateRequest {
  spawn_rules: object[];
  instrument_id: string;
  start: string;
  end: string;
}

export interface SpawnEvaluateResponse {
  instrument_id: string;
  start: string;
  end: string;
  bar_count: number;
  trigger_events: TriggerEvent[];
}

export async function validateSpawnRules(
  spawnRulesJson: string,
  signal?: AbortSignal,
): Promise<SpawnValidateResponse> {
  const r = await fetch(
    `${API_URL}/spawner/validate?spawn_rules=${encodeURIComponent(spawnRulesJson)}`,
    { signal },
  );
  return handleResponse<SpawnValidateResponse>(r);
}

export async function evaluateSpawnRules(
  req: SpawnEvaluateRequest,
  signal?: AbortSignal,
): Promise<SpawnEvaluateResponse> {
  const r = await fetch(`${API_URL}/spawner/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  return handleResponse<SpawnEvaluateResponse>(r);
}
```

- [ ] **Step 7: Verify tsc passes**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npx tsc --noEmit 2>&1 | head -10
```
Expected: 0 errors.

---

### Subtask C: `app/spawner/page.tsx`

- [ ] **Step 8: Create `app/spawner/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  validateSpawnRules,
  evaluateSpawnRules,
  type SpawnValidateResponse,
  type SpawnEvaluateResponse,
} from "@/lib/api";
import {
  listSavedRules,
  saveRule,
  deleteRule,
  type SavedSpawnRule,
} from "@/lib/spawner-storage";

// ── Types ─────────────────────────────────────────────────────────────────────

type OperandType = "literal" | "indicator";
type IndicatorType = "RSI" | "MA" | "BB" | "MACD" | "CCI" | "OBV";
type OpType = "<" | "<=" | ">" | ">=" | "==";
type Combinator = "AND" | "OR";

interface IndicatorParams {
  period: string;
  ma_type: string;
  fast_period: string;
  slow_period: string;
  k: string;
  band: string;
}

interface OperandForm {
  opType: OperandType;
  value: string;
  indicator: IndicatorType;
  barType: string;
  params: IndicatorParams;
}

interface ConditionRow {
  id: number;
  left: OperandForm;
  op: OpType;
  right: OperandForm;
}

interface RuleForm {
  combinator: Combinator;
  conditions: ConditionRow[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INDICATORS: IndicatorType[] = ["RSI", "MA", "BB", "MACD", "CCI", "OBV"];
const MA_TYPES = ["SIMPLE", "EXPONENTIAL", "WILDER", "HULL"];
const OPS: OpType[] = ["<", "<=", ">", ">=", "=="];

const DEFAULT_PARAMS: IndicatorParams = {
  period: "14",
  ma_type: "SIMPLE",
  fast_period: "12",
  slow_period: "26",
  k: "2",
  band: "upper",
};

const DEFAULT_BAR_TYPE = "AAPL.NASDAQ-1-DAY-LAST-EXTERNAL";

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultOperand(): OperandForm {
  return {
    opType: "indicator",
    value: "30",
    indicator: "RSI",
    barType: DEFAULT_BAR_TYPE,
    params: { ...DEFAULT_PARAMS },
  };
}

let _nextId = 1;
function nextId() { return _nextId++; }

function defaultCondition(): ConditionRow {
  return {
    id: nextId(),
    left: defaultOperand(),
    op: "<",
    right: { ...defaultOperand(), opType: "literal", value: "30" },
  };
}

function defaultRule(): RuleForm {
  return { combinator: "AND", conditions: [defaultCondition()] };
}

function operandToJson(op: OperandForm): object {
  if (op.opType === "literal") return { value: parseFloat(op.value) || 0 };
  const params: Record<string, string | number> = {};
  if (["RSI", "MA", "BB", "CCI"].includes(op.indicator)) {
    params.period = parseInt(op.params.period) || 14;
  }
  if (op.indicator === "MA") params.ma_type = op.params.ma_type;
  if (op.indicator === "BB") {
    params.k = parseFloat(op.params.k) || 2;
    params.band = op.params.band;
  }
  if (op.indicator === "MACD") {
    params.fast_period = parseInt(op.params.fast_period) || 12;
    params.slow_period = parseInt(op.params.slow_period) || 26;
  }
  return { indicator: op.indicator, bar_type: op.barType, params };
}

function ruleFormToJson(rule: RuleForm): object {
  return {
    condition: {
      combinator: rule.combinator,
      conditions: rule.conditions.map(c => ({
        left: operandToJson(c.left),
        op: c.op,
        right: operandToJson(c.right),
      })),
    },
    strategy: { class: "backtest_runner.ema_cross_flat:EMACrossFlat", params: {} },
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function IndicatorParamsEditor({
  indicator,
  params,
  onChange,
}: {
  indicator: IndicatorType;
  params: IndicatorParams;
  onChange: (p: IndicatorParams) => void;
}) {
  function numInput(key: keyof IndicatorParams, placeholder: string) {
    return (
      <input
        key={key}
        type="number"
        className="border border-border bg-panel text-text-1 rounded px-2 py-1 text-xs w-20"
        placeholder={placeholder}
        value={params[key]}
        onChange={e => onChange({ ...params, [key]: e.target.value })}
      />
    );
  }
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {(indicator === "RSI" || indicator === "MA" || indicator === "BB" || indicator === "CCI") &&
        numInput("period", "period")}
      {indicator === "MA" && (
        <select
          className="border border-border bg-panel text-text-1 rounded px-2 py-1 text-xs"
          value={params.ma_type}
          onChange={e => onChange({ ...params, ma_type: e.target.value })}
        >
          {MA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      )}
      {indicator === "BB" && (
        <>
          {numInput("k", "k")}
          <select
            className="border border-border bg-panel text-text-1 rounded px-2 py-1 text-xs"
            value={params.band}
            onChange={e => onChange({ ...params, band: e.target.value })}
          >
            <option value="upper">upper</option>
            <option value="middle">middle</option>
            <option value="lower">lower</option>
          </select>
        </>
      )}
      {indicator === "MACD" && (
        <>
          {numInput("fast_period", "fast")}
          {numInput("slow_period", "slow")}
        </>
      )}
    </div>
  );
}

function OperandEditor({
  value,
  onChange,
}: {
  value: OperandForm;
  onChange: (v: OperandForm) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <select
        className="border border-border bg-panel text-text-1 rounded px-2 py-1 text-sm"
        value={value.opType}
        onChange={e => onChange({ ...value, opType: e.target.value as OperandType })}
      >
        <option value="indicator">Indicator</option>
        <option value="literal">Literal</option>
      </select>
      {value.opType === "literal" ? (
        <input
          type="number"
          className="border border-border bg-panel text-text-1 rounded px-2 py-1 text-sm w-28"
          placeholder="value"
          value={value.value}
          onChange={e => onChange({ ...value, value: e.target.value })}
        />
      ) : (
        <>
          <select
            className="border border-border bg-panel text-text-1 rounded px-2 py-1 text-sm"
            value={value.indicator}
            onChange={e =>
              onChange({ ...value, indicator: e.target.value as IndicatorType, params: { ...DEFAULT_PARAMS } })
            }
          >
            {INDICATORS.map(ind => <option key={ind} value={ind}>{ind}</option>)}
          </select>
          <input
            className="border border-border bg-panel text-text-1 rounded px-2 py-1 text-xs"
            placeholder="bar_type e.g. AAPL.NASDAQ-1-DAY-LAST-EXTERNAL"
            value={value.barType}
            onChange={e => onChange({ ...value, barType: e.target.value })}
          />
          <IndicatorParamsEditor
            indicator={value.indicator}
            params={value.params}
            onChange={params => onChange({ ...value, params })}
          />
        </>
      )}
    </div>
  );
}

function ConditionRowEditor({
  condition,
  onChange,
  onRemove,
}: {
  condition: ConditionRow;
  onChange: (c: ConditionRow) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-start p-3 bg-panel-2 rounded border border-border">
      <div>
        <p className="text-xs text-text-3 mb-1">Left</p>
        <OperandEditor
          value={condition.left}
          onChange={left => onChange({ ...condition, left })}
        />
      </div>
      <div className="flex flex-col items-center pt-6">
        <select
          className="border border-border bg-panel text-text-1 rounded px-2 py-1 text-sm"
          value={condition.op}
          onChange={e => onChange({ ...condition, op: e.target.value as OpType })}
        >
          {OPS.map(op => <option key={op} value={op}>{op}</option>)}
        </select>
      </div>
      <div>
        <p className="text-xs text-text-3 mb-1">Right</p>
        <OperandEditor
          value={condition.right}
          onChange={right => onChange({ ...condition, right })}
        />
      </div>
      <button
        className="text-neg text-lg leading-none mt-6 px-1"
        onClick={onRemove}
        aria-label="Remove condition"
      >
        ✕
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SpawnerPage() {
  const [rule, setRule] = useState<RuleForm>(defaultRule);
  const [validateResult, setValidateResult] = useState<SpawnValidateResponse | null>(null);
  const [validateError, setValidateError] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [savedRules, setSavedRules] = useState<SavedSpawnRule[]>([]);
  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  const [instrument, setInstrument] = useState("AAPL.NASDAQ");
  const [start, setStart] = useState("2024-01-01");
  const [end, setEnd] = useState("2026-06-28");
  const [evalResult, setEvalResult] = useState<SpawnEvaluateResponse | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSavedRules(listSavedRules());
  }, []);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const rulesJson = JSON.stringify([ruleFormToJson(rule)], null, 2);

  function addCondition() {
    setRule(r => ({ ...r, conditions: [...r.conditions, defaultCondition()] }));
  }

  function removeCondition(id: number) {
    setRule(r => ({ ...r, conditions: r.conditions.filter(c => c.id !== id) }));
  }

  function updateCondition(id: number, updated: ConditionRow) {
    setRule(r => ({
      ...r,
      conditions: r.conditions.map(c => (c.id === id ? updated : c)),
    }));
  }

  async function handleValidate() {
    setValidateResult(null);
    setValidateError(null);
    try {
      const result = await validateSpawnRules(rulesJson);
      setValidateResult(result);
    } catch (e) {
      setValidateError(e instanceof Error ? e.message : String(e));
    }
  }

  function handleSave() {
    if (!saveName.trim()) return;
    const updated = saveRule(saveName.trim(), rulesJson);
    setSavedRules(updated);
    setSaveName("");
  }

  function handleDelete(name: string) {
    const updated = deleteRule(name);
    setSavedRules(updated);
    if (selectedRule === name) setSelectedRule(null);
  }

  async function handleEvaluate() {
    const jsonToEval =
      selectedRule
        ? (savedRules.find(r => r.name === selectedRule)?.json ?? rulesJson)
        : rulesJson;

    let parsedRules: object[];
    try {
      parsedRules = JSON.parse(jsonToEval) as object[];
    } catch {
      setEvalError("Invalid JSON");
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setEvalResult(null);
    setEvalError(null);

    try {
      const result = await evaluateSpawnRules(
        { spawn_rules: parsedRules, instrument_id: instrument, start, end },
        ctrl.signal,
      );
      if (abortRef.current !== ctrl) return;
      setEvalResult(result);
    } catch (e) {
      if (abortRef.current !== ctrl) return;
      if (e instanceof Error && e.name === "AbortError") return;
      setEvalError(e instanceof Error ? e.message : String(e));
    } finally {
      if (abortRef.current === ctrl) setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg text-text-1 p-6">
      <h1 className="text-xl font-bold mb-6">Strategy Spawner</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: Condition Builder ── */}
        <section className="space-y-4">
          <div className="bg-panel border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide mb-4">
              Condition Builder
            </h2>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-text-2">Combinator:</span>
              <select
                className="border border-border bg-panel-2 text-text-1 rounded px-2 py-1 text-sm"
                value={rule.combinator}
                onChange={e =>
                  setRule(r => ({ ...r, combinator: e.target.value as Combinator }))
                }
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
            </div>

            <div className="space-y-3">
              {rule.conditions.map(cond => (
                <ConditionRowEditor
                  key={cond.id}
                  condition={cond}
                  onChange={updated => updateCondition(cond.id, updated)}
                  onRemove={() => removeCondition(cond.id)}
                />
              ))}
            </div>

            <button
              className="mt-3 text-sm text-accent border border-accent/40 rounded px-3 py-1 hover:bg-accent/10"
              onClick={addCondition}
            >
              + Add Condition
            </button>
          </div>

          {/* Validate */}
          <div className="bg-panel border border-border rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="bg-accent text-black text-sm font-medium rounded px-4 py-1.5"
                onClick={handleValidate}
              >
                Validate
              </button>
              {validateResult && (
                <span
                  className={`text-sm font-medium ${
                    validateResult.valid ? "text-pos" : "text-neg"
                  }`}
                >
                  {validateResult.valid
                    ? `✓ Valid — ${validateResult.rules[0]?.condition_count ?? 0} condition(s)`
                    : `✗ ${validateResult.errors[0]?.error}`}
                </span>
              )}
              {validateError && (
                <span className="text-sm text-neg">{validateError}</span>
              )}
            </div>
          </div>

          {/* JSON preview */}
          <div className="bg-panel border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide mb-2">
              JSON Preview
            </h2>
            <textarea
              className="w-full h-32 bg-panel-2 border border-border text-text-2 text-xs font-mono rounded p-2 resize-none"
              readOnly
              value={rulesJson}
            />
          </div>

          {/* Save */}
          <div className="bg-panel border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide mb-3">
              Save Rule
            </h2>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-3 py-1.5 text-sm"
                placeholder="Rule name…"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
              />
              <button
                className="bg-accent text-black text-sm font-medium rounded px-4 py-1.5 disabled:opacity-40"
                onClick={handleSave}
                disabled={!saveName.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </section>

        {/* ── Right: Saved rules + Evaluate ── */}
        <section className="space-y-4">
          {/* Saved rules */}
          <div className="bg-panel border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide mb-3">
              Saved Rules
            </h2>
            {savedRules.length === 0 ? (
              <p className="text-sm text-text-3">No saved rules yet.</p>
            ) : (
              <div className="space-y-2">
                {savedRules.map(r => (
                  <div
                    key={r.name}
                    className={`flex items-center justify-between px-3 py-2 rounded border cursor-pointer ${
                      selectedRule === r.name
                        ? "border-accent text-accent bg-accent/10"
                        : "border-border bg-panel-2 text-text-1"
                    }`}
                    onClick={() =>
                      setSelectedRule(selectedRule === r.name ? null : r.name)
                    }
                  >
                    <div>
                      <span className="text-sm font-medium">{r.name}</span>
                      <span className="text-xs text-text-3 ml-2">
                        {r.savedAt.slice(0, 10)}
                      </span>
                    </div>
                    <button
                      className="text-xs text-neg hover:underline"
                      onClick={e => {
                        e.stopPropagation();
                        handleDelete(r.name);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evaluate */}
          <div className="bg-panel border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wide mb-3">
              Evaluate Against History
            </h2>
            <p className="text-xs text-text-3 mb-3">
              {selectedRule
                ? `Using saved rule: "${selectedRule}"`
                : "Using current builder rule"}
            </p>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-text-2 w-24 shrink-0">Instrument</label>
                <input
                  className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-2 py-1 text-sm"
                  value={instrument}
                  onChange={e => setInstrument(e.target.value)}
                  placeholder="e.g. AAPL.NASDAQ"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-text-2 w-24 shrink-0">Start</label>
                <input
                  type="date"
                  className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-2 py-1 text-sm"
                  value={start}
                  onChange={e => setStart(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-text-2 w-24 shrink-0">End</label>
                <input
                  type="date"
                  className="flex-1 border border-border bg-panel-2 text-text-1 rounded px-2 py-1 text-sm"
                  value={end}
                  onChange={e => setEnd(e.target.value)}
                />
              </div>
            </div>

            <button
              className="bg-accent text-black text-sm font-medium rounded px-4 py-1.5 disabled:opacity-40"
              onClick={handleEvaluate}
              disabled={loading}
            >
              {loading ? "Running…" : "Run Evaluate"}
            </button>

            {evalError && (
              <p className="mt-2 text-sm text-neg">{evalError}</p>
            )}

            {evalResult && (
              <div className="mt-4">
                <p className="text-sm text-text-2 mb-2">
                  {evalResult.bar_count} bars &bull;{" "}
                  {evalResult.trigger_events.length} trigger event(s)
                </p>
                {evalResult.trigger_events.length > 0 ? (
                  <div className="overflow-auto max-h-48">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-text-3 border-b border-border">
                          <th className="py-1 text-left font-medium">Rule #</th>
                          <th className="py-1 text-left font-medium">Trigger Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evalResult.trigger_events.map((ev, i) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="py-1.5 text-text-1">Rule {ev.rule_index + 1}</td>
                            <td className="py-1.5 text-pos font-mono">{ev.trigger_date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-text-3">
                    No conditions triggered in this range.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 9: Run tsc to verify**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npx tsc --noEmit 2>&1 | head -10
```
Expected: 0 errors.

---

### Subtask D: NavBar + Docs

- [ ] **Step 10: Add Spawner to NavBar**

In `components/NavBar.tsx`, find the Live group and add Spawner as the first item:

Find:
```tsx
  {
    label: "Live",
    items: [
      { href: "/bots",      label: "Bots" },
```

Replace with:
```tsx
  {
    label: "Live",
    items: [
      { href: "/spawner",   label: "Spawner" },
      { href: "/bots",      label: "Bots" },
```

- [ ] **Step 11: Run full test suite**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test 2>&1 | tail -5
npx tsc --noEmit 2>&1 | head -5
```
Expected: 134/134 passed (127 existing + 7 new), 0 tsc errors.

- [ ] **Step 12: Update docs**

Prepend to `docs/progress.md`:

```markdown
## Phase 19 — Strategy Spawner UI (2026-06-28) ✅ SHIPPED

### 완료된 작업
- Backend: `GET /spawner/validate` (ConditionParser 검증), `POST /spawner/evaluate` (catalog 바 기반 조건 평가)
- Frontend: `lib/spawner-storage.ts` (localStorage CRUD), `lib/api.ts` (+6 types +2 functions)
- `/spawner` 페이지 — 시각적 조건 빌더, 저장된 룰 CRUD, 히스토리 평가 + 트리거 테이블
- NavBar: Spawner 추가 (Live 그룹 첫 번째)

### 변경된 파일
**Backend:** `api_server/main.py`, `tests/test_spawner_condition_api.py`
**Frontend:** `lib/spawner-storage.ts`, `lib/api.ts`, `app/spawner/page.tsx`, `components/NavBar.tsx`, `docs/`

### 다음 할 일
- Phase 20: Live Order Dashboard

---
```

Update `docs/roadmap.md`:
- Change `**HEAD:** 369f5d0` → current HEAD (will be the latest commit hash after this task)
- Change `| 19 | ... | TBD |` → `| 19 | ... | 369f5d0..<new-HEAD> |`

- [ ] **Step 13: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add lib/spawner-storage.ts tests/lib/spawner-storage.test.ts lib/api.ts app/spawner/page.tsx components/NavBar.tsx docs/progress.md docs/roadmap.md
git commit -m "feat(spawner): spawner page, storage, api types, NavBar + docs"
```

Note: if the storage and api.ts were already committed in Step 5, only commit the remaining files. Verify `git status` before committing.
