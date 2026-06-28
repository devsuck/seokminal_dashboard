# Bot Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `app/bots/page.tsx` from legacy terminal-style inline styles to the project's design token system, matching the visual language of all other dashboard pages.

**Architecture:** Single task — pure UI migration of the existing 367-line `app/bots/page.tsx`. All logic, state, API calls, and WebSocket patterns are preserved exactly. Only CSS changes: replace `S.*` style objects and all inline `style={{...}}` props with Tailwind className tokens. No new files. No new tests.

**Tech Stack:** Next.js 16, React 19, TypeScript, TailwindCSS 4. No new dependencies.

## Global Constraints

- Design tokens ONLY in `className`: `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1`, `text-text-2`, `text-text-3`, `text-accent`, `text-pos`, `text-neg`, `text-warn`, `text-info`
- `bg-accent text-black`: ONLY primary action buttons (Create / Run Preview / Start)
- Active/selected state: `border-l-2 border-l-accent bg-panel` (sidebar list item selected)
- Stop button: `border border-neg text-neg` (destructive action)
- Start button: `border border-pos text-pos` (positive action)
- Status indicators: `text-pos` (running), `text-neg` (error), `text-text-3` (stopped/other)
- P&L values: `text-pos` (≥0), `text-neg` (<0), `text-text-3` (null)
- No inline `style={{...}}` except: chart library config inside CandlestickChart (not our code)
- No hardcoded hex in `className`
- Monospace data values: `font-data` class (already defined in globals.css)
- Remove the `const S = { ... }` style object entirely
- Remove `statusColor()` and `pnlColor()` helper functions — replace with inline ternary className logic
- Remove `const API_URL` if only used for WebSocket URL (check if still needed; keep if so)
- `"use client"` must remain at top
- All existing functionality preserved: bot list, create form, start/stop, live status polling, WebSocket price, backtest preview, candlestick chart, trade log
- 98 tests must pass after change (no new tests, no regressions)

## Token Mapping Reference

| Old inline style | New className |
|---|---|
| `color: "#ff8c00"` (label/heading) | `text-accent` |
| `color: "#e8e8e8"` (primary text) | `text-text-1` |
| `color: "#888"` (secondary text) | `text-text-2` |
| `color: "#777"` or `"#555"` (muted) | `text-text-3` |
| `color: "#00cc44"` (positive/running) | `text-pos` |
| `color: "#ff3333"` (negative/error) | `text-neg` |
| `background: "#0d0d0d"` | `bg-bg` |
| `background: "#1a1a1a"` | `bg-panel` |
| `background: "#111"` or `"#0f0f0f"` | `bg-panel-2` |
| `border: "1px solid #2a2a2a"` | `border border-border` |
| `borderBottom: "1px solid #2a2a2a"` | `border-b border-border` |
| `fontFamily: "monospace"` (data) | `font-data` |
| `fontSize: 13/14` | `text-xs` or `text-sm` |
| `S.btn` (primary orange) | `bg-accent text-black text-xs font-semibold px-4 py-1.5 rounded cursor-pointer hover:brightness-110 border-0` |
| `S.btnSm` (secondary) | `border border-border text-text-3 text-xs px-2.5 py-1 rounded cursor-pointer hover:text-text-2 bg-transparent` |
| Selected sidebar item left border | `border-l-2 border-l-accent` |
| Table header cell | `pb-1.5 pt-1.5 pr-3 text-accent text-xs font-normal text-left border-b border-border whitespace-nowrap` |
| Table data cell | `py-1.5 pr-3 text-xs font-data border-b border-border/50` |

## File Map

**Modified:**
- `app/bots/page.tsx` — replace ALL inline styles with Tailwind tokens; remove `S` object, `statusColor`, `pnlColor`

**Modified:**
- `docs/progress.md` — prepend Phase 10 block

---

### Task 1: Rewrite app/bots/page.tsx with design tokens

**Files:**
- Modify: `app/bots/page.tsx`
- Modify: `docs/progress.md`

**Functional requirements (all must be preserved):**
- Load bots on mount (`listBots()`)
- Sidebar: list bots with name + status dot + instrument_id; selected = highlighted with accent left border; refresh button
- Create form: NEW button toggles form; fields: name, strategy select, symbol select, fast EMA, slow EMA, trade size; CREATE button submits
- Bot detail panel: name + status dot; Start/Stop toggle button; live status card (when running: last price, position, signal, recent orders); configuration table; backtest preview section with date range + Run Preview button + metrics row + candlestick chart + trade log table
- Live status polling every 5s when running (poll `getLiveBotStatus`)
- WebSocket for real-time price when running
- Error display below sidebar

- [ ] **Step 1: Read and understand current file**

