# Phase 14 — Futures Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Futures Analytics page with cost-of-carry pricer, term structure curve, and rollover cost analysis to the Nautilus quant dashboard.

**Architecture:** Backend computes all futures math using the cost-of-carry model (F = S·e^((r−q)·T)) — no external data needed. Frontend has a single `/futures` page with three tabs: Pricer, Curve (D3 line chart), and Roll. Same pattern as Phase 13 (Options).

**Tech Stack:**
- Backend: Python 3.14, FastAPI, math (stdlib only — no scipy needed)
- Frontend: Next.js 16, React 19, TypeScript, TailwindCSS 4, D3 v7 (already installed)

## Global Constraints

- Backend: `seokminal-multi-venue/` at `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue`
- Frontend: `seokminal-dashboard/` at `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard`
- Backend test command: `cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue && pytest tests/test_futures_pricer.py -v`
- Frontend test command: `cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && npm test`
- Backend starts from `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue/catalog`: `uvicorn api_server.main:app --reload`
- API base URL: `http://127.0.0.1:8000` — CORS allows `localhost:3000` only
- Design tokens: `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1`, `text-text-2`, `text-text-3`, `text-accent`, `text-pos`, `text-neg`, `text-warn`, `text-info`, `font-data`
- No hex codes in React `className` (SVG attrs and D3 `.attr()` excepted)
- `bg-accent text-black` only on primary Compute buttons
- Active tabs: `border-b-2 border-accent text-accent font-bold -mb-px`; inactive: `border-transparent text-text-3 font-normal hover:text-text-1`
- No inline `style={}` in React except SVG attrs, D3 `.attr()`, data-driven values, chart container height
- All API calls via `lib/api.ts` functions only (no raw `fetch` in components)
- AbortController pattern: abort→create→assign→try/catch AbortError silently→finally guard
- No new npm dependencies
- Frontend tests: 127 currently passing — do not break

---

## File Structure

### Backend (seokminal-multi-venue/)
| File | Action | Responsibility |
|---|---|---|
| `futures/__init__.py` | Create | Package init (empty) |
| `futures/pricer.py` | Create | Cost-of-carry: price, calendar, roll |
| `tests/test_futures_pricer.py` | Create | Unit tests for all pricer functions |
| `api_server/main.py` | Modify | Append 3 endpoints + 5 Pydantic models |
| `pyproject.toml` | Modify | Add `"futures*"` to packages.find.include |

### Frontend (seokminal-dashboard/)
| File | Action | Responsibility |
|---|---|---|
| `lib/api.ts` | Modify | Append 3 API functions + 5 TypeScript interfaces |
| `app/futures/page.tsx` | Create | Futures page: Pricer + Roll + Curve (D3 line chart) tabs |
| `components/NavBar.tsx` | Modify | Add Futures to Research group (after Options) |

---

### Task 1: Futures Pricer Module

**Files:**
- Create: `seokminal-multi-venue/futures/__init__.py`
- Create: `seokminal-multi-venue/futures/pricer.py`
- Create: `seokminal-multi-venue/tests/test_futures_pricer.py`

**Interfaces:**
- Produces (consumed by Task 2):
  - `futures_price(S, r, q, T) -> dict`
  - `futures_calendar(S, r, q, expiry_days) -> list[dict]`
  - `futures_roll(S, r, q, front_days, back_days) -> dict`

- [ ] **Step 1: Create package init**

```bash
mkdir -p /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue/futures
touch /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue/futures/__init__.py
```

- [ ] **Step 2: Write failing tests first**

Create `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue/tests/test_futures_pricer.py`:

