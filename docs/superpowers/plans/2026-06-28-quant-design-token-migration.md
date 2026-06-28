# Quant Page Design Token Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all inline `style={}` and `const S` object in `app/quant/page.tsx` with Tailwind design token classes.

**Architecture:** Single-file migration. Remove the `const S = {...}` style dictionary entirely. Replace every `style={S.xxx}` and inline `style={{ ... }}` with `className`. Update `col()` and `pnlMC()` to return class strings instead of hex colors. No new components, no restructuring.

**Tech Stack:** Next.js 16, React 19, TypeScript, TailwindCSS 4

## Global Constraints

- Design tokens only — no hex codes in `className` (exception: SVG element attrs like `stroke`, `fill`, `d3.attr()` remain hex — those are SVG/D3, not React className)
- `bg-accent text-black` only on primary action buttons (RUN, OPTIMIZE, 조회 buttons)
- Active tabs: `border-accent text-accent font-bold` (with `border-b-2`)
- Inactive tabs: `border-transparent text-text-3 font-normal hover:text-text-1`
- Data-driven background (`corrBg()` returns rgba) is an allowed `style={}` exception — keep it
- `style={{ width: N }}` on `<input type="number">` is allowed — keep it
- Token palette: `bg-bg`, `bg-panel`, `bg-panel-2`, `border-border`, `text-text-1`, `text-text-2`, `text-text-3`, `text-accent`, `text-pos`, `text-neg`, `text-warn`, `text-info`, `font-data`
- No new npm dependencies
- No restructuring — keep all components in one file, same function names

---

### Task 1: Migrate `app/quant/page.tsx` to design tokens

**Files:**
- Modify: `seokminal-dashboard/app/quant/page.tsx` (entire file, 1579 lines)

**No new test file needed** — this is a pure visual migration with no logic change. Verification is: TypeScript clean + existing test suite passes + grep confirms zero `style={S.` remaining.

**Token mapping (apply verbatim):**

| Old (hex / S property) | New (Tailwind) |
|---|---|
| `S.page` `{ padding: 20 }` | `p-5` |
| `S.header` `{ color: "#ff8c00", fontSize: 13, letterSpacing: 1, marginBottom: 24 }` | `text-accent text-[13px] tracking-widest uppercase mb-6` |
| `S.tabs` `{ display: "flex", borderBottom: "1px solid #2a2a2a", marginBottom: 16 }` | `flex border-b border-border mb-4` |
| `S.toolbar` `{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }` | `flex gap-3 items-center mb-3.5 flex-wrap` |
| `S.btn` (RUN/OPTIMIZE/조회 buttons only) | `px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 transition-all border-0` |
| `S.label` `{ color: "#ff8c00", fontSize: 13 }` | `text-accent text-[13px]` |
| `S.err` `{ color: "#ff3333", fontSize: 13 }` | `text-neg text-[13px]` |
| `S.muted` `{ color: "#777", fontSize: 13 }` | `text-text-3 text-[13px]` |
| `S.table` `{ borderCollapse: "collapse", width: "100%", maxWidth: 560 }` | `border-collapse w-full max-w-[560px]` |
| `S.tdLabel` `{ padding: "6px 18px 6px 0", color: "#ff8c00", fontSize: 13, width: 220 }` | `py-1.5 pr-[72px] text-accent text-[13px] w-[220px]` |
| `S.tdVal` `{ padding: "6px 0", fontSize: 14, fontFamily: "monospace", fontWeight: "bold" }` | `py-1.5 text-sm font-data font-bold` |
| `#ff8c00` (text) | `text-accent` |
| `#ff3333`, `#ef4444` (text) | `text-neg` |
| `#00cc44`, `#22c55e` (text) | `text-pos` |
| `#777`, `#888`, `#666`, `#aaa` (text) | `text-text-3` |
| `#e8e8e8`, `#ddd`, `#ccc` (text) | `text-text-2` |
| `#333`, `#444`, `#555` (text — dark/dim) | `text-text-3/50` |
| `border: "1px solid #2a2a2a"` or `#1e1e1e` or `#181818` or `#141414` | `border border-border` (for rows: `border-b border-border`) |
| `background: "#0d0d0d"` | `bg-bg` |
| `background: "#1a1a1a"` | `bg-panel` |

**`col()` function — rewrite to return class string:**

```typescript
function colCls(v: number | null | undefined, invert = false): string {
  if (v == null) return "text-text-3";
  if (invert) return v < 0 ? "text-pos" : "text-neg";
  return v >= 0 ? "text-pos" : "text-neg";
}
```

Delete the old `col()` function entirely. Replace every `c: col(...)` in rows arrays with `cls: colCls(...)`. Update table cell rendering from `style={{ color: r.c }}` to `className={r.cls}`.

