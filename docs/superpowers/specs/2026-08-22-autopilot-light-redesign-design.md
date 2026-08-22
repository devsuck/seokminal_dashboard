# Autopilot 라이트 리디자인 (2단계: 리디자인) 설계

## 배경

seokminal v2 3단계 계획(가지치기→리디자인→PWA화) 중 2단계. 1단계(가지치기)는
`2026-08-22-dashboard-pruning-monitoring-only-design.md`로 완료됨 (68→약36라우트,
`/hud` 중심 5탭 감시전용 셸 구조).

목표: 밀도 높은 "Bloomberg Terminal" 다크 톤을 감시용 핵심 화면에 한해 밝은
카드형("Autopilot" 카피트레이딩 앱 참조) 톤으로 전환. 10월 중순 입대 데드라인
전까지 Lv5 자율 증권매니저로 다듬는 여정의 시각적 갱신.

## 스코프

**전환 대상 (이번 phase):**
- `components/console/CommandRail.tsx` — 전 라우트 공유 좌측 나브
- `app/hud/page.tsx` + `components/hud/{HomeTab(홈은 page.tsx 내부),PortfolioTab,LabTab,ExecutionTab,TasksTab}.tsx` — 5탭 셸
- `app/agents/page.tsx`

**전환 제외 (현행 다크 유지, 이번 phase 미변경):** `portfolio`, `polymarket`,
`copytrade`, `infra`, `orderflow`, `mlb`, `performance`, `vrp`, `dart-auto`,
`risk-guard`, `quant/validation`, `research-os/{chat,governance,validation,pipeline}`,
`investment-os` — 총 13개 라우트. `components/ui/Panel.tsx`(`Panel`/`PanelHeader`)는
이 13개 라우트가 계속 쓰므로 무수정 유지.

**의도적으로 받아들이는 전환기 불일치:** `CommandRail`은 전 라우트 공유이므로,
라이트 전환 후에는 미전환 13개 라우트가 "라이트 레일 + 다크 본문"으로 보임. 후속
phase에서 나머지 라우트도 전환할 때까지 임시로 감수.

## 비주얼 언어

배경 `#FAFAFB`, 카드 `#FFFFFF`, 보더 `#E5E7EB`. 실제 border-radius 사용(카드
12-16px), 옅은 그림자로 elevation 표현. 다크 모드 없음(이번 phase는 라이트 전용,
다크 토글은 후속 과제).

타이포그래피 불변: UI 텍스트 Inter(`--font-ui`), 숫자/테이블 데이터 JetBrains
Mono(`--font-data`) 그대로 유지.

## 토큰 전략

기존 `--color-bg/panel/panel-2/border/text-1/2/3/accent/pos/neg/warn/info`
(app/globals.css `@theme` 블록)는 절대 수정하지 않음 — 13개 미전환 라우트가
의존. 대신 신규 `ap-` 접두 토큰 세트를 같은 `@theme` 블록에 추가(additive):

```
--color-ap-bg: #FAFAFB;
--color-ap-surface: #FFFFFF;
--color-ap-line: #E5E7EB;
--color-ap-ink-1: #111827;
--color-ap-ink-2: #6B7280;
--color-ap-ink-3: #9CA3AF;
--color-ap-brand: #FF9F0A;   /* 기존 accent와 동일 hue, 라이트 배경 대비 재검증 후 필요시 톤 조정 */
--color-ap-up: #059669;
--color-ap-down: #DC2626;
--color-ap-caution: #D97706;
--color-ap-note: #2563EB;
--radius-ap-sm: 8px;
--radius-ap-md: 12px;
--radius-ap-lg: 16px;
--radius-ap-xl: 20px;
--shadow-ap-sm: 0 1px 3px rgba(0,0,0,.06);
--shadow-ap-md: 0 4px 12px rgba(0,0,0,.08);
```