```python
"""Tests for cost-of-carry futures pricer."""
import math
import pytest

from futures.pricer import futures_price, futures_calendar, futures_roll


# ── futures_price ─────────────────────────────────────────────────────────────

def test_futures_price_contango():
    """When r > q, futures price > spot (contango)."""
    result = futures_price(S=100, r=0.05, q=0.02, T=1.0)
    assert result["price"] > 100
    assert result["market_structure"] == "contango"


def test_futures_price_backwardation():
    """When q > r, futures price < spot (backwardation)."""
    result = futures_price(S=100, r=0.02, q=0.06, T=1.0)
    assert result["price"] < 100
    assert result["market_structure"] == "backwardation"


def test_futures_price_flat():
    """When r == q, futures price == spot (flat)."""
    result = futures_price(S=100, r=0.04, q=0.04, T=1.0)
    assert result["price"] == pytest.approx(100.0, abs=1e-6)
    assert result["market_structure"] == "flat"


def test_futures_price_formula():
    """F = S * exp((r - q) * T) exactly."""
    S, r, q, T = 150.0, 0.06, 0.01, 0.5
    result = futures_price(S, r, q, T)
    expected = S * math.exp((r - q) * T)
    assert result["price"] == pytest.approx(expected, abs=1e-4)


def test_futures_price_basis():
    """basis = F - S."""
    result = futures_price(S=100, r=0.05, q=0.02, T=1.0)
    assert result["basis"] == pytest.approx(result["price"] - 100.0, abs=1e-6)


def test_futures_price_basis_pct():
    """basis_pct = (F - S) / S * 100."""
    result = futures_price(S=100, r=0.05, q=0.02, T=1.0)
    expected_pct = (result["price"] - 100.0) / 100.0 * 100.0
    assert result["basis_pct"] == pytest.approx(expected_pct, abs=1e-4)


def test_futures_price_annualized_carry():
    """annualized_carry = (r - q) * 100."""
    result = futures_price(S=100, r=0.05, q=0.02, T=1.0)
    assert result["annualized_carry"] == pytest.approx(3.0, abs=1e-6)


def test_futures_price_zero_expiry():
    """At T=0, futures price equals spot, basis=0."""
    result = futures_price(S=100, r=0.05, q=0.02, T=0)
    assert result["price"] == pytest.approx(100.0, abs=1e-6)
    assert result["basis"] == pytest.approx(0.0, abs=1e-6)
    assert result["market_structure"] == "flat"


def test_futures_price_required_keys():
    """Result has all required keys."""
    result = futures_price(100, 0.05, 0.02, 1.0)
    required = {"price", "basis", "basis_pct", "annualized_carry", "market_structure"}
    assert required <= set(result.keys())


# ── futures_calendar ──────────────────────────────────────────────────────────

def test_futures_calendar_structure():
    """Calendar returns list of dicts with required keys."""
    rows = futures_calendar(S=100, r=0.05, q=0.02, expiry_days=[30, 60, 90])
    assert len(rows) == 3
    required = {"expiry_days", "price", "basis", "basis_pct", "annualized_carry", "market_structure"}
    for row in rows:
        assert required <= set(row.keys())


def test_futures_calendar_expiry_days():
    """Each row carries the correct expiry_days."""
    rows = futures_calendar(100, 0.05, 0.02, [30, 60, 90])
    assert [r["expiry_days"] for r in rows] == [30, 60, 90]


def test_futures_calendar_monotone_contango():
    """In contango (r > q), later expiries have higher prices."""
    rows = futures_calendar(100, 0.05, 0.01, [30, 60, 90, 180])
    prices = [r["price"] for r in rows]
    assert prices == sorted(prices)


def test_futures_calendar_monotone_backwardation():
    """In backwardation (q > r), later expiries have lower prices."""
    rows = futures_calendar(100, 0.01, 0.07, [30, 60, 90, 180])
    prices = [r["price"] for r in rows]
    assert prices == sorted(prices, reverse=True)


# ── futures_roll ──────────────────────────────────────────────────────────────

def test_futures_roll_structure():
    """Roll result has all required keys."""
    result = futures_roll(100, 0.05, 0.02, front_days=30, back_days=60)
    required = {
        "front_days", "back_days", "front_price", "back_price",
        "roll_cost", "roll_cost_pct", "annualized_roll_yield", "days_to_roll"
    }
    assert required <= set(result.keys())


def test_futures_roll_days_to_roll():
    """days_to_roll = back_days - front_days."""
    result = futures_roll(100, 0.05, 0.02, front_days=30, back_days=90)
    assert result["days_to_roll"] == 60


def test_futures_roll_contango_positive_cost():
    """Contango: rolling forward costs money (roll_cost > 0)."""
    result = futures_roll(100, 0.05, 0.01, front_days=30, back_days=60)
    assert result["roll_cost"] > 0


def test_futures_roll_backwardation_negative_cost():
    """Backwardation: rolling forward earns money (roll_cost < 0)."""
    result = futures_roll(100, 0.01, 0.07, front_days=30, back_days=60)
    assert result["roll_cost"] < 0


def test_futures_roll_yield_sign():
    """In contango, annualized_roll_yield < 0 (cost to roll)."""
    result = futures_roll(100, 0.05, 0.01, front_days=30, back_days=60)
    assert result["annualized_roll_yield"] < 0


def test_futures_roll_price_formula():
    """front_price and back_price match futures_price formula."""
    S, r, q = 100.0, 0.05, 0.02
    result = futures_roll(S, r, q, 30, 60)
    expected_front = S * math.exp((r - q) * 30 / 365.0)
    expected_back = S * math.exp((r - q) * 60 / 365.0)
    assert result["front_price"] == pytest.approx(expected_front, abs=1e-4)
    assert result["back_price"] == pytest.approx(expected_back, abs=1e-4)
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_futures_pricer.py -v 2>&1 | head -10
```
Expected: `ModuleNotFoundError: No module named 'futures'`

- [ ] **Step 4: Implement `futures/pricer.py`**

Create `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue/futures/pricer.py`:

