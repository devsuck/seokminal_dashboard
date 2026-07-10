# Orderflow Trading Cockpit — Design Spec

**Status:** Approved by user delegation ("네가 볼 때 최고의 UX로... 허가받지말고 계속 작업해줘, 다 작업하고 내가 보고 수정할거니까"). All UX/architecture calls in this doc are Claude's judgment, made explicit here for the user's later review — not independently re-confirmed one-by-one.

## Goal

Layer 5 real-time trading indicators onto the existing `/orderflow` candlestick chart (`components/CandlestickChart.tsx` + `components/orderflow/OrderflowChart.tsx`) so a trader can read order-book depth, large-order flow, cumulative delta, absorption, and options gamma exposure **all on one chart view** without splitting attention across separate panels — directly serving the stated goal of spotting entries in real time.

1. **COB (Current Order Book) depth inset** — live bid/ask ladder rendered in-chart, price-aligned.
2. **Iceberg / Large-Lot tracker** — bubble markers on trade prints sized by trade size.
3. **CVD (Cumulative Volume Delta)** sub-pane + per-cell delta in the footprint.
4. **Absorption highlighting** — flags candles where dominant-side volume failed to move price.
5. **GEX levels on the main chart** — gamma-wall horizontal lines for BTC.HL/ETH.HL, pulled from the already-shipped `OptionsFlowPanel` data source.

## Architecture

All 5 features are additive `ISeriesPrimitive` layers attached to the same candlestick series (following the exact pattern `FootprintPrimitive.ts`/`HeatmapPrimitive.ts` already establish: `attached()` captures `chart`/`series`/`requestUpdate`, `updateData()` stores new data + calls `requestUpdate()`, `draw()` re-reads live `timeToCoordinate`/`priceToCoordinate` every native repaint — this gets pan/zoom sync for free, no new coordinate-sync code needed anywhere), **except CVD**, which is a second chart pane (`chart.addSeries(HistogramSeries, opts, paneIndex=1)`, reusing the multi-pane pattern already used for RSI/MACD/etc in `CandlestickChart.tsx`).

Rationale for in-chart-primitive COB over a separate DOM sidebar (the alternative considered): a separate sidebar needs its own price-scale subscription mechanism that doesn't exist in lightweight-charts v5's public API in a push form (no `subscribeVisibleRangeChange` for price scale) — it would have to poll `series.priceToCoordinate` on a timer and would drift during fast pans/zooms. An in-chart primitive redraws every native frame automatically, exactly like footprint/heatmap already do, guaranteeing pixel-perfect sync with zero new sync code. It also keeps everything in one visual field, matching the "다 어우러져" (all indicators working together) requirement better than a split layout.

