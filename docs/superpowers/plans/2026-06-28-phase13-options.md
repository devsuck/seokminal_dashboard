# Phase 13 — Options Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Options Analytics page with Black-Scholes Greeks calculator, Option Chain table, and IV Surface heatmap to the Nautilus quant dashboard.

**Architecture:** Backend computes all option math using Black-Scholes (scipy + numpy — no external data source needed). Frontend has a single `/options` page with three tabs. IV Surface is rendered as a D3 heatmap (x=expiry, y=strike/spot ratio, color=IV%). No new npm dependencies.

**Tech Stack:**
- Backend: Python 3.14, FastAPI, scipy.stats.norm, numpy (already installed)
- Frontend: Next.js 16, React 19, TypeScript, TailwindCSS 4, D3 v7 (already installed)

## Global Constraints

- Backend: `seokminal-multi-venue/` at `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue`
- Frontend: `seokminal-dashboard/` at `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard`
- Backend test command: `cd seokminal-multi-venue && pytest tests/test_options_pricer.py -v`
- Frontend test command: `cd seokminal-dashboard && npm test`
- Backend starts at `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue/catalog` (run: `uvicorn api_server.main:app --reload`)
- API base URL: `http://127.0.0.1:8000` — CORS allows `localhost:3000` only
- Design tokens (frontend): `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1`, `text-text-2`, `text-text-3`, `text-accent`, `text-pos`, `text-neg`, `text-warn`, `text-info`, `font-data`
- No hex codes in React `className` (SVG attrs and data-driven `style={}` excepted)
- `bg-accent text-black` only on primary action (RUN/COMPUTE) buttons
- Active tabs: `border-b-2 border-accent text-accent font-bold -mb-px`; inactive: `border-transparent text-text-3 hover:text-text-1`
- No inline `style={}` in React except: SVG attrs, D3 `.attr()`, data-driven width/color, chart container height
- AbortController pattern: abort→create→assign→try/finally guard→abort check before setState
- All API calls via `lib/api.ts` functions only (no raw `fetch` in components)
- No new npm dependencies
- Frontend tests: 127 currently passing — do not break them

---

## File Structure

### Backend (seokminal-multi-venue/)
| File | Action | Responsibility |
|---|---|---|
| `options/__init__.py` | Create | Package init (empty) |
| `options/pricer.py` | Create | Black-Scholes: price, greeks, IV, chain, surface |
| `tests/test_options_pricer.py` | Create | Unit tests for all pricer functions |
| `api_server/main.py` | Modify | Add 3 endpoints + 5 Pydantic models |
| `pyproject.toml` | Modify | Add `options*` to `packages.find.include` |

### Frontend (seokminal-dashboard/)
| File | Action | Responsibility |
|---|---|---|
| `lib/api.ts` | Modify | Add 3 API functions + 5 TypeScript interfaces |
| `app/options/page.tsx` | Create | Options page: Greeks + Chain + IV Surface tabs |
| `components/NavBar.tsx` | Modify | Add Options link to Research group |

---

### Task 1: Black-Scholes Pricer Module

**Files:**
- Create: `seokminal-multi-venue/options/__init__.py`
- Create: `seokminal-multi-venue/options/pricer.py`
- Create: `seokminal-multi-venue/tests/test_options_pricer.py`

**Interfaces:**
- Produces (consumed by Task 2):
  - `bs_price(S, K, T, r, sigma, option_type) -> float`
  - `bs_greeks(S, K, T, r, sigma, option_type) -> dict`
  - `implied_vol(market_price, S, K, T, r, option_type) -> float | None`
  - `bs_chain(S, expiry_days, r, sigma, strikes) -> list[dict]`
  - `bs_iv_surface(S, r, atm_vol, skew, smile) -> dict`

- [ ] **Step 1: Create the package init**

```bash
mkdir -p /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue/options
touch /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue/options/__init__.py
```

- [ ] **Step 2: Write the failing tests first**

Create `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue/tests/test_options_pricer.py`:

```python
"""Tests for Black-Scholes option pricer."""
import math
import pytest

from options.pricer import bs_price, bs_greeks, implied_vol, bs_chain, bs_iv_surface


# ── bs_price ──────────────────────────────────────────────────────────────────

def test_bs_price_call_atm():
    """ATM call should be positive and less than spot."""
    price = bs_price(S=100, K=100, T=1.0, r=0.05, sigma=0.2, option_type="call")
    assert 0 < price < 100


def test_bs_price_put_atm():
    """ATM put should be positive and less than strike."""
    price = bs_price(S=100, K=100, T=1.0, r=0.05, sigma=0.2, option_type="put")
    assert 0 < price < 100


def test_bs_price_put_call_parity():
    """C - P = S - K*e^(-rT) (put-call parity)."""
    S, K, T, r, sigma = 100.0, 100.0, 1.0, 0.05, 0.2
    C = bs_price(S, K, T, r, sigma, "call")
    P = bs_price(S, K, T, r, sigma, "put")
    expected = S - K * math.exp(-r * T)
    assert abs((C - P) - expected) < 1e-8


def test_bs_price_deep_itm_call():
    """Deep ITM call price ≈ S - K*e^(-rT)."""
    S, K, T, r, sigma = 200.0, 100.0, 1.0, 0.05, 0.2
    price = bs_price(S, K, T, r, sigma, "call")
    lower_bound = S - K * math.exp(-r * T)
    assert price > lower_bound * 0.99


def test_bs_price_zero_expiry_call():
    """At expiry, call = max(S-K, 0)."""
    assert bs_price(110, 100, 0, 0.05, 0.2, "call") == pytest.approx(10.0, abs=1e-8)
    assert bs_price(90, 100, 0, 0.05, 0.2, "call") == pytest.approx(0.0, abs=1e-8)


def test_bs_price_zero_expiry_put():
    """At expiry, put = max(K-S, 0)."""
    assert bs_price(90, 100, 0, 0.05, 0.2, "put") == pytest.approx(10.0, abs=1e-8)
    assert bs_price(110, 100, 0, 0.05, 0.2, "put") == pytest.approx(0.0, abs=1e-8)


# ── bs_greeks ─────────────────────────────────────────────────────────────────

def test_greeks_call_delta_bounds():
    """Call delta ∈ (0, 1)."""
    g = bs_greeks(100, 100, 1.0, 0.05, 0.2, "call")
    assert 0 < g["delta"] < 1


def test_greeks_put_delta_bounds():
    """Put delta ∈ (-1, 0)."""
    g = bs_greeks(100, 100, 1.0, 0.05, 0.2, "put")
    assert -1 < g["delta"] < 0


def test_greeks_gamma_positive():
    """Gamma > 0 for both call and put."""
    for ot in ("call", "put"):
        g = bs_greeks(100, 100, 1.0, 0.05, 0.2, ot)
        assert g["gamma"] > 0


def test_greeks_vega_positive():
    """Vega > 0 for both call and put."""
    for ot in ("call", "put"):
        g = bs_greeks(100, 100, 1.0, 0.05, 0.2, ot)
        assert g["vega"] > 0


def test_greeks_call_theta_negative():
    """Call theta < 0 (time decay hurts long options)."""
    g = bs_greeks(100, 100, 1.0, 0.05, 0.2, "call")
    assert g["theta"] < 0


def test_greeks_call_delta_atm():
    """ATM call delta ≈ 0.5–0.6 (between 0.5 and 0.7 for realistic params)."""
    g = bs_greeks(100, 100, 1.0, 0.05, 0.2, "call")
    assert 0.5 < g["delta"] < 0.7


def test_greeks_call_put_delta_sum():
    """Call delta + |put delta| ≈ 1 (from put-call parity derivative)."""
    S, K, T, r, sigma = 100, 100, 1.0, 0.05, 0.2
    call_g = bs_greeks(S, K, T, r, sigma, "call")
    put_g = bs_greeks(S, K, T, r, sigma, "put")
    assert abs(call_g["delta"] + abs(put_g["delta"]) - 1.0) < 0.001


# ── implied_vol ───────────────────────────────────────────────────────────────

def test_implied_vol_round_trip():
    """IV inversion: bs_price(sigma) → implied_vol → original sigma."""
    S, K, T, r, sigma = 100.0, 100.0, 1.0, 0.05, 0.25
    price = bs_price(S, K, T, r, sigma, "call")
    iv = implied_vol(price, S, K, T, r, "call")
    assert iv is not None
    assert abs(iv - sigma) < 1e-4


def test_implied_vol_intrinsic_returns_none():
    """Market price below intrinsic value returns None."""
    iv = implied_vol(0.01, 100, 200, 1.0, 0.05, "call")  # deep OTM call worth < 0.01
    assert iv is None


def test_implied_vol_zero_expiry_returns_none():
    """Zero time to expiry returns None."""
    iv = implied_vol(10.0, 110, 100, 0, 0.05, "call")
    assert iv is None


# ── bs_chain ──────────────────────────────────────────────────────────────────

def test_bs_chain_structure():
    """Chain returns list of dicts with required keys."""
    strikes = [90.0, 95.0, 100.0, 105.0, 110.0]
    chain = bs_chain(S=100, expiry_days=30, r=0.05, sigma=0.2, strikes=strikes)
    assert len(chain) == 5
    required = {"strike", "call_price", "call_delta", "call_gamma", "call_theta",
                "call_vega", "put_price", "put_delta", "put_gamma", "put_theta", "put_vega"}
    for row in chain:
        assert required <= set(row.keys())


def test_bs_chain_atm_call_above_put():
    """ATM call price > ATM put when r > 0."""
    chain = bs_chain(100, 252, 0.05, 0.2, [100.0])
    row = chain[0]
    assert row["call_price"] > row["put_price"]


def test_bs_chain_itm_otm_ordering():
    """ITM call (S>K) is more expensive than OTM call (S<K)."""
    chain = bs_chain(100, 30, 0.05, 0.2, [90.0, 110.0])
    itm = next(r for r in chain if r["strike"] == 90.0)
    otm = next(r for r in chain if r["strike"] == 110.0)
    assert itm["call_price"] > otm["call_price"]


# ── bs_iv_surface ─────────────────────────────────────────────────────────────

def test_bs_iv_surface_shape():
    """Surface returns correctly shaped grid."""
    result = bs_iv_surface(S=100, r=0.05, atm_vol=0.2)
    assert "strikes" in result
    assert "expiry_days" in result
    assert "iv_surface" in result
    assert len(result["iv_surface"]) == len(result["strikes"])
    assert len(result["iv_surface"][0]) == len(result["expiry_days"])


def test_bs_iv_surface_positive_ivs():
    """All IV values must be positive."""
    result = bs_iv_surface(S=100, r=0.05, atm_vol=0.2)
    for row in result["iv_surface"]:
        for val in row:
            assert val > 0
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_options_pricer.py -v 2>&1 | head -20
```
Expected: `ModuleNotFoundError: No module named 'options'`

- [ ] **Step 4: Implement `options/pricer.py`**

Create `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue/options/pricer.py`:

```python
"""Black-Scholes option pricer: price, Greeks, IV, chain, IV surface."""
import math
import numpy as np
from scipy.stats import norm


def bs_price(
    S: float, K: float, T: float, r: float, sigma: float, option_type: str
) -> float:
    """Black-Scholes option price.

    Args:
        S: Spot price
        K: Strike price
        T: Time to expiry in years (T=0 returns intrinsic value)
        r: Risk-free rate (annualised, e.g. 0.05 for 5%)
        sigma: Implied volatility (annualised, e.g. 0.2 for 20%)
        option_type: "call" or "put"
    """
    if T <= 0:
        return max(0.0, S - K) if option_type == "call" else max(0.0, K - S)
    d1 = (math.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    if option_type == "call":
        return S * norm.cdf(d1) - K * math.exp(-r * T) * norm.cdf(d2)
    return K * math.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)


def bs_greeks(
    S: float, K: float, T: float, r: float, sigma: float, option_type: str
) -> dict:
    """Compute option Greeks.

    Returns dict with keys: delta, gamma, theta, vega, rho.
    - theta is per calendar day (divided by 365)
    - vega is per 1 percentage-point change in vol (divided by 100)
    - rho is per 1 percentage-point change in rate (divided by 100)
    """
    if T <= 0:
        delta = 1.0 if (option_type == "call" and S > K) else (
            -1.0 if (option_type == "put" and S < K) else 0.0
        )
        return {"delta": delta, "gamma": 0.0, "theta": 0.0, "vega": 0.0, "rho": 0.0}

    sqrt_T = math.sqrt(T)
    d1 = (math.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * sqrt_T)
    d2 = d1 - sigma * sqrt_T
    pdf_d1 = norm.pdf(d1)

    gamma = pdf_d1 / (S * sigma * sqrt_T)
    vega = S * pdf_d1 * sqrt_T / 100.0

    if option_type == "call":
        delta = norm.cdf(d1)
        theta = (
            -S * pdf_d1 * sigma / (2.0 * sqrt_T)
            - r * K * math.exp(-r * T) * norm.cdf(d2)
        ) / 365.0
        rho = K * T * math.exp(-r * T) * norm.cdf(d2) / 100.0
    else:
        delta = norm.cdf(d1) - 1.0
        theta = (
            -S * pdf_d1 * sigma / (2.0 * sqrt_T)
            + r * K * math.exp(-r * T) * norm.cdf(-d2)
        ) / 365.0
        rho = -K * T * math.exp(-r * T) * norm.cdf(-d2) / 100.0

    return {"delta": delta, "gamma": gamma, "theta": theta, "vega": vega, "rho": rho}


def implied_vol(
    market_price: float,
    S: float,
    K: float,
    T: float,
    r: float,
    option_type: str,
    tol: float = 1e-6,
    max_iter: int = 100,
) -> float | None:
    """Compute implied volatility via Newton-Raphson.

    Returns None if no solution exists (e.g. T=0 or price <= intrinsic).
    """
    if T <= 0:
        return None
    intrinsic = max(0.0, S - K) if option_type == "call" else max(0.0, K - S)
    if market_price <= intrinsic + 1e-10:
        return None

    sigma = 0.3
    for _ in range(max_iter):
        price = bs_price(S, K, T, r, sigma, option_type)
        sqrt_T = math.sqrt(T)
        d1 = (math.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * sqrt_T)
        vega_raw = S * norm.pdf(d1) * sqrt_T
        if abs(vega_raw) < 1e-10:
            return None
        sigma -= (price - market_price) / vega_raw
        if sigma <= 0:
            return None
        if abs(bs_price(S, K, T, r, sigma, option_type) - market_price) < tol:
            break
    return sigma


def bs_chain(
    S: float,
    expiry_days: int,
    r: float,
    sigma: float,
    strikes: list[float],
) -> list[dict]:
    """Compute option chain for a list of strikes.

    Returns list of dicts, one per strike, with call+put price and Greeks.
    """
    T = expiry_days / 365.0
    rows = []
    for K in strikes:
        call_greeks = bs_greeks(S, K, T, r, sigma, "call")
        put_greeks = bs_greeks(S, K, T, r, sigma, "put")
        rows.append({
            "strike": K,
            "call_price": round(bs_price(S, K, T, r, sigma, "call"), 4),
            "call_delta": round(call_greeks["delta"], 4),
            "call_gamma": round(call_greeks["gamma"], 6),
            "call_theta": round(call_greeks["theta"], 4),
            "call_vega": round(call_greeks["vega"], 4),
            "put_price": round(bs_price(S, K, T, r, sigma, "put"), 4),
            "put_delta": round(put_greeks["delta"], 4),
            "put_gamma": round(put_greeks["gamma"], 6),
            "put_theta": round(put_greeks["theta"], 4),
            "put_vega": round(put_greeks["vega"], 4),
        })
    return rows


def bs_iv_surface(
    S: float,
    r: float,
    atm_vol: float,
    skew: float = 0.1,
    smile: float = 0.3,
) -> dict:
    """Compute a synthetic IV surface using a parametric vol model.

    Model: sigma(K, T) = atm_vol * (1 - skew*m + smile*m^2) * term_factor
    where m = ln(K/F) / (atm_vol * sqrt(T)) — normalised log-moneyness
    and term_factor = 1 + 0.08 * (1 - sqrt(T))  — upward term slope for short expiries

    Returns:
        {
            "strikes": [float],         # 9 strikes from 0.8*S to 1.2*S
            "expiry_days": [int],       # 7 expiries: 30,60,90,120,180,252,360
            "iv_surface": [[float]],    # [n_strikes][n_expiries], IV as fraction
        }
    """
    expiry_days = [30, 60, 90, 120, 180, 252, 360]
    # 9 strikes evenly spaced from 80% to 120% of spot
    moneyness_levels = np.linspace(0.80, 1.20, 9)
    strikes = [round(S * m, 2) for m in moneyness_levels]

    iv_surface = []
    for K in strikes:
        row = []
        for days in expiry_days:
            T = days / 365.0
            F = S * math.exp(r * T)
            sqrt_T = math.sqrt(T)
            # Normalised log-moneyness
            m = math.log(K / F) / (atm_vol * sqrt_T) if atm_vol * sqrt_T > 0 else 0.0
            term_factor = 1.0 + 0.08 * (1.0 - sqrt_T)
            iv = atm_vol * (1.0 - skew * m + smile * m**2) * term_factor
            row.append(round(max(0.01, iv), 4))
        iv_surface.append(row)

    return {
        "strikes": strikes,
        "expiry_days": expiry_days,
        "iv_surface": iv_surface,
    }
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_options_pricer.py -v
```
Expected: all 19 tests PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
git add options/__init__.py options/pricer.py tests/test_options_pricer.py
git commit -m "feat(options): add Black-Scholes pricer — price, greeks, IV, chain, surface"
```

---

### Task 2: FastAPI Endpoints + pyproject.toml

**Files:**
- Modify: `seokminal-multi-venue/api_server/main.py` (append ~120 lines)
- Modify: `seokminal-multi-venue/pyproject.toml` (add `options*` to include list)

**Interfaces:**
- Consumes (from Task 1): `bs_greeks`, `bs_price`, `implied_vol`, `bs_chain`, `bs_iv_surface`
- Produces (consumed by Task 3 — frontend):
  - `GET /options/greeks?option_type=call&spot=100&strike=100&expiry_days=30&rate=0.05&vol=0.2`
  - `GET /options/chain?spot=100&expiry_days=30&rate=0.05&vol=0.2` (auto-generates strikes ±20%)
  - `GET /options/iv-surface?spot=100&rate=0.05&atm_vol=0.2&skew=0.1&smile=0.3`

- [ ] **Step 1: Write the failing integration test**

Add to `seokminal-multi-venue/tests/test_api_server.py` (append at the end):

```python
# ── Options endpoints ─────────────────────────────────────────────────────────