```python
"""Cost-of-carry futures pricer: price, calendar term structure, roll analysis."""
import math


def futures_price(
    S: float, r: float, q: float, T: float
) -> dict:
    """Compute futures price using cost-of-carry model.

    Args:
        S: Spot price
        r: Risk-free rate (annualised, e.g. 0.05 for 5%)
        q: Convenience yield / dividend yield (annualised, e.g. 0.02 for 2%)
        T: Time to expiry in years (T=0 returns spot)

    Returns dict with keys:
        price, basis, basis_pct, annualized_carry, market_structure
    """
    carry = r - q
    if T <= 0:
        return {
            "price": round(S, 4),
            "basis": 0.0,
            "basis_pct": 0.0,
            "annualized_carry": round(carry * 100, 4),
            "market_structure": "flat",
        }
    F = S * math.exp(carry * T)
    basis = F - S
    basis_pct = (basis / S) * 100
    if carry > 1e-9:
        structure = "contango"
    elif carry < -1e-9:
        structure = "backwardation"
    else:
        structure = "flat"
    return {
        "price": round(F, 4),
        "basis": round(basis, 4),
        "basis_pct": round(basis_pct, 4),
        "annualized_carry": round(carry * 100, 4),
        "market_structure": structure,
    }


def futures_calendar(
    S: float, r: float, q: float, expiry_days: list[int]
) -> list[dict]:
    """Compute futures prices across a list of expiries (term structure).

    Returns list of dicts — one per expiry — each with all futures_price keys
    plus expiry_days.
    """
    rows = []
    for days in expiry_days:
        T = days / 365.0
        fp = futures_price(S, r, q, T)
        rows.append({"expiry_days": days, **fp})
    return rows


def futures_roll(
    S: float, r: float, q: float, front_days: int, back_days: int
) -> dict:
    """Compute rollover cost from front contract to back contract.

    Args:
        S: Spot price
        r: Risk-free rate (annualised)
        q: Convenience yield (annualised)
        front_days: Days to expiry of the nearby (front) contract
        back_days: Days to expiry of the next (back) contract; must be > front_days

    Returns dict with:
        front_days, back_days, front_price, back_price,
        roll_cost (F_back - F_front),
        roll_cost_pct (roll_cost / F_front * 100),
        annualized_roll_yield (positive = earns by rolling, negative = costs),
        days_to_roll (back_days - front_days)
    """
    T_front = front_days / 365.0
    T_back = back_days / 365.0
    carry = r - q

    F_front = S * math.exp(carry * T_front) if T_front > 0 else S
    F_back = S * math.exp(carry * T_back)

    roll_cost = F_back - F_front
    roll_cost_pct = (roll_cost / F_front) * 100 if F_front != 0 else 0.0

    days_to_roll = back_days - front_days
    if days_to_roll > 0 and F_front != 0:
        # Positive = you earn by rolling (backwardation); negative = you pay (contango)
        annualized_roll_yield = (-roll_cost / F_front) * (365.0 / days_to_roll) * 100
    else:
        annualized_roll_yield = 0.0

    return {
        "front_days": front_days,
        "back_days": back_days,
        "front_price": round(F_front, 4),
        "back_price": round(F_back, 4),
        "roll_cost": round(roll_cost, 4),
        "roll_cost_pct": round(roll_cost_pct, 4),
        "annualized_roll_yield": round(annualized_roll_yield, 4),
        "days_to_roll": days_to_roll,
    }
```

- [ ] **Step 5: Run tests — verify they all pass**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_futures_pricer.py -v
```
Expected: 19/19 PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
git add futures/__init__.py futures/pricer.py tests/test_futures_pricer.py
git commit -m "feat(futures): add cost-of-carry pricer — price, calendar, roll"
```

---

### Task 2: FastAPI Endpoints + pyproject.toml

**Files:**
- Modify: `seokminal-multi-venue/api_server/main.py` (append ~120 lines)
- Modify: `seokminal-multi-venue/pyproject.toml` (add `"futures*"` to include list)
- Modify: `seokminal-multi-venue/tests/test_api_server.py` (append 3 new tests)

**Interfaces:**
- Consumes (from Task 1): `futures_price`, `futures_calendar`, `futures_roll`
- Produces (consumed by Task 3):
  - `GET /futures/price?spot=100&rate=0.05&convenience_yield=0.02&expiry_days=30`
  - `GET /futures/calendar?spot=100&rate=0.05&convenience_yield=0.02`
  - `GET /futures/roll?spot=100&rate=0.05&convenience_yield=0.02&front_days=30`

- [ ] **Step 1: Write failing API tests**

Append to the END of `seokminal-multi-venue/tests/test_api_server.py`:

```python
# ── Futures endpoints ─────────────────────────────────────────────────────────

def test_futures_price_contango():
    """GET /futures/price returns contango when r > q."""
    r = client.get("/futures/price?spot=100&rate=0.05&convenience_yield=0.02&expiry_days=30")
    assert r.status_code == 200
    data = r.json()
    assert data["price"] > 100
    assert data["market_structure"] == "contango"


def test_futures_calendar_structure():
    """GET /futures/calendar returns 7 rows with required keys."""
    r = client.get("/futures/calendar?spot=100&rate=0.05&convenience_yield=0.02")
    assert r.status_code == 200
    data = r.json()
    assert "rows" in data
    assert len(data["rows"]) == 7
    row = data["rows"][0]
    assert "expiry_days" in row and "price" in row and "market_structure" in row


def test_futures_roll_structure():
    """GET /futures/roll returns list of rolls with required keys."""
    r = client.get("/futures/roll?spot=100&rate=0.05&convenience_yield=0.02&front_days=30")
    assert r.status_code == 200
    data = r.json()
    assert "rolls" in data
    assert len(data["rolls"]) == 5
    roll = data["rolls"][0]
    assert "roll_cost" in roll and "annualized_roll_yield" in roll
```