Read `app/bots/page.tsx` in full. Note all the places using `S.btn`, `S.btnSm`, `S.th`, `S.td`, `S.label`, `S.err`, `S.muted`, `statusColor()`, `pnlColor()`, and all `style={{...}}` props.

- [ ] **Step 2: Rewrite the file**

Write the complete replacement. Key structural decisions:

**Layout:**
```tsx
// Root: two-column flex, full height
<div className="flex h-[calc(100vh-37px)] overflow-hidden">
  {/* Sidebar */}
  <div className="w-56 border-r border-border bg-bg flex flex-col shrink-0">
    ...
  </div>
  {/* Main */}
  <div className="flex-1 overflow-y-auto">
    ...
  </div>
</div>
```

**Sidebar header:**
```tsx
<div className="px-3 py-2.5 border-b border-border">
  <div className="text-accent text-xs font-semibold uppercase tracking-wider mb-2">Trading Bots</div>
  <div className="flex gap-1.5">
    <button
      onClick={() => { setShowForm(p => !p); setSelectedId(null); }}
      className="flex-1 h-7 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 border-0">
      {showForm ? "✕ Cancel" : "+ New"}
    </button>
    <button
      onClick={load}
      className="h-7 px-2 border border-border text-text-3 text-xs rounded cursor-pointer hover:text-text-2 bg-transparent">
      ↺
    </button>
  </div>
</div>
```

**Bot list item:**
```tsx
<div
  key={bot.id}
  onClick={() => { setSelectedId(bot.id); setShowForm(false); }}
  className={`px-3 py-2 cursor-pointer border-b border-border/50 border-l-2 transition-colors ${
    selectedId === bot.id
      ? "border-l-accent bg-panel"
      : "border-l-transparent hover:bg-panel/50"
  }`}>
  <div className="flex items-center justify-between">
    <span className={`text-xs ${selectedId === bot.id ? "text-text-1" : "text-text-2"}`}>
      {bot.name}
    </span>
    <button
      onClick={e => { e.stopPropagation(); handleDelete(bot.id); }}
      className="text-neg text-xs px-1 cursor-pointer bg-transparent border-0 hover:opacity-70">
      ✕
    </button>
  </div>
  <div className={`text-xs mt-0.5 ${
    bot.status === "running" ? "text-pos" : bot.status === "error" ? "text-neg" : "text-text-3"
  }`}>
    ● {bot.status}
  </div>
  <div className="text-[11px] text-text-3 mt-0.5 font-data">{bot.instrument_id}</div>
</div>
```

**Create form:**
```tsx
<div className="p-4 max-w-md border-b border-border">
  <div className="text-accent text-xs font-semibold uppercase tracking-wider mb-3">New Bot</div>
  <form onSubmit={handleCreate} className="space-y-2">
    {/* Each field row: */}
    <div className="flex items-center gap-2">
      <span className="text-accent text-xs w-24 shrink-0">Name</span>
      <input
        value={form.name}
        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
        placeholder="bot-name"
        className="h-7 flex-1 px-2 text-xs bg-panel-2 border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent font-data"
      />
    </div>
    {/* Similar pattern for all fields */}
    {/* strategy: <select> with same className */}
    {/* Number inputs: w-16 instead of flex-1 */}
    <button type="submit" disabled={submitting}
      className="mt-1 h-7 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 border-0 disabled:opacity-50 disabled:cursor-not-allowed">
      {submitting ? "Creating…" : "Create"}
    </button>
  </form>
</div>
```

**BotDetail — header:**
```tsx
<div className="flex items-center gap-3 mb-4">
  <span className="text-text-1 text-sm font-semibold">{bot.name}</span>
  <span className={`text-xs ${
    bot.status === "running" ? "text-pos" : bot.status === "error" ? "text-neg" : "text-text-3"
  }`}>● {bot.status}</span>
  <button onClick={toggle} className={`h-7 px-3 text-xs rounded border cursor-pointer bg-transparent hover:opacity-80 ${
    bot.status === "running"
      ? "border-neg text-neg"
      : "border-pos text-pos"
  }`}>
    {bot.status === "running" ? "Stop" : "Start"}
  </button>
</div>
```