For the "loading" dim color case — replace `color: loading ? "#333" : r.c` with:
```tsx
className={`py-1.5 text-sm font-data font-bold ${loading ? "text-text-3/30" : r.cls}`}
```

**`pnlMC()` at line 1372 — rewrite to return class string:**

```typescript
function pnlMCCls(v: number | null | undefined): string {
  return v == null ? "text-text-3/50" : v > 1 ? "text-pos" : v > 0 ? "text-warn" : "text-neg";
}
```

Delete old `pnlMC()`. Replace every `style={{ color: pnlMC(...) }}` with `className={pnlMCCls(...)}`.

**Tab buttons (QuantPage `export default`):**

Replace the per-tab `style={{...}}` object with:
```tsx
<button
  key={t.id}
  onClick={() => setTab(t.id)}
  className={`px-5 py-1.5 text-[13px] cursor-pointer border-0 border-b-2 -mb-px bg-transparent transition-colors ${
    tab === t.id
      ? "border-accent text-accent font-bold"
      : "border-transparent text-text-3 font-normal hover:text-text-1"
  }`}
>
  {t.label}
</button>
```

**Instrument toggle buttons (CorrelationTab, PortfolioTab):**

```tsx
<button
  key={id}
  onClick={() => toggle(id)}
  className={`px-2.5 py-0.5 text-[13px] cursor-pointer border rounded transition-colors ${
    selected.includes(id)
      ? "bg-accent text-black border-accent"
      : "bg-transparent text-text-3 border-border hover:text-text-2"
  }`}
>
  {id.split(".")[0]}
</button>
```

**`Err` component:**
```tsx
function Err({ msg }: { msg: string | null }) {
  return msg ? <p className="text-neg text-[13px] mt-0 mb-3">ERR: {msg}</p> : null;
}
```

**`corrBg()` — KEEP as-is (data-driven rgba, allowed exception):**
The `style={{ background: corrBg(v) }}` in the correlation matrix remains. Only remove className-level hex.

**Table row borders:**
Replace `style={{ borderBottom: "1px solid #181818" }}` on `<tr>` with `className="border-b border-border"`.

**Section wrappers (CorpFinancePanel, others):**
- `style={{ marginTop: 24, borderTop: "1px solid #1e1e1e", paddingTop: 16 }}` → `className="mt-6 border-t border-border pt-4"`
- `style={{ marginBottom: 16 }}` → `className="mb-4"`
- `style={{ color: "#ff8c00", fontSize: 14, marginBottom: 6 }}` → `className="text-accent text-sm mb-1.5"`
- `style={{ display: "flex", gap: 32, flexWrap: "wrap" }}` → `className="flex gap-8 flex-wrap"`
- `style={{ overflowX: "auto", marginBottom: 16 }}` → `className="overflow-x-auto mb-4"`

**CorpFinance table (inline, not S):**
- `style={{ borderCollapse: "collapse", fontSize: 14, fontFamily: "monospace", minWidth: 600 }}` → `className="border-collapse text-sm font-data min-w-[600px]"`
- `<th>` cells: `style={{ padding: "4px 12px", color: "#ff8c00", textAlign: "left/right", fontSize: 14 }}` → `className="px-3 py-1 text-accent text-sm text-left/right"`
- `<td>` label cells: `style={{ padding: "4px 12px", color: "#666", fontSize: 13 }}` → `className="px-3 py-1 text-text-3 text-[13px]"`
- `<td>` value cells with `color: v >= 0 ? "#e8e8e8" : "#ff3333"` → `className={\`px-3 py-1 text-right ${v >= 0 ? "text-text-2" : "text-neg"}\`}`
- `<td>` ratio cells with conditional color → `className={\`px-3 py-1 text-right ${v == null ? "text-text-3/50" : good ? "text-pos" : "text-neg"}\`}`
- `style={{ color: "#555", fontSize: 14, marginBottom: 8 }}` → `className="text-text-3 text-sm mb-2"`
- `style={{ color: data.crno etc }}` → `className="text-text-3 text-sm mb-2"`

**SubTabs component (line 1484):** Check for any inline styles there too.

**Allowed exceptions (do NOT remove these):**
- All SVG element attributes: `stroke`, `fill`, `stroke-width`, `textAnchor` — these are SVG, not className
- `style={{ width: N }}` on `<input type="number">` controls
- `style={{ background: corrBg(v) }}` on correlation matrix cells (data-driven rgba)
- `style={{ height: N }}` on chart containers if any
- `barChart()` function's SVG `fill={c}` and similar — SVG attribute, allowed

- [ ] **Step 1: Read the file and understand current structure**

Read `/Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard/app/quant/page.tsx` in full (all 1579 lines). Map which components exist and where each `style={S.xxx}` or `style={{ ... }}` appears. Do NOT start editing yet.

