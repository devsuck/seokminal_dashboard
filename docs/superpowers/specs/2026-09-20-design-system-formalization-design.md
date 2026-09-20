# 디자인 시스템 정식화 (버튼/타이포) — 설계

**날짜:** 2026-09-20
**대체 대상:** `docs/superpowers/specs/2026-09-17-mobile-design-system-overhaul.md` — 해당 스펙의 태스크 1~10은 git 이력상 전부 커밋 완료됐으나 문서(addendum 미커밋) 상태가 최신화되지 않음. 이 스펙이 그 결과를 계승하고, addendum이 지적한 잔여 항목(버튼/타이포 미시스템화)을 이어서 정의한다. 기존 spec/plan 파일은 이 스펙 커밋 후 정리한다(Task 0 참고 — writing-plans 단계에서 처리).

## 배경

유저 질문("토스/로빈후드 라이트 디자인 다 적용된거 맞아?")에 대한 감사 결과:

- `page.tsx` 33개 중 8개만 ap-light 토큰(`bg-ap-bg #FAFAFB`, `ap-surface #FFFFFF`) 사용. 나머지 25개(주로 데스크톱 콘솔: `overview`, `portfolio-os/*`, `research-os` 잔여 페이지, `quant/validation`, `insider`, `login` 등)는 다크 institutional 톤(`--color-bg #05070A`, SpaceX/Bloomberg 팔레트) 유지.
- `ApPrimitives.tsx`에 카드류(`ApPanel`/`ApStatTile`/`ApListRow`)·배지(`ApBadge`/`ApDot`)·`ApGateStep`·`ApLightHero`는 있으나 **버튼 프리미티브 없음** — 페이지마다 버튼 className 손코딩.
- **타이포 스케일 토큰화 안 됨** — `font-ui`/`font-data` 패밀리 변수만 있고 크기는 전부 `text-[11px]` 류 매직넘버.

## 스코프 결정 (유저 승인)

1. **적용 범위:** 모바일 4곳(홈/포트폴리오/에이전트/성과) + 인접 페이지만 정식화. 대상 8개 페이지(아래) — 데스크톱 콘솔 25개는 의도적으로 다크 유지, 이번 스코프 밖.
   - `app/hud/page.tsx`
   - `app/portfolio/page.tsx`
   - `app/performance/page.tsx`
   - `app/(console)/investment-os/page.tsx`
   - `app/(console)/investment-os/live-agents/page.tsx`
   - `app/(console)/research-os/chat/page.tsx`
   - `app/(console)/research-os/governance/page.tsx`
   - `app/(console)/research-os/validation/page.tsx`
   - 및 하위 컴포넌트: `components/hud/PortfolioTab.tsx`, `components/hud/ExecutionTab.tsx`, `components/hud/TasksTab.tsx`, `components/ui/ApPrimitives.tsx`
2. **버튼 variant:** primary / secondary / danger / ghost — 4종 전부 필요 (유저 확인).
3. **버튼 size/state:** sm/md 2단계, `loading`(스피너+disabled 겸용) 지원. lg는 YAGNI, 필요해지면 추가.
4. **기존 spec/plan 문서:** 이 스펙이 대체·계승. 2026-09-17 문서들은 정리(archive 또는 커밋 후 종료 처리) 대상으로 플랜에 태스크화.

## 설계

### 1. `ApButton` 프리미티브

기존 코드에 이미 반복되던 손코딩 패턴(`app/(console)/investment-os/live-agents/page.tsx:191-253`, `components/ShutdownButton.tsx:104-115`)을 그대로 이름 붙여 컴포넌트화 — 새 비주얼 발명 없음.

