# Phase 28: AI Trader MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/ai-trader` placeholder page with a working AI Strategy Advisor: given an instrument and date range, Claude analyzes price data and recommends the best strategy with concrete parameters.

**Architecture:** Two-task delivery. Backend: new `ai_strategy/advisor.py` module that computes bar statistics and calls Claude (`claude-haiku-4-5-20251001`) for a structured JSON recommendation; new `GET /ai/strategy-recommend` endpoint in main.py. Frontend: upgrade `app/ai-trader/page.tsx` from placeholder to a functional advisor UI; add `getAiRecommendation()` to `lib/api.ts`.

**Tech Stack:** FastAPI, Anthropic Python SDK (`anthropic==0.111.0`, already installed), Next.js/React

## Global Constraints

- Python bin: `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`
- Test command: `cd seokminal-multi-venue && /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/ -q`
- Frontend test command: `cd seokminal-dashboard && npm test`
- TypeScript check: `npx tsc --noEmit`
- `@pytest.mark.asyncio` forbidden
- Pre-existing failures to ignore: `test_auth.py` ×3, `test_backtest_happy_path` ×1
- Design tokens only in className: `bg-bg/panel/panel-2`, `border-border`, `text-text-1/2/3`, `text-accent/pos/neg/warn/info`
- `style={{}}` forbidden (no chart in this phase — no exceptions needed)
- `bg-accent text-black` on the primary "Get Recommendation" button only
- Raw `fetch` in components forbidden — must use `lib/api.ts` functions
- AbortController pattern: abort→create→assign ref→fetch→catch AbortError silently→`if (!ctrl.signal.aborted) setLoading(false)` in finally→unmount cleanup
- Claude model to use: `claude-haiku-4-5-20251001`
- Commit to main directly; no feature branches
- Co-Authored-By: no model names or internal context info

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `seokminal-multi-venue/ai_strategy/__init__.py` | Create | Empty package init |
| `seokminal-multi-venue/ai_strategy/advisor.py` | Create | `recommend_strategy(bars, instrument_id) -> dict` |
| `seokminal-multi-venue/api_server/main.py` | Modify | `GET /ai/strategy-recommend` endpoint |
| `seokminal-multi-venue/tests/test_ai_advisor.py` | Create | 4 tests |
| `seokminal-dashboard/lib/api.ts` | Modify | `AiRecommendation` type + `getAiRecommendation()` |
| `seokminal-dashboard/app/ai-trader/page.tsx` | Modify | Replace placeholder with advisor UI |

---

### Task 1: Backend — AI advisor module + endpoint

**Files:**
- Create: `seokminal-multi-venue/ai_strategy/__init__.py`
- Create: `seokminal-multi-venue/ai_strategy/advisor.py`
- Modify: `seokminal-multi-venue/api_server/main.py`
- Create: `seokminal-multi-venue/tests/test_ai_advisor.py`

**Interfaces:**
- Consumes: `anthropic.Anthropic()` client; `statistics` stdlib; existing bar mock pattern from `tests/test_backtest_optimize.py`
- Produces:
  - `recommend_strategy(bars: list, instrument_id: str) -> dict` — keys: `strategy: str`, `params: dict`, `reasoning: str`
  - `GET /ai/strategy-recommend` returning `AiRecommendResponse`

- [ ] **Step 1: Write failing tests**

Create `seokminal-multi-venue/tests/test_ai_advisor.py`:

```python
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from ai_strategy.advisor import recommend_strategy
from api_server.main import app

client = TestClient(app)


def _fake_bars(n=50):
    bar = MagicMock()
    bar.close = 100.0
    bar.ts_event = 1_704_067_200_000_000_000  # 2024-01-01 UTC in nanoseconds
    return [bar] * n


def _mock_anthropic_response(strategy="macd", params=None, reasoning="Test reasoning."):
    if params is None:
        params = {"fast": 12, "slow": 26, "signal_period": 9}
    import json
    mock_client = MagicMock()
    mock_message = MagicMock()
    mock_content = MagicMock()
    mock_content.text = json.dumps({"strategy": strategy, "params": params, "reasoning": reasoning})
    mock_message.content = [mock_content]
    mock_client.messages.create.return_value = mock_message
    return mock_client


def test_recommend_strategy_returns_required_keys():
    bars = _fake_bars(50)
    with patch("ai_strategy.advisor.anthropic.Anthropic", return_value=_mock_anthropic_response()):
        result = recommend_strategy(bars, "AAPL.NASDAQ")
    assert "strategy" in result
    assert "params" in result
    assert "reasoning" in result
    assert result["strategy"] in {"ema_cross", "macd", "rsi"}


def test_recommend_strategy_raises_on_empty_bars():
    with pytest.raises(ValueError, match="no bars"):
        recommend_strategy([], "AAPL.NASDAQ")


def test_ai_recommend_endpoint_returns_200():
    with (
        patch("api_server.main.ParquetDataCatalog") as mock_cat,
        patch("api_server.main.bar_type_for") as mock_bt,
        patch("api_server.main.InstrumentId") as mock_iid,
        patch("api_server.main.recommend_strategy") as mock_rec,
    ):
        mock_cat.return_value.bars.return_value = _fake_bars(50)
        mock_bt.return_value = MagicMock(__str__=lambda s: "bar_type")
        mock_iid.from_str.return_value = MagicMock()
        mock_rec.return_value = {
            "strategy": "macd",
            "params": {"fast": 12, "slow": 26, "signal_period": 9},
            "reasoning": "MACD suits this trending instrument.",
        }

        r = client.get(
            "/ai/strategy-recommend"
            "?instrument_id=AAPL.NASDAQ&start=2024-01-01&end=2024-12-31"
        )

    assert r.status_code == 200
    data = r.json()
    assert data["strategy"] == "macd"
    assert "fast" in data["params"]
    assert data["instrument_id"] == "AAPL.NASDAQ"
    assert len(data["reasoning"]) > 0


def test_ai_recommend_endpoint_returns_400_for_missing_bars():
    with (
        patch("api_server.main.ParquetDataCatalog") as mock_cat,
        patch("api_server.main.bar_type_for") as mock_bt,
        patch("api_server.main.InstrumentId") as mock_iid,
    ):
        mock_cat.return_value.bars.return_value = []
        mock_bt.return_value = MagicMock(__str__=lambda s: "bar_type")
        mock_iid.from_str.return_value = MagicMock()

        r = client.get(
            "/ai/strategy-recommend"
            "?instrument_id=UNKNOWN.XX&start=2024-01-01&end=2024-12-31"
        )

    assert r.status_code == 400
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/test_ai_advisor.py -v
```

Expected: ImportError — `ai_strategy.advisor` not found.

- [ ] **Step 3: Create ai_strategy package**

Create `seokminal-multi-venue/ai_strategy/__init__.py` (empty file).

Create `seokminal-multi-venue/ai_strategy/advisor.py`:

```python
"""AI-powered strategy advisor using Claude."""
from __future__ import annotations

import json
import statistics

import anthropic

_VALID_STRATEGIES = {"ema_cross", "macd", "rsi"}
_MODEL = "claude-haiku-4-5-20251001"


def recommend_strategy(bars: list, instrument_id: str) -> dict:
    """
    Analyze bars and ask Claude to recommend a trading strategy.

    Returns dict with keys: strategy (str), params (dict), reasoning (str).
    Raises ValueError if bars is empty.
    """
    if not bars:
        raise ValueError("no bars provided")

    closes = [float(b.close) for b in bars]
    mean_price = statistics.mean(closes)
    price_std = statistics.stdev(closes) if len(closes) > 1 else 0.0
    overall_trend = (closes[-1] - closes[0]) / closes[0] if closes[0] > 0 else 0.0
    recent = closes[-20:] if len(closes) >= 20 else closes
    recent_mean = statistics.mean(recent)
    recent_vs_overall = (recent_mean - mean_price) / mean_price if mean_price > 0 else 0.0

    prompt = f"""You are a quantitative trading strategy advisor. Analyze this instrument and recommend the best strategy.

Instrument: {instrument_id}
Total bars analyzed: {len(bars)}
Price range: ${min(closes):.2f} - ${max(closes):.2f}
Mean price: ${mean_price:.2f}
Price volatility (std): ${price_std:.2f}
Overall trend (first to last): {overall_trend:+.2%}
Recent 20-bar mean vs overall mean: {recent_vs_overall:+.2%}

Available strategies:
- ema_cross: EMA crossover signals (params: fast, slow). Best for trending markets.
- macd: MACD momentum (params: fast, slow, signal_period). Good for momentum with trend confirmation.
- rsi: RSI mean-reversion (params: period, oversold, overbought). Best for ranging markets.

Respond with ONLY valid JSON in this exact format (no markdown, no code fences):
{{"strategy": "ema_cross"|"macd"|"rsi", "params": {{...}}, "reasoning": "2-3 sentence explanation"}}

For ema_cross: params = {{"fast": <int>, "slow": <int>}}
For macd: params = {{"fast": <int>, "slow": <int>, "signal_period": <int>}}
For rsi: params = {{"period": <int>, "oversold": <float>, "overbought": <float>}}"""

    client = anthropic.Anthropic()
    message = client.messages.create(
        model=_MODEL,
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )

    text = message.content[0].text.strip()
    # Strip markdown code fences if model adds them despite instructions
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("{"):
                text = part
                break

    result = json.loads(text)
    if result.get("strategy") not in _VALID_STRATEGIES:
        raise ValueError(f"Claude returned unknown strategy: {result.get('strategy')!r}")
    return result
```

