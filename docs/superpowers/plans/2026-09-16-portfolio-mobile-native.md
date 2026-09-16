# Portfolio 모바일 네이티브 디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 하단 탭바를 5개 primary 탭으로 확장하고, 4종 신규 시각 프리미티브(티커뱃지·손익막대·리스트로우·바텀시트)를 만들어 `/portfolio`의 보유종목 리스트를 Toss/Robinhood 스타일 모바일 네이티브 UI로 재구성한다.

**Architecture:** 기존 데스크톱 로직/state는 그대로 두고 `md:hidden`(모바일)/`hidden md:block`(데스크톱) 분기를 프로젝트 기존 컨벤션(4라우트에서 이미 쓴 패턴) 그대로 적용한다. 새 프리미티브는 `components/ui/ApPrimitives.tsx`에 기존 `ApDot`/`ApBadge`/`ApMeter`와 같은 스타일로 추가하고, `/portfolio`의 `AccountsTab`이 이미 fetch해둔 state를 그대로 재사용해 벤더별(Alpaca/HL/KIS) 데이터를 공통 `MobilePosition` 모양으로 매핑한다.

**Tech Stack:** Next.js App Router, React, Tailwind(ap-* 토큰), vitest — 신규 npm 의존성 없음, 순수 SVG/CSS만 사용.

**Spec:** `docs/superpowers/specs/2026-09-16-portfolio-mobile-native-design.md`

## Global Constraints

- 색상은 전부 `var(--color-ap-*)` CSS 변수 경유 — `lib/chart-colors.ts`의 `TOKEN`(다크 리터럴 hex) 사용 금지.
- 신규 npm 의존성 추가 금지 — 순수 SVG/Tailwind만.
- 모바일/데스크톱 분기 기준은 `md`(768px) breakpoint, 기존 4라우트와 동일 컨벤션: 데스크톱 `hidden md:block`(또는 `hidden md:grid`), 모바일 `md:hidden`.
- Raw `fetch` 금지 — `lib/api.ts`/`lib/console-api.ts` 함수만 사용. 이번 계획의 모든 태스크는 신규 fetch를 추가하지 않고 기존 state를 재사용한다.
- `ApPrimitives.tsx` 내 동적 색상/폭(hue, width%)은 `ApDot`/`ApBadge`/`ApMeter`가 이미 쓰는 `style={{...}}` 인라인 패턴을 그대로 따른다 — Tailwind로 표현 불가능한 JS 계산값이라 이 파일 안에서는 기존에 승인된 예외.
- LKG 페이퍼 트레이딩 포지션은 이번 모바일 리스트에 포함하지 않는다 — 데이터 모양(`score_delta`)이 다른 벤더의 `pnlPct`와 호환되지 않아 매퍼에 안 맞음. `/portfolio`의 USD 합계 계산에는 이미 포함되어 있어 총액은 정확함. Phase 2 후보로 남긴다.
- EUR 계좌는 이번 모바일 리스트에서 제외 — 데스크톱에서도 EUR은 계좌 잔고만 있고 종목 단위 데이터가 없어(never itemized) 매핑할 데이터 자체가 없음.
- `superpowers:subagent-driven-development`로 실행 시 이 계획이 참조하는 스펙 파일도 함께 읽을 것.

---

### Task 1: `ApTickerBadge` 프리미티브 + hue 해시 함수

**Files:**
- Modify: `components/ui/ApPrimitives.tsx` (파일 끝에 추가)
- Test: `tests/lib/apPrimitives.test.ts` (신규)

**Interfaces:**
- Produces: `export function hashHue(seed: string): number` (0~359), `export function ApTickerBadge({ symbol, size = 32 }: { symbol: string; size?: number }): JSX.Element`

- [ ] **Step 1: `ApPrimitives.tsx` 끝에 `hashHue`와 `ApTickerBadge` 추가**

```ts
// ── Ticker badge (심볼 해시 기반 원형 뱃지, 외부 로고 없음) ──────────────────
export function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function ApTickerBadge({ symbol, size = 32 }: { symbol: string; size?: number }) {
  const hue = hashHue(symbol);
  const text = symbol.slice(0, 2).toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold shrink-0"
      style={{
        width: size, height: size, fontSize: Math.round(size * 0.38),
        background: `hsl(${hue} 60% 90%)`, color: `hsl(${hue} 55% 28%)`,
      }}
    >
      {text}
    </span>
  );
}
```

- [ ] **Step 2: 테스트 파일 작성**

```ts
import { describe, it, expect } from "vitest";
import { hashHue } from "@/components/ui/ApPrimitives";

describe("hashHue", () => {
  it("같은 심볼은 항상 같은 hue를 반환한다", () => {
    expect(hashHue("AAPL")).toBe(hashHue("AAPL"));
  });
  it("0~359 범위 안에 있다", () => {
    for (const s of ["AAPL", "005930", "BTC", "a", ""]) {
      const h = hashHue(s);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });
  it("서로 다른 심볼은 (대개) 다른 hue를 반환한다", () => {
    expect(hashHue("AAPL")).not.toBe(hashHue("MSFT"));
  });
});
```