def test_options_greeks_call():
    """GET /options/greeks returns delta/gamma/theta/vega/rho/price."""
    r = client.get("/options/greeks?option_type=call&spot=100&strike=100&expiry_days=30&rate=0.05&vol=0.2")
    assert r.status_code == 200
    data = r.json()
    assert 0 < data["delta"] < 1
    assert data["gamma"] > 0
    assert data["price"] > 0


def test_options_greeks_put():
    """GET /options/greeks returns negative delta for put."""
    r = client.get("/options/greeks?option_type=put&spot=100&strike=100&expiry_days=30&rate=0.05&vol=0.2")
    assert r.status_code == 200
    data = r.json()
    assert -1 < data["delta"] < 0


def test_options_chain_structure():
    """GET /options/chain returns list with required keys."""
    r = client.get("/options/chain?spot=100&expiry_days=30&rate=0.05&vol=0.2")
    assert r.status_code == 200
    data = r.json()
    assert "rows" in data
    assert len(data["rows"]) > 0
    row = data["rows"][0]
    assert "strike" in row and "call_price" in row and "put_price" in row


def test_options_iv_surface_shape():
    """GET /options/iv-surface returns 9x7 grid."""
    r = client.get("/options/iv-surface?spot=100&rate=0.05&atm_vol=0.2")
    assert r.status_code == 200
    data = r.json()
    assert len(data["strikes"]) == 9
    assert len(data["expiry_days"]) == 7
    assert len(data["iv_surface"]) == 9
    assert len(data["iv_surface"][0]) == 7
```

- [ ] **Step 2: Run the new tests — verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_api_server.py::test_options_greeks_call -v 2>&1 | tail -5
```
Expected: `FAILED` with `404 Not Found`

- [ ] **Step 3: Update `pyproject.toml`**

In `seokminal-multi-venue/pyproject.toml`, find the `include` list under `[tool.setuptools.packages.find]` and add `"options*"`:

```toml
[tool.setuptools.packages.find]
include = ["backends*", "adapters*", "tests*", "api_server*", "backtest_runner*", "condition_engine*", "strategy_spawner*", "correlation_analysis*", "beta_analysis*", "risk_analysis*", "fred*", "ecos*", "corp_finance*", "live_engine*", "monte_carlo*", "regime_filter*", "krx*", "sec_edgar*", "ksd*", "options*"]
```

- [ ] **Step 4: Add Pydantic models and endpoints to `api_server/main.py`**

Append the following to the end of `seokminal-multi-venue/api_server/main.py` (before the last `if __name__` block if it exists, otherwise just at the end):

```python
# ═══════════════════════════════════════════════════════════════════════════════
# Options Analytics
# ═══════════════════════════════════════════════════════════════════════════════

from options.pricer import bs_price, bs_greeks, implied_vol, bs_chain, bs_iv_surface


class OptionsGreeksResponse(BaseModel):
    option_type: str
    spot: float
    strike: float
    expiry_days: int
    rate: float
    vol: float
    price: float
    intrinsic_value: float
    time_value: float
    delta: float
    gamma: float
    theta: float
    vega: float
    rho: float


class OptionsChainRow(BaseModel):
    strike: float
    call_price: float
    call_delta: float
    call_gamma: float
    call_theta: float
    call_vega: float
    put_price: float
    put_delta: float
    put_gamma: float
    put_theta: float
    put_vega: float


class OptionsChainResponse(BaseModel):
    spot: float
    expiry_days: int
    rate: float
    vol: float
    rows: list[OptionsChainRow]


class OptionsIvSurfaceResponse(BaseModel):
    spot: float
    rate: float
    atm_vol: float
    strikes: list[float]
    expiry_days: list[int]
    iv_surface: list[list[float]]


@app.get("/options/greeks", response_model=OptionsGreeksResponse)
def get_options_greeks(
    option_type: str = Query(..., description="call or put"),
    spot: float = Query(..., gt=0),
    strike: float = Query(..., gt=0),
    expiry_days: int = Query(..., ge=0),
    rate: float = Query(0.05),
    vol: float = Query(..., gt=0),
) -> OptionsGreeksResponse:
    if option_type not in ("call", "put"):
        raise HTTPException(status_code=400, detail="option_type must be 'call' or 'put'")
    T = expiry_days / 365.0
    price = bs_price(spot, strike, T, rate, vol, option_type)
    greeks = bs_greeks(spot, strike, T, rate, vol, option_type)
    intrinsic = max(0.0, spot - strike) if option_type == "call" else max(0.0, strike - spot)
    return OptionsGreeksResponse(
        option_type=option_type,
        spot=spot,
        strike=strike,
        expiry_days=expiry_days,
        rate=rate,
        vol=vol,
        price=round(price, 4),
        intrinsic_value=round(intrinsic, 4),
        time_value=round(price - intrinsic, 4),
        **{k: round(v, 6) for k, v in greeks.items()},
    )


@app.get("/options/chain", response_model=OptionsChainResponse)
def get_options_chain(
    spot: float = Query(..., gt=0),
    expiry_days: int = Query(..., ge=1),
    rate: float = Query(0.05),
    vol: float = Query(..., gt=0),
    strikes: str | None = Query(None, description="Comma-separated strikes. Default: 9 strikes ±20% of spot."),
) -> OptionsChainResponse:
    if strikes:
        try:
            ks = [float(s.strip()) for s in strikes.split(",") if s.strip()]
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid strikes format") from exc
    else:
        ks = [round(spot * m, 2) for m in np.linspace(0.80, 1.20, 9)]
    rows = bs_chain(spot, expiry_days, rate, vol, ks)
    return OptionsChainResponse(
        spot=spot,
        expiry_days=expiry_days,
        rate=rate,
        vol=vol,
        rows=[OptionsChainRow(**r) for r in rows],
    )


@app.get("/options/iv-surface", response_model=OptionsIvSurfaceResponse)
def get_options_iv_surface(
    spot: float = Query(..., gt=0),
    rate: float = Query(0.05),
    atm_vol: float = Query(..., gt=0),
    skew: float = Query(0.1),
    smile: float = Query(0.3),
) -> OptionsIvSurfaceResponse:
    result = bs_iv_surface(spot, rate, atm_vol, skew, smile)
    return OptionsIvSurfaceResponse(
        spot=spot,
        rate=rate,
        atm_vol=atm_vol,
        **result,
    )
```