- [ ] **Step 4: Add endpoint to main.py**

In `api_server/main.py`, add the import at the top (after existing imports):

```python
from ai_strategy.advisor import recommend_strategy
```

Then add the Pydantic model and endpoint anywhere in main.py (no routing order constraint for `/ai/` prefix):

```python
class AiRecommendResponse(BaseModel):
    instrument_id: str
    strategy: str
    params: dict
    reasoning: str


@app.get("/ai/strategy-recommend", response_model=AiRecommendResponse)
def ai_strategy_recommend(
    instrument_id: str = Query(...),
    start: dt.date = Query(...),
    end: dt.date = Query(...),
) -> AiRecommendResponse:
    start_ns = date_to_ns(start.isoformat())
    end_ns = date_to_ns(end.isoformat())

    try:
        bar_type_str = str(bar_type_for(InstrumentId.from_str(instrument_id)))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"invalid instrument_id: {exc}") from exc

    catalog = ParquetDataCatalog(CATALOG_PATH)
    all_bars = catalog.bars(bar_types=[bar_type_str])
    bars = [b for b in all_bars if start_ns <= b.ts_event <= end_ns]

    if not bars:
        raise HTTPException(
            status_code=400,
            detail=f"no bars found for {instrument_id!r} in [{start}, {end}]",
        )

    try:
        result = recommend_strategy(bars, instrument_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI recommendation failed: {exc}") from exc

    return AiRecommendResponse(
        instrument_id=instrument_id,
        strategy=result["strategy"],
        params=result["params"],
        reasoning=result["reasoning"],
    )
```

- [ ] **Step 5: Run all tests**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3 -m pytest tests/ -q
```

Expected: 4 new tests pass; pre-existing 4 failures unchanged; no regressions.

- [ ] **Step 6: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-multi-venue
git add ai_strategy/__init__.py ai_strategy/advisor.py api_server/main.py tests/test_ai_advisor.py
git commit -m "feat: add AI strategy advisor module and GET /ai/strategy-recommend endpoint"
```

---

### Task 2: Frontend — api.ts + ai-trader page

**Files:**
- Modify: `seokminal-dashboard/lib/api.ts`
- Modify: `seokminal-dashboard/app/ai-trader/page.tsx`

**Interfaces:**
- Consumes:
  - `handleResponse<T>()` and `API_URL` from `lib/api.ts`
  - Existing `ApiError` import pattern
- Produces:
  - `AiRecommendation` exported interface: `instrument_id: string`, `strategy: string`, `params: Record<string, number>`, `reasoning: string`
  - `getAiRecommendation(instrumentId, start, end, signal?) → Promise<AiRecommendation>`
  - Upgraded `/ai-trader` page with advisor UI

- [ ] **Step 1: Add type and function to lib/api.ts**

Add after the `runPortfolioBacktest` function (near the end of the backtest section):

```typescript
export interface AiRecommendation {
  instrument_id: string;
  strategy: string;
  params: Record<string, number>;
  reasoning: string;
}

export async function getAiRecommendation(
  instrumentId: string,
  start: string,
  end: string,
  signal?: AbortSignal,
): Promise<AiRecommendation> {
  const params = new URLSearchParams({ instrument_id: instrumentId, start, end });
  return handleResponse<AiRecommendation>(
    await fetch(`${API_URL}/ai/strategy-recommend?${params.toString()}`, { signal })
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Replace ai-trader page**

Read the current `app/ai-trader/page.tsx` first (it's a placeholder). Replace it entirely with:

```tsx
"use client";

import { useRef, useState } from "react";
import { ApiError, getAiRecommendation, type AiRecommendation } from "@/lib/api";

const STRATEGY_LABELS: Record<string, string> = {
  ema_cross: "EMA Cross",
  macd: "MACD",
  rsi: "RSI",
};