**Tech stack:** no new dependencies. `d3` (already used in `OptionsFlowPanel.tsx`'s GEX chart) is NOT needed here — primitives draw with raw Canvas 2D context (`CanvasRenderingTarget2D`), matching `FootprintPrimitive`/`HeatmapPrimitive`'s existing style exactly.

## Global Constraints

- Design tokens only for any DOM/CSS: `bg-bg/panel/panel-2`, `border-border`, `text-text-1/2/3`, `text-accent/pos/neg/warn/info`. Canvas-drawn primitives use the `var(--color-*)` CSS custom-property string pattern already established in `OptionsFlowPanel.tsx`'s `GexChart`.
- No raw `fetch` — `lib/api.ts` only.
- AbortController pattern: abort→create→assign ref→fetch→catch AbortError→finally guard→unmount cleanup (for any new polling, i.e. GEX reuse).
- `style={{}}` banned except chart-container height.
- Backend: `asyncio_mode="auto"`, never `@pytest.mark.asyncio`. Python interpreter: `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`.
- CORS: API allows only `localhost:3000`.
- Follow existing primitive pattern exactly (`ISeriesPrimitive`, `attached()`, `updateData()`, `requestUpdate()`) — do not introduce a different primitive style for the new layers.
- Keep `orderflow/aggregator.py`'s existing snapshot-size discipline (Phase 156 bug 2: an unbounded/unthrottled broadcast previously pegged a worker at 94% CPU for 7.5 hours and hung the whole server) — any new broadcast path (COB raw book) MUST be size- and rate-bounded from the first line of code, not bolted on after.

## Feature 1 — COB Depth Inset

**Problem today:** `orderflow/aggregator.py`'s `on_book_snapshot` only ever produces `heatmap_delta` messages (single price level, tick-rounded, folded into a 2-second-bucketed historical trail). No raw/live full-book state ever reaches the frontend — there's nothing to build a live ladder from.

**Backend — `orderflow/manager.py` + `orderflow/aggregator.py`:**
- Add `OrderflowAggregator.latest_book(book: OrderBookSnapshot, levels: int = 20) -> dict` — returns `{"type": "book_snapshot", "bids": [{"price","size"}...], "asks": [{"price","size"}...]}`, each side sorted best-first, capped at `levels` (20) per side, **unrounded** raw prices (COB needs true tick precision, unlike the heatmap trail).
- Rate-bounded: `OrderflowManager` tracks `_last_book_broadcast_ts` per symbol-worker; only emits a `book_snapshot` message if ≥150ms elapsed since the last one for that symbol (Hyperliquid can push `l2Book` several times/sec — broadcasting every single one would flood the WS and the frontend's re-render loop; 150ms ≈ 6-7fps is plenty for a human-readable ladder and matches this project's established "bound everything from the first line" lesson from Phase 156).
- This is a NEW message type alongside existing `footprint_delta`/`heatmap_delta`/`status` — additive, no changes to those.

**Frontend — new primitive `components/orderflow/OrderBookPrimitive.ts`:**
- Same `ISeriesPrimitive` pattern as `HeatmapPrimitive.ts`. `updateData(bids, asks)` stores latest arrays.
- Renders as a semi-transparent inset docked to the **right edge of the visible plot area** (not a separate DOM column): for each level, a horizontal bar starting at the right edge and extending left, width ∝ `size / maxVisibleSize`, height = one row per level (fixed ~14px), asks stacked above the current spot-line, bids below. Uses `var(--color-pos)`/`var(--color-neg)` with the same opacity-by-magnitude technique `HeatmapPrimitive.ts` already uses.
- `zOrder: "top"` (drawn over candles, semi-transparent so candles remain visible underneath — same visual language as footprint numbers already drawn on top).
- Price→Y via `series.priceToCoordinate(level.price)` exactly like footprint/heatmap.

**Frontend — data plumbing:** extend `lib/orderflow-data.ts`'s WS message union + reducer with a `BookSnapshotMsg` case that replaces (not merges) the sidebar's `bids`/`asks` state on every message (it's a full snapshot, not a delta). `hooks/useOrderflowSocket.ts` gains a `book: {bids, asks}` field in its return value alongside existing `footprint`/`heatmap`.

## Feature 2 — Iceberg / Large-Lot Tracker

**No backend change needed.** `footprint_delta` messages already carry per-trade granularity (`orderflow/aggregator.py`'s `on_trade` emits one delta per individual `TradeEvent`, `delta_vol = trade.size` — that specific trade's size, not an accumulator). The existing reducer in `lib/orderflow-data.ts` currently folds these straight into aggregated cell sums and discards the individual event; this feature taps the same incoming messages before that fold.

**Frontend:**
- `lib/orderflow-data.ts`: add `applyLargeTradeTracking(state, msg: FootprintDeltaMsg)` — maintains a rolling window of the last 200 trade sizes (per symbol) to compute a live median; any incoming trade with `delta_vol > 3 × rolling_median` (and rolling window has ≥20 samples, else skip — avoids false positives on a cold-started/thin market) gets appended to a capped `largeTrades: {bucketTs, price, side, size}[]` array (cap 50, drop oldest).
- New primitive `components/orderflow/LargeLotPrimitive.ts`: draws a circle at `(footprintColumnX(bucketTs).center, priceToY(price))` per tracked large trade, radius `= clamp(6 + log2(size / rolling_median) * 3, 6, 24)`, fill `var(--color-pos)`/`var(--color-neg)` at ~40% opacity with a solid 1.5px stroke at full opacity (readable against dense footprint numbers underneath — matches Bookmap's "Large Lot Tracker" bubble look from the reference screenshot). `zOrder: "top"`.

## Feature 3 — CVD Sub-Pane + Per-Cell Delta

**No backend change needed.** Computed entirely client-side from the footprint stream already flowing in.

**Frontend:**
- `lib/orderflow-data.ts`: add `computeCvdSeries(footprintCells: FootprintCell[]): {time, value}[]` — groups cells by `bucket_ts`, sums `(buy_vol - sell_vol)` per bucket, sorts by time ascending, running-cumulative-sums into a monotonic-by-time series. Seeded from the full snapshot on connect (matches the existing snapshot+delta reducer pattern — CVD isn't reset per-session, it's the cumulative delta over whatever window the backend's rolling 7200s footprint buffer currently holds).
- `components/CandlestickChart.tsx`: add a second pane via `chart.addSeries(HistogramSeries, { color: ... }, paneIndex)` following the exact existing oscillator-pane pattern (`paneIdx++`, stretch-factor balancing already coded at lines ~360-364). New optional prop `cvdSeries?: {time, value}[]`; histogram bar color per-bar via the series' `color` accessor: `var(--color-pos)` when cumulative value rose vs. prior bar, `var(--color-neg)` when it fell (standard CVD coloring, matches the reference screenshot's CVD sub-chart).
- `components/orderflow/FootprintPrimitive.ts`: extend the existing per-cell number rendering to also draw a small delta value (`buy_vol - sell_vol`, signed, one line below the existing buy/sell numbers) when `barSpacing` is above the existing `MIN_BAR_SPACING_FOR_TEXT` gate (reuse, don't duplicate, that threshold).

## Feature 4 — Absorption Highlighting

**No backend change needed.**

**Frontend:**
- `lib/orderflow-data.ts`: add `detectAbsorption(footprintCells, bars): {time, side: "buy"|"sell"}[]` — for each candle (`bar.time === bucket_ts`), sum `buy_vol`/`sell_vol` across all price levels sharing that `bucket_ts`. Flag as absorption when the dominant side is ≥70% of total volume for that candle AND the candle's body move is opposite-or-flat relative to the dominant side (dominant sell but `close >= open`, or dominant buy but `close <= open`) AND total volume for the bucket is above a noise floor (≥ 10× the bucket's own rolling-median trade size from Feature 2's tracker, reusing that state — prevents flagging on a single thin print). These thresholds are a first-pass heuristic, not backtested; documented here as tunable constants (`ABSORPTION_DOMINANCE_RATIO = 0.7`) for later adjustment once the user has traded against it and has real feedback — this is explicitly out of scope to "get right" analytically in v1.
- `components/CandlestickChart.tsx`: render flagged candles via the chart's native marker API (`createSeriesMarkers`/`.setMarkers()`, already used elsewhere in this file per Phase 157's `markersRef` pattern) — small triangle marker below the candle for buy-absorption, above for sell-absorption, `var(--color-info)` color to stay visually distinct from the buy/sell red/green already saturating the view.

## Feature 5 — GEX Levels on Main Chart

**No backend change needed** — reuses the already-shipped `GET /options-flow/gex/{currency}` endpoint and `getOptionsGex` client function.

**Frontend refactor:** extract the polling `useEffect` currently inline in `OptionsFlowPanel.tsx` (lines ~84-108, including this session's stale-cache fix) into a shared `hooks/useGexSnapshot.ts` returning `{gex, isStale}`. `OptionsFlowPanel.tsx` becomes a consumer of this hook (no behavior change, pure extraction — this is the one refactor in this plan, justified because Feature 5 needs the exact same data in a second consumer and duplicating a 60s-poll AbortController effect would violate this project's DRY convention).

**New primitive `components/orderflow/GexLevelsPrimitive.ts`:** draws a horizontal line at each strike's price (via `priceToCoordinate`), line opacity ∝ `|net_gex| / max(|net_gex|)` across the snapshot's levels, the single max-magnitude strike ("gamma wall") gets a distinct thicker/dashed line in `var(--color-accent)`; all others in `var(--color-text-3)` at low opacity so they recede behind the gamma wall. Only strikes within the chart's currently visible price range are drawn (skip off-screen lines — cheap to check via `priceToCoordinate` returning `null`).

**Wiring:** `OrderflowChart.tsx` (or `CandlestickChart.tsx`, whichever already owns primitive attachment) gains `const currency = currencyForSymbol(symbol); const { gex } = useGexSnapshot(currency);` and attaches `GexLevelsPrimitive` only when `currency` is non-null, passing `gex?.levels ?? []`.

## Data Flow Summary

```
Hyperliquid WS (l2Book, trades)
  -> orderflow/hl_adapter.py (unchanged)
  -> orderflow/manager.py -> orderflow/aggregator.py
       .on_trade()        -> footprint_delta   (existing, also feeds Features 2/3/4 client-side)
       .on_book_snapshot() -> heatmap_delta[]   (existing, unchanged)
                            -> book_snapshot     (NEW, Feature 1, rate-bounded 150ms)
  -> WS /ws/orderflow/{symbol} -> hooks/useOrderflowSocket.ts -> lib/orderflow-data.ts reducer
       -> footprint cells  -> FootprintPrimitive (existing) + CVD (Feature 3) + Absorption (Feature 4) + LargeLot (Feature 2, pre-fold tap)
       -> heatmap cells    -> HeatmapPrimitive (existing, unchanged)
       -> book (bids/asks) -> OrderBookPrimitive (Feature 1, NEW)

Deribit REST (GEX, unchanged, existing feature)
  -> orderflow/gex.py -> GET /options-flow/gex/{currency}
  -> hooks/useGexSnapshot.ts (NEW, extracted) -> OptionsFlowPanel.tsx (existing, refactored) + GexLevelsPrimitive (Feature 5, NEW)
```

## Error Handling

- **Feature 1 (book_snapshot):** if no book data has arrived yet, `OrderBookPrimitive` simply doesn't draw (empty state, same as `HeatmapPrimitive`'s existing `if (cells.length===0) return` guard).
- **Feature 2 (large-lot):** cold-start guard (skip tracking until ≥20 samples) prevents false positives from a thin rolling window.
- **Feature 3 (CVD):** if `footprint` snapshot is empty on connect, CVD series starts at 0 — no special-casing needed, `computeCvdSeries([])` naturally returns `[]`.
- **Feature 4 (absorption):** noise floor (10× rolling median) prevents thin-print false flags; if Feature 2's rolling median isn't warmed up yet, absorption detection is simply skipped for those candles (fail closed, not open — under-flagging is safe, over-flagging trains the user to ignore the signal).
- **Feature 5 (GEX):** already has the stale-cache-retention + `text-warn` badge behavior shipped this session; the primitive itself just draws nothing (`levels: []`) when `gex` is null, same empty-state pattern as every other primitive here.
- **Feature 1 backend throttle:** if the 150ms window means a burst of book updates arrives, the manager keeps only the latest snapshot per window (drop-old, not queue-and-flush) — same "drop oldest under pressure" philosophy already used in `options_flow_manager.py`'s `_put()`.

## Testing

- Backend: `tests/test_orderflow_aggregator.py` gains cases for `latest_book()` (level capping, sort order, unrounded prices) and the 150ms manager-level throttle (`tests/test_orderflow_manager.py`, using a fake clock like the existing reconnect-backoff tests already do).
- Frontend pure functions get unit tests same as existing `lib/orderflow-data.ts`/`lib/orderflow-chart-coords.ts` coverage: `computeCvdSeries`, `detectAbsorption`, `applyLargeTradeTracking`, the new `book_snapshot` reducer case, and any new coordinate-math helpers added to `orderflow-chart-coords.ts` for the COB inset's bar layout.
- Canvas-drawing primitives (`OrderBookPrimitive.ts`, `LargeLotPrimitive.ts`, `GexLevelsPrimitive.ts`) get NO dedicated test file — matches this project's established convention (`FootprintPrimitive.ts`/`HeatmapPrimitive.ts`/`EventReturnChart.tsx` all have zero tests; drawing logic is verified by extracting the coordinate math into tested pure functions in `orderflow-chart-coords.ts` and keeping the primitive's `draw()` a thin consumer of that math).
- `hooks/useGexSnapshot.ts` gets no dedicated test file either (matches `useOrderflowSocket.ts`/`useOptionsFlowSocket.ts` convention — hooks with WS/fetch side effects aren't unit-tested in this codebase).

## Out of Scope (explicit)

- Backtesting/tuning the absorption heuristic's thresholds against real fills — v1 ships a documented, tunable first pass only.
- A toggle UI to show/hide individual layers (COB/iceberg/CVD/absorption/GEX) — v1 always renders all of them when data is available; a settings panel is a natural follow-up once the user has lived with the default view.
- Multi-symbol COB (only the currently-selected chart symbol gets a live book — matches how footprint/heatmap already work today, one symbol at a time).
- Historical/backfilled CVD across a page reload beyond whatever the backend's rolling footprint window (7200s) currently retains — no separate CVD persistence store.
