# Seokminal Dashboard UI/UX Redesign Spec

**Date:** 2026-06-27  
**Scope:** seokminal-dashboard (Next.js frontend only)  
**Goal:** Information structure, readability, usability, design system improvement — not feature addition.

---

## 1. Constraints

- All existing functionality preserved (API calls, backtest logic, state logic unchanged)
- No new features
- No API structure changes
- Inline styles removed and replaced with Tailwind + CSS vars

---

## 2. Layout Decision

**Top-control + Bottom-analytics** for Backtest page:

```
┌─────────────────────────────────────────┐
│  NAUTILUS NAV                           │
├─────────────────────────────────────────┤
│ [Single Strategy] [Composite / Gated]   │  ← StrategyModeTabs
│ Symbol │ Date Range │ TF │ Bench │ [RUN]│  ← StrategyControlPanel (shared)
│ Fast ── Slow ── (or Rule Builder)       │  ← SingleStrategyForm / CompositeBuilder
├──────────────────┬──────────────────────┤
│                  │ PNL  SHARPE  MAX DD  │  ← MetricGrid (KPI cards)
│   CHART AREA     ├──────────────────────┤
│                  │ TRADE LOG TABLE      │  ← TradeLogTable
└──────────────────┴──────────────────────┘
```

Market page (page.tsx): simpler — keep single column, apply design tokens only.

---

## 3. CSS Architecture

**Tailwind utilities + CSS custom properties**

- Design tokens defined in `globals.css` as CSS variables
- Components use Tailwind className for layout/spacing/radius
- Token reference via `bg-[var(--panel)]` pattern or direct Tailwind config extension
- No CSS Modules (avoids 13+ extra files)
- No new npm dependencies

---

## 4. Design Tokens (globals.css)

```css
/* Colors */
--bg:       #080A0F
--panel:    #0F131A
--panel-2:  #151A23
--border:   #242A35
--text-1:   #E6EAF0   /* primary */
--text-2:   #9AA4B2   /* secondary */
--text-3:   #5F6B7A   /* muted */
--accent:   #FF9F1C   /* orange — accent ONLY */
--pos:      #22C55E
--neg:      #EF4444
--warn:     #F59E0B
--info:     #3B82F6

/* Typography */
--font-ui:   Inter, 'Geist', system-ui, sans-serif
--font-data: 'JetBrains Mono', 'IBM Plex Mono', monospace
--font-code: monospace

/* Spacing */
--page-px: 24px
--panel-p: 16px

/* Radius */
--radius-sm: 4px
--radius-md: 6px
--radius-lg: 8px

/* Borders */
--border-width: 1px
```

**Orange usage rule:** active tab underline, primary RUN button, selected state only. No orange on labels, no orange on section headers.

---

## 5. Typography Rules

- `body`: `--font-ui` (Inter/system-ui). No more global Courier New.
- Numbers / prices / metrics: `font-mono` via `--font-data`
- JSON preview, code: `font-code` / `<pre>`
- Section labels: uppercase tracking, `--text-3`, 11–12px
- Data values: `--text-1`, 16–18px, `--font-data`

---

## 6. Components to Create

All go in `components/ui/` directory.

| Component | Purpose |
|---|---|
| `PageHeader` | Section title + optional subtitle |
| `StrategyModeTabs` | Segmented control: Single / Composite |
| `StrategyControlPanel` | Shared: Symbol, DateRange, TF buttons, Benchmark, RUN button |
| `SingleStrategyForm` | Fast/Slow EMA params |
| `CompositeStrategyBuilder` | Rule list + Add Rule button + JSON preview |
| `RuleCard` | One rule: combinator + conditions + EMA trigger footer |
| `ConditionRow` | Single condition with IndSelect + IndParams + op + right side |
| `MetricCard` | Label + Value + optional delta, positive/negative color |
| `MetricGrid` | Grid of MetricCards |
| `ChartPanel` | Chart container with symbol/TF header + placeholder |
| `TradeLogTable` | Sticky header, row hover, right-aligned numbers, PnL color |
| `JsonPreview` | `<details>` collapsible pre block |
| `EmptyState` | Styled no-data message |