- [ ] **Step 2: Delete `const S` and update helper functions**

Remove `const S = { ... }` entirely (lines ~29-41).

Replace `col()` with `colCls()` as specified above.
Replace `pnlMC()` with `pnlMCCls()` as specified above.
Replace `Err` component as specified above.

- [ ] **Step 3: Migrate `QuantPage` export default and tab buttons**

In the `export default function QuantPage()` component (line 1548):
- Replace `<div style={S.page}>` with `<div className="p-5">`
- Replace `<div style={S.header}>` with `<div className="text-accent text-[13px] tracking-widest uppercase mb-6">`
- Replace `<div style={S.tabs}>` with `<div className="flex border-b border-border mb-4">`
- Replace tab `<button style={{...}}>` with the className variant above

- [ ] **Step 4: Migrate `RiskTab`**

Apply all token mappings to `RiskTab` (lines 55-113):
- toolbar div → `className="flex gap-3 items-center mb-3.5 flex-wrap"`
- SYMBOL/BENCH/DATE spans → `className="text-accent text-[13px]"`
- RUN button → `className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 transition-all border-0"`
- In `rows` array: change `c: col(...)` → `cls: colCls(...)`; change `c: "#e8e8e8"` → `cls: "text-text-2"`; `c: result?.max_drawdown != null ? "#ff3333" : "#888"` → `cls: result?.max_drawdown != null ? "text-neg" : "text-text-3"`; `c: result ? "#ff3333" : "#444"` → `cls: result ? "text-neg" : "text-text-3/50"`
- Table → `className="border-collapse w-full max-w-[560px]"`
- `<tr>` → `className="border-b border-border"`
- `<td>` label → `className="py-1.5 pr-[72px] text-accent text-[13px] w-[220px]"`
- `<td>` value → `className={\`py-1.5 text-sm font-data font-bold ${loading ? "text-text-3/30" : r.cls}\`}`

- [ ] **Step 5: Migrate `FactorTab`**

Apply all token mappings to `FactorTab` (lines 116-214):
- Toolbar, labels, RUN button → same as RiskTab
- `betaRows`: `c: "#e8e8e8"` → `cls: "text-text-2"`
- Beta table same as RiskTab table pattern
- Rolling beta chart div: `style={{ marginBottom: 16 }}` → `className="mb-4"`
- Rolling beta label: `style={{ color: "#ff8c00", fontSize: 14, marginBottom: 4 }}` → `className="text-accent text-sm mb-1"`
- SVG element: `style={{ display: "block", border: "1px solid #1e1e1e", background: "#0d0d0d" }}` → `className="block border border-border bg-bg"`
- SVG children (`stroke="#1a1a1a"`, `stroke="#333"`, `stroke="#ff8c00"`, `fill="#444"`, `fill="#333"`) — KEEP as SVG attributes

- [ ] **Step 6: Migrate `CorpFinancePanel`**

Apply all token mappings to `CorpFinancePanel` (lines 217-368):
- Section wrapper → `className="mt-6 border-t border-border pt-4"`
- Section header (기업 재무정보) → `className="text-accent text-[13px] tracking-widest uppercase mb-3"`
- Toolbar → same pattern
- 조회 button → same as RUN button
- LOADING span → `className="text-text-3 text-[13px]"`
- `barChart()` internal:
  - Wrapper div → `className="mb-4"`
  - Label → `className="text-accent text-sm mb-1"`
  - SVG → `className="block bg-bg border border-border"` (keep SVG attrs as hex)
- Finance summary table: apply CorpFinance table mappings from Global Constraints above
- Row with `color: "#555", fontSize: 14, marginBottom: 8` → `className="text-text-3 text-sm mb-2"`

- [ ] **Step 7: Migrate `CorrelationTab`**