const STRATEGY_PARAMS_LABELS: Record<string, Record<string, string>> = {
  ema_cross: { fast: "Fast Period", slow: "Slow Period" },
  macd: { fast: "Fast Period", slow: "Slow Period", signal_period: "Signal Period" },
  rsi: { period: "Period", oversold: "Oversold", overbought: "Overbought" },
};

export default function AITraderPage() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart]               = useState("2025-01-01");
  const [end, setEnd]                   = useState("2026-06-01");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [result, setResult]             = useState<AiRecommendation | null>(null);

  const ctrlRef = useRef<AbortController | null>(null);

  // unmount cleanup
  useRef<() => void>(() => {
    return () => { ctrlRef.current?.abort(); };
  });

  async function analyze() {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const rec = await getAiRecommendation(instrumentId, start, end, ctrl.signal);
      if (!ctrl.signal.aborted) setResult(rec);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (!ctrl.signal.aborted) {
        setError(err instanceof ApiError ? err.message : "Recommendation failed");
      }
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  const paramLabels = result ? (STRATEGY_PARAMS_LABELS[result.strategy] ?? {}) : {};

  return (
    <div className="p-6 space-y-5 max-w-[760px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">AI Strategy Advisor</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Claude analyzes price data and recommends the best strategy and parameters.
        </p>
      </div>

      {/* Input form */}
      <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-text-3 text-xs">Instrument ID</label>
            <input
              value={instrumentId}
              onChange={e => setInstrumentId(e.target.value)}
              className="bg-bg border border-border rounded px-2 py-1.5 text-text-1 text-sm"
              placeholder="AAPL.NASDAQ"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-text-3 text-xs">Start</label>
            <input
              type="date"
              value={start}
              onChange={e => setStart(e.target.value)}
              className="bg-bg border border-border rounded px-2 py-1.5 text-text-1 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-text-3 text-xs">End</label>
            <input
              type="date"
              value={end}
              onChange={e => setEnd(e.target.value)}
              className="bg-bg border border-border rounded px-2 py-1.5 text-text-1 text-sm"
            />
          </div>
        </div>

        <button
          onClick={analyze}
          disabled={loading}
          className="bg-accent text-black text-sm px-4 py-1.5 rounded font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Analyzing…" : "Get AI Recommendation"}
        </button>
      </div>

      {error && (
        <p className="text-neg text-sm">{error}</p>
      )}

      {/* Result */}
      {result && (
        <div className="bg-panel border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-1 rounded border border-accent/40 text-accent bg-accent/10 font-medium tracking-wide uppercase">
              {STRATEGY_LABELS[result.strategy] ?? result.strategy}
            </span>
            <span className="text-text-3 text-xs">{result.instrument_id}</span>
          </div>

          {/* Params */}
          <div>
            <p className="text-text-3 text-xs uppercase tracking-wider mb-2">Recommended Parameters</p>
            <div className="flex flex-wrap gap-4">
              {Object.entries(result.params).map(([key, val]) => (
                <div key={key}>
                  <p className="text-text-3 text-xs">{paramLabels[key] ?? key}</p>
                  <p className="text-text-1 text-sm font-medium">{val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Reasoning */}
          <div>
            <p className="text-text-3 text-xs uppercase tracking-wider mb-1">Analysis</p>
            <p className="text-text-2 text-sm leading-relaxed">{result.reasoning}</p>
          </div>

          {/* Link to backtest */}
          <a
            href={`/backtest`}
            className="inline-flex text-accent text-xs border border-accent/30 rounded px-3 py-1.5 hover:bg-accent/10 transition-colors"
          >
            Open Backtest →
          </a>
        </div>
      )}
    </div>
  );
}
```

**IMPORTANT note on unmount cleanup:** The `useRef<() => void>(() => {...})` pattern above is not correct for cleanup. Instead, use `useEffect`:

```tsx
import { useEffect, useRef, useState } from "react";

// ... inside the component:
useEffect(() => {
  return () => { ctrlRef.current?.abort(); };
}, []);
```

Use this `useEffect` pattern, not the `useRef` pattern shown above.

- [ ] **Step 4: Run TypeScript check and tests**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard && npx tsc --noEmit && npm test
```

Expected: 0 TS errors; all prior 177 tests still pass (no new tests for UI task).

- [ ] **Step 5: Commit**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
git add lib/api.ts app/ai-trader/page.tsx
git commit -m "feat: upgrade ai-trader page to AI Strategy Advisor with Claude-powered recommendations"
```