Tailwind v4 `@theme` 블록은 CSS 커스텀 프로퍼티를 자동으로 유틸리티 클래스화
하므로 (`--color-ap-bg` → `bg-ap-bg` 등) 별도 tailwind.config 수정 불필요.

`--color-ap-up/down`은 기존 "Pattern B" 컨벤션(헤드라인 수치뿐 아니라 부호에
연동되는 모든 테이블 행/리스트 아이템에도 적용)을 라이트 팔레트에서도 동일하게
따른다.

## 컴포넌트 계획

**신규 `components/ui/Card.tsx`** — `Panel`/`PanelHeader`와 병렬 구조(대체 아님).
`Card`(surface+line+radius-ap-lg+shadow-ap-sm 래퍼), `CardHeader`(타이틀+옵션
액션 슬롯). `Panel.tsx`는 무수정.

**`CommandRail.tsx` 리컬러** — 구조/네비 로직/localStorage 상태(collapsed 등)
불변, `ap-` 토큰으로 색상만 교체. 현재 `var(--c-*)` 커스텀 프로퍼티 참조를 쓰고
있음 — 이 alias 매핑 존재 여부를 Task 1에서 먼저 확인, 없으면 `CommandRail.tsx`
내부에서 직접 `ap-` Tailwind 유틸리티로 전환(별도 alias 레이어 신설 안 함,
YAGNI).

**`/hud` 5탭 + `/agents`** — `Panel`/`PanelHeader` 사용처를 `Card`/`CardHeader`로
교체. `app/copytrade/page.tsx`의 Phase-79 `TraderCard` 정보 구조(아바타+이름+
수익률, 보유종목별 행)를 라이트 카드 비주얼 패턴의 참조 템플릿으로 삼는다
(`copytrade` 자체는 이번 phase 전환 대상 아님 — 패턴만 차용).

## 에러 처리 / 접근성

기존 컴포넌트의 에러/로딩 상태 처리 로직(AbortController 패턴 등)은 무변경 —
이번 phase는 순수 비주얼 토큰/컴포넌트 교체이며 데이터 흐름·상태 관리 로직에는
손대지 않는다.

## 테스트 전략

- 각 태스크 완료 후 `npx tsc --noEmit` 통과 필수(타입 에러 0).
- `npm run build` 는 스코프 내 마지막 태스크 이후 1회 필수 통과(53+개 라우트
  전부 빌드 성공, 미전환 13개 라우트 렌더링에 회귀 없음).
- 시각 회귀는 자동화 테스트 대상 아님(수동 확인 항목으로 플랜에 기록, SDD 실행
  주체가 사람이 아니므로 최종 리뷰 단계에서 코드 레벨 diff 검토로 갈음).

## 글로벌 제약 (기존 프로젝트 컨벤션 승계)

- 디자인 토큰만 사용 — 임의 hex/색상 클래스 금지(신규 `ap-` 토큰 범위 내에서만).
- `style={{}}` 금지 (예외: 차트 컨테이너 `style={{ height: "Npx" }}`).
- Raw `fetch` 금지 — `lib/api.ts` 함수만 사용(이번 phase는 비주얼 전용이라 해당
  없을 가능성 높으나, 손대는 파일에 raw fetch 발견 시 그대로 두지 말고 리포트).
- `bg-accent`/`bg-ap-brand text-black` 조합은 주요 액션 버튼에만.
- Active 탭 스타일 컨벤션(`border-accent text-accent bg-accent/10` 상당의
  `ap-` 버전)을 `CommandRail`/`hud` 탭 전환에도 동일 적용.
- 브랜치: `main` 직접 커밋(기존 프로젝트 컨벤션).
- 커밋 메시지 `Co-Authored-By`에 모델명/컨텍스트모드 정보 금지.

## 범위 밖 (명시적 후속 과제)

- 나머지 13개 라우트의 라이트 전환.
- 다크모드 토글.
- `Panel.tsx` 자체의 폐기/통합.
- PWA화(3단계, 별도 스펙).