Existing components refactored (not replaced):
- `CandlestickChart` — visual polish only (colors update to match new tokens)
- `InstrumentSelect` — style only
- `DateRangePicker` — style only

---

## 7. Component Specs

### Nav Header (layout.tsx)
- Height: 48px
- `--panel` background, `--border` bottom border
- Logo: `--text-1`, Inter bold, no orange
- Nav links: `--text-3` default, `--text-1` on hover, `--accent` on active
- Date: right side, `--text-3`

### StrategyModeTabs
- Segmented pill control (not underline tabs)
- `--panel-2` background container
- Active segment: `--panel` background + `--accent` text + subtle border
- Height: 32px

### StrategyControlPanel
- Single row on wide screens, wraps on narrow
- Inputs: height 36px, `--panel-2` bg, `--border` border, `--radius-md`
- Focus: `--accent` border color
- Labels: `--text-3`, 11px, uppercase, above or inline
- TF buttons: small segmented group, active = `--panel-2` + `--text-1`
- RUN button: `--accent` bg, `#000` text, height 36px, `--radius-md`, bold

### MetricCard
```
┌──────────────────┐
│ TOTAL PNL        │  ← label: text-3, 11px, uppercase
│ +$1,240.32       │  ← value: text-1 or pos/neg, 18px, font-data
│ +3.42%           │  ← delta: pos/neg, 12px, font-data
└──────────────────┘
```
- Background: `--panel`
- Border: `--border`
- Radius: `--radius-md`
- Padding: 12px 16px

### ChartPanel
- Header row: symbol pill + timeframe pill + strategy badge + legend
- Chart height: 480px (up from 420px)
- Placeholder: centered, `--text-3`, subtle border, proper height

### RuleCard
- Card: `--panel` bg, `--border` border, `--radius-lg`
- Header: "RULE N" label + combinator select + Remove (icon button, `--neg` on hover)
- Conditions: each row separated by AND/OR pill connector (not text)
- Add Condition: ghost button, secondary style
- Trigger footer: `--panel-2` bg, border-top, EMA fast/slow inputs

### ConditionRow
- Inline pill style: `[INDICATOR][PARAMS] [OP] [VALUE/INDICATOR]`
- All selects/inputs: compact height 32px within row
- Remove: × icon button, appears on hover

### TradeLogTable
- Container: `--panel` bg, `--border` border, `--radius-lg`, overflow-hidden
- `<thead>`: sticky, `--panel-2` bg, `--text-3` color
- `<tbody> tr:hover`: `--panel-2` bg
- Numbers (price, PnL, qty): right-align, `--font-data`
- PnL: `--pos`/`--neg` color
- Empty state: centered `EmptyState` component

### EmptyState
- Icon (optional) + message + optional CTA
- `--text-3`, centered, min-height for visual weight

---

## 8. Files Modified

| File | Change |
|---|---|
| `app/globals.css` | Full token rewrite + body font change + input/button base styles |
| `app/layout.tsx` | Tailwind className, remove inline styles |
| `app/page.tsx` | Apply tokens, extract sub-components |
| `app/backtest/page.tsx` | Full layout restructure, extract all sub-components |
| `components/CandlestickChart.tsx` | Color token update only |
| `components/InstrumentSelect.tsx` | Style update |
| `components/DateRangePicker.tsx` | Style update |

New files in `components/ui/`:
- All 13 components from section 6

---

## 9. Out of Scope

- quant/page.tsx, bots/page.tsx, ai-trader/page.tsx: apply globals only (no structural redesign)
- No new API endpoints
- No new features
- No AI features
- No font package installation (use system Inter / Google Fonts via CSS `@import` if available, else system-ui fallback)

---

## 10. Success Criteria

- Bloomberg Terminal feel preserved, but readable
- Orange used sparingly (≤3 places per screen)
- Chart + results visible without scrolling on 1440px wide screen
- Rule Builder less visually cluttered
- No inline styles in TSX files (except dynamic values like PnL color)
- All existing functionality passes manual smoke test