- [ ] **Step 2: Run the new tests — verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_api_server.py::test_futures_price_contango -v 2>&1 | tail -5
```
Expected: FAILED with 404

- [ ] **Step 3: Update `pyproject.toml`**

In `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue/pyproject.toml`, find the `include` line and add `"futures*"`:

```toml
include = ["backends*", "adapters*", "tests*", "api_server*", "backtest_runner*", "condition_engine*", "strategy_spawner*", "correlation_analysis*", "beta_analysis*", "risk_analysis*", "fred*", "ecos*", "corp_finance*", "live_engine*", "monte_carlo*", "regime_filter*", "krx*", "sec_edgar*", "ksd*", "options*", "futures*"]
```

- [ ] **Step 4: Append endpoints to `api_server/main.py`**

At the very END of `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue/api_server/main.py`, append:

```python
# ═══════════════════════════════════════════════════════════════════════════════
# Futures Analytics
# ═══════════════════════════════════════════════════════════════════════════════

from futures.pricer import futures_price, futures_calendar, futures_roll


class FuturesPriceResponse(BaseModel):
    spot: float
    rate: float
    convenience_yield: float
    expiry_days: int
    price: float
    basis: float
    basis_pct: float
    annualized_carry: float
    market_structure: str


class FuturesCalendarRow(BaseModel):
    expiry_days: int
    price: float
    basis: float
    basis_pct: float
    annualized_carry: float
    market_structure: str


class FuturesCalendarResponse(BaseModel):
    spot: float
    rate: float
    convenience_yield: float
    rows: list[FuturesCalendarRow]


class FuturesRollRow(BaseModel):
    front_days: int
    back_days: int
    front_price: float
    back_price: float
    roll_cost: float
    roll_cost_pct: float
    annualized_roll_yield: float
    days_to_roll: int


class FuturesRollResponse(BaseModel):
    spot: float
    rate: float
    convenience_yield: float
    front_days: int
    rolls: list[FuturesRollRow]


@app.get("/futures/price", response_model=FuturesPriceResponse)
def get_futures_price(
    spot: float = Query(..., gt=0),
    rate: float = Query(0.05),
    convenience_yield: float = Query(0.02),
    expiry_days: int = Query(..., ge=0),
) -> FuturesPriceResponse:
    T = expiry_days / 365.0
    fp = futures_price(spot, rate, convenience_yield, T)
    return FuturesPriceResponse(
        spot=spot,
        rate=rate,
        convenience_yield=convenience_yield,
        expiry_days=expiry_days,
        **fp,
    )


@app.get("/futures/calendar", response_model=FuturesCalendarResponse)
def get_futures_calendar(
    spot: float = Query(..., gt=0),
    rate: float = Query(0.05),
    convenience_yield: float = Query(0.02),
) -> FuturesCalendarResponse:
    expiry_days = [30, 60, 90, 120, 180, 252, 360]
    rows = futures_calendar(spot, rate, convenience_yield, expiry_days)
    return FuturesCalendarResponse(
        spot=spot,
        rate=rate,
        convenience_yield=convenience_yield,
        rows=[FuturesCalendarRow(**r) for r in rows],
    )


@app.get("/futures/roll", response_model=FuturesRollResponse)
def get_futures_roll(
    spot: float = Query(..., gt=0),
    rate: float = Query(0.05),
    convenience_yield: float = Query(0.02),
    front_days: int = Query(30, ge=1),
) -> FuturesRollResponse:
    back_days_list = [d for d in [60, 90, 120, 180, 252] if d > front_days]
    if not back_days_list:
        raise HTTPException(status_code=400, detail="front_days must be less than 252")
    rolls = [futures_roll(spot, rate, convenience_yield, front_days, bd) for bd in back_days_list]
    return FuturesRollResponse(
        spot=spot,
        rate=rate,
        convenience_yield=convenience_yield,
        front_days=front_days,
        rolls=[FuturesRollRow(**r) for r in rolls],
    )
```

**Import placement:** First run `grep -n "from options.pricer" api_server/main.py`. The options import is at line ~36 (top-level imports section). Add `from futures.pricer import futures_price, futures_calendar, futures_roll` on the line immediately after it — NOT in the Futures section at the bottom.

- [ ] **Step 5: Run the 3 new API tests**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_api_server.py::test_futures_price_contango tests/test_api_server.py::test_futures_calendar_structure tests/test_api_server.py::test_futures_roll_structure -v
```
Expected: 3/3 PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
git add api_server/main.py pyproject.toml tests/test_api_server.py
git commit -m "feat(api): add /futures/price, /futures/calendar, /futures/roll endpoints"
```

---

### Task 3: Frontend API Client + Futures Page (Pricer + Roll)

**Files:**
- Modify: `seokminal-dashboard/lib/api.ts` (append ~80 lines)
- Create: `seokminal-dashboard/app/futures/page.tsx`

**Interfaces:**
- Consumes (from Task 2):
  - `GET /futures/price` → `FuturesPriceResponse`
  - `GET /futures/calendar` → `FuturesCalendarResponse`
  - `GET /futures/roll` → `FuturesRollResponse`
- Produces (consumed by NavBar in Task 4): page at `/futures`

Note: Pricer and Roll tabs are complete here. Curve tab gets D3 chart in Task 4.

- [ ] **Step 1: Append to `lib/api.ts`**

At the END of `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard/lib/api.ts`, append:

```typescript
// ── Futures ──────────────────────────────────────────────────────────────────