Apply all token mappings to `CorrelationTab` (lines 371-456):
- Toolbar → same
- Instrument toggle buttons → use the toggle button className pattern above
- DATE label, RUN button, COMPUTING span → same
- Correlation matrix table: `style={{ borderCollapse: "collapse" }}` → `className="border-collapse"`
- Header `<th>` empty → `className="px-2 py-1 text-text-3 text-sm font-normal"`
- Header `<th>` with symbol → `className="px-2 py-1 text-accent text-sm font-normal"`
- Row label `<td>` → `className="px-2 py-0.5 text-accent text-sm whitespace-nowrap"`
- Matrix cell `<td>` → `className="p-0"`
- Matrix inner `<div>` with `corrBg(v)` → keep `style={{ background: corrBg(v) }}` + add `className="w-20 h-11 flex items-center justify-center border border-border"`
- Correlation value `<span>` → `className={\`text-sm font-data font-bold ${Math.abs(v) > 0.5 ? "text-bg" : "text-text-2"}\`}` (note: "text-bg" = near black since bg-bg is dark — might want just `text-black` here since it's shown on a colored bg; use `text-[color]` check — actually `text-bg` makes it hard to read, use `className="text-black dark:text-black"` or simply keep `style={{ color: Math.abs(v) > 0.5 ? "#000" : "#ccc" }}`). **Decision: keep `style={{ color: ... }}` only on the correlation span value inside the colored cell** — this is data-driven visibility, allowed exception.

- [ ] **Step 8: Migrate `PortfolioTab`**

Apply all token mappings to `PortfolioTab` (lines 459-614):
- Toolbar → same
- Instrument toggle → same as CorrelationTab toggle buttons
- OPTIMIZE button → `className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 transition-all border-0"`
- Portfolio stats container → `className="flex gap-8 flex-wrap"`
- "MIN VARIANCE PORTFOLIO" label → `className="text-accent text-sm mb-1.5"`
- Tables → same table/tr/td pattern as RiskTab
- For `col(result?.xxx ?? null)` → use `colCls(result?.xxx ?? null)`
- `#888` text (weight IDs when result exists) → `text-text-3`
- `#444` text (placeholder IDs) → `text-text-3/50`
- `#e8e8e8` text (weight values) → `text-text-2`
- `#333` text (placeholder values) → `text-text-3/30`
- Frontier SVG → keep SVG attrs as hex, add `className` to the `<svg>` wrapper: `className="block bg-bg border border-border"`
- Frontier label above chart → `className="text-accent text-sm mt-4 mb-1"`

- [ ] **Step 9: Migrate `svgLine`, `ChartPanel`, `ChartsTab`**

Lines 616-817:
- `ChartPanel`: `style={{ border: "1px solid #1e1e1e", marginBottom: 16, overflow: "hidden" }}` → `className="border border-border mb-4 overflow-hidden"`; title div `style={{ background: "#0d0d0d", padding: "6px 12px", color: "#ff8c00", fontSize: 13 }}` → `className="bg-bg px-3 py-1.5 text-accent text-[13px]"`; content div `style={{ background: "#050505" }}` → `className="bg-bg"`
- `ChartsTab`: toolbar + RUN button + error + loading → same patterns
- `svgLine()` returns SVG `<polyline>` with `color` param → keep as SVG attr (allowed)

- [ ] **Step 10: Migrate `MiniSeriesChart`, `FREDPanel`, `ECOSPanel`**

Lines 834-995:
- `MiniSeriesChart`: Apply token mappings to wrappers, labels, legend colors (if hex in className — keep SVG fill/stroke as hex)
- `FREDPanel` + `ECOSPanel`: Same toolbar/btn/label/error patterns
- Any `style={{ marginBottom: N }}` → `className="mb-N"`

- [ ] **Step 11: Migrate `KSDPanel`, `EdgarPanel`**

Lines 996-1255:
- Same patterns: toolbar, buttons, tables, labels
- `<th>` cells with hardcoded styles → token classes
- `<td>` cells with conditional colors → token classes or colCls()

- [ ] **Step 12: Migrate `MonteCarloTab`**

Lines 1256-1381:
- Toolbar, RUN, labels, error → same
- `pnlMC()` references → replace with `pnlMCCls()`
- Any table cells with MC-specific colors → use `pnlMCCls()`
- SVG elements → keep SVG attrs

- [ ] **Step 13: Migrate `RegimeTab`, `SubTabs`, `MacroUSPanel`, `MacroKRPanel`**

Lines 1382-1546:
- `RegimeTab`: toolbar, labels, RUN, error, result display → token classes
- `SubTabs`: tab button style → same active/inactive tab pattern
- `MacroUSPanel` / `MacroKRPanel`: wrapper patterns → token classes

- [ ] **Step 14: Verify and commit**

Run:
```bash
cd /Users/seokhun/Desktop/claude-test/seokminal/seokminal-dashboard
npx tsc --noEmit
```
Expected: zero errors

```bash
npm test
```
Expected: 127/127 tests passing

```bash
grep -n "style={S\." app/quant/page.tsx | wc -l
```
Expected: 0

```bash
grep -n 'style={{' app/quant/page.tsx | grep -v "corrBg\|width:\|background: corrBg\|color: Math\|color: v\b\|color: good" | wc -l
```
Expected: very low (SVG-related only, data-driven only)

Commit:
```bash
git add app/quant/page.tsx
git commit -m "style: migrate quant page to design tokens; remove const S object"
```

- [ ] **Step 15: Final check**

```bash
npx tsc --noEmit 2>&1 | head -5
npm test 2>&1 | tail -5
```

Both should show zero errors / 127 tests passing.