- [ ] **Step 3: 테스트 실행**

Run: `npx vitest run tests/lib/apPrimitives.test.ts`
Expected: 3개 테스트 PASS

- [ ] **Step 4: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add components/ui/ApPrimitives.tsx tests/lib/apPrimitives.test.ts
git commit -m "feat: ApTickerBadge 프리미티브 추가 (심볼 해시 기반 뱃지)"
```

---

### Task 2: `ApGainBar` 프리미티브

**Files:**
- Modify: `components/ui/ApPrimitives.tsx`
- Modify: `tests/lib/apPrimitives.test.ts`

**Interfaces:**
- Consumes: 없음(독립)
- Produces: `export function gainBarWidthPct(pct: number, maxAbs: number): number` (0~100), `export function ApGainBar({ pct, maxAbs }: { pct: number; maxAbs: number }): JSX.Element`

- [ ] **Step 1: `ApPrimitives.tsx`에 추가 (Task 1이 추가한 블록 바로 아래)**

```ts
// ── Gain bar (평단가→현재가 손익률 막대, 시계열 대체) ──────────────────────
export function gainBarWidthPct(pct: number, maxAbs: number): number {
  const denom = Math.max(1e-9, Math.abs(maxAbs));
  return Math.max(0, Math.min(100, (Math.abs(pct) / denom) * 100));
}

export function ApGainBar({ pct, maxAbs }: { pct: number; maxAbs: number }) {
  const width = gainBarWidthPct(pct, maxAbs);
  const tone = pct >= 0 ? "var(--color-ap-up)" : "var(--color-ap-down)";
  return (
    <div className="h-1.5 w-full min-w-[36px] bg-ap-line rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${width}%`, background: tone }} />
    </div>
  );
}
```

- [ ] **Step 2: 테스트 추가 (기존 `tests/lib/apPrimitives.test.ts`에 이어서)**

```ts
import { gainBarWidthPct } from "@/components/ui/ApPrimitives";

