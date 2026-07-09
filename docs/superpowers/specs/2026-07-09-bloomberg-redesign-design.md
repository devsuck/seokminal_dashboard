# Bloomberg Terminal 스타일 리디자인 + 리브랜드 (Phase 1)

**날짜:** 2026-07-09
**상태:** 승인 대기

## 배경

seokminal-dashboard(43페이지)를 Bloomberg Terminal 무드로 리디자인. 현재는 다크테마 +
오렌지 액센트(#FF9F1C) 기반이지만 "Jarvis" sci-fi HUD 모션(글로우 펄스·radar 회전·
scanline·flicker)이 깔려있음. 레퍼런스(Bloomberg Terminal 스크린샷)는 플랫하고 밀도
높은 멀티패널 그리드, 얇은 테두리, 컬러 헤더바가 특징 — 장식적 모션이 없음.

동시에 플랫폼 이름을 NAUTILUS → **SEOKMINAL**로 리브랜드.

## 스코프

43페이지 전체를 한 번에 갈아엎지 않는다. 이번 스펙은 **Phase 1**만 다룬다:
- 디자인 토큰 오버홀 (전역, `globals.css`)
- Sidebar 쉘 리브랜드 + 리디자인
- 신규 `<Panel>`/`<PanelHeader>` 공용 컴포넌트
- 모션/글로우 제거 (전역 키프레임 + 사용부 오디트)
- 플래그십 페이지 2개(`/hud`, `/market`) 전환

나머지 41페이지 전환은 Phase 2 — 별도 세션에서 별도 spec/plan으로 진행.

## 1. 디자인 토큰 (`app/globals.css` `@theme`)

- 기존 토큰명(`--color-bg` `--color-panel` `--color-panel-2` `--color-border`
  `--color-text-1/2/3` `--color-accent` `--color-pos/neg/warn/info`) 그대로 유지 —
  CLAUDE.md 컨벤션("디자인 토큰만 사용")이 이미 강제돼있어 값만 바꿔도 대부분 페이지에
  자동 상속됨.
- `--color-bg`를 더 짙게(블룸버그 무드), 액센트 오렌지는 유지(이미 근접).
- **모서리(radius)**: Tailwind v4 기본 `--radius-*` 테마 변수를 0으로 오버라이드.
  → 43페이지 어디든 이미 쓰이고 있는 `rounded-lg`/`rounded` 클래스는 그대로 두고
  CSS 변수만 바꿔서 전역에 각진 모서리 적용. 파일별 className 수정 불필요.
  → `rounded-full`(로고 원, 아바타, 상태 점 등)은 Tailwind에서 별도 유틸(고정
  `9999px`)이라 이 오버라이드 영향 안 받음 — 원형 요소는 그대로 원형 유지.
- `--color-hud`(시안, Jarvis 전용) 토큰은 모션 제거와 함께 사용부 오디트 후 남은
  참조 있으면 제거, 없으면 토큰 자체 삭제.

## 2. 쉘 — Sidebar 리브랜드 + 리디자인

- "NAUTILUS" 텍스트 → "SEOKMINAL"로 전체 치환: `components/Sidebar.tsx` 로고 텍스트,
  `app/layout.tsx`의 `metadata.title`.
- 로고 마크: 현재 `animate-ring`/`animate-orb` 펄스 애니메이션 도트 → **원형 조커
  스마일 SVG 아이콘**으로 교체. 스펙: 흰 얼굴, 자주색(purple) 입술, 녹색(green)
  헤어라인. 정적(모션 없음), "SEOKMINAL" 텍스트 왼쪽에 배치, 현재 로고 도트와
  비슷한 크기(collapsed/expanded 두 상태 모두 대응).
- 활성 탭/그룹 하이라이트(`bg-accent/15 text-accent`)는 색상 로직 유지, 모서리만
  전역 각짐 적용 상속.

## 3. 신규 공용 컴포넌트 — `<Panel>` / `<PanelHeader>`

- `components/ui/Panel.tsx` 신규 작성.
- `<PanelHeader>`: 오렌지 솔리드 배경(`bg-accent`) + 검정 굵은 대문자 텍스트
  (Bloomberg 시그니처 컬러바 헤더). optional 우측 슬롯(메타 정보/액션 버튼).
- `<Panel>`: 각진 바디, `border border-border bg-panel` 유지, 헤더+콘텐츠 슬롯
  구조.
- 기존에 페이지마다 흩어져 있던 `bg-panel border border-border rounded-lg
  overflow-hidden` + `bg-panel-2` 헤더 div 반복 패턴을 이 컴포넌트로 대체.
- Phase 1에서는 `/hud`, `/market`에만 적용. 나머지 페이지는 토큰 레이어(배경/
  모서리/보더 색)는 자동 상속되지만, 오렌지 헤더바는 마크업 구조 변경이라 Phase 2에서
  페이지별로 `<Panel>`로 교체.

## 4. 모션/글로우 제거

- `globals.css`의 `pulse-glow` `radar` `scanline` `flicker` `orb` `ring`
  키프레임과 대응 `--animate-*` 유틸 삭제(사용부 없어지면).
- 사용부 오디트: `ArcReactor`/`ReactorCore`/`HexIndicator` 등 Jarvis 전용 시각
  컴포넌트가 `/hud` 등에 남아있는지 확인 후, 남아있으면 정적 표시로 교체하거나
  더 이상 안 쓰이면 컴포넌트 자체 삭제.
- `rise`/`count-in`(값 갱신 시 짧은 페이드+슬라이드)처럼 **정보성** 트랜지션은
  유지 — "장식적 글로우"와 구분되는, 상태 변화를 알려주는 절제된 모션이라 블룸버그
  무드와 상충 안 함.

## 5. 검증

- Phase 1 완료 기준: `tsc --noEmit` 클린, `npm test` 회귀 없음, `npm run build`
  전체 라우트 정상 생성.
- 브라우저 실사용 확인: `/hud`, `/market` 렌더링 스크린샷(라이트/다크 무관, 이
  앱은 다크 전용) — 오렌지 헤더바·조커 로고·각진 모서리·모션 없음 확인.
- 나머지 41페이지는 토큰 레이어 상속만으로 깨진 곳 없는지(모서리 0 적용 시
  레이아웃 안 깨지는지) 샘플 3~4개 페이지 육안 확인.

## Phase 2 (이번 스펙 범위 밖, 다음 세션)

- 나머지 41페이지를 `<Panel>`/`<PanelHeader>`로 순차 전환.
- 우선순위는 다음 세션에 재논의(현재 nav 그룹 순서: 집행 → AI 에이전트 → 리서치 →
  검증 → 마켓 → 교육 순으로 진행하는 안이 유력하나 확정 아님).