**BotDetail — live status card:**
```tsx
{bot.status === "running" && (
  <div className="border border-border rounded-lg bg-panel-2 p-3 mb-4 max-w-sm">
    <div className="text-accent text-xs font-semibold uppercase tracking-wider mb-2">Live Status</div>
    <div className="flex gap-6 flex-wrap">
      <div>
        <div className="text-text-3 text-[11px] uppercase">Last Price</div>
        <div className="text-text-1 text-base font-data font-semibold">
          {livePrice != null ? livePrice.toFixed(2) : liveStatus?.last_price?.toFixed(2) ?? "—"}
        </div>
      </div>
      <div>
        <div className="text-text-3 text-[11px] uppercase">Position</div>
        <div className={`text-sm font-data font-semibold ${
          liveStatus?.position === "LONG" ? "text-pos"
          : liveStatus?.position === "SHORT" ? "text-neg"
          : "text-text-3"
        }`}>
          {liveStatus?.position ?? "FLAT"}{liveStatus?.qty ? ` ×${liveStatus.qty}` : ""}
        </div>
      </div>
      <div>
        <div className="text-text-3 text-[11px] uppercase">Signal</div>
        <div className={`text-sm font-data ${
          liveStatus?.last_signal?.includes("BUY") ? "text-pos"
          : liveStatus?.last_signal?.includes("SELL") ? "text-neg"
          : "text-text-3"
        }`}>
          {liveStatus?.last_signal ?? "—"}
        </div>
      </div>
    </div>
    {liveStatus?.error && (
      <div className="text-neg text-xs mt-1.5 font-data">{liveStatus.error}</div>
    )}
    {liveStatus?.recent_orders && liveStatus.recent_orders.length > 0 && (
      <div className="mt-2">
        <div className="text-text-3 text-[11px] uppercase mb-1">Recent Orders</div>
        {liveStatus.recent_orders.slice(-5).map((o, i) => (
          <div key={i} className="text-xs font-data text-text-3">
            {o.order_id} · {o.status} · filled {o.filled}
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

**BotDetail — config table:**
```tsx
<div className="text-accent text-xs font-semibold uppercase tracking-wider mb-2">Configuration</div>
<table className="border-collapse mb-4">
  <tbody>
    {configRows.map(r => (
      <tr key={r.k} className="border-b border-border/40">
        <td className="py-1 pr-4 text-accent text-xs w-28">{r.k}</td>
        <td className="py-1 text-text-2 text-xs font-data">{r.v}</td>
      </tr>
    ))}
  </tbody>
</table>
```

**BotDetail — backtest preview section:**
```tsx
<div className="text-accent text-xs font-semibold uppercase tracking-wider mb-2">Backtest Preview</div>
<div className="flex gap-2 items-center flex-wrap mb-3">
  <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
  <button onClick={runPreview}
    className="h-7 px-4 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 border-0">
    Run Preview
  </button>
  {loading && <span className="text-text-3 text-xs">Running…</span>}
</div>
{error && (
  <div className="text-neg text-xs bg-neg/10 border border-neg/20 rounded px-3 py-1.5 mb-3">
    {error}
  </div>
)}
```

**BotDetail — stats row:**
```tsx
<div className="flex gap-5 flex-wrap mb-3">
  {stats.map(s => (
    <div key={s.label}>
      <div className="text-text-3 text-[11px] uppercase">{s.label}</div>
      <div className={`text-sm font-data font-semibold ${s.className}`}>{s.val}</div>
    </div>
  ))}
</div>
```

Change `stats` to use className instead of col:
```typescript
const stats = btResult ? [
  { label: "Total P&L",  val: btResult.total_pnl != null ? btResult.total_pnl.toFixed(2) : "N/A",
    className: btResult.total_pnl != null ? (btResult.total_pnl >= 0 ? "text-pos" : "text-neg") : "text-text-3" },
  { label: "P&L %",      val: btResult.total_pnl_pct != null ? (btResult.total_pnl_pct * 100).toFixed(2) + "%" : "N/A",
    className: btResult.total_pnl_pct != null ? (btResult.total_pnl_pct >= 0 ? "text-pos" : "text-neg") : "text-text-3" },
  { label: "Sharpe",     val: btResult.sharpe_ratio?.toFixed(4) ?? "N/A",
    className: btResult.sharpe_ratio != null ? (btResult.sharpe_ratio >= 0 ? "text-pos" : "text-neg") : "text-text-3" },
  { label: "Max DD",     val: btResult.max_drawdown != null ? (btResult.max_drawdown * 100).toFixed(2) + "%" : "N/A",
    className: "text-neg" },
  { label: "Trades",     val: String(btResult.trades.length), className: "text-text-1" },
] : [];
```

**BotDetail — EMA legend and chart:**
```tsx
<div className="flex gap-3 text-xs mb-2 text-text-3">
  <span><span className="text-accent">—</span> EMA {bot.fast_ema}</span>
  <span><span className="text-info">—</span> EMA {bot.slow_ema}</span>
  <span><span className="text-pos">▲</span> Buy</span>
  <span><span className="text-neg">▼</span> Sell</span>