describe("gainBarWidthPct", () => {
  it("maxAbs와 같은 크기면 100을 반환한다", () => {
    expect(gainBarWidthPct(5, 5)).toBe(100);
    expect(gainBarWidthPct(-5, 5)).toBe(100);
  });
  it("0..100 범위로 클램프한다", () => {
    expect(gainBarWidthPct(10, 5)).toBe(100);
    expect(gainBarWidthPct(0, 5)).toBe(0);
  });
  it("maxAbs가 0이어도 나눗셈 에러 없이 동작한다", () => {
    expect(Number.isFinite(gainBarWidthPct(3, 0))).toBe(true);
  });
});
```

(두 번째 `import` 줄은 파일 상단의 기존 import 블록에 합쳐서 `import { hashHue, gainBarWidthPct } from "@/components/ui/ApPrimitives";` 한 줄로 정리할 것 — import 중복 금지.)

- [ ] **Step 3: 테스트 실행**

Run: `npx vitest run tests/lib/apPrimitives.test.ts`
Expected: 6개 테스트 PASS

- [ ] **Step 4: 타입체크 + 커밋**

```bash
npx tsc --noEmit
git add components/ui/ApPrimitives.tsx tests/lib/apPrimitives.test.ts
git commit -m "feat: ApGainBar 프리미티브 추가 (손익률 막대)"
```

---

### Task 3: `ApListRow` 프리미티브

**Files:**
- Modify: `components/ui/ApPrimitives.tsx`

**Interfaces:**
- Produces: `export function ApListRow(props: { leading?: ReactNode; title: ReactNode; subtitle?: ReactNode; trailing?: ReactNode; trailingSub?: ReactNode; onClick?: () => void }): JSX.Element`

- [ ] **Step 1: `ApPrimitives.tsx`에 추가**

```ts
// ── List row (범용 리스트 항목 — leading/title/subtitle + trailing/trailingSub) ──
export function ApListRow({
  leading, title, subtitle, trailing, trailingSub, onClick,
}: {
  leading?: ReactNode; title: ReactNode; subtitle?: ReactNode;
  trailing?: ReactNode; trailingSub?: ReactNode; onClick?: () => void;
}) {
  const content = (
    <>
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ap-ink-1 truncate">{title}</div>
        {subtitle && <div className="text-xs text-ap-ink-3 truncate mt-0.5">{subtitle}</div>}
      </div>
      {(trailing || trailingSub) && (
        <div className="shrink-0 text-right">
          {trailing && <div className="text-sm font-mono font-semibold text-ap-ink-1">{trailing}</div>}
          {trailingSub && <div className="mt-1">{trailingSub}</div>}
        </div>
      )}
    </>
  );
  if (onClick) {
    return (
      <button onClick={onClick}
        className="flex items-center gap-3 w-full min-h-11 py-2 px-3 text-left border-0 bg-transparent cursor-pointer active:bg-ap-bg">
        {content}
      </button>
    );
  }
  return <div className="flex items-center gap-3 w-full min-h-11 py-2 px-3">{content}</div>;
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (순수 JSX 분기라 별도 유닛 테스트 없음 — Task 7 통합 지점에서 브라우저로 시각 확인)

- [ ] **Step 3: 커밋**

```bash
git add components/ui/ApPrimitives.tsx
git commit -m "feat: ApListRow 프리미티브 추가 (범용 리스트 항목)"
```

---

### Task 4: `ApBottomSheet` 프리미티브

**Files:**
- Modify: `components/ui/ApPrimitives.tsx` (상단 import에 `useRef` 추가)
- Modify: `tests/lib/apPrimitives.test.ts`

**Interfaces:**
- Produces: `export function shouldDismissSheet(startY: number | null, endY: number, threshold?: number): boolean`, `export function ApBottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }): JSX.Element`
- 패턴 출처: `components/console/BottomTabBar.tsx`의 "더보기" 시트(스와이프 다운 80px로 닫힘) — 그 파일은 건드리지 않고 동일 패턴을 여기 새 컴포넌트로 추출.

- [ ] **Step 1: 파일 최상단 import 수정**

`components/ui/ApPrimitives.tsx` 1~3번째 줄:
```ts
"use client";

import type { ReactNode } from "react";
```
를 다음으로 교체:
```ts
"use client";

import { useRef, type ReactNode } from "react";
```

- [ ] **Step 2: 파일 끝에 추가**

```ts
// ── Bottom sheet (스와이프-다운으로 닫히는 모바일 시트) ─────────────────────
export function shouldDismissSheet(startY: number | null, endY: number, threshold = 80): boolean {
  return startY !== null && endY - startY > threshold;
}

export function ApBottomSheet({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const swipeStartY = useRef<number | null>(null);
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-h-[80vh] overflow-y-auto bg-ap-surface border-t border-ap-line rounded-t-xl pb-[env(safe-area-inset-bottom)]"
        onTouchStart={(e) => { swipeStartY.current = e.touches[0].clientY; }}
        onTouchEnd={(e) => {
          if (shouldDismissSheet(swipeStartY.current, e.changedTouches[0].clientY)) onClose();
          swipeStartY.current = null;
        }}>
        <div className="sticky top-0 flex items-center justify-between px-4 h-11 border-b border-ap-line bg-ap-surface">
          <span className="text-sm font-semibold text-ap-ink-1 truncate">{title}</span>
          <button onClick={onClose}
            className="text-ap-ink-3 text-xs border-0 bg-transparent cursor-pointer min-h-11 min-w-11 px-3 flex items-center justify-center shrink-0">
            닫기
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 테스트 추가 (`tests/lib/apPrimitives.test.ts`에 이어서, import 줄에 `shouldDismissSheet` 합치기)**

```ts
describe("shouldDismissSheet", () => {
  it("80px 넘게 아래로 스와이프하면 true", () => {
    expect(shouldDismissSheet(100, 190)).toBe(true);
  });
  it("80px 이하면 false", () => {
    expect(shouldDismissSheet(100, 170)).toBe(false);
  });
  it("시작점이 없으면(startY null) false", () => {
    expect(shouldDismissSheet(null, 300)).toBe(false);
  });
});
```

- [ ] **Step 4: 테스트 + 타입체크**

```bash
npx vitest run tests/lib/apPrimitives.test.ts
npx tsc --noEmit
```
Expected: 9개 테스트 PASS, 타입 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add components/ui/ApPrimitives.tsx tests/lib/apPrimitives.test.ts
git commit -m "feat: ApBottomSheet 프리미티브 추가 (스와이프 다운 닫기)"
```

---

### Task 5: 하단 탭바 5개로 확장

**Files:**
- Modify: `components/console/BottomTabBar.tsx`

**Interfaces:**
- Consumes: 없음(독립 태스크, 다른 태스크 산출물 안 씀)
- Produces: 없음(다른 태스크가 참조할 export 없음 — `PRIMARY_TABS`는 모듈 내부용)

- [ ] **Step 1: `PRIMARY_TABS` 확장 + `matchPrefix` 지원**

`components/console/BottomTabBar.tsx` 13~17번째 줄:
```ts
const PRIMARY_TABS = [
  { href: "/hud/summary", label: "홈" },
  { href: "/portfolio", label: "포트폴리오" },
  { href: "/investment-os", label: "Investment OS" },
];
```
를 다음으로 교체:
```ts
const PRIMARY_TABS: { href: string; label: string; matchPrefix?: string }[] = [
  { href: "/hud/summary", label: "홈" },
  { href: "/portfolio", label: "포트폴리오" },
  { href: "/research-os/chat", label: "Research OS", matchPrefix: "/research-os" },
  { href: "/investment-os", label: "Investment OS" },
  { href: "/performance", label: "성과" },
];
```

- [ ] **Step 2: `TabIcon`에 새 탭 2개 아이콘 케이스 추가**

`components/console/BottomTabBar.tsx`의 `TabIcon` 함수 내 `switch (href)` 블록(기존 22~31번째 줄) — `case "/investment-os":` 다음, `default:` 앞에 두 케이스 추가:

```ts
    case "/research-os/chat":
      return <svg {...props}><rect x="2" y="3" width="12" height="7.5" rx="1.5" /><path d="M5 10.5v3l3-3" /></svg>;
    case "/performance":
      return <svg {...props}><path d="M2 12l4-4 3 3 5-6" /><path d="M11 5h3v3" /></svg>;
```

- [ ] **Step 3: active 판정에 `matchPrefix` 반영**

`BottomTabBar()` 함수 안(기존 53번째 줄 `const inPrimary = ...`)을 다음으로 교체:
```ts
  const inPrimary = PRIMARY_TABS.some((t) => isActivePath(pathname, t.matchPrefix ?? t.href));
```

렌더 루프(기존 59~67번째 줄) 안의 `const active = isActivePath(pathname, t.href);`를 다음으로 교체:
```ts
          const active = isActivePath(pathname, t.matchPrefix ?? t.href);
```

- [ ] **Step 4: 탭 5개일 때 라벨 잘림 방지 — 라벨 span 클래스 축소**

같은 렌더 루프 안 라벨 `<span>` 줄:
```tsx
<span className={`text-[11px] tracking-wide ${active ? "text-[var(--c-hud)]" : "text-[var(--c-text-3)]"}`}>{t.label}</span>
```
를 다음으로 교체(글자 크기 축소 + 가운데 정렬 + 줄바꿈 허용):
```tsx
<span className={`text-[10px] leading-tight text-center px-0.5 ${active ? "text-[var(--c-hud)]" : "text-[var(--c-text-3)]"}`}>{t.label}</span>
```

- [ ] **Step 5: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 6: 개발 서버로 시각 확인**

`npm run dev` 후 브라우저 devtools 모바일 뷰(폭 <768px)로 `/hud/summary` 접속 — 하단 탭 5개(홈/포트폴리오/Research OS/Investment OS/성과)가 겹침 없이 보이는지, `/research-os/validation`·`/research-os/governance`로 이동해도 "Research OS" 탭이 활성 표시되는지 확인.

- [ ] **Step 7: 커밋**

```bash
git add components/console/BottomTabBar.tsx
git commit -m "feat: 하단 탭바 3개→5개로 확장 (Research OS, 성과 추가)"
```

---

### Task 6: `research-os/chat`에 `?q=` 딥링크 지원

**Files:**
- Modify: `app/(console)/research-os/chat/page.tsx`

**Interfaces:**
- Consumes: 없음(독립)
- Produces: 없음 — Task 7이 `router.push(`/research-os/chat?q=...`)`로 이 동작에 의존하지만, 인터페이스는 URL 규약(`?q=<symbol>`)이지 함수 export가 아님.

- [ ] **Step 1: import 수정**

`app/(console)/research-os/chat/page.tsx` 4번째 줄:
```ts
import { useState, useCallback } from "react";
```
를 다음으로 교체:
```ts
import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
```

(프로젝트 내 `app/(console)/investment-os/page.tsx`, `app/(console)/research-os/validation/page.tsx` 등이 이미 같은 방식으로 `useSearchParams`를 Suspense 경계 없이 직접 호출하는 컨벤션 — 그대로 따름.)

- [ ] **Step 2: `?q=` 읽어서 자동 실행**

`ResearchChat()` 함수 안, `run` 콜백 정의(기존 23~34번째 줄) 바로 다음에 추가:

```ts
  const searchParams = useSearchParams();
  useEffect(() => {
    const initial = searchParams.get("q");
    if (initial) { setQ(initial); run(initial); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 개발 서버로 수동 확인**

`npm run dev` 후 브라우저에서 `/research-os/chat?q=AAPL` 접속 — 입력창에 "AAPL"이 채워지고 자동으로 질문이 전송되어 Decision Memo가 뜨는지 확인. (자동화 테스트 없음 — 이 페이지엔 기존에도 테스트 파일이 없고, 프로젝트에 컴포넌트 렌더링 테스트 라이브러리(@testing-library/react 등)가 설치돼 있지 않음. `?q=` 없이 `/research-os/chat` 단독 접속 시 기존과 동일하게 빈 입력 상태인지도 함께 확인.)

- [ ] **Step 5: 커밋**

```bash
git add "app/(console)/research-os/chat/page.tsx"
git commit -m "feat: research-os/chat에 ?q= 딥링크 자동 질문 지원 추가"
```

---

### Task 7: `/portfolio` `AccountsTab` 모바일 리디자인

**Files:**
- Modify: `app/portfolio/page.tsx`
- Test: `tests/lib/portfolioMobileMapping.test.ts` (신규)

**Interfaces:**
- Consumes:
  - `ApTickerBadge`, `ApGainBar`, `ApListRow`, `ApBottomSheet` from `@/components/ui/ApPrimitives` (Tasks 1-4)
  - `AlpacaPosition`, `HLAssetPosition`, `KISHolding` types already imported in `app/portfolio/page.tsx` (line 7)
  - 기존 `AccountsTab()`의 state: `alpacaPositions`, `hlTestnetPositions`, `hlMainnetPositions`, `kisMockHoldings`, `kisLiveHoldings`, `krwTotal`, `usdTotal`, `usdcTotal`, `balancesPending`, `compositionRows` (기존 코드 그대로, 수정 없음)
  - `fmt()`, `Bar`(이미 import됨) — 모바일 블록에서도 재사용
- Produces: `export interface MobilePosition`, `export function alpacaToMobile(p: AlpacaPosition): MobilePosition`, `export function hlToMobile(p: HLAssetPosition, venue: string): MobilePosition`, `export function kisToMobile(h: KISHolding, venue: string): MobilePosition` — 다른 태스크는 이걸 소비하지 않음(테스트에서만 import).

- [ ] **Step 1: `AccountsTab` 함수 앞(기존 259~261번째 줄, `// ── 계좌 현황 탭 ──` 주석 바로 아래)에 매퍼 3개와 `MobilePosition`, `MobileGroup` 컴포넌트 추가**

```ts
// ── 모바일 리스트용 공통 포지션 모양 ─────────────────────────────────────────

export interface MobilePosition {
  key: string; symbol: string; qty: string; avgPrice: string; currentPrice: string;
  pnlPct: number; venue: string;
}

export function alpacaToMobile(p: AlpacaPosition): MobilePosition {
  return {
    key: p.symbol, symbol: p.symbol, qty: `${p.qty}주`,
    avgPrice: `$${p.avg_entry_price.toFixed(2)}`, currentPrice: `$${p.current_price.toFixed(2)}`,
    pnlPct: p.unrealized_plpc * 100, venue: "Alpaca",
  };
}

export function hlToMobile(p: HLAssetPosition, venue: string): MobilePosition {
  const pos = p.position;
  const szi = parseFloat(pos.szi);
  const roe = parseFloat(pos.returnOnEquity) * 100;
  return {
    key: pos.coin, symbol: pos.coin, qty: `${Math.abs(szi)}`,
    avgPrice: pos.entryPx ? `$${parseFloat(pos.entryPx).toFixed(2)}` : "—",
    currentPrice: `평가 $${parseFloat(pos.positionValue).toFixed(2)}`,
    pnlPct: roe, venue,
  };
}

export function kisToMobile(h: KISHolding, venue: string): MobilePosition {
  return {
    key: h.code, symbol: h.name, qty: `${h.qty}주`,
    avgPrice: `₩${h.avg_price.toLocaleString("ko-KR")}`,
    currentPrice: `₩${h.current.toLocaleString("ko-KR")}`,
    pnlPct: h.return_pct ?? 0, venue,
  };
}

function MobileGroup({ title, ccy, total, items, emptyHint, onSelect }: {
  title: string; ccy: string; total: number | null; items: MobilePosition[]; emptyHint: string;
  onSelect: (p: MobilePosition) => void;
}) {
  const maxAbs = Math.max(1, ...items.map((p) => Math.abs(p.pnlPct)));
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-ap-ink-1 text-sm font-semibold">{title}</span>
        {total != null && <span className="text-ap-brand text-sm font-mono font-bold">{fmt(total, ccy)}</span>}
      </div>
      <ApPanel>
        {items.length === 0 ? (
          <p className="text-ap-ink-3 text-xs p-3">{emptyHint}</p>
        ) : (
          <div className="divide-y divide-ap-line/60">
            {items.map((p, i) => (
              <ApListRow key={`${p.key}-${i}`}
                leading={<ApTickerBadge symbol={p.symbol} />}
                title={p.symbol}
                subtitle={`${p.qty} · ${p.avgPrice} · ${p.venue}`}
                trailing={<span className={p.pnlPct >= 0 ? "text-ap-up" : "text-ap-down"}>{p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(1)}%</span>}
                trailingSub={<div className="w-14"><ApGainBar pct={p.pnlPct} maxAbs={maxAbs} /></div>}
                onClick={() => onSelect(p)}
              />
            ))}
          </div>
        )}
      </ApPanel>
    </div>
  );
}
```

- [ ] **Step 2: 파일 최상단 import 수정**

`app/portfolio/page.tsx` 1~14번째 줄 중 아래 부분을 교체.

기존:
```ts
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getAccountBalances, getAlpacaPositions, getAlpacaAccount, getPaperState, getHLPositions, getKisHoldings,
  getOmsOrders, getRealizedPnl, ApiError,
  type AccountRow, type AlpacaPosition, type AlpacaAccount, type PaperState, type HLAssetPosition, type KISHolding,
  type OmsOrder, type VenuePnl,
} from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/Card";
import { SegmentedToggle, LoadingState, EmptyState, Bar } from "@/components/ui";
import { TimeSeries, type TSSeries } from "@/components/charts/TimeSeries";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { TOKEN } from "@/lib/chart-colors";
```

교체 후:
```ts
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getAccountBalances, getAlpacaPositions, getAlpacaAccount, getPaperState, getHLPositions, getKisHoldings,
  getOmsOrders, getRealizedPnl, ApiError,
  type AccountRow, type AlpacaPosition, type AlpacaAccount, type PaperState, type HLAssetPosition, type KISHolding,
  type OmsOrder, type VenuePnl,
} from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/Card";
import { SegmentedToggle, LoadingState, EmptyState, Bar } from "@/components/ui";
import { ApPanel, ApTickerBadge, ApGainBar, ApListRow, ApBottomSheet } from "@/components/ui/ApPrimitives";
import { TimeSeries, type TSSeries } from "@/components/charts/TimeSeries";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { TOKEN } from "@/lib/chart-colors";
```

- [ ] **Step 3: `AccountsTab()` 리턴문을 데스크톱/모바일 분기로 교체**

기존 `AccountsTab()`의 `return` 블록(현재 338~432번째 줄, `if (loading) return (...)` 다음부터 함수 끝까지)을 아래로 교체 — **`if (loading) return (...)` 블록은 그대로 유지**하고 그 다음 `return (` 부터 교체 시작:

```tsx
  const [selected, setSelected] = useState<MobilePosition | null>(null);
  const router = useRouter();

  const krwMobile: MobilePosition[] = [
    ...kisMockHoldings.map((h) => kisToMobile(h, "한투 모의")),
    ...kisLiveHoldings.map((h) => kisToMobile(h, "한투 실계좌")),
  ];
  const usdMobile: MobilePosition[] = alpacaPositions.map(alpacaToMobile);
  const usdcMobile: MobilePosition[] = [
    ...hlTestnetPositions.map((p) => hlToMobile(p, "HL 테스트넷")),
    ...hlMainnetPositions.map((p) => hlToMobile(p, "HL 메인넷")),
  ];

  return (
    <>
    <div className="hidden md:grid grid-cols-1 lg:grid-cols-[220px_1fr_320px] gap-4 items-start">
      {/* LEFT — 자산군별 합계, quick nav */}
      <div className="space-y-3">
        {krwTotal != null && <CcyTotalTile label="국내주식 합계" value={krwTotal} ccy="KRW" />}
        <CcyTotalTile label="해외주식 합계" value={usdTotal} ccy="USD" />
        {eurTotal != null && <CcyTotalTile label="해외주식 합계 (EUR)" value={eurTotal} ccy="EUR" />}
        {usdcTotal != null && <CcyTotalTile label="코인 합계" value={usdcTotal} ccy="USDC" />}
      </div>

      {/* CENTER — 자산군별 계좌 카드, main workspace */}
      <div className="space-y-8 min-w-0">
        <CcySection ccy="KRW" total={krwTotal} label="국내주식">
          {krwAccounts.map(a => (
            <AccountCard key={a.venue} label={a.label} ccy="KRW"
              balance={a.balance} mode={a.mode} error={a.error}>
              <KISHoldings holdings={a.venue === "kis_mock" ? kisMockHoldings : kisLiveHoldings} />
            </AccountCard>
          ))}
          {krwAccounts.length === 0 && (
            <p className="text-ap-ink-3 text-xs">{balancesPending ? "한투 잔고 조회 중… (최대 30초)" : "국내주식 계좌 없음"}</p>
          )}
        </CcySection>

        <CcySection ccy="USD" total={usdTotal > 0 ? usdTotal : null} label="해외주식">
          {alpacaAcct && (
            <AccountCard label="Alpaca · 미국주식" ccy="USD"
              balance={alpacaAcct.portfolio_value} paper={alpacaAcct.paper}>
              <AlpacaPositions positions={alpacaPositions} />
            </AccountCard>
          )}
          {usdAccounts.filter(a => a.venue !== "alpaca").map(a => (
            <AccountCard key={a.venue} label={a.label} ccy="USD"
              balance={a.balance} mode={a.mode} error={a.error} />
          ))}
          {paper && (
            <AccountCard label="LKG 페이퍼 트레이딩" ccy="USD"
              balance={lkgBalance} paper={true}>
              <LkgPaperDetail paper={paper} />
            </AccountCard>
          )}
        </CcySection>

        {eurAccounts.length > 0 && (
          <CcySection ccy="EUR" total={eurTotal} label="해외주식">
            {eurAccounts.map(a => (
              <AccountCard key={a.venue} label={a.label} ccy="EUR"
                balance={a.balance} mode={a.mode} error={a.error} />
            ))}
          </CcySection>
        )}

        <CcySection ccy="USDC" total={usdcTotal} label="코인">
          {usdcAccounts.map(a => (
            <AccountCard key={a.venue} label={a.label} ccy="USDC"
              balance={a.balance} mode={a.mode} error={a.error}>
              <HLPositions positions={a.venue === "hl_testnet" ? hlTestnetPositions : hlMainnetPositions} />
            </AccountCard>
          ))}
          {usdcAccounts.length === 0 && (
            <p className="text-ap-ink-3 text-xs">{balancesPending ? "HL 잔고 조회 중…" : "Hyperliquid 계좌 없음"}</p>
          )}
        </CcySection>
      </div>

      {/* RIGHT — composition (venue → 통화별 잔고 구성비) */}
      <Card>
        <CardHeader>거래소별 분포 <span className="text-ap-ink-3 text-[11px] font-normal">(구성)</span></CardHeader>
        <div className="p-1">
          {compositionRows.length === 0 ? (
            <p className="text-ap-ink-3 text-xs p-2">연동 계좌 없음</p>
          ) : (
            <div className="divide-y divide-ap-line/60 text-[11px]">
              {[...compositionRows].sort((a, b) => b.balance - a.balance).map(r => (
                <div key={`${r.venue}-${r.ccy}`} className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <div className="min-w-0">
                    <p className="text-ap-ink-1 truncate">{r.venue}</p>
                    <p className="text-ap-ink-3">{r.ccy} · {fmt(r.balance, r.ccy, true)}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 shrink-0">
                    <Bar ratio={r.share} tone="bg-ap-brand/70" trackClass="bg-ap-bg border-ap-line" />
                    <span className="tabular-nums text-ap-ink-2">{(r.share * 100).toFixed(1)}%</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="px-3 pb-3 text-[11px] text-ap-ink-3 leading-relaxed">
          통화 내 venue 잔고 구성비 · 손익 귀속(attribution)이 아닌 배분 현황 표시.
        </p>
      </Card>
    </div>

    <div className="md:hidden space-y-6">
      <MobileGroup title="국내주식" ccy="KRW" total={krwTotal} items={krwMobile}
        emptyHint={balancesPending ? "한투 잔고 조회 중… (최대 30초)" : "국내주식 보유 종목 없음"}
        onSelect={setSelected} />
      <MobileGroup title="해외주식" ccy="USD" total={usdTotal > 0 ? usdTotal : null} items={usdMobile}
        emptyHint="해외주식 보유 종목 없음" onSelect={setSelected} />
      <MobileGroup title="코인" ccy="USDC" total={usdcTotal} items={usdcMobile}
        emptyHint={balancesPending ? "HL 잔고 조회 중…" : "코인 보유 종목 없음"} onSelect={setSelected} />

      {compositionRows.length > 0 && (
        <ApPanel>
          <div className="px-4 py-3 border-b border-ap-line">
            <span className="text-sm font-semibold text-ap-ink-1">거래소별 분포</span>
          </div>
          <div className="divide-y divide-ap-line/60 p-1">
            {[...compositionRows].sort((a, b) => b.balance - a.balance).map(r => (
              <div key={`${r.venue}-${r.ccy}`} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-ap-ink-1 text-sm truncate">{r.venue}</p>
                  <p className="text-ap-ink-3 text-xs">{r.ccy} · {fmt(r.balance, r.ccy, true)}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 shrink-0">
                  <Bar ratio={r.share} tone="bg-ap-brand/70" trackClass="bg-ap-bg border-ap-line" />
                  <span className="tabular-nums text-ap-ink-2 text-xs">{(r.share * 100).toFixed(1)}%</span>
                </span>
              </div>
            ))}
          </div>
        </ApPanel>
      )}
    </div>

    <ApBottomSheet open={selected != null} onClose={() => setSelected(null)} title={selected?.symbol ?? ""}>
      {selected && (
        <div className="space-y-3">
          <div className="flex justify-between text-sm"><span className="text-ap-ink-3">평균단가</span><span className="text-ap-ink-1 font-mono">{selected.avgPrice}</span></div>
          <div className="flex justify-between text-sm"><span className="text-ap-ink-3">현재가</span><span className="text-ap-ink-1 font-mono">{selected.currentPrice}</span></div>
          <div className="flex justify-between text-sm"><span className="text-ap-ink-3">수량</span><span className="text-ap-ink-1 font-mono">{selected.qty}</span></div>
          <div className="flex justify-between text-sm">
            <span className="text-ap-ink-3">평가손익률</span>
            <span className={`font-mono font-semibold ${selected.pnlPct >= 0 ? "text-ap-up" : "text-ap-down"}`}>
              {selected.pnlPct >= 0 ? "+" : ""}{selected.pnlPct.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between text-sm"><span className="text-ap-ink-3">venue</span><span className="text-ap-ink-1">{selected.venue}</span></div>
          <button
            onClick={() => router.push(`/research-os/chat?q=${encodeURIComponent(selected.symbol)}`)}
            className="w-full h-11 rounded-ap-md text-sm font-semibold text-white bg-ap-brand mt-2"
          >
            AI 판단 보러가기 →
          </button>
        </div>
      )}
    </ApBottomSheet>
    </>
  );
}
```

- [ ] **Step 4: 매퍼 유닛 테스트 작성**

`tests/lib/portfolioMobileMapping.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { alpacaToMobile, hlToMobile, kisToMobile } from "@/app/portfolio/page";
import type { AlpacaPosition, HLAssetPosition, KISHolding } from "@/lib/api";

describe("alpacaToMobile", () => {
  it("return% 필드를 100배해 pnlPct로 변환한다", () => {
    const p: AlpacaPosition = {
      symbol: "AAPL", qty: 10, side: "long", avg_entry_price: 150, current_price: 165,
      unrealized_pl: 150, unrealized_plpc: 0.1, market_value: 1650,
    };
    const m = alpacaToMobile(p);
    expect(m.symbol).toBe("AAPL");
    expect(m.pnlPct).toBeCloseTo(10);
    expect(m.avgPrice).toBe("$150.00");
  });
});

describe("hlToMobile", () => {
  it("returnOnEquity(비율)를 100배해 pnlPct로 변환한다", () => {
    const p: HLAssetPosition = {
      position: {
        coin: "BTC", szi: "0.5", entryPx: "60000", positionValue: "31000",
        unrealizedPnl: "1000", returnOnEquity: "0.05",
      },
    } as HLAssetPosition;
    const m = hlToMobile(p, "HL 테스트넷");
    expect(m.symbol).toBe("BTC");
    expect(m.pnlPct).toBeCloseTo(5);
    expect(m.venue).toBe("HL 테스트넷");
  });
});

describe("kisToMobile", () => {
  it("return_pct가 없으면 pnlPct 0으로 fallback한다", () => {
    const h: KISHolding = {
      code: "005930", name: "삼성전자", qty: 10, avg_price: 70000, current: 72000, return_pct: null,
    } as KISHolding;
    const m = kisToMobile(h, "한투 모의");
    expect(m.pnlPct).toBe(0);
    expect(m.symbol).toBe("삼성전자");
  });
});
```

(테스트에서 쓰는 각 타입의 필드가 실제 `lib/api.ts` 정의와 다르면 — 예: 필수 필드 누락으로 타입 에러가 나면 — `as AlpacaPosition` 같은 캐스팅으로 통과시키지 말고 `lib/api.ts`를 열어 정확한 필드 구성으로 고칠 것.)

- [ ] **Step 5: 테스트 + 타입체크**

```bash
npx vitest run tests/lib/portfolioMobileMapping.test.ts
npx tsc --noEmit
```
Expected: 3개 테스트 PASS, 타입 에러 없음

- [ ] **Step 6: 개발 서버로 시각 확인**

`npm run dev` 후 devtools 모바일 뷰로 `/portfolio` 접속:
- 국내주식/해외주식/코인 그룹이 리스트로 보이는지 (뱃지+막대+%)
- 종목 탭 → 바텀시트가 아래서 올라오는지, 아래로 스와이프하면 닫히는지
- 바텀시트의 "AI 판단 보러가기" → `/research-os/chat?q=<종목>`으로 이동해 자동 질문이 실행되는지
- 데스크톱 폭(≥768px)에서는 기존 3열 레이아웃이 그대로인지(회귀 없음)

- [ ] **Step 7: 커밋**

```bash
git add app/portfolio/page.tsx tests/lib/portfolioMobileMapping.test.ts
git commit -m "feat: /portfolio 모바일 보유종목 리스트 + 바텀시트 추가"
```

---

## 완료 후

모든 태스크 커밋 후 `npx tsc --noEmit`과 `npx vitest run`(전체 스위트) 한 번 더 돌려 회귀 없는지 확인. `superpowers:finishing-a-development-branch`는 이 프로젝트가 "main 직접 커밋" 컨벤션(`~/seokminal/CLAUDE.md`)이라 브랜치 병합 단계는 스킵 — 태스크별 커밋이 곧 main 히스토리.