**Note:** `numpy` is already imported as `np` in `main.py` (check first — if not, add `import numpy as np` near the top imports).

- [ ] **Step 5: Verify numpy is imported in main.py**

```bash
grep "import numpy" /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue/api_server/main.py
```

If no output: add `import numpy as np` to the imports section at the top of `main.py`.

- [ ] **Step 6: Run the new API tests**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest tests/test_api_server.py::test_options_greeks_call tests/test_api_server.py::test_options_greeks_put tests/test_api_server.py::test_options_chain_structure tests/test_api_server.py::test_options_iv_surface_shape -v
```
Expected: 4 tests PASS

- [ ] **Step 7: Run full backend test suite**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
pytest --ignore=tests/test_data_ingestion.py --ignore=tests/test_data_ingestion_ib.py --ignore=tests/test_data_ingestion_kospi.py --ignore=tests/test_live_trade_stream.py --ignore=tests/test_live_trade_stream_ib.py --ignore=tests/test_client.py --ignore=tests/test_ib_client.py --ignore=tests/test_ib_order_client.py --ignore=tests/test_order_client.py --ignore=tests/test_ws_auth.py --ignore=tests/test_ws_client.py -v 2>&1 | tail -15
```
Expected: all non-integration tests pass

- [ ] **Step 8: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
git add api_server/main.py pyproject.toml tests/test_api_server.py
git commit -m "feat(api): add /options/greeks, /options/chain, /options/iv-surface endpoints"
```

---

### Task 3: Frontend API Client + Options Page (Greeks + Chain)

**Files:**
- Modify: `seokminal-dashboard/lib/api.ts` (append ~80 lines)
- Create: `seokminal-dashboard/app/options/page.tsx`

**Interfaces:**
- Consumes (from Task 2):
  - `GET /options/greeks` → `OptionsGreeksResponse`
  - `GET /options/chain` → `OptionsChainResponse`
  - `GET /options/iv-surface` → `OptionsIvSurfaceResponse`
- Produces (consumed by NavBar in Task 4):
  - Page exists at `/options`

Note: This task creates the page with Greeks and Chain tabs. The IV Surface tab gets its D3 chart in Task 4. For now, show a placeholder "Coming in Task 4" div for the IV Surface tab.

- [ ] **Step 1: Add TypeScript interfaces and API functions to `lib/api.ts`**

Append to the end of `seokminal-dashboard/lib/api.ts`:

```typescript
// ── Options ─────────────────────────────────────────────────────────────────