</div>
<CandlestickChart bars={bars} trades={btResult.trades} emaFast={bot.fast_ema} emaSlow={bot.slow_ema} />
```

**BotDetail — trade log table:**
```tsx
<div className="mt-4">
  <div className="text-accent text-xs font-semibold uppercase tracking-wider mb-2">
    Trade Log ({btResult.trades.length})
  </div>
  <div className="overflow-x-auto">
    <table className="border-collapse min-w-[640px]">
      <thead>
        <tr>
          {["#","Side","Entry","Entry Px","Exit","Exit Px","Qty","P&L"].map(h => (
            <th key={h}
              className="pb-2 pt-1 pr-3 text-accent text-xs font-normal text-left border-b border-border whitespace-nowrap">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {btResult.trades.map((t, i) => (
          <tr key={i}>
            <td className="py-1.5 pr-3 text-xs font-data text-text-3 border-b border-border/40">{i + 1}</td>
            <td className={`py-1.5 pr-3 text-xs font-data border-b border-border/40 ${t.side === "LONG" ? "text-pos" : "text-neg"}`}>{t.side}</td>
            <td className="py-1.5 pr-3 text-xs font-data text-text-2 border-b border-border/40">
              {new Date(t.entry_ts_ns / 1e6).toISOString().slice(0, 10)}
            </td>
            <td className="py-1.5 pr-3 text-xs font-data text-text-1 border-b border-border/40">{t.entry_price.toFixed(2)}</td>
            <td className="py-1.5 pr-3 text-xs font-data text-text-2 border-b border-border/40">
              {t.exit_ts_ns ? new Date(t.exit_ts_ns / 1e6).toISOString().slice(0, 10) : "—"}
            </td>
            <td className="py-1.5 pr-3 text-xs font-data text-text-1 border-b border-border/40">{t.exit_price?.toFixed(2) ?? "—"}</td>
            <td className="py-1.5 pr-3 text-xs font-data text-text-2 border-b border-border/40">{t.qty.toFixed(0)}</td>
            <td className={`py-1.5 pr-3 text-xs font-data font-semibold border-b border-border/40 ${
              t.pnl != null ? (t.pnl >= 0 ? "text-pos" : "text-neg") : "text-text-3"
            }`}>
              {t.pnl != null ? t.pnl.toFixed(2) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
```

**BotDetail container:**
```tsx
// BotDetail root div:
<div className="flex-1 p-4 overflow-y-auto">
```

**Empty state:**
```tsx
{!showForm && !selectedBot && (
  <div className="p-6 text-text-3 text-sm">← Select a bot or create new</div>
)}
```

**Error in sidebar:**
```tsx
{error && (
  <div className="px-3 py-2 text-neg text-xs border-t border-border">{error}</div>
)}
```

- [ ] **Step 3: Remove API_URL constant if only used for WebSocket**

Check if `const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"` is used anywhere other than the WebSocket URL construction. If only used for WebSocket, keep it (WebSocket can't go through `lib/api.ts`). Keep all WebSocket code as-is.

- [ ] **Step 4: Run full test suite**

```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/nautilus-dashboard && npm test
```
Expected: 98/98 passing

- [ ] **Step 5: Update docs/progress.md**

Prepend this block at the top:
```markdown
### Bot Infrastructure (2026-06-28)

**Phase 10 — Bots Page Upgrade:**
- `app/bots/page.tsx` — migrated from terminal inline styles to design token system
  - Removed `const S` style object, `statusColor()`, `pnlColor()` helpers
  - Applied: `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1/2/3`, `text-accent`, `text-pos`, `text-neg`, `font-data`
  - `bg-accent text-black`: Create button, Run Preview button
  - Bot status: `text-pos` (running), `text-neg` (error), `text-text-3` (stopped)
  - Start/Stop: `border-pos text-pos` / `border-neg text-neg` (destructive vs positive)
  - All functionality preserved: bot list, create form, start/stop toggle, live status polling, WebSocket price, backtest preview, candlestick chart, trade log
**Tests:** 98 passing (no new tests)
```

- [ ] **Step 6: Commit**

```bash
git add app/bots/page.tsx docs/progress.md
git commit -m "feat: upgrade bots page to design token system"
```

---

## Self-Review

### Spec Coverage

| Requirement | Implementation | Status |
|---|---|---|
| Remove `const S` style objects | Deleted; all replaced with className | ✅ |
| Remove statusColor/pnlColor | Replaced with inline ternary className | ✅ |
| No inline style= except WebSocket/chart | API_URL for WS kept; CandlestickChart not touched | ✅ |
| bg-accent text-black: only primary actions | Create, Run Preview | ✅ |
| Start button: border-pos text-pos | ✅ | ✅ |
| Stop button: border-neg text-neg | ✅ | ✅ |
| Status dot: text-pos/neg/text-3 | ✅ | ✅ |
| All bot functionality preserved | Logic/state/API unchanged | ✅ |
| font-data for monospace values | prices, ids, trade data | ✅ |

### Inline Style Exceptions (Accepted)

- `API_URL` used for `ws://` WebSocket construction — cannot route through `lib/api.ts` (WebSocket, not HTTP). Keep `const API_URL`.
- `CandlestickChart` internal chart library styles — not our code, not touched.