```tsx
// components/ui/ApPrimitives.tsx 에 추가

export type ApButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ApButtonSize = "sm" | "md";

const AP_BUTTON_VARIANT: Record<ApButtonVariant, string> = {
  primary:   "bg-ap-brand text-white",
  secondary: "bg-ap-bg text-ap-ink-1",
  danger:    "border border-ap-down/30 text-ap-down/70 hover:bg-ap-down/8 hover:text-ap-down hover:border-ap-down/50 bg-transparent",
  ghost:     "bg-transparent text-ap-ink-2",
};

const AP_BUTTON_SIZE: Record<ApButtonSize, string> = {
  sm: "h-9 text-ap-label px-3",
  md: "h-11 text-ap-title px-4",
};

export function ApButton({
  variant = "primary",
  size = "sm",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: {
  variant?: ApButtonVariant;
  size?: ApButtonSize;
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={disabled || loading}
      className={`rounded-ap-md font-semibold border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${AP_BUTTON_VARIANT[variant]} ${AP_BUTTON_SIZE[size]} ${className}`}
      {...rest}
    >
      {loading ? "…" : children}
    </button>
  );
}
```

**호출부 교체 대상** (`<button className="...">` → `<ApButton variant=... size=...>`):
- `app/(console)/investment-os/live-agents/page.tsx:191-253` — 승인/보류/예/아니오/제출 (5곳, primary+secondary+ghost 혼재)
- `components/ShutdownButton.tsx:104-115` — 종료 버튼 (danger)
- 나머지 대상 파일들은 구현 단계에서 `grep -n "<button className="` 로 전수 스캔, 발견되는 대로 교체.

### 2. 타이포 스케일 토큰

실측 매직넘버 사용 빈도(대상 8파일+`ApPrimitives.tsx`+`hud/*Tab.tsx` 기준, `text-[Npx]` 그레잡 결과) 그대로 이름 붙임:

```css
/* app/globals.css @theme 블록에 추가 (기존 --color-ap-*, --radius-ap-* 옆) */
--text-ap-micro:   9px;   /* 278회 다음 최소 — 대문자 라벨/태그 */
--text-ap-caption: 10px;  /* 보조 캡션 */
--text-ap-body:    11px;  /* 기본 본문 — 최다 사용(278곳) */
--text-ap-label:   12px;  /* 버튼/강조 라벨 */
--text-ap-title:   13px;  /* 카드 제목/굵은 헤드라인 */
--text-ap-stat:    16px;  /* 강조 수치(제안액 등) */
--text-ap-hero:    26px;  /* 히어로 큰 숫자 */
```

Tailwind v4 `@theme` 규칙상 `--text-ap-body` 정의만으로 `text-ap-body` 유틸리티가 자동 생성됨 (`--radius-ap-*` → `rounded-ap-*` 기존 패턴과 동일).

**14px 이슈:** `app/(console)/investment-os/live-agents/page.tsx:276` 단 1곳(`font-extrabold` 인라인 델타 수치)만 14px — 스케일에서 배제, `text-ap-title`(13px)로 흡수. 별도 스텝 추가는 YAGNI(단일 사용처).

**롤아웃 방법:** 대상 파일들에서 `text-\[11px\]` → `text-ap-body` 등 기계적 치환(파일별 1:1 매핑, 로직 변경 없음) — implementer가 파일 단위로 처리, 각 파일 diff는 className 치환만이라 리뷰 빠름.

### 3. 검증

- `npx tsc --noEmit` — 타입 에러 없음 확인.
- `npm run build` — 정적 페이지 8곳 전부 빌드 성공 확인.
- 시각 확인: `app/hud/page.tsx`, `live-agents` 페이지 브라우저 스크린샷으로 버튼/폰트 렌더링 확인 (Chrome MCP 사용 가능하면 활용).
- 기존 동작 변경 없음 — 순수 스타일 리팩터라 별도 유닛테스트 불필요. `tests/lib/attention.test.ts` 등 로직 테스트는 무관하므로 회귀 없음만 `npm test` 그린으로 확인.

## 비범위 (명시적 제외)

- 데스크톱 콘솔 25개 페이지의 다크→라이트 전환 (별도 스코프, 이번엔 안 함).
- 차트/데이터시각화 색상(`chart-1~5`, `seq-1~4`) — 다크 콘솔과 공유 토큰이라 이번 변경 대상 아님.
- lg 버튼 사이즈, 아이콘 전용 버튼의 별도 최소너비 규칙 — 필요해지면 추가.