export interface FuturesPriceResponse {
  spot: number;
  rate: number;
  convenience_yield: number;
  expiry_days: number;
  price: number;
  basis: number;
  basis_pct: number;
  annualized_carry: number;
  market_structure: string;
}

export interface FuturesCalendarRow {
  expiry_days: number;
  price: number;
  basis: number;
  basis_pct: number;
  annualized_carry: number;
  market_structure: string;
}

export interface FuturesCalendarResponse {
  spot: number;
  rate: number;
  convenience_yield: number;
  rows: FuturesCalendarRow[];
}

export interface FuturesRollRow {
  front_days: number;
  back_days: number;
  front_price: number;
  back_price: number;
  roll_cost: number;
  roll_cost_pct: number;
  annualized_roll_yield: number;
  days_to_roll: number;
}

export interface FuturesRollResponse {
  spot: number;
  rate: number;
  convenience_yield: number;
  front_days: number;
  rolls: FuturesRollRow[];
}

export async function getFuturesPrice(
  spot: number,
  rate: number,
  convenienceYield: number,
  expiryDays: number,
  signal?: AbortSignal
): Promise<FuturesPriceResponse> {
  const params = new URLSearchParams({
    spot: String(spot),
    rate: String(rate),
    convenience_yield: String(convenienceYield),
    expiry_days: String(expiryDays),
  });
  return handleResponse<FuturesPriceResponse>(
    await fetch(`${API_URL}/futures/price?${params}`, { signal })
  );
}

export async function getFuturesCalendar(
  spot: number,
  rate: number,
  convenienceYield: number,
  signal?: AbortSignal
): Promise<FuturesCalendarResponse> {
  const params = new URLSearchParams({
    spot: String(spot),
    rate: String(rate),
    convenience_yield: String(convenienceYield),
  });
  return handleResponse<FuturesCalendarResponse>(
    await fetch(`${API_URL}/futures/calendar?${params}`, { signal })
  );
}

export async function getFuturesRoll(
  spot: number,
  rate: number,
  convenienceYield: number,
  frontDays: number,
  signal?: AbortSignal
): Promise<FuturesRollResponse> {
  const params = new URLSearchParams({
    spot: String(spot),
    rate: String(rate),
    convenience_yield: String(convenienceYield),
    front_days: String(frontDays),
  });
  return handleResponse<FuturesRollResponse>(
    await fetch(`${API_URL}/futures/roll?${params}`, { signal })
  );
}
```

- [ ] **Step 2: Run frontend tests — verify still passing**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test 2>&1 | tail -5
npx tsc --noEmit 2>&1 | head -5
```
Expected: 127/127 passing, zero TypeScript errors

- [ ] **Step 3: Create `app/futures/page.tsx`**