export interface OptionsGreeksResponse {
  option_type: string;
  spot: number;
  strike: number;
  expiry_days: number;
  rate: number;
  vol: number;
  price: number;
  intrinsic_value: number;
  time_value: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

export interface OptionsChainRow {
  strike: number;
  call_price: number;
  call_delta: number;
  call_gamma: number;
  call_theta: number;
  call_vega: number;
  put_price: number;
  put_delta: number;
  put_gamma: number;
  put_theta: number;
  put_vega: number;
}

export interface OptionsChainResponse {
  spot: number;
  expiry_days: number;
  rate: number;
  vol: number;
  rows: OptionsChainRow[];
}

export interface OptionsIvSurfaceResponse {
  spot: number;
  rate: number;
  atm_vol: number;
  strikes: number[];
  expiry_days: number[];
  iv_surface: number[][];
}

export async function getOptionsGreeks(
  optionType: string,
  spot: number,
  strike: number,
  expiryDays: number,
  rate: number,
  vol: number,
  signal?: AbortSignal
): Promise<OptionsGreeksResponse> {
  const params = new URLSearchParams({
    option_type: optionType,
    spot: String(spot),
    strike: String(strike),
    expiry_days: String(expiryDays),
    rate: String(rate),
    vol: String(vol),
  });
  return handleResponse<OptionsGreeksResponse>(
    await fetch(`${API_URL}/options/greeks?${params}`, { signal })
  );
}

export async function getOptionsChain(
  spot: number,
  expiryDays: number,
  rate: number,
  vol: number,
  signal?: AbortSignal
): Promise<OptionsChainResponse> {
  const params = new URLSearchParams({
    spot: String(spot),
    expiry_days: String(expiryDays),
    rate: String(rate),
    vol: String(vol),
  });
  return handleResponse<OptionsChainResponse>(
    await fetch(`${API_URL}/options/chain?${params}`, { signal })
  );
}

export async function getOptionsIvSurface(
  spot: number,
  rate: number,
  atmVol: number,
  skew?: number,
  smile?: number,
  signal?: AbortSignal
): Promise<OptionsIvSurfaceResponse> {
  const params = new URLSearchParams({
    spot: String(spot),
    rate: String(rate),
    atm_vol: String(atmVol),
  });
  if (skew !== undefined) params.set("skew", String(skew));
  if (smile !== undefined) params.set("smile", String(smile));
  return handleResponse<OptionsIvSurfaceResponse>(
    await fetch(`${API_URL}/options/iv-surface?${params}`, { signal })
  );
}
```

- [ ] **Step 2: Run frontend tests — verify still passing**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test 2>&1 | tail -5
```
Expected: 127/127 passing

- [ ] **Step 3: Create `app/options/page.tsx`**

Create `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard/app/options/page.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import {
  ApiError,
  getOptionsGreeks, getOptionsChain,
  type OptionsGreeksResponse, type OptionsChainResponse, type OptionsChainRow,
} from "@/lib/api";

type Tab = "greeks" | "chain" | "surface";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt4(v: number): string { return v.toFixed(4); }
function fmt6(v: number): string { return v.toFixed(6); }

function signCls(v: number): string {
  return v > 0 ? "text-pos" : v < 0 ? "text-neg" : "text-text-3";
}

function Err({ msg }: { msg: string | null }) {
  return msg ? <p className="text-neg text-sm mt-0 mb-3">ERR: {msg}</p> : null;
}

// ── Greeks Tab ───────────────────────────────────────────────────────────────

function GreeksTab() {
  const [optionType, setOptionType] = useState<"call" | "put">("call");
  const [spot, setSpot] = useState("100");
  const [strike, setStrike] = useState("100");
  const [expiryDays, setExpiryDays] = useState("30");
  const [rate, setRate] = useState("0.05");
  const [vol, setVol] = useState("0.20");
  const [result, setResult] = useState<OptionsGreeksResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getOptionsGreeks(
        optionType,
        parseFloat(spot), parseFloat(strike),
        parseInt(expiryDays), parseFloat(rate), parseFloat(vol),
        ctrl.signal
      ));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  const GREEK_ROWS: { label: string; key: keyof OptionsGreeksResponse; fmt: (v: number) => string; desc: string }[] = [
    { label: "Price",           key: "price",           fmt: fmt4, desc: "Theoretical option price" },
    { label: "Intrinsic Value", key: "intrinsic_value", fmt: fmt4, desc: "max(S-K, 0) for call, max(K-S, 0) for put" },
    { label: "Time Value",      key: "time_value",      fmt: fmt4, desc: "Price minus intrinsic value" },
    { label: "Delta (Δ)",       key: "delta",           fmt: fmt4, desc: "Price change per $1 move in spot" },
    { label: "Gamma (Γ)",       key: "gamma",           fmt: fmt6, desc: "Delta change per $1 move in spot" },
    { label: "Theta (Θ)",       key: "theta",           fmt: fmt4, desc: "Price change per calendar day" },
    { label: "Vega (ν)",        key: "vega",            fmt: fmt4, desc: "Price change per 1% vol change" },
    { label: "Rho (ρ)",         key: "rho",             fmt: fmt4, desc: "Price change per 1% rate change" },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-panel border border-border rounded-lg p-4">
        <div className="flex gap-3 flex-wrap items-end">
          {/* Option type */}
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Type</label>
            <div className="flex gap-1">
              {(["call", "put"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setOptionType(t)}
                  className={`px-3 py-1 text-xs rounded border cursor-pointer transition-colors ${
                    optionType === t
                      ? "border-accent text-accent bg-accent/10"
                      : "border-border text-text-3 hover:text-text-2 bg-transparent"
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {[
            { label: "Spot (S)", value: spot, set: setSpot },
            { label: "Strike (K)", value: strike, set: setStrike },
            { label: "Expiry (days)", value: expiryDays, set: setExpiryDays },
            { label: "Rate (r)", value: rate, set: setRate },
            { label: "Vol (σ)", value: vol, set: setVol },
          ].map(({ label, value, set }) => (
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
            onClick={run}
            disabled={loading}
            className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed self-end"
          >
            {loading ? "Computing…" : "Compute"}
          </button>
        </div>
      </div>

      <Err msg={error} />

      {/* Results table */}
      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-panel-2">
          <span className="text-text-3 text-[11px] uppercase tracking-wider">
            {optionType.toUpperCase()} Option Results
          </span>
        </div>
        <table className="border-collapse w-full">
          <tbody>
            {GREEK_ROWS.map(row => {
              const v = result ? (result[row.key] as number) : null;
              return (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-accent text-[13px] w-[180px]">{row.label}</td>
                  <td className={`px-4 py-2 text-sm font-data font-bold w-32 ${loading ? "text-text-3/30" : v !== null ? signCls(v) : "text-text-3"}`}>
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

// ── Chain Tab ─────────────────────────────────────────────────────────────────

function ChainTab() {
  const [spot, setSpot] = useState("100");
  const [expiryDays, setExpiryDays] = useState("30");
  const [rate, setRate] = useState("0.05");
  const [vol, setVol] = useState("0.20");
  const [result, setResult] = useState<OptionsChainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getOptionsChain(
        parseFloat(spot), parseInt(expiryDays), parseFloat(rate), parseFloat(vol),
        ctrl.signal
      ));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  const spotNum = parseFloat(spot) || 100;

  function atmCls(row: OptionsChainRow): string {
    const moneyness = row.strike / spotNum;
    return moneyness > 0.98 && moneyness < 1.02 ? "bg-accent/5" : "";
  }

  return (
    <div className="space-y-4">
      <div className="bg-panel border border-border rounded-lg p-4">
        <div className="flex gap-3 flex-wrap items-end">
          {[
            { label: "Spot (S)", value: spot, set: setSpot },
            { label: "Expiry (days)", value: expiryDays, set: setExpiryDays },
            { label: "Rate (r)", value: rate, set: setRate },
            { label: "Vol (σ)", value: vol, set: setVol },
          ].map(({ label, value, set }) => (
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
            onClick={run}
            disabled={loading}
            className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed self-end"
          >
            {loading ? "Computing…" : "Compute"}
          </button>
        </div>
      </div>

      <Err msg={error} />

      {result && (
        <div className="overflow-x-auto">
          <table className="border-collapse w-full text-xs font-data">
            <thead>
              <tr className="border-b border-border">
                <th colSpan={5} className="px-3 py-2 text-pos text-center border-r border-border">CALL</th>
                <th className="px-3 py-2 text-text-3 text-center font-medium">STRIKE</th>
                <th colSpan={5} className="px-3 py-2 text-neg text-center border-l border-border">PUT</th>
              </tr>
              <tr className="border-b border-border text-text-3">
                {["Price", "Δ", "Γ", "Θ", "ν"].map(h => (
                  <th key={`c-${h}`} className="px-3 py-1.5 text-right font-medium">{h}</th>
                ))}
                <th className="px-3 py-1.5 text-center font-semibold text-text-2 border-x border-border">K</th>
                {["Price", "Δ", "Γ", "Θ", "ν"].map(h => (
                  <th key={`p-${h}`} className="px-3 py-1.5 text-right font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map(row => (
                <tr key={row.strike} className={`border-b border-border hover:bg-panel-2 ${atmCls(row)}`}>
                  <td className="px-3 py-1.5 text-right text-pos">{fmt4(row.call_price)}</td>
                  <td className="px-3 py-1.5 text-right text-text-2">{fmt4(row.call_delta)}</td>
                  <td className="px-3 py-1.5 text-right text-text-3">{fmt6(row.call_gamma)}</td>
                  <td className="px-3 py-1.5 text-right text-neg">{fmt4(row.call_theta)}</td>
                  <td className="px-3 py-1.5 text-right text-text-2">{fmt4(row.call_vega)}</td>
                  <td className="px-3 py-1.5 text-center font-semibold text-accent border-x border-border">
                    {row.strike}
                  </td>
                  <td className="px-3 py-1.5 text-right text-neg">{fmt4(row.put_price)}</td>
                  <td className="px-3 py-1.5 text-right text-text-2">{fmt4(row.put_delta)}</td>
                  <td className="px-3 py-1.5 text-right text-text-3">{fmt6(row.put_gamma)}</td>
                  <td className="px-3 py-1.5 text-right text-neg">{fmt4(row.put_theta)}</td>
                  <td className="px-3 py-1.5 text-right text-text-2">{fmt4(row.put_vega)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!result && !loading && !error && (
        <div className="text-center py-12 text-text-3 text-sm">
          Configure parameters and click Compute to view the options chain.
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "greeks",  label: "Greeks" },
  { id: "chain",   label: "Chain" },
  { id: "surface", label: "IV Surface" },
];

export default function OptionsPage() {
  const [tab, setTab] = useState<Tab>("greeks");

  return (
    <div className="p-6 space-y-4 max-w-[1200px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Options Analytics</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Black-Scholes pricing, Greeks, option chain, and implied volatility surface.
        </p>
      </div>

      {/* Tab bar */}
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

      {tab === "greeks"  && <GreeksTab />}
      {tab === "chain"   && <ChainTab />}
      {tab === "surface" && (
        <div className="text-center py-16 text-text-3 text-sm">
          IV Surface heatmap — implemented in Task 4.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run frontend tests — still passing**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test 2>&1 | tail -5
npx tsc --noEmit 2>&1 | head -5
```
Expected: 127/127 passing, zero TypeScript errors

- [ ] **Step 5: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add lib/api.ts app/options/page.tsx
git commit -m "feat(options): add Options page (Greeks + Chain tabs) and API client types"
```

---

### Task 4: IV Surface D3 Heatmap + NavBar + Docs

**Files:**
- Modify: `seokminal-dashboard/app/options/page.tsx` (replace IV Surface placeholder with D3 heatmap)
- Modify: `seokminal-dashboard/components/NavBar.tsx` (add Options to Research group)
- Modify: `seokminal-dashboard/docs/roadmap.md` (mark Phase 13 complete)
- Modify: `seokminal-dashboard/docs/progress.md` (add Phase 13 entry)

**Interfaces:**
- Consumes (from Task 3): `getOptionsIvSurface`, `OptionsIvSurfaceResponse` from `lib/api.ts`
- Consumes: D3 v7 (already installed: `import * as d3 from "d3"`)

- [ ] **Step 1: Run existing tests to establish baseline**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test 2>&1 | tail -5
```
Expected: 127/127 passing

- [ ] **Step 2: Replace IV Surface placeholder in `app/options/page.tsx`**

The IV Surface tab currently shows a placeholder div. Replace it with a full `IvSurfaceTab` component.

**Modify the existing React import** (already has `useRef, useState`) to add `useEffect`:
```tsx
import { useEffect, useRef, useState } from "react";
```

**Add d3 import** (new line, after the React import):
```tsx
import * as d3 from "d3";
```

**Modify the existing `@/lib/api` import** to also import `getOptionsIvSurface` and `OptionsIvSurfaceResponse`:
```tsx
import {
  ApiError,
  getOptionsGreeks, getOptionsChain, getOptionsIvSurface,
  type OptionsGreeksResponse, type OptionsChainResponse, type OptionsChainRow,
  type OptionsIvSurfaceResponse,
} from "@/lib/api";
```

Add the `IvSurfaceTab` component function before the `const TABS` declaration:

```tsx
// ── IV Surface Tab ────────────────────────────────────────────────────────────

function IvSurfaceTab() {
  const [spot, setSpot] = useState("100");
  const [rate, setRate] = useState("0.05");
  const [atmVol, setAtmVol] = useState("0.20");
  const [result, setResult] = useState<OptionsIvSurfaceResponse | null>(null);
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
      setResult(await getOptionsIvSurface(
        parseFloat(spot), parseFloat(rate), parseFloat(atmVol),
        undefined, undefined, ctrl.signal
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

    const W = 560, H = 300;
    const margin = { top: 30, right: 80, bottom: 50, left: 64 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const { strikes, expiry_days, iv_surface } = result;
    const nS = strikes.length;   // 9 strikes (rows)
    const nE = expiry_days.length; // 7 expiries (columns)

    // x-axis: expiry days
    const xScale = d3.scaleBand<number>()
      .domain(expiry_days)
      .range([0, innerW])
      .padding(0.05);

    // y-axis: strikes (displayed top-to-bottom as low to high)
    const yScale = d3.scaleBand<number>()
      .domain([...strikes].reverse())
      .range([0, innerH])
      .padding(0.05);

    // Flat IV array for color domain
    const allIvs = iv_surface.flat();
    const minIv = d3.min(allIvs)!;
    const maxIv = d3.max(allIvs)!;

    // Color scale: blue (low) → white (mid) → red (high)
    const colorScale = d3.scaleSequential<string>()
      .domain([minIv, maxIv])
      .interpolator(d3.interpolateRdYlBu);
    // Reverse so blue = low, red = high
    const color = (v: number) => colorScale(maxIv - v + minIv);

    // Draw heatmap cells
    for (let si = 0; si < nS; si++) {
      for (let ei = 0; ei < nE; ei++) {
        const iv = iv_surface[si][ei];
        const K = strikes[si];
        const E = expiry_days[ei];
        g.append("rect")
          .attr("x", xScale(E)!)
          .attr("y", yScale(K)!)
          .attr("width", xScale.bandwidth())
          .attr("height", yScale.bandwidth())
          .attr("fill", color(iv))
          .attr("rx", 2);

        // IV label inside cell
        g.append("text")
          .attr("x", xScale(E)! + xScale.bandwidth() / 2)
          .attr("y", yScale(K)! + yScale.bandwidth() / 2 + 4)
          .attr("text-anchor", "middle")
          .attr("font-size", 9)
          .attr("fill", iv > (minIv + maxIv) / 2 ? "#111" : "#eee")
          .text(`${(iv * 100).toFixed(1)}%`);
      }
    }

    // x-axis (expiry labels)
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(
        d3.axisBottom<number>(xScale)
          .tickFormat(d => `${d}d`)
      )
      .call(ax => ax.select(".domain").remove())
      .call(ax => ax.selectAll("text").attr("fill", "#9AA4B2").attr("font-size", 11))
      .call(ax => ax.selectAll(".tick line").remove());

    // y-axis (strike labels)
    g.append("g")
      .call(
        d3.axisLeft<number>(yScale)
          .tickFormat(d => String(d))
      )
      .call(ax => ax.select(".domain").remove())
      .call(ax => ax.selectAll("text").attr("fill", "#9AA4B2").attr("font-size", 11))
      .call(ax => ax.selectAll(".tick line").remove());

    // Axis labels
    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 40)
      .attr("text-anchor", "middle")
      .attr("fill", "#9AA4B2")
      .attr("font-size", 11)
      .text("Expiry (days)");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2)
      .attr("y", -48)
      .attr("text-anchor", "middle")
      .attr("fill", "#9AA4B2")
      .attr("font-size", 11)
      .text("Strike");

    // Color legend (right side)
    const legendH = innerH;
    const legendX = innerW + 16;
    const legendSteps = 20;
    const stepH = legendH / legendSteps;

    for (let i = 0; i < legendSteps; i++) {
      const v = minIv + (i / (legendSteps - 1)) * (maxIv - minIv);
      g.append("rect")
        .attr("x", legendX)
        .attr("y", legendH - (i + 1) * stepH)
        .attr("width", 14)
        .attr("height", stepH)
        .attr("fill", color(v));
    }

    g.append("text").attr("x", legendX + 7).attr("y", -4).attr("text-anchor", "middle").attr("fill", "#9AA4B2").attr("font-size", 9).text(`${(maxIv * 100).toFixed(0)}%`);
    g.append("text").attr("x", legendX + 7).attr("y", legendH + 12).attr("text-anchor", "middle").attr("fill", "#9AA4B2").attr("font-size", 9).text(`${(minIv * 100).toFixed(0)}%`);

  }, [result]);

  return (
    <div className="space-y-4">
      <div className="bg-panel border border-border rounded-lg p-4">
        <div className="flex gap-3 flex-wrap items-end">
          {[
            { label: "Spot (S)", value: spot, set: setSpot },
            { label: "Rate (r)", value: rate, set: setRate },
            { label: "ATM Vol (σ)", value: atmVol, set: setAtmVol },
          ].map(({ label, value, set }) => (
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
            onClick={run}
            disabled={loading}
            className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed self-end"
          >
            {loading ? "Computing…" : "Compute"}
          </button>
        </div>
      </div>

      <Err msg={error} />

      {result && (
        <div className="bg-bg border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2">
            <span className="text-text-3 text-[11px] uppercase tracking-wider">
              Implied Volatility Surface — Spot {result.spot} · ATM Vol {(result.atm_vol * 100).toFixed(0)}%
            </span>
          </div>
          <div className="p-4">
            <svg ref={svgRef} width={560} height={300} className="block" />
          </div>
        </div>
      )}

      {!result && !loading && !error && (
        <div className="text-center py-16 text-text-3 text-sm">
          Configure parameters and click Compute to view the IV surface.
        </div>
      )}
    </div>
  );
}
```

Then in the main page, replace the IV Surface placeholder:
```tsx
{tab === "surface" && (
  <div className="text-center py-16 text-text-3 text-sm">
    IV Surface heatmap — implemented in Task 4.
  </div>
)}
```
→
```tsx
{tab === "surface" && <IvSurfaceTab />}
```

- [ ] **Step 3: Add Options to NavBar (Research group)**

In `seokminal-dashboard/components/NavBar.tsx`, find the Research group items array and add Options:

```tsx
{
  label: "Research",
  items: [
    { href: "/notebooks",   label: "Notebooks" },
    { href: "/strategies",  label: "Strategies" },
    { href: "/experiments", label: "Experiments" },
    { href: "/quant",       label: "Quant" },
    { href: "/options",     label: "Options" },   // ← add this line
    { href: "/report",      label: "Report" },
  ],
},
```

- [ ] **Step 4: Run frontend tests + TypeScript check**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npm test 2>&1 | tail -5
npx tsc --noEmit 2>&1 | head -10
```
Expected: 127/127 passing, zero TypeScript errors

- [ ] **Step 5: Update docs**

In `seokminal-dashboard/docs/roadmap.md`, add Phase 13 row to the completed table and update HEAD + test count. Add to the completed phase table:

```
| 13 | Options Analytics | `options/pricer.py`, `app/options/page.tsx`, IV Surface heatmap | — |
```

Update `**HEAD:**` to current git hash and `**테스트:**` to `127/127 통과` (test count unchanged).

Remove Phase 13 from the "향후 계획" section (or add a note: completed).

In `seokminal-dashboard/docs/progress.md`, prepend a Phase 13 section:

```markdown
## Phase 13 — Options Analytics (2026-06-28)

### 완료된 작업
- Black-Scholes pricer: `bs_price`, `bs_greeks`, `implied_vol`, `bs_chain`, `bs_iv_surface` (`options/pricer.py`)
- API: `/options/greeks`, `/options/chain`, `/options/iv-surface` endpoints (`api_server/main.py`)
- Frontend: `/options` page — Greeks calculator, Options Chain table, IV Surface D3 heatmap
- NavBar: Options added to Research group

### 변경된 파일
**Backend (seokminal-multi-venue):**
- `options/__init__.py` (new)
- `options/pricer.py` (new)
- `tests/test_options_pricer.py` (new)
- `api_server/main.py` (+~120 lines)
- `pyproject.toml` (+options* to packages)

**Frontend (seokminal-dashboard):**
- `lib/api.ts` (+3 functions, +5 types)
- `app/options/page.tsx` (new)
- `components/NavBar.tsx` (Options link added)

### 다음 할 일
- Phase 14: Futures (롤오버 처리, 연속 계약)
```

- [ ] **Step 6: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add app/options/page.tsx components/NavBar.tsx docs/roadmap.md docs/progress.md
git commit -m "feat(options): add IV Surface D3 heatmap, Options NavBar link, docs update"
```