Create `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard/app/futures/page.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import {
  ApiError,
  getFuturesPrice, getFuturesRoll,
  type FuturesPriceResponse, type FuturesRollResponse, type FuturesRollRow,
} from "@/lib/api";

type Tab = "pricer" | "curve" | "roll";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt4(v: number): string { return v.toFixed(4); }
function fmt2(v: number): string { return v.toFixed(2); }

function structureCls(s: string): string {
  if (s === "contango") return "text-warn";
  if (s === "backwardation") return "text-info";
  return "text-text-3";
}

function rollCostCls(v: number): string {
  return v > 0 ? "text-neg" : v < 0 ? "text-pos" : "text-text-3";
}

function Err({ msg }: { msg: string | null }) {
  return msg ? <p className="text-neg text-sm mt-0 mb-3">ERR: {msg}</p> : null;
}

// ── Shared input row ──────────────────────────────────────────────────────────

function InputRow({
  fields,
  onCompute,
  loading,
}: {
  fields: { label: string; value: string; set: (v: string) => void }[];
  onCompute: () => void;
  loading: boolean;
}) {
  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="flex gap-3 flex-wrap items-end">
        {fields.map(({ label, value, set }) => (
          <div key={label} className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">{label}</label>
            <input
              type="number"
              value={value}
              onChange={e => set(e.target.value)}
              step="any"
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-24"
            />
          </div>
        ))}
        <button
          onClick={onCompute}
          disabled={loading}
          className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed self-end"
        >
          {loading ? "Computing…" : "Compute"}
        </button>
      </div>
    </div>
  );
}

// ── Pricer Tab ────────────────────────────────────────────────────────────────

const PRICER_ROWS: { label: string; key: keyof FuturesPriceResponse; fmt: (v: number) => string; desc: string }[] = [
  { label: "Futures Price",      key: "price",            fmt: fmt4, desc: "F = S · e^((r-q)·T)" },
  { label: "Basis",              key: "basis",            fmt: fmt4, desc: "F − S" },
  { label: "Basis %",            key: "basis_pct",        fmt: fmt2, desc: "(F − S) / S × 100" },
  { label: "Annualized Carry %", key: "annualized_carry", fmt: fmt2, desc: "(r − q) × 100" },
];

function PricerTab() {
  const [spot, setSpot] = useState("100");
  const [rate, setRate] = useState("0.05");
  const [convYield, setConvYield] = useState("0.02");
  const [expiryDays, setExpiryDays] = useState("30");
  const [result, setResult] = useState<FuturesPriceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getFuturesPrice(
        parseFloat(spot), parseFloat(rate), parseFloat(convYield),
        parseInt(expiryDays, 10), ctrl.signal
      ));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <InputRow
        fields={[
          { label: "Spot (S)", value: spot, set: setSpot },
          { label: "Rate (r)", value: rate, set: setRate },
          { label: "Conv. Yield (q)", value: convYield, set: setConvYield },
          { label: "Expiry (days)", value: expiryDays, set: setExpiryDays },
        ]}
        onCompute={run}
        loading={loading}
      />
      <Err msg={error} />
      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center gap-3">
          <span className="text-text-3 text-[11px] uppercase tracking-wider">Futures Pricer</span>
          {result && (
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${structureCls(result.market_structure)}`}>
              {result.market_structure}
            </span>
          )}
        </div>
        <table className="border-collapse w-full">
          <tbody>
            {PRICER_ROWS.map(row => {
              const v = result ? (result[row.key] as number) : null;
              return (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-accent text-[13px] w-[220px]">{row.label}</td>
                  <td className={`px-4 py-2 text-sm font-data font-bold w-32 ${loading ? "text-text-3/30" : v !== null ? (v >= 0 ? "text-pos" : "text-neg") : "text-text-3"}`}>
                    {loading ? "…" : v !== null ? row.fmt(v) : "—"}
                  </td>
                  <td className="px-4 py-2 text-text-3 text-xs">{row.desc}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Roll Tab ──────────────────────────────────────────────────────────────────

function RollTab() {
  const [spot, setSpot] = useState("100");
  const [rate, setRate] = useState("0.05");
  const [convYield, setConvYield] = useState("0.02");
  const [frontDays, setFrontDays] = useState("30");
  const [result, setResult] = useState<FuturesRollResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getFuturesRoll(
        parseFloat(spot), parseFloat(rate), parseFloat(convYield),
        parseInt(frontDays, 10), ctrl.signal
      ));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <InputRow
        fields={[
          { label: "Spot (S)", value: spot, set: setSpot },
          { label: "Rate (r)", value: rate, set: setRate },
          { label: "Conv. Yield (q)", value: convYield, set: setConvYield },
          { label: "Front (days)", value: frontDays, set: setFrontDays },
        ]}
        onCompute={run}
        loading={loading}
      />
      <Err msg={error} />
      {result && (
        <div className="overflow-x-auto">
          <table className="border-collapse w-full text-xs font-data">
            <thead>
              <tr className="border-b border-border text-text-3">
                <th className="px-3 py-2 text-left font-medium">Roll</th>
                <th className="px-3 py-2 text-right font-medium">Front F</th>
                <th className="px-3 py-2 text-right font-medium">Back F</th>
                <th className="px-3 py-2 text-right font-medium">Roll Cost</th>
                <th className="px-3 py-2 text-right font-medium">Cost %</th>
                <th className="px-3 py-2 text-right font-medium">Ann. Yield %</th>
                <th className="px-3 py-2 text-right font-medium">Days to Roll</th>
              </tr>
            </thead>
            <tbody>
              {result.rolls.map((row: FuturesRollRow) => (
                <tr key={row.back_days} className="border-b border-border hover:bg-panel-2">
                  <td className="px-3 py-1.5 text-text-2">
                    {result.front_days}d → {row.back_days}d
                  </td>
                  <td className="px-3 py-1.5 text-right text-text-1">{fmt4(row.front_price)}</td>
                  <td className="px-3 py-1.5 text-right text-text-1">{fmt4(row.back_price)}</td>
                  <td className={`px-3 py-1.5 text-right font-bold ${rollCostCls(row.roll_cost)}`}>
                    {row.roll_cost > 0 ? "+" : ""}{fmt4(row.roll_cost)}
                  </td>
                  <td className={`px-3 py-1.5 text-right ${rollCostCls(row.roll_cost_pct)}`}>
                    {row.roll_cost_pct > 0 ? "+" : ""}{fmt2(row.roll_cost_pct)}%
                  </td>
                  <td className={`px-3 py-1.5 text-right ${rollCostCls(-row.annualized_roll_yield)}`}>
                    {row.annualized_roll_yield > 0 ? "+" : ""}{fmt2(row.annualized_roll_yield)}%
                  </td>
                  <td className="px-3 py-1.5 text-right text-text-3">{row.days_to_roll}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!result && !loading && !error && (
        <div className="text-center py-12 text-text-3 text-sm">
          Configure parameters and click Compute to view rollover costs.
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "pricer", label: "Pricer" },
  { id: "curve",  label: "Curve" },
  { id: "roll",   label: "Roll" },
];

export default function FuturesPage() {
  const [tab, setTab] = useState<Tab>("pricer");

  return (
    <div className="p-6 space-y-4 max-w-[1100px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Futures Analytics</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Cost-of-carry pricing, term structure curve, and rollover cost analysis.
        </p>
      </div>

      <div className="flex border-b border-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-1.5 text-sm cursor-pointer border-0 border-b-2 -mb-px bg-transparent transition-colors ${
              tab === t.id
                ? "border-accent text-accent font-bold"
                : "border-transparent text-text-3 font-normal hover:text-text-1"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pricer" && <PricerTab />}
      {tab === "roll"   && <RollTab />}
      {tab === "curve"  && (
        <div className="text-center py-16 text-text-3 text-sm">
          Term structure curve — implemented in Task 4.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run frontend tests + TypeScript check**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test 2>&1 | tail -5
npx tsc --noEmit 2>&1 | head -5
```
Expected: 127/127 passing, zero TypeScript errors

- [ ] **Step 5: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add lib/api.ts app/futures/page.tsx
git commit -m "feat(futures): add Futures page (Pricer + Roll tabs) and API client types"
```

---

### Task 4: Term Structure Curve (D3) + NavBar + Docs

**Files:**
- Modify: `seokminal-dashboard/app/futures/page.tsx` (add CurveTab, replace placeholder)
- Modify: `seokminal-dashboard/components/NavBar.tsx` (add Futures to Research group)
- Modify: `seokminal-dashboard/docs/roadmap.md` (mark Phase 14 complete)
- Modify: `seokminal-dashboard/docs/progress.md` (prepend Phase 14 section)

**Interfaces:**
- Consumes: `getFuturesCalendar`, `FuturesCalendarResponse`, `FuturesCalendarRow` from `lib/api.ts`
- Consumes: D3 v7 (already installed)

- [ ] **Step 1: Run baseline tests**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test 2>&1 | tail -5
```
Expected: 127/127 passing

- [ ] **Step 2: Modify imports in `app/futures/page.tsx`**

Change the first 3 import lines to:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import {
  ApiError,
  getFuturesPrice, getFuturesRoll, getFuturesCalendar,
  type FuturesPriceResponse, type FuturesRollResponse, type FuturesRollRow,
  type FuturesCalendarResponse,
} from "@/lib/api";
```

- [ ] **Step 3: Add `CurveTab` component before the `const TABS` line**

Insert this function above `const TABS: ...`:

```tsx
// ── Curve Tab ─────────────────────────────────────────────────────────────────

function CurveTab() {
  const [spot, setSpot] = useState("100");
  const [rate, setRate] = useState("0.05");
  const [convYield, setConvYield] = useState("0.02");
  const [result, setResult] = useState<FuturesCalendarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getFuturesCalendar(
        parseFloat(spot), parseFloat(rate), parseFloat(convYield), ctrl.signal
      ));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    if (!result || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const W = 560, H = 280;
    const margin = { top: 20, right: 20, bottom: 48, left: 64 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const { rows } = result;
    const spotVal = result.spot;

    const xScale = d3.scaleLinear()
      .domain([0, d3.max(rows, d => d.expiry_days)!])
      .range([0, innerW]);

    const allPrices = [...rows.map(d => d.price), spotVal];
    const yMin = d3.min(allPrices)! * 0.999;
    const yMax = d3.max(allPrices)! * 1.001;
    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerH, 0]);

    // Fill area between spot line and curve
    const isContango = rows[0]?.market_structure === "contango";
    const fillColor = isContango ? "#ff4444" : "#44cc88";

    const area = d3.area<typeof rows[0]>()
      .x(d => xScale(d.expiry_days))
      .y0(yScale(spotVal))
      .y1(d => yScale(d.price))
      .curve(d3.curveCatmullRom);

    g.append("path")
      .datum(rows)
      .attr("d", area)
      .attr("fill", fillColor)
      .attr("opacity", 0.15);

    // Spot price horizontal dashed reference line
    g.append("line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", yScale(spotVal)).attr("y2", yScale(spotVal))
      .attr("stroke", "#9AA4B2")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4 4");

    g.append("text")
      .attr("x", -6).attr("y", yScale(spotVal) + 4)
      .attr("text-anchor", "end")
      .attr("fill", "#9AA4B2")
      .attr("font-size", 10)
      .text(`S=${spotVal}`);

    // Futures curve line
    const line = d3.line<typeof rows[0]>()
      .x(d => xScale(d.expiry_days))
      .y(d => yScale(d.price))
      .curve(d3.curveCatmullRom);

    g.append("path")
      .datum(rows)
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", fillColor)
      .attr("stroke-width", 2);

    // Dots + labels at each expiry
    rows.forEach(d => {
      g.append("circle")
        .attr("cx", xScale(d.expiry_days))
        .attr("cy", yScale(d.price))
        .attr("r", 3.5)
        .attr("fill", fillColor);

      g.append("text")
        .attr("x", xScale(d.expiry_days))
        .attr("y", yScale(d.price) - 8)
        .attr("text-anchor", "middle")
        .attr("fill", "#9AA4B2")
        .attr("font-size", 9)
        .text(d.price.toFixed(2));
    });

    // x-axis
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).tickValues(rows.map(r => r.expiry_days)).tickFormat(d => `${d}d`))
      .call(ax => ax.select(".domain").remove())
      .call(ax => ax.selectAll("text").attr("fill", "#9AA4B2").attr("font-size", 11))
      .call(ax => ax.selectAll(".tick line").remove());

    // y-axis
    g.append("g")
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => String(d)))
      .call(ax => ax.select(".domain").remove())
      .call(ax => ax.selectAll("text").attr("fill", "#9AA4B2").attr("font-size", 11))
      .call(ax => ax.selectAll(".tick line").attr("stroke", "#2a3040").attr("x2", innerW));

    // Axis labels
    g.append("text")
      .attr("x", innerW / 2).attr("y", innerH + 38)
      .attr("text-anchor", "middle").attr("fill", "#9AA4B2").attr("font-size", 11)
      .text("Expiry (days)");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2).attr("y", -50)
      .attr("text-anchor", "middle").attr("fill", "#9AA4B2").attr("font-size", 11)
      .text("Futures Price");

  }, [result]);

  const structure = result?.rows[0]?.market_structure ?? null;

  return (
    <div className="space-y-4">
      <InputRow
        fields={[
          { label: "Spot (S)", value: spot, set: setSpot },
          { label: "Rate (r)", value: rate, set: setRate },
          { label: "Conv. Yield (q)", value: convYield, set: setConvYield },
        ]}
        onCompute={run}
        loading={loading}
      />
      <Err msg={error} />
      {result && (
        <div className="bg-bg border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center gap-3">
            <span className="text-text-3 text-[11px] uppercase tracking-wider">
              Term Structure — Spot {result.spot}
            </span>
            {structure && (
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${structureCls(structure)}`}>
                {structure}
              </span>
            )}
          </div>
          <div className="p-4">
            <svg ref={svgRef} width={560} height={280} className="block" />
          </div>
        </div>
      )}
      {!result && !loading && !error && (
        <div className="text-center py-16 text-text-3 text-sm">
          Configure parameters and click Compute to view the term structure curve.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Replace the Curve placeholder**

Find this in `app/futures/page.tsx`:
```tsx
      {tab === "curve"  && (
        <div className="text-center py-16 text-text-3 text-sm">
          Term structure curve — implemented in Task 4.
        </div>
      )}
```

Replace with:
```tsx
      {tab === "curve"  && <CurveTab />}
```

- [ ] **Step 5: Add Futures to NavBar**

In `seokminal-dashboard/components/NavBar.tsx`, find the Research group:
```tsx
    label: "Research",
    items: [
      { href: "/notebooks",   label: "Notebooks" },
      { href: "/strategies",  label: "Strategies" },
      { href: "/experiments", label: "Experiments" },
      { href: "/quant",       label: "Quant" },
      { href: "/options",     label: "Options" },
      { href: "/report",      label: "Report" },
    ],
```

Add Futures after Options:
```tsx
    label: "Research",
    items: [
      { href: "/notebooks",   label: "Notebooks" },
      { href: "/strategies",  label: "Strategies" },
      { href: "/experiments", label: "Experiments" },
      { href: "/quant",       label: "Quant" },
      { href: "/options",     label: "Options" },
      { href: "/futures",     label: "Futures" },
      { href: "/report",      label: "Report" },
    ],
```

- [ ] **Step 6: Run tests + TypeScript check**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test 2>&1 | tail -5
npx tsc --noEmit 2>&1 | head -5
```
Expected: 127/127 passing, zero errors

- [ ] **Step 7: Update docs**

In `seokminal-dashboard/docs/roadmap.md`:
1. Update `**HEAD:**` to current git hash (`git log --oneline -1 --format="%h"`)
2. Add Phase 14 row to the completed table:
   ```
   | 14 | Futures Analytics | `futures/pricer.py`, `app/futures/page.tsx`, term structure curve | — |
   ```
3. Remove Phase 14 from the "향후 계획" section (Phase 14~16 → Phase 15~16)
4. Update section heading: `## 향후 계획 — Asset Class 확장 (Phase 15~16)`

In `seokminal-dashboard/docs/progress.md`, prepend a Phase 14 section:

```markdown
## Phase 14 — Futures Analytics (2026-06-28)

### 완료된 작업
- Cost-of-carry pricer: `futures_price`, `futures_calendar`, `futures_roll` (`futures/pricer.py`)
- API: `/futures/price`, `/futures/calendar`, `/futures/roll` endpoints (`api_server/main.py`)
- Frontend: `/futures` page — Pricer card, Roll table, Term Structure D3 line chart
- NavBar: Futures added to Research group (after Options)

### 변경된 파일
**Backend (seokminal-multi-venue):**
- `futures/__init__.py` (new)
- `futures/pricer.py` (new)
- `tests/test_futures_pricer.py` (new)
- `api_server/main.py` (+~110 lines)
- `pyproject.toml` (+futures*)

**Frontend (seokminal-dashboard):**
- `lib/api.ts` (+3 functions, +5 types)
- `app/futures/page.tsx` (new)
- `components/NavBar.tsx` (Futures link added)

### 다음 할 일
- Phase 15: Forex (ECOS FX 환율 데이터 연동)
```

- [ ] **Step 8: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add app/futures/page.tsx components/NavBar.tsx docs/roadmap.md docs/progress.md
git commit -m "feat(futures): add term structure D3 curve, Futures NavBar link, docs update"
```
