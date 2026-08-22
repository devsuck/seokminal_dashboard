## Phase 226 — 콘솔 라우트 6개 ap- 전환 (CSS 변수 스코프 확장) (2026-08-23) ✅ SHIPPED (커밋 대기)

### 배경
Phase 225 완료 후 유저 질문 "디자인 토큰이 좀 디자인이 다른데. 통일을 해야할 것 같은데" → grep 조사로 원인이 `(console)` 라우트그룹의 6개 라이브 페이지(CommandRail에서 실제 링크되는 것만: `quant/validation`, `research-os/{pipeline,validation,chat,governance}`, `investment-os`)가 여전히 다크 테마임을 특정, 보고. 유저 재질문 "그러면 이거 지금 앱화 된거라고 말하고싶은거야?"에 미완료 항목 정직하게 나열. 유저 지시: "6개 콘솔 라우트도 ap- 전환해줘".

### 완료된 작업
- **접근 방식 전환**: 기존 9라우트는 하드코딩 Tailwind 클래스(`bg-panel` 등)라 파일별 find/replace가 필요했지만, 이번 6라우트 + 공유 컴포넌트(`components/console/primitives.tsx`, `widgets.tsx`)는 전부 `var(--c-*)` CSS 커스텀 프로퍼티만 사용(하드코딩 Tailwind 색상 클래스 0건, grep 확인) — 페이지/컴포넌트 JSX를 전혀 건드리지 않고 CSS 변수 스코프 확장만으로 전환 가능하다고 판단
- `app/globals.css`의 `.rail-ap` 스코프 블록 확장: 기존엔 `--c-bg/panel/panel-2/border/text-1/2/3/hud/warn`만 라이트로 리매핑했는데 `--c-panel-3`(Meter 트랙 배경), `--c-border-2`, `--c-blue`, `--c-emerald`, `--c-pos`, `--c-neg`, `--c-info` 7개 변수 추가 매핑. `--c-pos`→`--color-ap-up`, `--c-neg`→`--color-ap-down`, `--c-blue`/`--c-info`→`--color-ap-note`, `--c-emerald`→`--color-ap-up`(다크 팔레트에서 emerald==pos가 동일 hex였던 관계를 그대로 유지)
- `app/(console)/layout.tsx` 수정: 기존엔 `<>{children}</>` pass-through였던 걸 `<div className="rail-ap min-h-full bg-[var(--c-bg)]">{children}</div>`로 변경 — `(console)` 라우트그룹 전체(6개 라이브 라우트 + CommandRail에 안 걸린 22개 레거시/고아 페이지, investment-os 5탭 통합 이전의 잔재)에 스코프 적용. `bg-[var(--c-bg)]` 명시 배경 페인트가 핵심: `.console-shell`이 자기 스코프의 `--c-bg`(하드코딩 다크 hex)로 그라디언트 배경을 직접 페인트하기 때문에, 자식 요소의 `.rail-ap` 변수 오버라이드만으로는 그 배경까지 안 가려짐(CSS 커스텀 프로퍼티는 하위로만 캐스케이드) — 각 페이지 루트가 자체 불투명 배경이 없어 이 파란 배경을 페이지 콘텐츠 뒤로 그대로 비쳐 보이는 문제였음
- 파일 수정은 위 2개뿐 — 6개 페이지 파일, `primitives.tsx`, `widgets.tsx` 전부 무수정

### 변경된 파일
`app/globals.css`, `app/(console)/layout.tsx`

### 막힌 부분/결정사항 (rulings)
- **범위 판단**: 유저가 말한 "6개"는 CommandRail에 실제 링크된 라이브 라우트만 지칭(나머지 22개는 investment-os 5탭 통합 이전 레거시/고아 페이지, `docs/step4/dashboard_migration_map.md` 참고). 하지만 스코프를 `(console)` 레이아웃 전체에 건 건 의도적 — 어차피 순수 CSS 변수 리매핑이라 22개 고아 페이지까지 같이 밝아져도 리스크 0(JSX 무변경, 아무도 안 쓰는 페이지라 회귀 여지 없음), 파일 단위로 쪼개서 6개만 스코프 걸 마땅한 지점이 없었음(각 페이지 개별 wrapper 없음)
- **오탐 조사**: `app/hud/page.tsx`(Phase 222/223에서 이미 "전환 완료" 표시됨)가 다크 전용 `components/terminal/ResearchStatus.tsx`를 쓰고 있어 다크 누출 아닌가 의심했으나, grep 재확인 결과 실제 사용처 없음(첫 grep이 `AutoResearchStatus`라는 무관한 타입명에 대한 오탐이었음) — `components/terminal/*` 전체가 죽은 코드(소비처 0)로 확인, 조치 불필요
- `.c-panel-2` 클래스가 `research-os/pipeline/page.tsx:724`에서 쓰이는데 `globals.css`에 정의가 없는 기존 버그 발견 — 이번 스코프 밖, 미수정(원래도 스타일 미적용 상태였을 것, 이번 작업으로 악화 안 됨)

### 검증
`npx tsc --noEmit` 클린, `npm test` 29 files / 319 tests 전부 통과(수정 전과 동일). 브라우저 육안 확인 6/6 완료(데스크톱 폭): `investment-os`, `research-os/pipeline`, `research-os/chat`, `research-os/validation`, `research-os/governance`, `quant/validation` — 전부 배경·패널·텍스트·뱃지(pos 초록/neg 빨강/warn 주황/info 파랑)가 ap- 라이트 톤으로 정상 렌더, 다크 배경 비침 없음, CommandRail과 시각적으로 통일됨 확인. 각 페이지에 뜨는 `백엔드 연결 실패: Failed to fetch`는 API 서버(uvicorn) 미기동으로 인한 기존 현상(회귀 아님).

### 다음 할 일
- 커밋 대기 — Phase 224~226 미커밋분 전부 번들 예정, 유저 확인 필요
- 아이폰 실기기 또는 DevTools 디바이스 모드로 전체 라우트 최종 확인 여전히 미완(Phase 225부터 이어지는 이슈)
- `.env.local` 터널 URL, `next.config.ts` `allowedDevOrigins` 하드코딩 — 여전히 미해결
- `.c-panel-2` 미정의 클래스 버그(`research-os/pipeline/page.tsx:724`) — 우선순위 낮음, 필요시 후속 조치
- 이번 건으로 다크 테마 라우트는 전부 소진(라이브 라우트 기준) — "앱화" 관점에서 남은 건 실기기 모바일 검증 + 커밋뿐

---

## Phase 225 — 잔여 9라우트 라이트 전환 + 모바일 하단 탭바 (2026-08-22) ✅ SHIPPED (커밋 대기)

### 배경
유저 지시: "다른 페이지들(다트,카피트레이,리스크가드 등) 전부 작업 안되어있네. 작업해주고. 그리고 아이폰으로 볼 때에는(해당 해상도에서는) 하단 바처럼 기존 앱 UI에 충실하게 해줘." Phase 222~224로 `/hud`·`/agents`·`/polymarket`만 전환된 상태 — 남은 9라우트 일괄 전환 + 아이폰 폭 네이티브 탭바 패턴 신규 구축. 브레인스토밍 게이트 생략, 7개 fork subagent 병렬 디스패치로 직접 실행.

### 완료된 작업
- **9라우트 ap- 전환**(fork 7개 병렬, 파일당 1~2개 담당): `copytrade`, `dart-auto`, `infra`, `mlb`, `orderflow`, `performance`, `portfolio`, `risk-guard`, `vrp` — Phase 222 확립한 매핑 그대로(`bg-panel`→`bg-ap-surface`, `text-text-*`→`text-ap-ink-*`, `Panel/PanelHeader`→`Card/CardHeader` 등)
- `risk-guard/page.tsx`는 공유 다크 HUD 프리미티브(`components/console/primitives.tsx`/`widgets.tsx`, 미전환 콘솔 페이지들과 공유)를 건드리지 않기 위해 페이지 자체를 `Card`/`CardHeader`/`Bar`/`EmptyState`/`LoadingState`로 직접 재작성
- **모바일 하단 탭바 신규 구축**: `CommandRail.tsx`를 `hidden md:flex`로 데스크톱 전용 전환(구식 JS 기반 접기 로직 삭제), `ALL_GROUPS` export, 신규 `BottomTabBar.tsx`(md:hidden, 홈/오더플로우/포트폴리오/에이전트 4탭 고정 + "더보기" 시트로 전체 라우트) 신규 작성, `app/layout.tsx`에 마운트 + `<main>` `pb-14 md:pb-0`
- `EdgeReportCard.tsx`(mlb+performance fork가 단일 소비처(`app/mlb/page.tsx`)로 지목, 후속 조치로 컨트롤러 직접 전환) — `Panel/PanelHeader`→`Card/CardHeader`, 전 테이블·뱃지·BH-FDR 섹션 ap- 토큰화. `Heatmap.tsx`/`NullDistribution.tsx`는 `TOKEN.*` 전용이라 무수정 유지(차트 색상 예외 규칙)

### 변경된 파일
`app/{copytrade,dart-auto,infra,mlb,orderflow,performance,portfolio,risk-guard,vrp}/page.tsx`, `components/console/CommandRail.tsx`, `components/console/BottomTabBar.tsx`(신규), `app/layout.tsx`, `components/charts/EdgeReportCard.tsx`

### 막힌 부분/결정사항 (rulings)
- **버그 발견·수정(커밋 전)**: fork가 재작성한 `BottomTabBar.tsx`가 `var(--c-panel)`/`var(--c-border)`/`var(--c-text-3)`를 `.rail-ap` 스코프 없이 직접 사용 — 이 변수들은 `.rail-ap` 클래스 안에서만 라이트 값으로 리매핑되고 밖에서는 다크 베이스값(`--c-panel: #0A0F16` 등)으로 해석됨. `<nav>`와 "더보기" 시트 backdrop `<div>`에 `rail-ap` 클래스 추가해 수정 — 브라우저 검증 전에 diff 리뷰로 선제 발견
- 공유 콘솔 프리미티브(`primitives.tsx`/`widgets.tsx`) 자체를 ap-화하는 건 이번 스코프 밖으로 명시 배제 — 아직 다크인 콘솔 페이지들이 있어 건드리면 그쪽이 깨짐. 후속 phase 후보로만 기록
- **모바일 실측 불가**: `resize_window`(390x844)·`window.resizeTo()` 둘 다 시도했으나 `window.innerWidth`가 계속 데스크톱 폭(1300)으로 나와 실제 뷰포트가 안 바뀜 — 이 환경(Chrome MCP 확장) 자체 한계로 재확인(Phase 224에서도 동일 현상). 코드 레벨 검증(`hidden md:flex`/`md:hidden`, 768px 브레이크포인트가 기존 코드베이스 컨벤션과 일치)으로 대체, 아이폰 실기기/DevTools 수동 확인은 유저 몫으로 남김
- `/copytrade`·`/dart-auto`·`/orderflow`·`/performance`·`/risk-guard`·`/vrp`에서 보이는 `TypeError: Failed to fetch`는 백엔드(uvicorn) 미기동으로 인한 기존 현상 — 이번 전환으로 생긴 회귀 아님(콘솔 확인 결과 JS 에러/워닝 없음, 순수 네트워크 실패)

### 검증
`npx tsc --noEmit` 클린, `npm test` 29 files / 319 tests 전부 통과. `grep` 스윕으로 9개 전환 파일 전부 잔여 다크 토큰·`Panel`/`PanelHeader` import 없음 확인, `w-16`류 고정폭 오버플로 버그 재발 없음 확인. 브라우저 육안 확인 9/9 완료(전부 데스크톱 폭, 라이트 테마 정상·다크 토큰 누출 없음) — `read_console_messages`로 JS 에러/워닝 없음 확인.
- **재검증 라운드(같은 세션, fork 완료 후 최종 확인)**: `tsc`/`npm test` 재실행 동일 결과(클린/319 통과). `resize_window` 재시도 재실패 확인(`innerWidth` 여전히 1300 고정, 환경 한계 재확인) → CSS 강제 오버라이드(`.console-rail{display:none}`+`nav.rail-ap{display:flex}`)로 모바일 상태 시뮬레이션해 `portfolio`/`infra`/`orderflow` 3곳 스크린샷 확인: `CommandRail` 정상 숨김, `BottomTabBar` 라이트 테마로 정상 렌더(4탭+더보기, active 탭 하이라이트 정상), 다크 토큰 누출 없음. `document.body.scrollWidth === document.documentElement.clientWidth`(1300=1300)로 3페이지 전부 가로 오버플로 없음 확인. 단, 이 시뮬레이션은 네비만 강제 전환한 것이라 실제 768px 이하에서의 페이지 콘텐츠 리플로우(그리드·테이블 등)까지 검증한 건 아님 — 진짜 좁은 뷰포트 리플로우 확인은 여전히 실기기/DevTools 몫.

### 다음 할 일
- 커밋 대기 — Phase 224(polymarket) 미커밋분과 함께 번들 예정, 유저 확인 필요
- 아이폰 실기기 또는 Chrome DevTools 디바이스 모드로 `BottomTabBar` 실제 렌더링 최종 확인 필요(코드 검증만 완료, 실측 미완)
- `.env.local` 터널 URL(Phase 224부터 이어지는 이슈), `next.config.ts` `allowedDevOrigins` 하드코딩 — 여전히 미해결
- 공유 콘솔 프리미티브(`primitives.tsx`/`widgets.tsx`) ap- 화는 아직 미착수 — 필요해지면 후속 phase

---

## Phase 224 — /polymarket 라이트 미니멀 전환 (2026-08-22) ✅ SHIPPED (커밋 대기)

### 배경
Phase 222/223 후속. "결국 모바일로 본다"가 최종 목표라 유저가 명시적으로 브레인스토밍 게이트 생략하고 바로 실행 지시 — Autopilot 앱 UI를 참고해 `/polymarket`(다각화 배스킷 봇 + 샤프월렛 컨버전스 봇 + 고래 리더보드)을 라이트 `ap-` 토큰 + 모바일 안전 레이아웃으로 전면 재작성.

### 완료된 작업
- `app/polymarket/page.tsx` 전면 재작성 — `Panel`/`PanelHeader`→`Card`/`CardHeader`, 레거시 다크 토큰 전량 `ap-` 매핑, 얇은 상태바 3~4개를 `Card` 1개 내부 `border-t border-ap-line` 섹션으로 통합
- `<table>` 3곳(다각화봇 포지션·샤프월렛 포지션·고래 리더보드) 전부 `divide-y` 스택 리스트로 전환 — `app/agents/page.tsx` 트레이드로그 선례 따름, 가로 스크롤 없이 전 너비에서 렌더
- 공유 컴포넌트에 override prop 추가(`SegmentedToggle.inactiveClass` 선례 따름, 기본값 불변이라 미전환 라우트 무영향): `EmptyState.textClass`, `LoadingState`/`Spinner`(`textClass`/`spinnerClass`), `ChartFrame`(`textClass`/`legendTextClass`), `Bar.trackClass`, `FreshnessBar.trackClass`(패스스루)
- `BarChart.tsx`는 polymarket 단독 소비 확인(grep) 후 오버라이드 prop 없이 직접 `ap-` 전환
- 토스트 알림 모바일 오버플로 수정(`left-4 sm:left-auto`)
- **버그 발견·수정**: 고래 리더보드 스택 리스트의 거래량 열(`w-16 text-right`)이 `$1,835,428,000`류 큰 값에 비해 고정폭이 너무 좁아 페이지 전체 가로 스크롤 유발 — 브라우저 실측(가로 스크롤해서 우측 잘린 값 확인)으로 발견, `w-16` 제거로 자연폭 사용하게 수정

### 변경된 파일
`app/polymarket/page.tsx`, `components/ui/EmptyState.tsx`, `components/ui/LoadingState.tsx`, `components/charts/ChartFrame.tsx`, `components/ui/Bar.tsx`, `components/ui/FreshnessBar.tsx`, `components/charts/BarChart.tsx`

### 막힌 부분/결정사항 (rulings)
- `lib/chart-colors.ts`의 `TOKEN.*` 리터럴 hex와 `lib/edge-labels.ts`의 `pos`/`neg`/`warn`은 스코프 밖 유지 — `TOKEN`은 앱 전역 ~20개 차트 컴포넌트 공유(이미 전환된 `agents/page.tsx`도 그대로 씀), `edge-labels`는 미전환 `/edges` 라우트와 공유하며 테마 중립 토큰이라 안전
- PNL 추이 차트(`TimeSeries`, lightweight-charts 위젯)는 자체 다크 캔버스 유지 — 위 `TOKEN` 예외와 동일 사유, 버그 아님
- `.env.local`의 `NEXT_PUBLIC_API_URL`이 임시 Cloudflare 터널 URL로 남아있음, `next.config.ts`의 `allowedDevOrigins`도 특정 터널 호스트네임 하드코딩 — 이번 phase 스코프 밖이라 미수정, 터널 재시작하면 다시 깨짐(다음 세션에서 확인 필요)

### 검증
`npx tsc --noEmit` 클린, `npm test` 29 files / 319 tests 전부 통과. 브라우저 육안 확인: 전체 페이지 스크롤 통과(전략·수집기 현황 / 다각화 배스킷 봇 / PNL 차트 / 보유 포지션 / 봇 실행 로그 / 샤프월렛 컨버전스 봇 / 고래 리더보드) — 라이트 테마 정상, 다크 토큰 누출 없음, 가로 스크롤 버그 수정 후 재확인 완료. 콘솔 에러/워닝 없음.

### 다음 할 일
- 아직 커밋 안 함 — 유저 확인 후 `main`에 직접 커밋 예정(이전 세션의 미커밋 변경분 `CommandRail.tsx` 모바일 collapse fix, `next.config.ts` `allowedDevOrigins` 추가도 함께 번들 예정)
- 미전환 나머지 라우트(`portfolio`, `copytrade` 등) 라이트 전환은 다음 phase 대상 — 아직 유저 지시 없음
- `.env.local` 터널 URL 원복 여부(`http://127.0.0.1:8000`으로) 유저 확인 필요

---

## Phase 223 — 미니멀 밀도 리디자인 + PWA화 (2026-08-22) ✅ SHIPPED

### 배경
seokminal v2 2단계 마무리 + 3단계. Phase 222가 색상 토큰만 바꿨던 것과 달리, 유저가 "오토파일럿 앱처럼 미니멀하게"를 요청 — 컴포넌트 종류 축소·정보 밀도 축소를 브레인스토밍(spike→approach 선택→섹션별 design→spec)으로 정식 거쳐 스펙/플랜 작성 후 SDD 2태스크로 실행. 스펙 `docs/superpowers/specs/2026-08-22-autopilot-minimal-density-design.md`, 플랜 `docs/superpowers/plans/2026-08-22-autopilot-minimal-density.md`. 완료 직후 유저가 "PWA까지 전부 마무리해줘, 외출할거니까"로 3단계(PWA화)까지 위임 — 이 단계는 브레인스토밍 승인 게이트 없이 컨트롤러 자체 판단(ruling)으로 진행.

### 완료된 작업 — 미니멀 밀도 (SDD, 2태스크 + 최종 리뷰)
- `hud-frame` 장식 CSS(코너브래킷, 레거시 다크 accent 참조) 전량 제거 — `app/globals.css` 규칙 삭제 + 6개 파일(`ExecutionTab`/`LabTab`/`PortfolioTab`/`AutoResearchPanel`) 클래스 토큰 제거
- `/hud` Home 탭 8카드 → 5블록 재구성: 시스템개요(시스템상태+정합성감시 병합), 판단필요, 인프라상태(유닛로스터+수집기함대 병합), 돈길, 최근활동(신규 `SegmentedToggle` 토글로 알림/LAB로그/페이퍼체결 3카드 통합)
- `components/ui/SegmentedToggle.tsx`에 `inactiveClass` prop 추가 — 최종 whole-branch 리뷰가 잡아낸 "비활성 버튼이 라이트 카드 위에서 레거시 다크 토큰(`border-border`/`text-text-3`) 그대로 노출" 결함 수정, `hud/page.tsx` 호출부만 `ap-line`/`ap-ink` 오버라이드 적용(다른 다크 라우트 호출부는 기본값 유지라 영향 없음)

### 완료된 작업 — PWA화 (컨트롤러 자체 설계, 별도 스펙 없음)
- `app/manifest.ts`(Next 네이티브 컨벤션) — name/icons/start_url/standalone/theme_color(`#FF9F0A`)
- `app/icon.png`(512)·`app/apple-icon.png`(180)·`public/icons/{icon-192,icon-512,icon-maskable-512}.png` — 이미 설치돼 있던 `sharp`(next/image 트랜지티브 의존성)로 신규 의존성 없이 생성, ap-brand 단색 배경 + "S" 모노그램
- `public/sw.js` + `components/PwaRegister.tsx` — 설치 가능성(installability) 충족용 최소 서비스워커, **오프라인 캐싱 없음**(의도적 설계 판단, 아래 rulings 참조)
- `app/layout.tsx` — `viewport.themeColor`, `appleWebApp` 메타, `<PwaRegister />` 마운트

### 변경된 파일
`app/globals.css`, `components/hud/{ExecutionTab,LabTab,PortfolioTab}.tsx`, `components/AutoResearchPanel.tsx`,
`app/hud/page.tsx`, `components/ui/SegmentedToggle.tsx`,
`app/manifest.ts`(신규), `app/icon.png`(신규), `app/apple-icon.png`(신규), `public/icons/*.png`(신규 3개), `public/sw.js`(신규), `components/PwaRegister.tsx`(신규), `app/layout.tsx`

### 막힌 부분/결정사항 (rulings)
- Task 1 브리프가 4파일/5곳만 전제했는데 `AutoResearchPanel.tsx`에 `hud-frame` 참조 2곳 추가 발견(implementer가 grep으로 확인, DONE_WITH_CONCERNS) → 죽은 CSS 클래스 방치 방지 위해 스코프 확장해 같이 제거, 별도 커밋(`a94796f`)으로 분리해 리뷰어에 위임 → CONDITIONAL PASS로 승인됨
- 최종 whole-branch 리뷰(opus)에서 SegmentedToggle 비활성 버튼 레거시 토큰 누출(minor) + stale 주석(nit) 발견 → 컨트롤러가 직접 수정(`inactiveClass` prop 추가, 기본값 불변으로 다른 호출부 무영향) 후 즉시 커밋. `app/agents/page.tsx`의 동일 컴포넌트 사용처 2곳도 같은 결함이 있으나 Phase 222(이미 종료된 다른 phase) 소관이라 손대지 않음 — 후속 정리 후보로 기록
- **PWA 오프라인 미지원은 의도적 설계**: 실거래/포트폴리오 대시보드에서 서비스워커가 API 응답을 캐싱하면 stale 가격·포지션을 "최신"처럼 보여줄 위험이 있음 → sw.js는 설치 가능성만 충족(no-op fetch 핸들러), 정적 자산이든 API든 캐싱 전략 없음. 오프라인에서는 그냥 로드 실패 — 트레이딩 툴에서는 이게 맞는 동작이라 판단
- 개발서버 dev-mode Turbopack에서 `app/icon.png`/`app/manifest.ts` 추가 후 `require is not defined` SSR 에러 발생 → `.next` 캐시 삭제 + 서버 재기동으로 해결(신규 메타데이터 컨벤션 파일은 hot-reload로 못 잡는 turbopack 캐시 이슈로 판단, 코드 결함 아님)

### 검증
`npx tsc --noEmit` 통과, `npm test` 29 files / 319 tests 전부 통과. 브라우저 육안 확인: `/hud` 4탭(Home/Lab/Execution/Portfolio) 전부 hud-frame 제거 후 렌더링 정상, 최근활동 토글 활성/비활성 색상 정상(`ap-brand`/`ap-line`). `/manifest.webmanifest`·`/icon.png`·`/apple-icon.png`·`/sw.js` 전부 200, `<head>`에 `theme-color`/`manifest`/`apple-mobile-web-app-*` 메타 정상 주입 확인.

### 다음 할 일
- 미전환 13개 라우트(`portfolio`,`polymarket`,`copytrade` 등) 라이트 전환(Phase 222부터 이어지는 후속 phase)
- `app/agents/page.tsx`의 SegmentedToggle 2곳도 `inactiveClass` 적용(발견은 됐으나 이번 phase 스코프 밖이라 미수정)
- PWA 설치 UX(A2HS 프롬프트 커스텀 배너 등)는 미구현 — 필요해지면 후속 phase
- iOS 홈 화면 추가 후 실제 standalone 렌더링은 미검증(개발환경 제약, 실기기 테스트 필요)

---

## Phase 222 — Autopilot 라이트 리디자인 (2026-08-22) ✅ SHIPPED

### 배경
seokminal v2 2단계(리디자인). 스펙 `docs/superpowers/specs/2026-08-22-autopilot-light-redesign-design.md`, 플랜 `docs/superpowers/plans/2026-08-22-autopilot-light-redesign.md`(9태스크, SDD 실행). 유저 승인 후 취침 — 중간 확인 없이 끝까지 자율 실행.

### 완료된 작업
- `app/globals.css` `@theme`에 `ap-` 토큰 세트 추가(bg/surface/line/ink-1/2/3/brand/up/down/caution/note + radius/shadow) — 기존 다크 토큰(`--color-bg/panel/...`) 무수정, 13개 미전환 라우트 영향 없음
- `components/ui/Card.tsx`(신규) — `Panel`/`PanelHeader`와 시그니처 동일한 병렬 프리미티브(`Card`/`CardHeader`), `Panel.tsx` 자체는 무수정
- `CommandRail.tsx` 라이트 전환 — `.rail-ap` 스코프드 CSS 변수 오버라이드(`--c-*`→`--color-ap-*`)로 JSX 무변경 전환, `CommandPalette.tsx`도 자동 적용됨. `ShutdownButton.tsx`는 토큰명 직접 매핑
- `/hud` 5탭(Home/Portfolio/Lab/Execution/Tasks) + `/agents` — `Panel`→`Card` 전량 스왑, 다크 토큰 클래스(`bg-panel`,`text-text-1` 등)를 `ap-` 토큰명으로 매핑
- 최종 whole-branch 리뷰(opus)에서 잔여 결함 4건(페이지 배경 누락 2곳, `.scan-skeleton` 다크 누출, 하드코딩 accent 변수) 발견 → 컨솔리데이티드 픽스 1커밋으로 해결, 스코프드 재검토 clean

### 변경된 파일
`app/globals.css`, `components/ui/Card.tsx`(신규), `components/console/CommandRail.tsx`, `components/ShutdownButton.tsx`,
`app/hud/page.tsx`, `components/hud/{PortfolioTab,LabTab,ExecutionTab,TasksTab}.tsx`, `app/agents/page.tsx`

### 막힌 부분/결정사항 (rulings)
- 플랜의 토큰명 매핑 규칙이 `{bg,text,border}-` 접두사만 명시하고 `divide-`를 누락 — 실결함(다크 라인 누출) 확인 후 `divide-`도 동일 매핑으로 규칙 확장, 즉시 수정 + 이후 태스크에 반영
- `LivePulse`/`Kv`의 `tone="pos"` 등 prop 값은 `Jarvis.tsx`(스코프 밖)의 semantic enum 룩업 키라 미치환 유지
- `--color-ap-brand` 라이트 배경 대비 정식 재검증(spec 명시 항목)은 개인용 단일 사용자 툴이라 이번 phase는 육안 확인으로 대체, 정식 감사는 후속 phase로 연기
- 미사용 `ap-` radius/shadow 토큰 4개는 spec이 전체 세트 명시 요구 — 삭제 안 함
- `app/agents/page.tsx`의 `lib/chart-colors.ts`/inline-style 사전 부채는 이번 diff가 도입한 게 아님(pre-existing) — 스코프 밖, 후속 phase 부채로 기록만
- **의도적 전환기 불일치**: 13개 미전환 라우트(`portfolio`,`polymarket`,`copytrade` 등)는 "라이트 레일 + 다크 본문"으로 보임 — spec에 명시된 임시 상태, 후속 phase에서 나머지 라우트 전환 시 해소

### 검증
`npx tsc --noEmit` 통과, `npm test` 29 files/319 tests 전부 통과, `npm run build` 53+ 라우트 성공, 브라우저 육안확인(`/hud`,`/agents` 라이트 렌더링, `/portfolio` 레일만 라이트+본문 다크 확인).

### 다음 할 일
seokminal v2 3단계(PWA화) — 별도 스펙/플랜 필요. 이후 미전환 13개 라우트 라이트 전환(후속 phase), `--color-ap-brand` 정식 대비 감사.

---

## Phase 221 — 대시보드 가지치기: 감시 전용 피벗 완료 (2026-08-22) ✅ SHIPPED

### 배경
seokminal v2 웹 오버홀 1단계(가지치기→리디자인→PWA). 대시보드 미래 역할 = 감시 전용(에이전트가 리서치/매매 다 함). 14-task SDD 플랜(`docs/superpowers/plans/2026-08-22-dashboard-pruning-monitoring-only.md`) 전체 실행 완료.

### 완료된 작업
- `/hud`를 진짜 탭쉘로 전환(home/portfolio/lab/execution/tasks 5탭), lab/lab-execution/lab-tasks/overview/auto-research 5라우트 흡수(Task 1-7)
- `/lab`의 수동 "다음 가설 검토" 실행버튼 제거(감시전용 원칙, Task 4)
- council/exec/portfolio-os 8라우트(council×3 + exec×2 + portfolio-os×3) → `/investment-os` 리다이렉트(콘텐츠 이미 STEP4-D로 통합되어 있었음, 신규 UI 불필요, Task 9, 8개 파일 개별 검증)
- calendar/insider/macro/news 4라우트 → `/agents` ContextTab으로 흡수(전역 피드, 에이전트별 필터링은 안 함 — 후속 업그레이드 지점, Task 10-11)
- backtest(+heatmap)/ict/event-study/signal/experiments/data-quality/validation/crypto/forex/futures/options/market/buyback-doctor/edges/search/design-system 총 16라우트 CUT(Task 12에서 7개 dir, Task 13에서 9개 dir — 합 16 확인)
- Task 12·13 실행 중 브리프의 `href="..."` 문자열 grep이 놓친 `router.push()`/템플릿 리터럴 기반 죽은 링크 추가 발견·제거: Task 12는 WatchlistSidebar CTA·ChartTab 툴바 버튼·search 스크리너 버튼(전부 삭제된 `/backtest`로 향함, 2라운드 픽스), Task 13은 9개 삭제 dir 밖의 5개 파일(dart-auto, copytrade, GroqSummaryPanel, hud/PortfolioTab ×2, hud `violationHref()`)에서 `/market`·`/buyback-doctor` 참조 6곳을 링크→평문(div/span) 전환 또는 분기 삭제
- `lib/researchOsRedirects.ts`의 `OLD_TO_NEW` 맵 15→32키로 확장(단일 맵 재사용, 신규 파일 없음, Task 1)
- CommandRail 네비: TERMINAL_GROUPS 5그룹→3그룹으로 축소(Task 8)

### 변경된 파일
`app/hud/page.tsx`, `components/hud/{PortfolioTab,LabTab,ExecutionTab,TasksTab}.tsx`(신규),
`components/agents/ContextTab.tsx`(신규), `app/agents/page.tsx`, `lib/researchOsRedirects.ts`,
`__tests__/researchOsRedirects.test.ts`, `components/console/CommandRail.tsx`,
`components/market/{WatchlistSidebar,ChartTab}.tsx`, `app/search/page.tsx`,
`app/dart-auto/page.tsx`, `app/copytrade/page.tsx`, `components/GroqSummaryPanel.tsx`,
+ merge/cut 대상 각 라우트의 `page.tsx`(스텁 교체 또는 삭제, 9개 디렉토리 통째 삭제 포함)

### 검증
- `npx tsc --noEmit` 통과, `npm test` 29 files / 319 tests 전부 통과, `npm run build` 성공(53 static route 생성).
- `find app -name page.tsx | wc -l` = 51(최종). 개발서버 기동 후 18개 리다이렉트 경로 전수 curl 스모크 — 전부 307, 최종 목적지도 전부 200 확인.

### 다음 할 일
2단계 리디자인(autopilot 스타일 비주얼), 3단계 PWA화 — 둘 다 별도 스펙/플랜 필요(이 plan 스코프 아님).

### 막힌 부분/결정사항
실행 중 발견된 플랜-preflight 미포착 충돌 5건을 컨트롤러가 그때그때 스코프를 좁혀 룰링:
1. **Tasks 2-6 tsc 일시정지**: HudShell(Task2)이 아직 존재하지 않는 PortfolioTab/LabTab/ExecutionTab/TasksTab을 import하는 의도된 스캐폴딩 단계라 그 구간 tsc는 실패가 예상된 상태 — "매 task 끝 tsc 통과 필수" 글로벌 제약을 Task 2~5에 한해 한시 정지, Task 6에서 "전체 그린" 게이트로 전량 회수(리뷰 시 Task2~5는 "예상된 missing-import 에러 외 새 에러 없음"만 확인).
2. **Task 11 스코프 확장(app/market/page.tsx)**: `market` 페이지가 NewsPage/CalendarPage를 컴포넌트로 embed 중이라 뉴스/캘린더 redirect-stub화 시 타입이 깨짐 → Task 11 스코프를 market/page.tsx 내부의 "뉴스"/"캘린더" venue 탭 2개(+관련 import/타입/렌더 라인)만 최소 제거로 한정 확장. market 자체는 Task 13에서 통째 삭제될 예정이라 임시 조치.
3. **Task 12 round1 WatchlistSidebar 룰링**: `components/market/WatchlistSidebar.tsx`의 per-item "백테스트" CTA(→ 삭제 예정 `/backtest`, CommandRail 밖·7개 대상 dir 밖이라 브리프 grep 밖)를 Task 12 스코프에 포함해 통째 제거 — backtest는 후속 라우트 없는 순수 CUT이므로 죽은 진입점 제거가 원칙.
4. **Task 12 round2 ChartTab+search 룰링**: 브리프의 `href=` 문자열 grep이 놓친 `router.push()` 기반 죽은 링크 2건(ChartTab.tsx 툴바 버튼, search/page.tsx 스크리너 버튼) 추가 제거 — ChartTab은 다른 용도가 없던 `useRouter` import까지 함께 정리, search는 다른 곳(라인 415)에서 router를 계속 써서 import는 유지.
5. **Task 13의 5-file dead-link 룰링**: 9개 삭제 대상 dir 밖에서 `/market`·`/buyback-doctor`를 가리키던 죽은 링크 6곳(dart-auto, copytrade, GroqSummaryPanel, hud/PortfolioTab ×2, hud `violationHref()`)을 "내비게이션만 제거, 표시는 유지" 원칙으로 통일 처리(Link→div/span 전환, 또는 buyback 분기 삭제해 `/lab` 기본값으로 낙하).

후속 정리 후보(minor, deferred — 블로커 아님):
- LabTab 빈상태 문구가 삭제된 "▶ 다음 가설 검토" 버튼을 텍스트로 여전히 언급(Task 4)
- GroupGlyph 아이콘 맵에 삭제된 그룹명("리서치 랩","검증·백테스트") 잔존, fallback 처리돼 런타임 무영향(Task 8)
- FRED macro 패널이 검증 시점 DGS10 빈 응답("—") 반환 — 프론트 가드는 정상, 백엔드 데이터 상태 확인은 이 plan 스코프 밖(Task 10)
- `components/market/`(17개 파일: MarketWorkspace, WatchlistSidebar, ChartTab, 인디케이터 차트 등) — 유일한 소비자였던 `app/market/page.tsx`가 삭제되며 전부 고아 코드화, 빌드/tsc 영향 없음(Task 13)
- `app/(console)/intel/research-os/page.tsx`(nav 미연결 미사용 페이지로 보임) — 이번 스펙 범위 밖이라 손대지 않음, 후속 정리 후보로 기록만.
- ContextTab은 에이전트별 티커 필터링 없이 전역 피드만 노출(YAGNI) — 필요해지면 `agentId`/`symbol` prop 추가.

---

## Phase 217 — sharp_wallet_bot 청산루프 정합성버그 수정 + 다각화봇 note 정정 (2026-08-19) ✅ SHIPPED

### 배경
- 사용자 리포트: "홈 수집기 재시작 버튼 눌러도 안돌아가고, 정합성 감시 다 빨간색".
- 재시작 버튼: `polymarket_mlb_specialist_tick` 실제로는 정상 재시작됨(tmux 세션 재생성 확인) — 새 데이터 write까지 반영 지연(수 분) 때문에 누른 직후엔 여전히 죽은 것처럼 보였을 뿐, 코드 버그 아님.
- 정합성 감시(`/lab/health`) 6건 위반 전부 `polymarket_sharp_wallet_bot` 하나에서 발생: STUCK_EXIT 5건(포지션이 exit_at 지나고 45시간+ 미청산) + SPENT_MISMATCH 1건.

### 근본원인
- `data/polymarket_sharp_wallet_bot.json`: `enabled=false`(Phase214~216에서 사용자 확인 대기 중 비활성화된 상태). 그런데 `api_server/polymarket_sharp_wallet_bot.py`의 `tick()`이 `enabled=false`면 통째로 `return {"skipped": "disabled"}` — 신규진입뿐 아니라 **청산 로직(`_process_exits`)까지 같이 스킵**돼서, 봇 끄기 전에 열려있던 포지션이 영원히 미청산 상태로 남아 정합성 검사기가 계속 위반 잡음.

### 완료된 작업
- `api_server/polymarket_sharp_wallet_bot.py` — `tick()`/`_loop()` 재구성: `_process_exits`는 `enabled` 값과 무관하게 항상 먼저 실행, `enabled=false`/킬스위치일 때 막는 건 신규진입(`_scan_and_enter`)뿐. `_loop()`도 disabled여도 매 interval마다 `tick()` 호출하도록 게이트 제거.
- `tests/test_polymarket_sharp_wallet_bot.py` — `test_tick_disabled_skips` 반환값 갱신(`closed` 키 추가), `test_tick_disabled_still_processes_exits` 신규(disabled여도 exit는 돌고 entry는 안 도는지 검증).
- `api_server/polymarket_bot.py` — `status()`의 `note` 필드 정정: 낡은 "엣지 주장 없음" → Phase213 검증결과(mid_favorite 밴드 BH-FDR 생존, p=0.026, n=37 기준 candidate) 반영, n≥100 재검증 전까지 paper 유지라고 명시.
- `api_server/polymarket_sharp_wallet_bot.py` — `status()`의 `note`도 정정: 실집행 no_edge 확정(2274건 exit, 승률13.7%, pnl -$1900.74) + disabled 유지·재개 금지 명시. 단 연구 신호 자체(BH-FDR+워크포워드, 300s 호라이즌)는 별개로 여전히 `paper_candidate_forward_test_required` — 원시데이터(`polymarket_sharp_wallet_tick` 수집기)/검증러너는 삭제 안 하고 보류.

### 검증
- `pytest tests/test_polymarket_sharp_wallet_bot.py -q` 27 passed.
- `bash scripts/restart_api.sh` 재기동 → 재기동 직후 첫 tick에서 미청산 포지션 5개 자동청산 확인, `/lab/health` STUCK_EXIT 5건 → 0건.
- `pytest tests/ -q` 2251 passed (회귀 없음). `npm test`(vitest) 316 passed.

### 남은 것 (미해결/보류)
- `SPENT_MISMATCH`(spent=$0.04, 오픈포지션 0개) 잔차 — 사소한 반올림 드리프트, 이번엔 미조치.
- 샤프월렛 완전 삭제 여부 — 사용자에게 3단계(실행봇/수집기/리서치검증러너) 스코프 설명, **"일단 보류"로 확인**. 다음에 삭제 논의 재개하면 이 세 계층 구분해서 다시 물을 것.
- 다각화봇(`polymarket_bot`) mid_favorite 표본 22/100(resolve 41건 중) — n≥100 되면 재검증 필요(Phase213 조건).
- 진단 중 별건 발견 → 후속조사로 해소: `convergence_legs` 수집기가 한때 `/lab/fleet`에서 `stale`(16.8시간, 임계 12시간) 찍혔었는데, 재확인 결과 자연복구(현재 fresh, 244s 전). pane 로그의 EDGAR 403(`efts.sec.gov`)은 수동 재현 시 200 정상 응답 — 일시적 레이트리밋/순단으로 판단, `insider/edgar_client.py` try/except가 흡수해 프로세스는 안 죽음. 오늘자 4개 소스(dart_corp_action/form4/congress/options_uoa) 전부 정상 적재 확인됨. 조치 불필요.

---

## Phase 216 — 플랫폼 미사용 기능 감사 + 오더플로우 데스크탑 이전 보류 (2026-08-15) ✅ SHIPPED(감사) / 🔶 보류(오더플로우)

### 완료된 작업 (env 복구 + 감사)
- `copytrade_autobot` 미작동 원인: `.env`엔 Alpaca 키 다 있었는데 떠있던 uvicorn 프로세스가 그 키 로딩 이전에 뜬 상태로 계속 살아있었음. `scripts/restart_api.sh`로 재기동 → `load_dotenv()` 재적용 확인, `run-now` 테스트에서 `no_alpaca_key` 스킵 없이 정상 포지션조회까지 감(청산대상 0건뿐). `enabled=true`로 켜둠.
- `lkg_paper`("Living Knowledge Graph" 페이퍼봇, `api_server/graph_api.py`): 키/CLI 다 정상, 6시간 주기 스케줄러가 토요일 전체+일요일 18시(KST) 전 스킵하는 설계라 그냥 주말이라 안 돎 — 버그 아님.
- 플랫폼 전체 미사용기능 감사(서브에이전트 fork, 24 tool calls) 완료:
  - **HIGH**: 콘솔 신규 8페이지(`intel/research-os`, `council/*`, `portfolio-os/allocation|positions`, `exec/monitor`, `design-system`) — 페이지+백엔드(`console_api.py`) 다 있는데 `CommandRail.tsx`에 링크가 없어 고아. `docs/CONSOLE.md`에 정식 문서화됨, 진행중인 nav 개편 플랜과 시점 겹침 — 방치 아니라 IA 마이그레이션 중 링크 연결 누락으로 판단.
  - **MEDIUM**: `exec/orders`/`portfolio-os/risk`(같은 nav 미연결, 내용은 살아있음), `jarvis/research_workflow/` 레거시 8~9개(공식 `__deprecated__` 마커, 의도된 보존), `research/run_orderflow_*.py` 10개(실험레지스트리 기록 0건, gz버그 미수정 그 파일군과 동일), `run_polymarket_event_divergence_scan.py`(수집만 하고 분석 스크립트 없음, docstring에 명시된 범위밖).
  - **클린**: 백엔드 라우터 17개 전부 프론트 참조 있음, `*_old`/`*_v2`류 레거시 네이밍 파일 0건.

### 오더플로우 방향성 논의 — 보류
- 사용자 질문: "개발 방향성에 오더플로우가 맞는지 고민 중" → 검토 결과 한달째 검증결과 0건, 메인 방향성(폴리마켓/이벤트 확률, BH-FDR+워크포워드)과 도메인 이질적, gz버그(Phase 213에서 미수정 deferred)까지 겹쳐 있다고 답변.
- gz버그 수정 + 검증 재실행 먼저 하자고 제안했으나 **사용자 거절**: "그거하면 컴터 터진다. 그냥 옮겨서 할게" — 데스크탑으로 개발환경 이전 예정, 맥북보다 성능 좋아서 그쪽에서 처리하겠다는 판단(맥북 발열 이슈는 CLAUDE.md에 이미 기록됨: `--reload` 상시가동 금지 사유).
- **결정: 오더플로우 gz버그 수정 + 죽었는지 판정, 전부 데스크탑 이전 이후로 보류.** 맥북에서 더 손대지 말 것.

### 다음
- 데스크탑 이전 시점에 오더플로우 계열(`research/run_orderflow_*.py` 10개) gz-blindness 스윕 + 재검증부터 시작.
- 콘솔 신규 8페이지 `CommandRail.tsx` 링크 연결 여부 — 사용자 결정 대기(삭제 후보 아님, 연결 여부만 미결).
- `run_polymarket_event_divergence_scan.py` 계속 끌지 여부 — 사용자 결정 대기.
- Phase 215의 미결 항목(`vrp_bot`/`polymarket_sharp_wallet_bot` 비활성화 여부, `polymarket_whale_tick` 수집기 원인불명 재발)도 여전히 대기 중.

## Phase 215 — 전체 봇/수집기 헬스체크 (2026-08-15) 🔶 진행중 (사용자 답변 대기)

### 배경
- 사용자: "지금 데이터 모은게 한두개가 아닌데 나머지도 어떻게 잘 되어가나 체크해줄래?" — sharp_wallet/다각화봇 외 나머지 전체 상태 점검 요청.

### 수집기(collector) 헬스 — `GET /lab/fleet`
- 13개 중 12개 fresh, `polymarket_whale_tick` 1개만 `stuck`(마지막 write 19:38:04Z, age 2900s+ >> 임계 600s의 4배).
- `POST /lab/collectors/polymarket_whale_tick/restart`로 공식 재기동 1회 실행 — 재기동 직후 pane에 `ConnectionError: data-api.polymarket.com Connection refused` 반복(포함 프로세스 pid 92489). 같은 시각 수동 `curl`/직접 python `requests.get`은 둘 다 200 즉시 성공 — 프로세스별로 갈린 원인 미상(프록시 env 없음, macOS 방화벽도 disabled 확인, Little Snitch 미설치 확인).
- 진단 중 실수로 tmux pane에 무심코 Ctrl-C 전송(세션 재기동 확인 목적 아니었음) — 세션이 wrapper 루프로 되어 있었는지 자동으로 새 프로세스(pid 93561)로 재기동됨, 데이터 유실은 없음(수집만 중단됐던 구간, 저장된 과거 데이터는 안 건드림). 재기동 직후 잠깐 pane 깨끗했지만 수 분 뒤 동일 `Connection refused` 재발 확인(Monitor로 확인) — **재기동 2회(92489→93561) 모두 동일 증상, 근본 미해결**.
- 방화벽(disabled 확인), Little Snitch(미설치), 프록시 env(없음) 다 배제. 동일 시각 수동 `curl`/직접 `python3 -c "requests.get(...)"`는 즉시 200 성공 — 이 프로세스(수집기)만 골라서 거부당하는 원인 미상. 코드 버그는 아님(요청 로직 자체는 정상 동작 확인됨), OS/네트워크 레벨의 프로세스별 이슈로 추정 — 재기동으로 해결 안 되는 걸 확인했으니 더 이상 재기동 반복은 의미 없음, 사용자에게 에스컬레이션.

### 봇(paper bot) 실현손익 — `data/*.json`/`*_log.jsonl` 직접 조회
| 봇 | 상태 | 판정 |
|---|---|---|
| `dart_autobot` | enabled, spent=0(토요일, 휴장이라 정상), 최근 26건 청산 승률 69.2%/평균 +6.7% | 정상 |
| `copytrade_autobot` | enabled=false, 로그 2건(켰다가 즉시 끔, 08-04 이후 미가동) | 의도적 비활성 |
| `polymarket_bot`(다각화) | realized_pnl=$194.49, mid_favorite 밴드로 이미 승격 조치됨(Phase 214) | 정상 |
| `polymarket_sharp_wallet_bot` | realized_pnl=**-$1900.74**, enabled=true로 계속 손실 누적 중 | Phase 214에서 이미 죽음 판정, 미조치 |
| `vrp_bot` | enabled=true, spent=0, realized_pnl=0 — 로그 918건 중 916건 `scan_fail`(07-07~08-14, 한달+ 연속), 원인: Alpaca `Connection refused` 830회 + IB `no historical bars`류 87회. **가동 이래 단 한번도 거래 성공한 적 없음** | **신규 발견 — 방치된 죽은 봇** |
| `lkg_paper` | capital=10000, cash=6400, position 2건, closed 0건 | 정상(아직 평가할 청산 이력 없음) |

### 다음 (사용자 답변 대기 중)
- `vrp_bot` 끌지 / Alpaca API 키·IB Gateway 접속 상태부터 조사할지 — 인증정보 확인이 필요해 단독 처리 안 함.
- `polymarket_sharp_wallet_bot` 비활성화 여부 (Phase 214에서부터 이어지는 미결 질문).
- `polymarket_whale_tick` 재기동 후 실제 데이터 재적재 확인 — Monitor 결과 대기 중.

## Phase 214 — 샤프월렛 실거래 P&L 확인(진짜 죽음) + 다각화 봇 mid_favorite 승격 (2026-08-15) ✅ SHIPPED

### 배경
- Phase 213에서 "샤프월렛 verdict은 여전히 paper_candidate_forward_test_required, 안 죽음"이라 답했는데, 사용자가 "지금 -1000달러잖아, 망한 전략 아니냐"고 반박. Phase 213 답변은 `research/run_polymarket_sharp_wallet_validate.py`(과거 원장 재생 백테스트, TRADE_SIZE=1.0 단위)만 봤고, 실제 라이브 페이퍼 집행봇(`api_server/polymarket_sharp_wallet_bot.py`, `data/polymarket_sharp_wallet_bot.json`/`_log.jsonl`)의 실현손익은 확인 안 한 게 원인 — 별개 파일이라 누락.

### 확인 결과
- `data/polymarket_sharp_wallet_bot.json`: `realized_pnl = -1900.74`(사용자 말대로 실질적으로 "-1000대", 좀비 청산 이력 포함).
- `data/polymarket_sharp_wallet_bot_log.jsonl` exit 로그 2274건 집계: 승 311 / 패 1963(승률 13.7%), 총 pnl **-$1900.74**. 호라이즌별: 30s -$143, 120s -$134, 300s -$1624(2044건 — 볼륨 대부분 여기, 백테스트에서 유일하게 walk-forward 통과했던 그 호라이즌인데 실집행에서 제일 크게 깨짐).
- 결론 수정: 사용자가 맞음. 연구 백테스트(과거 원장 재생, 단위 스테이크 소액 엣지)와 실제 forward paper 집행(2026-08-02~) 결과가 정반대 — 이게 바로 "forward_test_required" 상태가 기다리던 그 forward test였고, 결과는 명백히 실패. **verdict을 사실상 `no_edge`/폐기로 취급해야 함** — in-sample 신호가 out-of-sample에서 완전히 붕괴한 교과서 사례.
- Phase 213 결론("안 죽음") 정정: verdict 필드(BH-FDR+walk-forward)는 과거원장 재생 기준이라 안 죽었다고 나온 거고, 실집행 결과는 죽었음. 앞으로는 이 두 개를 같이 봐야 함 — research validator verdict만으로 생사 판단 금지.

### 조치
- 사용자가 명시 위임한 2번(다각화 봇 mid_favorite 승격)만 실행: 운영 중인 API(`POST /polymarket/config`)로 `min_price=0.49, max_price=0.74`(0.50 정확힌 clamp상 불가, 가장 가까운 값) 적용 완료 — `side="favorite"` 등 나머지 설정 그대로, paper 그대로.
- 샤프월렛 봇(`enabled=true`로 계속 돌아가는 중, 계속 실손실 누적 페이퍼)은 위임 범위 밖이라 건드리지 않음 — 끌지 여부는 사용자 확인 필요.

### 다음
- 샤프월렛 페이퍼봇 비활성화 여부 확인 필요(사용자 대기).
- `research/agents/experiment_registry.jsonl`의 `polymarket_sharp_wallet_convergence_v1` status를 실집행 P&L 반영해 갱신할지 검토(현재는 여전히 `paper_candidate_forward_test_required`로 기록됨 — research verdict 기준이라 틀린 건 아니지만 오해 소지).

## Phase 213 — gz-blindness 버그 스윕 + 샤프월렛 재검증 (2026-08-15) ✅ SHIPPED

### 배경
- 사용자: "샤프월렛전략 지금 망했잖아, 미드 페이버릿으로 승격해서 데이터 모으자"고 제안.
- 확인 차 `run_polymarket_sharp_wallet_validate.py` 재실행 → `n_anchors=1593`, `dates` 겨우 3일치(08-13~08-15). 과거 레지스트리 기록(08-04, n_anchors=6122, 15일치)과 비교해 급감 발견.
- 근본원인: Phase 210에서 추가한 `research/compress_old_data.py`(2일 지난 jsonl→gz 압축, cron 매일) 자체 docstring이 "읽는 쪽 gz-aware 아니면 무음으로 데이터 유실"이라고 경고해뒀는데, 실제로 그 리더들을 안 고쳐놓음 — cron이 돌면서 압축이 쌓일수록 검증러너들이 최근 2~3일치만 보게 되는 회귀. `cross_venue_skew`(gz 185개, 최다 피해)는 자기 문서에서 "gz-aware 참고구현"이라 인용한 `load_venue_snapshots`조차 앞단 `_available_dates()`가 plain glob이라 gz 날짜 자체를 못 찾아 사실상 같이 뚫려있었음.

### 완료된 작업
- `research/jsonl_dates.py` 신규 — 공용 헬퍼 3개(`list_dates`/`open_stem`/`iter_all_rows`), plain+gz 둘 다 인식. 캐치한 버그: `list_dates(glob_prefix=...)` 최초 구현이 프리픽스 뒤에 `*` 안 붙여서(`f"{glob_prefix}{suffix}"`) prefix 지정 호출은 전부 매치 실패 — `tests/test_jsonl_dates.py` 작성 중 자체 발견, `f"{glob_prefix}*{suffix}"`로 수정.
- 이 헬퍼로 스윕 교체(9개 파일): `research/hypotheses/polymarket_sharp_wallet.py`, `polymarket_whale.py`(→`polymarket_whale_coincidence.py`는 재수출이라 자동 해결), `research/run_polymarket_sharp_wallet_validate.py`, `run_polymarket_whale_validate.py`, `run_polymarket_whale_coincidence_validate.py`, `run_mlb_specialist_validate.py`, `run_cross_venue_skew_validate.py`, `run_options_uoa_forward.py`, `run_polymarket_arb_validation.py`, `run_sharp_wallet_maker_vs_taker.py`.
- `tests/test_jsonl_dates.py` 신규 — 8 tests.
- `pytest tests/ -q` 2248 passed(2240→2248, 회귀 없음).
- 오더플로우 계열 스크립트(`run_orderflow_signal_matrix*.py` 등 7개)는 동일 버그 계열이지만 이번 스윕 범위 밖 — 후속 필요(미착수).

### 재검증 결과 — 샤프월렛, 07-21~08-15 전체(26일, n_anchors=9756, 과거 최대치 갱신)
- BH-FDR: bucket 풀 9/9 생존, score tercile 풀 9/9 생존(둘 다 alpha=0.1) — 여기까진 늘 그랬음.
- walk-forward: **18개 중 5개만 통과**, 전부 300s 호라이즌(`bucket1/2/3:300s`, `mid:300s`, `high:300s`) — 30s/120s는 버킷·티어 안 가리고 전부 실패. 이 패턴은 08-03/08-04 기록과도 일관됨(그때도 6~11/18).
- verdict: **`paper_candidate_forward_test_required`**(안 죽음, 원래 상태 그대로) — "망했다"는 사용자 관찰은 gz 버그로 3일치만 본 이전 실행 탓, 교정 데이터로도 결론 동일.

### 다음
- 사용자 질문 답변 완료(대화로 전달): (1) 샤프월렛 안 죽음, 항상 이 상태였음 — 30s/120s 호라이즌은 구조적으로 walk-forward 못 뚫는 듯, 300s만 유효할 가능성. (2) 미드 페이버릿 밴드 승격 관련 논의 진행.
- 오더플로우 7개 파일 gz-blindness 후속 스윕 — 미착수.

### 배경
- 사용자: 폴리마켓 다각화 봇(`api_server/polymarket_bot.py`) 실현손익 $194.49(스펜드 $300) 보고 "제일 잘 버는 전략 같다"고 언급.
- 1차 응답: 이 봇은 코드/설계문서에 "엣지 주장 없음"이라 명시된 무엣지 베이스라인(대조군)이라고 설명 → 사용자가 "32승 5패인데 그런 말을 하나, 봐야 알지 않냐. MLB도 효율시장이라 개인엣지 없다 했으면서 설계문서 업데이트 필요없냐"고 반박.
- 손으로 캘리브레이션 검정(진입가=시장 내재확률 대비 실제 승률) 해봤더니 z≈2.23(미보정 단일검정) — 프로젝트 규율(BH-FDR+워크포워드) 없이 판단하면 안 되는 상황이라 사용자가 정식 파이프라인 태우자고 요청.

### 완료된 작업
- `research/run_polymarket_bot_diversification_validate.py` 신규 — `data/polymarket_bot_log.jsonl`(kind="resolve") 읽어 귀무가설(entry_price=진짜 확률, 효율시장)을 Bernoulli 몬테카를로(N_RUNS=500)로 검정. 가격밴드 2변형(mid_favorite <중앙값, heavy_favorite ≥중앙값) 단일 BH-FDR 풀(alpha=0.1) + walk-forward(전/후반 둘다 양수) 게이트. `research/run_mlb_specialist_validate.py`/`run_polymarket_whale_coincidence_validate.py`와 동일 idiom, `validation/baselines·multiple_testing·metrics·cost_model` 그대로 재사용.
- `tests/test_run_polymarket_bot_diversification_validate.py` 신규 — 9 tests.

### 검증 결과 (표본 37건, 2026-08-15 기준)
- mid_favorite(진입가 0.50~0.74, n=18): win_rate 83.3%, total_pnl $151.6(코스트 반영), **p=0.026**, walk-forward 전/후반 둘다 양수(+39.3/+112.3) → BH-FDR(alpha=0.1, m=2) 생존.
- heavy_favorite(진입가 0.74~0.89, n=19): win_rate 89.5%, total_pnl $26.1, p=0.226 → BH-FDR 미생존(walk-forward는 통과하지만 다중검정 보정에서 탈락).
- 전체 verdict: **candidate**(mid_favorite 밴드에 한정). heavy_favorite 밴드는 no_edge.
- `pytest tests/ -q` 2240 passed(2231→2240, 회귀 없음).

### 다음
- **실집행 승격 아님.** 표본 37건 단일 데이터셋, 밴드분할 자체가 사후설계(pre-registration 아님) — house 규율(paper 우선) 그대로 유지, 데이터 더 쌓인 뒤(예: n≥100) 재검증 필요.
- `api_server/polymarket_bot.py` note 필드("엣지 주장 없음")는 지금 데이터 기준으로 낡음 — "미검증/mid-favorite 밴드 candidate" 정도로 수정 고려(사용자 확인 대기, 아직 미착수).
- MLB 설계문서(`docs/superpowers/specs/2026-07-21-polymarket-mlb-specialist-design.md`)는 업데이트 불필요로 판단: 그 결론은 MLB(유동성 큰 성숙 시장) 한정이고 이번 신호는 완전 다른 시장군(정치/스포츠 프롭/크립토 저유동성)이라 서로 독립적 — 사용자에게 이 판단 근거 전달 완료.

## Phase 209 — 트레이딩 에이전트 5개 좀비 상태 자동복구 (2026-08-15) ✅ SHIPPED

### 배경
- 사용자: "다트 오토파일럿 보유종목 왜 안떠" 문의 계기로 전체 점검. `/dart/positions`는 정상(모의계좌 실제로 0주 — desync reconcile이 정상 처리한 결과, Phase 208 이후 동작대로).
- 점검 중 발견: `/agents` 5개(스윙검증-US·자율형 학습 AI·KR 거시 전략 AI·lv5 가상화폐·US Daytrade E2E 검증) 전부 `status="running"`인데 `session_live=false`. tmux 서버가 리셋돼 `seokminal-agent-*` 세션이 전부 사라진 상태였고, 대시보드엔 계속 "running"으로 표시돼 실제로는 매매 안 하고 방치 중이었음.
- 근원: `status` 필드는 start/stop 시점에만 DB에 쓰여지고 tmux 세션 생존 여부와 별개로 관리됨. `dart_autobot`(asyncio 상시태스크, 서버 프로세스에 종속)과 달리 트레이딩 에이전트는 tmux 세션(별도 프로세스)이라 서버 재기동만으론 안 살아나고, 자동 복구 로직 자체가 없었음.

### 완료된 작업
- `api_server/main.py` — `_revive_agents()` 추가, startup 훅(`_start_dart_bot`) 맨 앞에서 호출. `agent_store.list_agents()` 순회해 `status=="running"` 인데 세션 죽은 것만 기존 `start_agent()`(멱등, 세션 있으면 no-op) 재호출.
- 새 함수/엔드포인트 없음 — 기존 `routers/agents.py`의 `_agent_tmux`/`_session_exists`/`start_agent` 재사용.

### 검증
- `bash scripts/restart_api.sh` 재기동 → 5개 전부 `session_live=true` 확인, tmux 세션 5개 새로 생성됨.
- `pytest tests/ -k agent -q` 49 passed.

### 다음
- 완료: 2번 문제(디스크) — 아래 Phase 210에서 처리.

---

## Phase 210 — 디스크 압박 해소: compress_old_data 스케줄 누락 (2026-08-15) ✅ SHIPPED

### 배경
- 점검 중 발견: 디스크 20GB 남음(91.6% 사용). `research/data/polymarket_tick` 21G, `cross_venue_skew` 15G — 회전 없이 무제한 누적.
- 원인은 신규 버그 아님 — `research/compress_old_data.py`(오래된 jsonl gzip 압축, 최근 2일 제외, 리더들 이미 `.gz` 인식)가 이미 존재하고 정상 동작하는데 **스케줄이 안 걸려있었음**. 마지막 압축 흔적이 07-26 — 20일 방치. `crontab -l` 확인해보니 압축 관련 항목 자체가 없었음(수동으로 한 번 돌리고 잊혀진 것으로 추정).

### 완료된 작업
- `scripts/compress_old_data.sh` 신규 — `research/compress_old_data.py` 실행 + 로그(`logs/compress_old_data.log`), 기존 `options_uoa_n_check.sh` 패턴 따름.
- `crontab` 등록: 매일 04:00 `compress_old_data.sh` 자동 실행.
- 즉시 1회 수동 실행 — 519개 파일(33G) 압축, **디스크 여유 20G → 55G** 회복. `polymarket_tick` 21G→5.6G, `cross_venue_skew` 15G→4.6G.

### 검증
- `pytest tests/test_compress_old_data.py tests/test_prune_old_data.py -q` 11 passed (사전).
- 압축 후 `pytest tests/ -q` 2230 passed — `.gz` 전환이 기존 리더(cross_venue_skew, polymarket_tick fill_sim 등)에 영향 없음 확인.

### 다음
- `research/prune_old_data.py`(retention 90일, 실삭제)는 아직 미스케줄 — 지금은 압축만으로 여유 확보돼 급하지 않음. 디스크 다시 빠듯해지면 이것도 크론 등록 고려.

---

## Phase 211 — convergence_legs 함대 stale 오탐 수정 (2026-08-15) ✅ SHIPPED

### 배경
- 3번 문제(폴리마켓/HL 네트워크 순단)는 재조사해보니 이미 자연복구(재연결 로직 정상 동작) — 코드 조치 불필요.
- 대신 `/lab/fleet` 재확인 중 실제 버그 발견: `convergence_legs` 수집기가 그 순간에도 `stale`로 오탐 중이었음.
- 원인: `research/run_convergence_signal_collect.py`(POLL_INTERVAL_SEC=21600, 6h 주기)가 `api_server/fleet_health.py`의 `STALE_AFTER_S` 오버라이드 맵에 없어서 DEFAULT 900s 임계 적용 → 사이클 대기 중 상시 stale. **Phase 206에서 고친 것과 완전히 같은 버그 클래스**(`polymarket_implication_watch/collect`), Phase 206 이후 추가된 수집기가 그 맵에 누락된 것.

### 완료된 작업
- `api_server/fleet_health.py` — `STALE_AFTER_S["convergence_legs"] = 43200`(POLL_INTERVAL_SEC × 2, 기존 컨벤션).
- `tests/test_fleet_health.py` — `test_convergence_legs_not_stale_between_cycles` 회귀테스트 추가(Phase 206 패턴과 동일하게 사이클 상수 직접 import해서 임계 대조).

### 검증
- `pytest tests/ -q` 2231 passed.
- 재기동 후 `/lab/fleet`: 13/13 fresh(이전 12 fresh + 1 stale).

### 다음
- 없음. 새 수집기 추가할 때마다 `STALE_AFTER_S`에 실제 폴링주기 기준으로 넣는 걸 습관화할 것 — 이번이 벌써 두 번째 누락.

---

## Phase 208 — 공유 모의계좌 크로스봇 청산 버그 수정 (2026-08-14) ✅ SHIPPED

### 배경
- 사용자 리포트: "다트 오토파일럿 왜 보유주식 안보이냐". `/dart/positions`(KIS 모의 실보유 조회)는 빈 배열, 근데 `dart_autobot` 내부 장부(`cfg["positions"]`)엔 7종목·spent=₩999,194/1,000,000(remaining ₩806) 남아있어 "예산 부족"으로 신규 매수 계속 실패 중이었음.
- 원인 추적: KIS 모의 잔고 조회(`inquire-balance`) 직접 호출 → `rt_cd=0` 정상, `output1`(보유) 빈 배열, `scts_evlu_amt=0` — 계좌에 실제로 0주. DART봇 로그엔 이 7종목에 대한 매도 이벤트가 전혀 없음(자기가 안 팜).
- 진짜 원인: `api_server/routers/agents.py`의 `_daytrade_tick_locked`(KR/HL/US 데이트레이드 에이전트 공용) 가 청산 판정 시 **브로커 계좌 전체 보유**(`kis.get_holdings()`/`get_all_positions()`/`get_positions()`)를 "내 포지션"으로 착각해 자기 TP/SL·시그널로 청산. 실행 중이던 `KR 거시 전략 AI`(agent 126ea9ce)가 **DART봇이 산 종목까지 자기 걸로 알고 조용히 매도**함. 같은 클래스 버그가 `condition_tick_endpoint`(Lv1)에도 있었음(`qtyh`를 브로커 전체 수량으로 계산 → 다른 봇 몫까지 매도 가능) — 그리고 지금 US Alpaca 페이퍼 에이전트 3개가 동시 running 중이라 그쪽도 실제로 살아있는 버그였음(계좌 하나 공유).

### 완료된 작업
- `api_server/dart_autobot.py`: `_reconcile_positions()` 추가 — tick마다 로컬 포지션 vs 브로커 실보유 대조, 브로커에 없는 코드는 spent 환급 후 드롭(모의계좌가 외부 요인으로 꼬여도 예산이 영구히 안 묶이게). 수동 run-now로 즉시 정리 → spent 0, remaining ₩1,000,000, positions 0.
- `api_server/routers/agents.py` `_daytrade_tick_locked`: `own_codes`(에이전트 자기 사이클 원장 `_perf.open_positions`에 있는 심볼만) 계산 후 HL/KIS/Alpaca-paper/IB-live 4개 venue 분기 전부 `held` 빌드를 이 집합으로 스코프. 남의 계좌 보유는 아예 안 보이게.
- `condition_tick_endpoint`(Lv1): KR/Alpaca 매도 수량을 브로커 전체 잔고가 아니라 `min(내 원장 수량, 브로커 수량)`으로 캡.
- 백엔드 재기동 3회(각 수정 후), 테스트 2230개 전부 통과.

### 다음
- 커밋 완료(dart_autobot 손절 지정가 기능/reconcile 분리 커밋 + agents.py 스코핑 커밋).
- 관찰 포인트: DART봇 예산 정상화됐으니 다음 장중 tick에서 정상 매수 재개되는지 확인.
- 미룬 것: 실계좌(IB live) 쪽 fix는 코드만 맞춰뒀고 현재 live 에이전트가 없어 실제 검증은 못 함 — live 에이전트 붙이면 한 번 확인.

---

## Phase 207 — options_uoa 2단계: 사후수익률 라벨링 (2026-08-06) ✅ SHIPPED

### 배경
- 1단계(수집)만 돌고 있었음. 이벤트 218건 쌓였는데 **수익률을 붙이는 코드가 없어** 임계값 스윕/BH-FDR로 못 넘어감.

### 완료된 작업
- `research/run_options_uoa_forward.py` 신규 — 이벤트 → 신호 집계 → 기초자산 사후수익률(1/3/5 거래일) 라벨링.
  - **lookahead 방지**: 탐지일 **다음 거래일 시가** 진입(탐지가 장중/장마감 후라 당일 종가 진입은 미래참조). `run_kr_dart_event_study.py`와 같은 규약.
  - **pseudo-replication 방지**: 통계 단위를 (티커, 탐지일, 방향)으로 집계. 218 이벤트 → **신호 21건**. 같은 날 같은 티커 계약 20개를 세면 같은 기초자산 수익률을 20번 센 셈.
  - call=롱 / put=숏(부호 반전). 같은 티커·같은 날 call·put 동시 발생은 **따로 집계** — 합치면 상쇄됨.
  - 미래 바 부족하면 `None`(라벨 미완성) — 0으로 채우지 않음.
  - 출력 `research/data/options_uoa_forward/labels.jsonl` — **수집 디렉터리와 분리**. `options_uoa/*.jsonl`에 쓰면 함대 헬스가 mtime을 수집기 생존으로 오독함(Phase 206 하트비트와 같은 이유).
  - 알파카 일봉(IEX 피드, 무료플랜 제약). `load_dotenv()` 직접 호출 — api_server 밖 스크립트라 키가 안 잡혔음.
- `tests/test_options_uoa_forward.py` 신규 6건: 다음거래일 진입, put 부호반전, 미래바 부족 시 None, 같은날 계약 병합, call/put 분리, 미라벨 행 제외.

### 검증
- `pytest tests/ -q` **2208 passed**.
- 실데이터 실행: 이벤트 218 → 신호 21(티커 8), 라벨 **0건** — 일봉이 08-05까지인데 이벤트가 08-04~08-06이라 보유기간 미경과. 정상 동작.
- 파이프라인 자체는 과거 날짜(07-20/07-21, INTC)로 end-to-end 확인 — fwd_1d/3d/5d 실수치 산출됨.

### 다음 할 일
- 매 거래일 스크립트 재실행하면 라벨이 채워짐. **n≥30 신호**(≈2주 수집) 후 임계값 스윕(vol_oi_ratio·dte·moneyness) → BH-FDR 등록.
- 지금 신호율 ≈7건/일 → 5거래일이면 n≈35. 08-13 전후 재점검.
- **알림 설치됨**: `crontab` 2026-08-13 09:07 → `scripts/options_uoa_n_check.sh`(라벨러 실행 + n 로그 + macOS 알림). 해제는 `crontab -r`.

### 막힌 부분/결정사항
- 라벨링 단계에선 `MIN_VOL_OI=0`(필터 없음). 임계값을 여기서 정하면 스윕 자체가 사후선택이 됨 — 다음 단계에서 스윕.
- 알파카 무료 IEX 피드라 당일 바가 늦음. 실측 라벨은 항상 T+1 이후에만 확정.

---

## Phase 206 — 함대 오탐 제거 + 통화혼합 근본수정 + 그래프 이력 (2026-08-06) ✅ SHIPPED

### 배경
- Phase 205 잔여 2건: (2) 수집기 staleness 임계 오보정, (3) 검증 미완 항목들.

### 완료된 작업
- **수집기 staleness 오탐 — 원인 2종으로 갈렸음**
  - *긴 사이클 vs 짧은 임계*: `polymarket_implication_watch`(WATCH_INTERVAL_S=3600), `polymarket_implication_collect`(SCAN_INTERVAL_S=86400)가 DEFAULT 900s 임계라 **사이클 대기 중 상시 stale**. `api_server/fleet_health.py` STALE_AFTER_S에 7200 / 172800(각 사이클 ×2) 추가.
  - *이벤트 0건 = 파일 미갱신*: `options_uoa`는 `append_events()`가 빈 리스트면 early-return이라 미장 마감 중엔 아무것도 안 씀 → 살아있어도 dead/stale로 찍힘. `research/collector_heartbeat.py` 신규 — 폴링 성공마다 `<data_dir>/.heartbeat` touch로 **"살아있음"과 "데이터 나옴"을 분리**. 확장자를 `.jsonl`로 안 한 이유: 분석 스크립트들이 data_dir의 `*.jsonl`을 이벤트로 읽어감.
  - `api_server/lab_api.py` `_tmux_process_status`: mtime을 `*.jsonl` + `.heartbeat` 중 max로. 하트비트 없는 수집기엔 무영향.
  - 결과: `/lab/fleet` **12/12 fresh**(이전 3건 stale/오탐).
- **통화 혼합 근본수정(서버)** — Phase 205에서 프론트만 우회했던 것. 소비자 grep 결과 프론트 사용처 0 → `/dashboard/pnl/all` 응답에서 `grand_total_realized_pnl` **삭제**(₩ 에이전트 + $ 봇을 더한 값). `lib/api.ts` 타입·`tests/test_dashboard_pnl.py` 기대값도 정리.
- **`/infra` 병목 스코어 추세 — 죽은 패널이었음**: 육안 검증하려다 발견. 프론트가 부르는 `GET /graph/history/{node_id}` **라우트가 서버에 아예 없음**(404 → catch → `history=[]` → `history.length>=2` 영구 미충족). 노드 22개 전부 이력 0.
  - `api_server/graph_api.py`: 패치마다 노드 스코어 스냅샷을 `graph_history.jsonl`에 append(`_append_history`) + `GET /graph/history/{node_id}` 신설(limit=200, 오래된 것→최신).

### 변경된 파일
- 백엔드 신규: `research/collector_heartbeat.py`, `tests/test_graph_history.py`
- 백엔드 수정: `api_server/fleet_health.py`, `api_server/lab_api.py`, `api_server/graph_api.py`, `api_server/main.py`, `research/run_options_uoa_collect.py`, `tests/test_fleet_health.py`, `tests/test_dashboard_pnl.py`
- 프론트 수정: `lib/api.ts`(타입에서 grand_total 제거)

### 검증
- 백엔드 `pytest tests/ -q` **2202 passed**(신규 5건: 긴사이클 임계 회귀 2 + 하트비트 1 + 그래프 이력 3 중 일부).
- 프론트 `npx tsc --noEmit` 통과, `npm test` **316/316**.
- API 재기동 후 실측: `/lab/fleet` 12/12 fresh, `.heartbeat` 생성 확인, `GET /graph/history/nvidia` 200 `{history: []}`.

### 다음 할 일
- `/infra` 추세 스파크라인 육안 검증은 여전히 불가 — 이력이 이제 쌓이긴 하나 **패치 2회 이상 누적돼야** 패널이 뜸. AI 업데이트 2번 돈 뒤 확인.
- 네비게이션 IA(고아 페이지 27개, CommandRail 38링크) — 유저가 보류 결정.

### 막힌 부분/결정사항
- 임계값 회귀 테스트는 상수를 하드코딩하지 않고 각 수집기 스크립트의 `*_INTERVAL_S`를 import해서 비교 — 사이클 상수가 바뀌면 테스트가 먼저 깨지게.
- `grand_total_realized_pnl`은 필드 유지 대신 삭제 선택. 소비자가 0이고, 남겨두면 다음 사람이 또 더할 footgun이라 판단.

---

## Phase 205 — 가독성/정보전달 업그레이드 (2026-08-06) ✅ SHIPPED

### 배경
- 유저 요청: "가독성과 정보 전달 최적화를 위한 시각화 및 UXUI 업그레이드".
- Phase 204 감사에서 드러난 근본 문제: 화면이 상태를 **이진(초록/빨강, running/stopped)**으로만 표시해 정도(degree)를 못 보여줌 + 같은 개념을 페이지마다 다른 말(raw key, raw enum)로 부름.

### 완료된 작업
- **슬라이스 1 — HUD 정보 위계**
  - `lib/collectors.ts` 신규: 수집기 12개의 한글 라벨·목적지 href, verdict 라벨/톤 단일 출처.
  - `components/ui/FreshnessBar.tsx` 신규: `age/stale_after` 비율을 10% 해상도 정적 클래스로 그림(`style={{}}` 금지 규칙 준수). "45초 전"과 "55분 전"이 똑같이 초록이던 문제 해결.
  - `app/hud/page.tsx`: 하드코딩 수집기 목록 삭제 → `/lab/fleet` 단일 출처 기반 자동 생성(서버에 수집기 추가돼도 프론트 수정 불필요). 로스터를 "전략"과 "수집기 함대"로 분리, verdict 기반 칩/배경/재기동버튼. 월드클락을 패널헤더 한 줄로 압축. 돈길 3칸 그리드 → 4단 스테퍼(엣지→페이퍼→ARM→LIVE).
  - `lib/api.ts` `CollectorKey` 8개 → 서버 COLLECTOR_SESSIONS와 동일한 12개.
  - 부수 수확: 이진 표시 때문에 stale 4개가 HUD에서 초록 "가동"으로 보이던 게 드러남 → 이제 "정상 11/12 · 이상 1"로 표면화.
- **슬라이스 2 — 중복 시각화 통합**
  - `components/charts/Sparkline.tsx` 신규(`invert`: 낮을수록 좋은 지표용, `stretch`: 컨테이너 폭 맞춤).
  - `app/edges/page.tsx` 로컬 `Sparkline`, `app/infra/page.tsx` `sparklinePath` 제거 후 교체. `app/performance/page.tsx`는 축·벤치마크·베이스라인 있는 정식 차트라 통합 대상 아님(그대로 둠).
- **슬라이스 3(일부) — 용어 통일**
  - `/edges`, `/polymarket` 함대 패널: raw key(`options_uoa`) → 한글 라벨, raw verdict(`stale`) → `지연`, FreshnessBar 추가. 원문 key/reason은 `title`에 보존.
  - `lib/edge-labels.ts` 신규: `gradeStyle`/`gradeLabel`/`edgeStatusLabel`이 `/edges`·`/polymarket`에 각각 복제돼 있던 것 통합. `/polymarket`이 노출하던 raw `not_significant` → `미유의`.
- **슬라이스 3 — /overview 통화 혼합 버그 + /portfolio 비중 시각화**
  - **버그**: `/overview` 총 배분이 KRW 100만 + USD 1만×2 + $100 + $10만을 통화 무시하고 더해 `1120100`을 표시. 총손익·총수익률도 동일. 배분 막대도 이 탓에 달러 배분이 0.9%로 반올림 소멸해 조각 2개만 보였음.
  - 수정: `currencyOf(market)`으로 통화별 그룹 집계 → 요약 카드가 `₩1,000,000` 행과 `$120,100` 행으로 분리. 막대도 통화별 + **범례(이름·%)** 추가 → 숨어 있던 에이전트 5개 전부 보임.
  - `AnimatedNumber`: 천단위 구분 없이 `1120100`으로 찍던 것 `toLocaleString`으로 교체. 부호를 통화기호 바깥에 찍도록(`-$2,665`, 기존이면 `$-2665`) + `signed` 프롭.
  - 독립봇 실현손익 합계: 서버 `grand_total_realized_pnl`이 KRW 에이전트 손익까지 더한 값이라 사용 중단 → 통화 안 섞인 `bots_totals`(순수 $)만 표시. `-467` → `-$389`.
  - 배분/현금/투자중처럼 부호 의미 없는 금액에 `+`가 붙던 것 `amt()`로 분리.
  - `/portfolio` 거래소별 분포 표: 비중 열에 막대 추가(숫자만으론 상대비교 느림).
  - `components/ui/Bar.tsx` 신규 — 폭 클래스 테이블이 3번째로 복제될 참이라 추출, `FreshnessBar`가 이걸 쓰도록 변경.

### 변경된 파일
- 신규: `lib/collectors.ts`, `lib/edge-labels.ts`, `components/ui/FreshnessBar.tsx`, `components/ui/Bar.tsx`, `components/charts/Sparkline.tsx`
- 수정: `app/hud/page.tsx`, `app/edges/page.tsx`, `app/polymarket/page.tsx`, `app/infra/page.tsx`, `app/overview/page.tsx`, `app/portfolio/page.tsx`, `components/Jarvis.tsx`, `lib/api.ts`, `components/ui/index.ts`

### 검증
- `npx tsc --noEmit` 통과. `npm test` **316/316**. 선행 실패 1건(`tests/lib/attention.test.ts`가 `lib/attention.ts:41` 라벨을 옛 문구로 기대)은 유저 지시대로 **라벨 유지 + 테스트 기대값 수정**으로 정리 — label/detail/href 3개 다 현재 구현에 맞춤.
- 브라우저 육안 확인: `/hud`, `/edges`, `/polymarket`, `/overview`, `/portfolio`.

### 다음 할 일
- `/infra` 병목 스코어 추세 스파크라인은 육안 검증 못 함(선택 노드 history 스냅샷 1개뿐이라 `history.length >= 2` 미충족). tsc·로직 동일성으로만 확인.

### 막힌 부분/결정사항
- `style={{}}` 금지 규칙 때문에 정도 표시는 10% 단위 정적 클래스로 양자화. 10% 해상도면 신선도·비중 판단엔 충분하다고 판단.
- `/performance` equity 차트는 스파크라인이 아니므로 통합하지 않음 — 억지로 합치면 축/라벨 옵션이 딸려 들어와 공용 컴포넌트가 비대해짐.
- 통화 혼합은 서버 `/dashboard/pnl/all`에도 있음(`grand_total_realized_pnl`). 프론트에서 안 쓰는 것으로 우회했고 서버는 안 건드림 — 다른 소비자가 있는지 미확인.

---

## Phase 204 — 대시보드 UX 감사 + 수정 (2026-08-06) ✅ SHIPPED

### 배경
- 유저가 "UXUI적으로 어떻냐" 요청 → 크롬으로 전 페이지 육안 감사, 5개 지적 → 1/4/5 우선 수정 지시, 이어서 "화면 자체 문제" 감사분까지 전부 작업 지시.

### 완료된 작업
- **차트 로딩 상태 부재**: `/market` ChartTab이 로딩 중에도 빈 상태를 그려서, `/search`에만 있는 "불러오기" 버튼을 누르라는 유령 안내를 띄움. `loading` 분기 추가 + 빈 상태에 실제 동작하는 "다시 시도" 버튼.
- **HUD 정합성 위반 행이 막다른 길**: 엔티티별 목적지 매핑(`violationHref`) 후 `<Link>` + `→` 어포던스.
- **백테스트 실행 버튼 스크롤 이탈**: 규칙 편집기가 길어 실행 버튼이 화면 밖으로. 컨트롤 행 `sticky top-0`(스크롤 조상 = `app/layout.tsx <main>`).
- **브로커 에러 원문 노출**: `[Errno 61] Connection refused` → `errorHint()`로 조치 문구 변환(원문은 `title` 속성 보존).
- **로딩 중 "계좌 없음" 오표시**: 포트폴리오는 fast(알파카/HL) → slow(KIS 30초) 2단 로드인데, 대기 구간에 KRW/USDC 섹션이 "계좌 없음"을 표시. `balancesPending` 상태로 분리.
- **맨 로더 3곳**: `/overview`, `/portfolio`, `/insider` → `LoadingState` + 소요시간 hint.
- **TimeSeries 좌하단 라이브러리 로고와 라인 겹침**: `rightPriceScale.scaleMargins`로 bottom 여백 확보(모든 TimeSeries 공통).
- API 서버 재기동(`scripts/restart_api.sh`) — 08-04 기동분이라 Phase 203 수집기 3개가 HUD에 안 보이던 것 해소. `/lab/fleet` n_total 9 → 12.

### 변경된 파일
- `components/market/ChartTab.tsx`
- `components/ui/StrategyControlPanel.tsx`
- `components/charts/TimeSeries.tsx`
- `app/hud/page.tsx`
- `app/portfolio/page.tsx`
- `app/overview/page.tsx`
- `app/insider/page.tsx`

### 다음 할 일
- 미착수 지적 2건: (a) CommandRail에 없는 고아 페이지 27개, (b) 38링크 스크롤 컬럼 + 운영자모드 이진 토글 — 네비게이션 정보구조 재설계라 별도 작업 필요.
- 수집기 staleness 임계값 재보정: `options_uoa`(3600s)는 미장 마감 후 야간마다 stale 오탐, `polymarket_implication_*`(900s)는 실제 사이클 주기보다 짧음. 임계 자체가 틀린 것이라 알람 신뢰도 깎임.

### 막힌 부분/결정사항
- `/market` 차트가 "죽었다"는 초기 진단은 오진이었음 — dev 모드 첫 페인트가 15~25초 걸린 것. 데이터 배선은 정상, 수정 범위를 로딩 상태 표시로 축소.
- lightweight-charts 로고는 제거(`attributionLogo: false`) 대신 여백 확보로 회피 — 어트리뷰션 유지.
## Phase 203 — Polymarket 함의관계 위반 모듈 라이브 전환 (2026-08-05) ✅ SHIPPED

### 배경
- 유저가 폴리마켓 고수익 트레이더(swisstony) 프로필 조사 요청(브라우저+API 리버스엔지니어링, `data-api.polymarket.com/positions`·`/activity` 엔드포인트, 지갑주소 `0x204f72f35326db932158cba6adff0b9a1da95e14` 확보) 후 "나도 이런 봇 만들고 싶다"고 요청.
- 조사 결과: 시간당 ~1000건 체결(5시간 5000건, MLB는 1.5%뿐 — 축구/테니스/e스포츠가 대부분), 보유 MLB 포지션 105건 진입가 14c~90c 전구간 고른 분포 → 마켓메이킹/상관마켓 헤지형 봇으로 판단, "인간 MLB 전문가" 서사 아님.
- 새로 설계하는 대신 이미 SDD 완료돼있던 `research/polymarket_market_implication/`(코드 완성, 라이브 미시작 상태) 재개를 제안 → 승인받음.

### 완료된 작업
- Groq `llama-3.3-70b-versatile` 모델 유효성 실호출 확인(200 OK) — deprecated 아님.
- `polymarket-implication-collect`(일 1회 페어 발굴), `polymarket-implication-watch`(시간당 위반 감시) tmux 세션 기동.
- 첫 collect 사이클 완주 확인(LLM 순차호출이라 ~15분 소요): 마켓 192개 태깅, 후보쌍 1개 발굴(Elon 트윗수 마켓 pattern_type B) → `pairs.jsonl` 기록됨.
- `scripts/deploy/ensure_collectors.sh`, `api_server/lab_api.py`(`COLLECTOR_SESSIONS`)에 두 세션 등록(desired-state + HUD 모니터링).
- `.gitignore`에 `entity_cache.json` 추가(기존 `*.jsonl` 글롭이 이 파일 미커버).

### 변경된 파일
- `seokminal-multi-venue/scripts/deploy/ensure_collectors.sh`
- `seokminal-multi-venue/api_server/lab_api.py`
- `seokminal-multi-venue/.gitignore`

### 다음 할 일
- 위반 30~50건 쌓이면 QA(정성 검토 오탐률) + 포워드 pnl N≥20 게이트부터. 미충족이면 sharp_wallet과 동일하게 paper 무기한 유지 — 표본 부족 상태에서 라이브 전환 판단 금지.
- collect가 하루 1회, `LLM_DAILY_CALL_CAP=500`(태깅+분류 합산)이라 후보쌍 축적이 느릴 수 있음 — 며칠 지나서도 쌍이 한 자릿수면 `MIN_VOLUME_USD`/후보필터 기준 재검토.

### 막힌 부분/결정사항
- 없음.

---

## Phase 202 — 카피트레이딩 자동청산 서버 루프 이전 (2026-08-04) ✅ SHIPPED

### 배경
- 유저: "카트 오토파일럿, 카피트레이딩 업그레이드로 넘어가보자" → "카피트레이딩 자동청산부터 서버 루프로 옮겨줘". 기존 자동청산이 `app/copytrade/page.tsx`의 `useEffect` 60초 폴링(브라우저 탭 열려있어야만 동작)에 의존 — DART 오토봇(`dart_autobot.py`, 브라우저 무관 서버 상시 루프)과 구조적으로 비대칭이던 갭.

### 완료된 작업
- `dart_autobot.py` 패턴(JSON config/state + JSONL 로그 + `asyncio` 백그라운드 루프 + 킬스위치 체크) 그대로 따라 `copytrade_autobot.py` 신규 작성. Alpaca `get_all_positions()`가 유일한 진실 소스라 dart봇과 달리 로컬 포지션 추적 상태는 두지 않음(단순화).
- `main.py`: `copytrade_autobot` 라우터 등록 + `@app.on_event("startup")`에 `_copytrade_bot_start()` 배선(다른 서버봇들과 동일 지점).
- 기존 수동용 `/copytrade/auto-exit` 엔드포인트는 그대로 유지(테스트/수동 트리거용), 신규 서버 루프는 `/copytrade/auto/{status,config,run-now}`로 분리.
- 프론트(`app/copytrade/page.tsx`): 자동청산 토글/익절%/손절% 를 `localStorage` 대신 서버 설정(`getCopytradeBotStatus`/`setCopytradeBotConfig`)에 연결. 브라우저 폴링으로 직접 청산 실행하던 `useEffect`(60초 인터벌) 제거 — 이제 서버 루프가 실행을 전담, 프론트는 상태 표시(마지막 실행 시각)+토글/설정+수동 "지금 적용" 버튼만.
- `lib/api.ts`에 `getCopytradeBotStatus`/`setCopytradeBotConfig`/`CopytradeBotStatus`/`CopytradeBotLog` 추가(DART 오토봇 API 패턴 그대로).
- 테스트: `tests/test_copytrade_autobot.py` 신규(TP/SL 발동·미발동·disabled 스킵 4케이스) 전부 통과. `npx tsc --noEmit` clean. `bash scripts/restart_api.sh` 후 `/copytrade/auto/status`·`/copytrade/auto/config` 실제 curl로 라이브 확인.

### 변경된 파일
- `seokminal-multi-venue/api_server/copytrade_autobot.py` (신규)
- `seokminal-multi-venue/api_server/main.py` (라우터 등록 + startup 배선)
- `seokminal-multi-venue/tests/test_copytrade_autobot.py` (신규)
- `seokminal-dashboard/lib/api.ts`, `seokminal-dashboard/app/copytrade/page.tsx`

### 다음 할 일
- 유저가 다음으로 언급한 DART 오토파일럿 개선(소급 과매수 예산 리셋 미해결 건, JSON state 마이그레이션 로직 정리)은 아직 미시작 — "카피트레이딩부터"라 순서상 다음 후보지만 유저 재확인 없이 먼저 손대지 않음.

### 막힌 부분/결정사항
- `pytest tests/ -q` 전체 실행 시 `test_alerts_api.py::test_triggered_includes_insider_convergence_signal` + `test_polymarket_sharp_wallet_bot.py` 3건 실패 확인됨 — 이번 변경(copytrade_autobot/main.py 라우터 등록)과 무관한 별개 서브시스템(내부자 컨버전스 신호, 샤프월렛 봇)이라 원인 미조사. 다음 세션에서 원인 확인 필요(라이브 데이터 의존 플레이키일 가능성).

---

## Phase 201 — UI/UX 정리 스윕: 로딩 카피·스피너·AbortController 패턴드리프트·씬페이지 감사 (2026-08-04) ✅ SHIPPED

### 배경
- 유저 "해 그러면 나머지들도 전부 다 해줘 나 잘거라서" — 이전 세션에서 조사된 UI/UX 잔여 태스크 전부 자율 실행 지시(취침). 실채팅 없이 4개 태스크(Task #3~#6) 완주.

### 완료된 작업
- **Task #3 — `/hud` 로딩 카피**: `계좌 정보 로딩 중…`이 IB Gateway 정상 응답지연(6~8초) 동안 멈춘 것처럼 보이던 문제. `(IB Gateway 응답 대기, 6~8초 정상)` 문구 추가.
- **Task #4 — cold-load 시 빈 화면 6곳에 `LoadingState` 배선**: `buyback-doctor`, `overview`, `edges`, `lab`, `orderflow` 5개 페이지에 `components/ui`의 `LoadingState` 적용. `backtest/heatmap`은 유저 트리거형(버튼 클릭 그리드서치, 이미 진행률 표시 있음)이라 대상 아님 확인 후 스킵.
- **Task #5 — AbortController 패턴드리프트 수정 (~11개 페이지)**: 프로젝트 컨벤션(abort→create→assign ref→fetch→catch AbortError→finally guard→unmount cleanup) 위반 두 유형 발견 후 수정.
  - `investment-os/page.tsx`: 공용 `useTabFetch` 훅 + 14개 호출부, 추가 raw fetch `useEffect` 2곳 — 전부 `let live` 패턴 또는 취소 전무 → AbortController로 교체.
  - `agents/page.tsx`: `GodModePanel` + 사이클/퍼포먼스 폴링 `useEffect` 2곳. **부수 발견**: 두 폴링 루프가 `let live` 가드와 무관하게 `setTimeout(poll, 5000)`을 무조건 재예약 — unmount 후 in-flight fetch가 resolve되면 cleanup의 `clearTimeout`이 잡을 수 없는 새 타이머가 재생성되는 실제 폴링 누수 버그. `if (live) ... setTimeout(...)`으로 재예약 자체를 게이팅해서 같이 수정.
  - `research-os/{graph,discovery,workflow,production,brain,timeline,intelligence-plus}/page.tsx` 7개 전부: 취소 전무(가장 심한 패턴) → 전부 AbortController로 교체.
  - `experiments/page.tsx`는 `localStorage` 동기 읽기라 네트워크 취소 대상 아님 확인 후 스킵.
- **Task #6 — 씬 콘솔 페이지 6곳 감사 (읽기전용)**: `exec/orders`, `council/{logs,agents,decisions}`, `portfolio-os/{positions,risk}` — 형제 페이지 대비 28~41줄로 짧아 미완성 의심됐으나, 전부 `useConsole` + 실제 fetch + `StateBlock` 로딩/에러/빈상태 처리 확인. 하드코딩·TODO 없음 — **의도된 미니멀 상태뷰, 수정 불필요.**
- `npx tsc --noEmit` clean (Task #4, #5 각각 재검증).

### 변경된 파일
- `app/hud/page.tsx`
- `app/buyback-doctor/page.tsx`, `app/overview/page.tsx`, `app/edges/page.tsx`, `app/lab/page.tsx`, `app/orderflow/page.tsx`
- `app/(console)/investment-os/page.tsx`, `app/agents/page.tsx`
- `app/(console)/research-os/{graph,discovery,workflow,production,brain,timeline,intelligence-plus}/page.tsx`

### 다음 할 일
- 없음 — Task #3~#6 전부 완료.
- **보류 (유저 확인 필요, 자율 진행 범위 제외)**: `/hud`(레거시 Tailwind 토큰) vs `research-os`(CSS 변수 `var(--c-*)`) 시각언어 이원화 — 디자인 결정 필요, 유저 복귀 후 직접 지시 없이는 손대지 않음.

### 막힌 부분/결정사항
- 없음.

---

## Phase 200 — 샤프월렛 봇 시각화 + 배치실행 체감시간 + 승격 라벨 정정 (2026-08-04) ✅ SHIPPED

### 배경
- 유저 3건 동시 제기: (1) 샤프월렛 봇 진행상황 시각화 페이지 없음, (2) 홈 "리서치 후보" 배치실행 눌러도 안 도는 것처럼 보임, (3) "승격" 알림 클릭해도 뭔지 모르겠음. 유저 실채팅 없이 자율 진행(직전 세션 3건 백그라운드 조사 리포트 기반).

### 완료된 작업
- **(2) 배치실행 "안 돌아가는" 체감 버그 — 근본원인 확정**: `curl --max-time 60`으로 실측 — 실제론 78초 걸리는 동기 연산(BH-FDR + permutation test n=300)인데 프론트에 진행 표시가 전혀 없어서 죽은 것처럼 보였음. `lab_api.py` docstring도 "수초 내 완료"라고 잘못 적혀 있어서 애초에 타임아웃/진행표시가 안 붙어 있었던 원인. 수정: `AutoResearchPanel.tsx`에 실행 중 경과초 카운터 + "(보통 1~2분)" 안내 추가, `busy:true` 응답 시 이전 결과를 새 결과처럼 덮어쓰지 않고 "이미 다른 배치가 실행 중" 메시지로 명시. docstring도 실측값으로 정정.
  - 부가 확인: 이 배치가 도는 동안 uvicorn 단일 워커가 막혀 `/investment-os` 등 무관한 페이지 API 호출도 같이 pending 되는 것 브라우저 네트워크 탭에서 직접 확인 — "동기 78초 연산이 이벤트루프 블록" 진단이 다른 페이지에서도 재확인됨.
- **(1) 샤프월렛 봇 시각화**: `app/polymarket/page.tsx`에 기존 `polymarket_bot` UI 패턴(토글/지금실행/지출·PnL 스트립/누적PnL 차트/포지션 테이블/실행로그) 그대로 재사용해 `#sharp-wallet-bot` 섹션 신규 추가. 요약 배지를 그 섹션으로 점프하는 앵커링크로 변경. `lib/api.ts`에 `SharpWalletPosition` 타입 추가(`unknown[]` 대체).
- **(3) "승격" 라벨 모호함 정정**: `investment-os` 페이지는 URL로 탭 상태 안 됨(`useSearchParams` 없어서 항상 개요 탭으로 랜딩, "승격" 단어는 운영 탭에만 있었음) → `app/insider/page.tsx`에서 쓰던 `Suspense`+`useSearchParams` 패턴 이식, `?tab=ops` 딥링크 동작하게 함. `lib/attention.ts`의 `ladder-gate` 항목 라벨/설명 문구를 "자문용 — 실제 실행/전략 변경 없음"으로 명확화하고 href를 `/investment-os?tab=ops`로 변경. 운영 탭 사다리 패널에 이 사다리는 포트폴리오 전체 자문용 시뮬레이션이고, 실제 전략을 페이퍼로 올리는 진짜 승격은 Auto-Research의 "🚀 페이퍼로 올리기" 버튼이라는 설명 문구 + 링크 추가.
- `npx tsc --noEmit` clean. 브라우저로 3개 페이지 전부 라이브 검증(아래 참고).

### 변경된 파일
- `seokminal-multi-venue/api_server/lab_api.py` (docstring)
- `components/AutoResearchPanel.tsx`
- `lib/api.ts`
- `app/polymarket/page.tsx`
- `app/(console)/investment-os/page.tsx`
- `lib/attention.ts`

### 브라우저 검증
- `/polymarket` → 요약 배지 "→ 상세" 클릭 시 `#sharp-wallet-bot`로 정상 점프, 실데이터(실현손익 $-376, 최근 정산 14건, 봇 실행 로그)로 섹션 렌더 확인.
- `/auto-research` → "▶ 배치 실행" 클릭 시 버튼 라벨이 "실행중... 0s → 5s (보통 1~2분)"로 실시간 틱 확인. 배치 자체는 정상 완료(`status.json`: n_candidates 3).
- `/investment-os?tab=ops` → 운영 탭으로 바로 랜딩 확인, 신규 설명 문구 + Auto-Research 링크 렌더 확인.

### 다음 할 일
- 없음 — 3건 모두 완료.

### 막힌 부분/결정사항
- 없음.

---

## Phase 199 — 인사이더 컨버전스 스코어링 최종 리뷰 + 픽스 라운드 (2026-08-03) ✅ SHIPPED

### 배경
- `docs/superpowers/plans/2026-08-03-insider-convergence-scoring.md`(7-task, backend repo에 위치) SDD 실행 마무리 세션. 구현 자체는 전 세션 완료 — 이번엔 Task 7 수동검증 블로커 해소 + 최종 전체-브랜치 리뷰 + 픽스. 유저 실채팅 없이 자율 진행.

### 완료된 작업
- **버그 근본원인 확정 + 수정 (commit `13fc5d1`)**: `AlertPoller.tsx` `setInterval` 폴링에 in-flight guard 없어 겹친 `/alerts/triggered` 요청이 Chrome 호스트당 6-커넥션 한도를 다 잡아먹음 → `/insider/convergence?market=us`가 클라이언트에서 큐잉된 채 백엔드에 도달도 못 해 US 컨버전스 탭이 영구 "pending"으로 보였던 버그. `inFlight` ref 가드로 해결.
- **최종 전체-브랜치 리뷰(opus) findings 중 프론트 2건 수정 (commit `6db22b5`)**:
  - HIGH: `app/insider/page.tsx` — `/insider?tab=convergence` 토스트 딥링크가 이미 `/insider`에 있을 때 소프트 네비게이션이라 탭 전환 안 됨 → `searchParams` 감시 `useEffect` 추가.
  - MEDIUM: `AlertPoller.tsx`의 `inFlight` 가드에 타임아웃 없어 응답 없는 fetch 하나가 폴링 영구 마비 가능 → `getTriggeredAlerts(AbortSignal.timeout(POLL_MS))`.
  - (백엔드 3건은 `seokminal-multi-venue/docs/progress.md` 참조, commits `2d0e360`/`7634f56`)
- `npx tsc --noEmit` clean(두 라운드 다 재검증).

### 변경된 파일
- `components/AlertPoller.tsx`, `app/insider/page.tsx`

### 다음 할 일
- [x] 컨버전스 탭이 실제 알림(🔥 컨버전스 toast → 클릭)에서 정상 전환되는지 브라우저 재확인 — **완료, 아래 참고.**
- 이 프로젝트는 "main 직접 커밋" 컨벤션 — 별도 머지/PR 없음, 이미 완료 상태.

### 막힌 부분/결정사항
- 없음.

### 추가: 딥링크 클릭 브라우저 재검증 (같은 세션, 계속)

유저 지시("브라우저로 컨버전스 딥링크 클릭 재확인해줘"). 백엔드 uvicorn이 이번 세션 커밋(`2d0e360`/`7634f56`) 이전부터 떠있어 구버전 코드로 응답 중이었던 걸 발견 → `scripts/restart_api.sh`로 재기동 후 재검증(상세는 backend `docs/progress.md` 참조).

- 토스트가 8초 안에 사라져 스크린샷으로 못 잡아서, 브라우저에 `MutationObserver`를 심어 토스트 DOM 삽입 즉시 딥링크(`a[href*="tab=convergence"]`)를 자동 클릭하도록 우회.
- 클릭 후 URL이 `/insider?tab=convergence`로 전환되고 컨버전스 탭 버튼이 active 클래스(`border-accent bg-accent text-black`)로 바뀌는 것까지 확인 — `app/insider/page.tsx`의 `useEffect` searchParams 동기화 fix 라이브 동작 확정.

### 다음 세션 확인 (추가)
- 없음 — 이 플랜(2026-08-03-insider-convergence-scoring) SDD 사이클 전체 완료.

---

## Phase 198 — report-lag 프론트 연동 + search_company DART API 오용 버그 수정 (2026-08-03) ✅ SHIPPED

### 배경
- Phase 197에서 만든 `get_report_lag_days()`/`/insider/kr/report-lag` 엔드포인트를 프론트에 연동("프론트에도 report-lag 연동해줘").
- 브라우저 검증 중 KR 회사검색이 항상 빈 결과 반환하는 별개의 기존 버그 발견 → 유저 지시("지금 고치고 report-lag 브라우저 확인부터 마저")로 같이 수정.

### 발견한 버그: `search_company()` DART `company.json` 오용
- `company.json`은 **corp_code 단건조회 전용** API — `corp_name`을 검색 파라미터로 줘도 먹지 않아 항상 빈 결과. 공식 이름검색 방법은 `corpCode.xml`(전체 상장사 zip) 받아서 로컬 필터링뿐.
- 수정: `_get_corp_list()` 신규(24h 메모리 캐시, `kr_universe.client`와 동일 double-checked-locking 컨벤션) + `search_company()`가 이걸 이름 부분일치+상장사(`stock_code` 有)만 필터하도록 교체.
- corpCode.xml 최초(캐시 미스) 다운로드가 sandbox 네트워크 스로틀로 165초 걸림(코드 문제 아님, 환경 문제) — 이후 캐시 히트는 즉시.

### 완료된 작업
1. **프론트 report-lag 연동**: `app/insider/page.tsx`의 `KRTable`에 행별 "확인" 버튼 — 클릭 시 `rcept_no` 기준 지연일수 조회, `Map<rcept_no, AbortController>`로 행별 abort→create→fetch→catch AbortError→unmount cleanup 패턴 적용. `lib/api.ts`에 `getInsiderKRReportLag()` + `ReportLag` 인터페이스 추가.
2. **search_company 버그 수정**: `insider/dart_client.py` — 위 내용. 테스트 3건 신규(`tests/test_dart_client.py`, 총 21/21 pass).
3. **브라우저 실동작 검증**: KR탭→"삼성전자" 검색(정상 결과 뜸)→선택→개별거래 테이블(765건) 로드→"확인" 클릭→"6일" 지연값 정상 렌더 확인.

### 변경된 파일
- 수정: `seokminal-multi-venue/insider/dart_client.py`(`search_company()` 재작성, `_get_corp_list()` 신규)
- 수정: `seokminal-multi-venue/tests/test_dart_client.py`(+3 tests)
- 수정: `seokminal-dashboard/app/insider/page.tsx`(`KRTable` report-lag UI), `lib/api.ts`(`getInsiderKRReportLag`)

### 커밋
- 백엔드 `52920b6`: search_company 버그 수정
- 프론트 `c6e2f7e`: report-lag UI 연동

### 다음 할 일
- 없음 — 이번 세션 요청 범위(report-lag 프론트 연동 + 발견된 회사검색 버그) 전부 완료·커밋됨.

---

## Phase 197 — DART 공시지연 실측 + elestock/list.json 리포트코드 버그 수정 (2026-08-03) ✅ SHIPPED

### 배경
- 유저가 공유한 OpenPlanter 깃헙(카피트레이딩용?) 검토 요청 → OSINT/지식그래프 데스크톱 GUI로 매매실행과 무관, 5개월 방치, 단일기여자 → 카피트레이딩 부적합 판정, 채택 안 함.
- 유저 정정: "카피트레이딩 아니라 내부거래자 매매(DART insider)임. 공시 지연 얼마나 되는지부터 확인해줘."

### 발견한 버그 3건 (전부 근본원인 추적 후 수정)
1. **`elestock.json`이 `bgn_de`/`end_de`/`page_no`/`page_count` 파라미터 자체를 무시**하고 항상 전체 이력 반환 — curl로 1999년 불가능 범위 줘도 2024+ 전체 데이터 나옴으로 증명. `get_executive_stock_changes()`에 클라이언트 post-filter 추가로 수정.
2. `elestock.json` 요약 API엔 실거래일 필드가 없음(`rcept_dt`=접수일만). 원본 `document.xml`의 "세부변동내역" 표 `AUNIT="MDF_DM"`(결제일 기준 변동일)을 직접 파싱하는 `get_report_lag_days()` 신규 구현.
3. **리포트코드 오분류**: `list.json` 조회에 `pblntf_ty=B`/`pblntf_detail_ty=B001`을 썼는데 이건 "주요사항보고서"(CB발행·증자결정 등)이지 임원·주요주주 소유상황보고서가 아님. 올바른 코드는 `D`/`D002`. 이 버그 때문에 최초 8건 실측이 전부 0건으로 나왔음 — 실측 스크립트 + `dart_client.py`의 `get_recent_kr_insider_feed()`(운영 코드, `/insider` 실피드가 씀) 둘 다 D002로 수정. (`get_recent_kr_corporate_actions()`는 원래 주요사항보고서를 찾는 용도라 B001 그대로 맞음, 안 건드림.)

### 실측 결과 (D002 수정 후 30건 샘플)
```
n=80  평균=24.0일  중앙값=1.0일  최대=1552일  법정기한(5영업일) 초과=10건 (12%)
(원문 오기로 보이는 음수 lag 3건 제외: [-1460, -3, -4])
```
중앙값 1일이 실질 대표값(대부분 결제일 익일 공시), 평균은 꼬리 이상치(리파인 1552일 등)에 왜곡됨. 법정기한 초과 12%는 실제 위반 사례. 음수 lag는 원문 XML 직접 대조로 확인한 신고자측 데이터 오기(연도 오타 등)로 판명, 우리쪽 파싱 버그 아님.

### 잡은 환경 이슈
- sandbox 네트워크 심한 스로틀링(문서당 45-60초+) — 30건 순차 다운로드에 20분+ 소요, `run_in_background`+`ScheduleWakeup`으로 대응.
- `dotenv.load_dotenv()`가 `python3 - <<EOF` 스틴/heredoc 실행시 `AssertionError: assert frame.f_back is not None`로 죽음(`find_dotenv()`가 콜스택 프레임 워킹 실패) — 실제 `.py` 파일로 작성해 실행하면 회피됨. 향후 원샷 디버그 스크립트는 heredoc 말고 파일로 작성할 것.

### 변경된 파일
- 수정: `seokminal-multi-venue/insider/dart_client.py`(post-filter, `get_report_lag_days()` 신규, `get_recent_kr_insider_feed()` D002 수정)
- 신규: `seokminal-multi-venue/tests/test_dart_client.py`(3 tests, 전체 16/16 pass)
- 신규: `seokminal-multi-venue/research/measure_dart_disclosure_lag.py`(실측 스크립트)

### 다음 할 일
- 없음 — 유저 원 질문("공시지연 얼마나 되는지") 답변 완료. `get_report_lag_days()`를 프로덕션 API/프론트에 노출할지는 미결정, 유저가 명시 요청 전엔 안 함.
- git commit 안 함(유저 명시 요청 없음).

---

## Phase 196 — 토스트 UX 개선 + 옵션 UOA(비정상 옵션거래량) 신규 leg on /insider (Alpaca) (2026-08-02) ✅ SHIPPED

### 배경
- sharp_wallet 봇 알림 토스트가 실제로 뜨는지(디버그 트리거 아닌 진짜 30초 폴링 사이클) 콘솔 로그 타이밍으로 검증 완료 — 파이프라인 정상, 이전 "토스트 안 뜸" 관찰은 스크린샷 타이밍 미스일 뿐 실버그 아니었음.
- 유저 피드백: "팝업 정보가 불친절함. 무슨 알람인지·어떤 액션인지·해당 대시보드로 넘어가는 버튼 필요" → 토스트 UX 개선.
- 유저 질문: "만기 짧은 콜/풋에 대량매매 = 인사이더 트레이딩 참고 가능?" → UOA(Unusual Options Activity) 학계·SEC/FINRA 실사용 근거 있음, 단독 알파로는 노이즈 큼·상업적으로 포화 → 기존 `/insider` 멀티시그널 컨버전스 프레임(DART/congress/gov-contracts/EDGAR Form4/Finnhub)에 새 leg로 편입 제안 → 유저 승인, 단 **"ib는 채택하지말고 alpaca로"** 명시 제약.

### 완료된 작업
1. **토스트 UX**: 제목/본문 분리(`\n` + `whitespace-pre-line`) + 클릭시 관련 대시보드로 이동하는 링크 버튼(`bot_id` 프리픽스로 `/polymarket`·`/mlb`·`/agents` 라우팅).
2. **옵션 UOA 백엔드(Alpaca)**: `insider/options_uoa_client.py` 신규 — 만기≤14일+OTM≥10%+Vol/OI≥3x 콘트랙트만 스캔·플래그. `GET /insider/options-uoa` 신규(명시 티커 or 다른 insider leg가 이미 플래그한 티커 자동조회). 5개 pytest 신규(총 13/13 pass). 라이브 curl로 명시/자동 두 모드 다 검증.
3. **프론트 옵션 UOA 탭**: `lib/api.ts`에 `getOptionsUOA()`, `app/insider/page.tsx`에 "🎯 옵션 UOA" 탭 신설(상태/fetch/AbortController/검색행/테이블 전부 wiring). `npx tsc --noEmit` clean. 브라우저 실동작 검증(자동조회 30건 + AAPL 명시조회 둘 다 실데이터 정상 렌더).

### 디버깅 중 잡은 실버그 2건 (Alpaca SDK)
- `get_option_chain`의 `OptionsSnapshot`엔 이 SDK 버전에서 `daily_bar`(거래량) 필드 자체가 없음 → `get_option_bars`(Day timeframe, 배치조회)로 전환.
- `BarSet`은 `__contains__` 없어서 `sym in bars`가 항상 `False` → `bars.data.get(sym, [])`로 직접 dict 조회해야 함. 문서화 안 된 SDK 갭, 후속 확장시 기억할 것.

### 변경된 파일
- 신규: `seokminal-multi-venue/insider/options_uoa_client.py`
- 수정: `seokminal-dashboard/lib/toast.ts`, `components/ui/ToastContainer.tsx`, `components/AlertPoller.tsx`, `lib/api.ts`, `app/insider/page.tsx`
- 수정: `seokminal-multi-venue/api_server/main.py`(import + `OptionsUOA` 모델 + 엔드포인트), `tests/test_insider.py`(+5 tests)

### 다음 할 일
- 없음 — 이번 세션 요청 범위(토스트 UX + 옵션 UOA Alpaca leg) 전부 완료·검증됨.
- (참고) IB는 이 기능에서 명시적으로 배제됨 — 향후 옵션 데이터 관련 작업에서 재검토하지 말 것.

---

## Phase 195 — 홈/네비 단순화 1단계: /hud "판단 필요" 큐 + Operator 나브 모드 (2026-08-01) ✅ SHIPPED

유저: "플랫폼이 심플하지 않다" — 리서치/시스템 잡다한 상태를 사람이 매번 확인하는 대시보드가 되어버렸다는 피드백. `/hud`와 `/command` 두 개의 경쟁하는 홈페이지, `CommandRail` 나브 9그룹/54항목 헤더 항상노출이 원인으로 지목됨. 2단계 중 1단계(IA/UX, 페이지 삭제 없음)만 진행 — "1+3으로 가자"(홈 통합+판단필요 큐 + 나브 Operator 토글)로 접근 확정, 브레인스토밍→스펙(`docs/superpowers/specs/2026-08-01-home-nav-simplification-design.md`)→플랜(`docs/superpowers/plans/2026-08-01-home-nav-simplification.md`)→subagent-driven-development 4태스크 실행+각 태스크 리뷰+최종 브랜치 리뷰까지 전부 완료.

### 구현
- `lib/attention.ts`: `deriveAttentionItems()` 순수함수 — pipeline 제안대기/risk BLOCK/investment-os 승격게이트/리서치 후보 4개 신호를 "판단 필요" 카드로 변환. 백엔드 변경 없음, 기존 `/console/*` 엔드포인트만 소비.
- `/hud`에 "판단 필요" Panel 신설, `/command`(Command Center) 폐기·삭제 — `/hud`가 유일한 홈페이지로 흡수. 나브 브랜드/홈 링크 전부 `/hud`로 재조준, `lib/research-os.ts`·`intel/research-os/page.tsx`의 `/command` 폴백 6곳도 정리.
- `CommandRail.tsx`에 Operator 모드 토글 추가 — 기본값 켜짐, 9그룹 중 3그룹(트레이딩 데스크/봇·에이전트/Research·모니터링)만 노출, "전체보기"로 해제. `CommandPalette` 검색은 필터와 무관하게 전체 54항목 계속 도달 가능(숨긴 게 아니라 접은 것).

### 최종 브랜치 리뷰에서 잡힌 이슈 (전부 수정)
- `/hud`의 신규 fetch 3개(pipeline/risk/investment-os)가 원래 4초 폴링 루프에 있었음 — `investment-os`가 매 호출 220ms(백엔드가 소스트리 전체 `ast.parse` 재실행) 걸려서 상시 열린 홈페이지에서 발열 리스크. 30초 느린 루프(잔액 폴링과 동일 주기)로 이동.
- "전부 정상" 0상태 문구가 유닛다운 상태를 커버 안 하는데 시스템 전체 정상인 것처럼 읽혀서 "판단 대기 항목 없음"으로 스코프 좁힘.
- `트레이딩 데스크` 그룹 내부에 남아있던 구식 `/hud` 항목이 신규 최상단 "홈" 링크와 중복 노출 — 제거.
- `docs/CONSOLE.md`의 삭제된 `/command` 라우트 표 행 정리.

### 컨트롤러가 판단하고 안 고친 것 (판단만 하고 넘어감)
- "승격 대기" 카드 조건에 백엔드 상수(`human_approval_mandatory`, 영구 True)가 껴 있어 AND절이 사실상 죽은 코드 — 그래도 `gates.passed` 자체는 진짜 변동 신호라 카드가 계속 뜨는 게 버그는 아님, 안 고침.
- 스펙엔 있었지만 플랜에서 빠진 "참고 섹션"(regime/council 격하 표시) — 실질 손실은 posture 패널 하나뿐(council/status는 다른 경로로 이미 살아있음), 유저의 원래 목표(정보량 줄이기)에 부합해서 재구현 안 하기로 판단.

### 변경된 파일
- 신규: `lib/attention.ts`, `tests/lib/attention.test.ts`, `tests/lib/commandRailGroups.test.ts`
- 수정: `app/hud/page.tsx`, `components/console/CommandRail.tsx`, `lib/research-os.ts`, `app/(console)/intel/research-os/page.tsx`, `docs/CONSOLE.md`
- 삭제: `app/(console)/command/page.tsx`

### 다음 할 일
- 2단계(Approach B, 실제 페이지 삭제)는 유저가 명시적으로 요청할 때까지 시작 안 함.
- 검증: `npx tsc --noEmit` clean, `npm test` 316/316 pass (28 files).

---

## Phase 194 — 플랫폼 압축 아이데이션(Track C 레거시 감사) + 네이밍 충돌 정리 + 워치리스트 라이브가 버그 수정 (2026-07-31) ✅ SHIPPED

유저: "플랫폼 너무 방대해, 필요없는 기능 쳐내고 압축하고 싶다" 아이데이션 요청 → 4트랙 제시 후 유저가 Track C(레거시 `TERMINAL_GROUPS` 45페이지에 기존 `dashboard_migration_map.md` 감사방법론 적용) 선택. 유저가 "os랑 레거시랑 겹치는 게 아무것도 없다고?"로 내 성급한 결론 지적 → 백엔드 소스까지 재검증. "둘 다 해줘"→"ㅇㅇ 진행해"로 리네임 3건 확정·실행.

### Track C — 레거시 45페이지 감사 (5개 클러스터 병렬 에이전트)
- 결론: 레거시 레이어 내부 중복 거의 없음 — 겹쳐 보이는 페이지들은 전부 "teaser→canonical drill-down" 패턴(예: `hud`(1줄 요약)→`overview`(작은 티저 스트립)→`lab/execution`(전체 상세)), `research-os` 유지 페이지들과 동일한 정당한 패턴.
- OS(console)↔레거시 교차 중복도 최종 확인 결과 거의 없음 — 설계상 분리(OS=페이퍼/거버넌스 트랙, `jarvis.paper_execution.ledger` 기반; 레거시=실제 브로커 라이브 트랙, Alpaca/KIS/HL 직결)임을 `api_server/console_api.py` `/console/positions`·`/console/orders` docstring으로 확인. 처음엔 스팟체크 2~3쌍만 보고 "안 겹침" 단정했다가 유저 지적으로 재검증, 결론 자체는 유지됐지만 근거 보강.
- 진짜 충돌은 코드/라벨 레벨 네이밍 뿐: `/overview` nav라벨 "개요" ↔ investment-os 내부 탭 "개요"(완전 다른 내용), `/validation` "검증 터미널" ↔ console 쪽 `getValidation`/`getValidationLoop`(3-way 이름 혼동), `lib/experiment-storage.ts`와 `lib/api.ts`에 동명 함수 `getExperiments`(무관한 기능, dev 레벨 충돌).

### 실행한 리네임 3건
- `/overview` nav라벨 "개요"→"AI 자본 개요"
- `/validation` nav라벨+h1 "검증 터미널"→"리서치 실험 로그", `app/ict/page.tsx` back-link 텍스트도 동기화
- `lib/experiment-storage.ts`의 `getExperiments`→`getSavedRuns`(호출부 4곳 + `app/experiments/page.tsx` + 테스트 8곳 전부 갱신)
- 검증: `npx tsc --noEmit` clean, `npx vitest run tests/lib/experiment-storage.test.ts` 10/10 pass.

### 이전 세션에서 밀려있던 미커밋 작업도 같이 커밋
- `WatchlistSidebar.tsx`: 라이브가 고정버그 수정 — parquet 카탈로그(`getBars`, 최초 적재 후 갱신 안 됨) 대신 venue별 라우팅 `fetchBarsForSymbol` 사용 + 60초 폴링.
- `/market`에 뉴스·캘린더 탭 흡수, `CommandRail` 최상위 nav 중복 제거.
- `PaperPosition`에 `current_price`/`market_value`/`unrealized_pnl` 추가, `app/infra` 포지션 테이블·헤더에 미실현P&L 표시.

### 변경된 파일
- `components/console/CommandRail.tsx`, `app/validation/page.tsx`, `app/ict/page.tsx`, `lib/experiment-storage.ts`, `app/experiments/page.tsx`, `tests/lib/experiment-storage.test.ts`
- `components/market/WatchlistSidebar.tsx`, `app/market/page.tsx`, `lib/api.ts`, `app/infra/page.tsx`

### 다음 할 일 (제안만 함, 유저 승인 대기 — 진행 안 함)
- ~~`app/ib/page.tsx` 삭제~~ → 2026-08-01 Phase 196에서 실행
- `research-os` 고아 4개(`market`/`intelligence`/`live-intelligence`/`organization`) 삭제 — 전부 참조 0건 grep 확인
- `intel/research-os`(432줄 허브) → `investment-os` Research Evidence 탭으로 리다이렉트, `dashboard_migration_map.md`의 "deprecated, 리다이렉트 대기" 분류 그대로. 이거 하면 `intelligence-plus`도 참조 끊겨서 삭제 가능해짐.

---

## Phase 196 — 2단계(Approach B) 착수: `app/ib/page.tsx` 삭제 (2026-08-01) ✅ SHIPPED

Phase 194에서 나온 삭제 후보 중 1번(`app/ib/page.tsx`, 고아 페이지, `getIBBars`와 기능 중복) 유저 승인 → 삭제 실행. 참조 0건 재확인(grep) 후 `git rm`, `npx tsc --noEmit` clean.

### 다음 할 일
- 나머지 2단계 후보(research-os 고아 4개, intel/research-os 리다이렉트)는 유저 승인 대기.

---

## Phase 193 — research-os "리서치 실행" 목표 무시 버그 수정 + 5페이지 UX 개편 (2026-07-31) ✅ SHIPPED

유저: research-os `agents` 페이지 목표 입력→"리서치 실행" 흐름 검증 요청. 입력 전달은 되는데 백엔드 가설생성 로직이 타이핑한 목표를 무시하는 버그 발견, 보고. `agents`/`workflow` 페이지 먼저 디자인 개편 제안 → 유저 "응 바로 작업 진행해줘 너가 말한 두개 전부"(백엔드 수정 + `committee`/`discovery`/`chat` 나머지 페이지도 같은 개편) 승인.

### 백엔드 — HypothesisGenerator topic 무시 버그
- `jarvis/research_workflow/hypothesis_generator.py`의 `HypothesisGenerator.generate(topic, ...)`가 `topic` 인자를 아예 안 씀 — 뭘 입력하든 `ResearchQueueEngine`(목표무관 전역 백로그, [[project_gamma_api_100cap_bug]] 관련 콜렉터들과 별개 트랙)이 낸 후보만 그대로 반환.
- **fix**: `research_queue.py`(목표무관 전역 엔진, 안 건드림)는 그대로 두고 `HypothesisGenerator` 안에서만 결정적 토큰겹침 재정렬 추가 — `_topic_tokens()`(정규식 `[^a-z0-9가-힣]+`, 한글/영문 둘 다), `_relevance()`로 큐 후보 재정렬. topic 토큰이 백로그 후보와 하나도 안 겹치면 topic 자체를 `_from_topic()`으로 1순위 가설 합성(LOW confidence, 사람검토 필수) — "결정적, LLM/랜덤 없음" 원칙 유지하면서 목표 반영 항상 보장.
- 검증: 3개 토픽(한글/무의미한글/영문겹침) 단위 스모크테스트, `pytest tests/ -q -k "hypothesis or research_workflow or research_director or research_queue or console_api"` 36 passed, `scripts/restart_api.sh` 재기동 후 curl로 실제 `/console/agent-workspace` 파이프라인 전체(한글 목표 입력→토픽 반영 가설) 라이브 확인.

### 프론트 — research-os 5페이지 UX 통일 개편
- `agents`/`workflow`/`committee`/`discovery`/`chat` 5개 페이지 전부: hero 입력박스(`Panel hud`) + 예시 칩(EXAMPLES) + 로딩 스피너·상태문구 + 설명 캡션 패턴으로 통일. `chat`만 대화형 UX 보존 위해 hero박스 없이 기존 인라인폼 확대+예시칩만 추가하는 경량 처리.
- 콘솔 CSS-var 디자인시스템(`var(--c-hud)` 등, `components/console/primitives.tsx`+`widgets.tsx`) 안에서만 작업 — Tailwind 토큰 레거시 시스템은 안 건드림.
- 검증: `tsc --noEmit` clean(전체), 브라우저로 5페이지 전부 라이브 확인(`committee`/`chat`은 예시칩 클릭→백엔드 실데이터 렌더까지 end-to-end, `discovery`는 최초 로딩스피너를 결과렌더로 착각했었으나 재확인 결과 정상 렌더+콘솔에러 없음 확정).

### 변경된 파일
- `seokminal-multi-venue/jarvis/research_workflow/hypothesis_generator.py`
- `seokminal-dashboard/app/(console)/research-os/agents/page.tsx`
- `seokminal-dashboard/app/(console)/research-os/workflow/page.tsx`
- `seokminal-dashboard/app/(console)/research-os/committee/page.tsx`
- `seokminal-dashboard/app/(console)/research-os/discovery/page.tsx`
- `seokminal-dashboard/app/(console)/research-os/chat/page.tsx`

### 다음 할 일
- 없음, 이번 트랙 종료. 다음은 별건(오더플로우 저널 30건 채우기 등 기존 트랙 계속).

---

## Phase 192 — Investment OS Phase 5 : 아키텍처 분리 회귀 수정 + Prediction Registry Integrity 정리 (2026-07-29~31) ✅ SHIPPED

유저: Phase 5 운영검증 중 `separated: false` 회귀 발견 → 근본원인 수정. 이어서 P5(committee-source prediction 5건) capture 오염 상태 정리 지시(Phase 5-F, 전문 스펙 제공) — "신규 기능 개발 아님, 과거 기록 보존하며 registry 상태만 명확히". 절대원칙: 기존 prediction row 삭제/수정 금지, 상태 변경만 append-only.

### Phase 5(5-A~E) 아키텍처 분리 회귀 수정
- `jarvis/investment_os/monthly_review.py`가 `jarvis.execution_risk.ledger`를 import해서 `separation.py`의 `_BROKER_PREFIX` 체크에 걸림(`separated: false`) — import 제거로 해결(`risk_changes`에서 `recent_execution_risk_events` 필드도 같이 제거).
- 전체 회귀 재검증 후 4커밋(멀티벤뉴 2 + 대시보드 2)로 마감, P6로 문서화.

### Phase 5-F — Prediction Registry Integrity Resolution
- **Step1 감사**: P5 committee-source prediction 5건 전부 동일 근본원인(Phase5 P1-P3 capture 버그 — 이미 수정됨) — `thesis`가 committee 라우팅 라벨 그대로 저장, `invalidation_condition`은 문자열 리터럴 `"return"`, `evidence_used`는 dict key 이름 그대로. `evaluation_framework`/`success_rule`/`snapshot_hash`는 `derive_framework()`가 thesis와 무관하게 결정적으로 동작해서 오염 안 됨 — "해시 유효 ≠ 내용 신뢰 가능" 구분.
- **Step2 결정**: 전부 `INVALIDATED`(`capture_integrity_failure`). RECAPTURED는 검토 후 기각 — `committee_packet()`이 저장된 스냅샷이 아니라 라이브 계산이라, 지금 재실행해서 만든 thesis는 사후 조작이 됨(사전등록 무결성 원칙 스스로 위반). INVALIDATED ≠ WRONG(예측 실패 아님, 기록 품질 문제).
- **Step3 게이트**: `prediction_registry.py`에 3번째 직교 축 `INTEGRITY_STATUSES`(LEGACY_CAPTURE/INVALIDATED/RECAPTURED) 신규 — `set_integrity_status()`(append-only, 원본 스냅샷 불변), `graded_predictions()`가 기본적으로 score-ineligible 제외, `registry_status()`에 `by_integrity`/`excluded_from_score_capture_integrity` 추가. 기존 `rmi_lessons.jsonl` 원장 재사용(신규 원장 없음).
- **Step4 대시보드**: `monthly_review.py`에 `_prediction_integrity()` 추가(read-only, `registry_status()` 재사용) → `/console/monthly-review`에 `prediction_integrity` 필드. 프론트 `lib/console-api.ts` 타입 추가 + `investment-os/page.tsx` Monthly Decision Loop 패널에 Valid/Legacy/Invalidated/Recapture Required 카운트 표시. 브라우저 확인: Valid 0 / Legacy 0 / Invalidated 5 / Recapture 0, 기존 5전략 상태 그대로.
- **Step5 Freeze**: registry 흐름 확정 — `CAPTURE→ACTIVE→EVALUATED→LEARNED` 또는 `CAPTURE→INVALIDATED`. Integrity 축은 직교/append-only.
- 검증: 5건 `snapshot_hash` byte-identical 전/후, 원본 row 필드 무수정, `pytest tests/ -q` 2033 passed, `governance.validate_all()` COMPLIANT, `validate_separation()` True, `npx tsc --noEmit` clean.
- 신규 생성 안 함(명시적 금지): prediction engine·scoring engine·auto generator·AI researcher·새 ledger/DB·새 dashboard architecture.

### 변경된 파일
- `jarvis/investment_os/monthly_review.py`(separation 회귀 수정 + `_prediction_integrity()`)
- `jarvis/research_workflow/prediction_registry.py`(`INTEGRITY_STATUSES`, `set_integrity_status()`, `_latest_integrity()`, `graded_predictions()`/`registry_status()` 게이트 배선)
- `seokminal-dashboard/docs/step5/phase5f_prediction_integrity_audit.md`(신규, 감사 리포트)
- `seokminal-dashboard/lib/console-api.ts`(`MonthlyReviewResp.prediction_integrity` 타입)
- `seokminal-dashboard/app/(console)/investment-os/page.tsx`(Prediction Integrity 카운트 UI)

### 다음 할 일
- 이 5건은 `state=PENDING`이라 오늘 시점 `scorable_right_wrong`엔 영향 없음 — 향후 `evaluate()` 호출 시 게이트가 실제로 채점 제외하는지 재확인 필요.
- Investment OS Phase 5 시리즈(5-A~F) 이걸로 종료. 다음은 별건(오더플로우 저널 30건 채우기, event_divergence 시그널 품질 관찰 등 — 기존 메모리 트랙 계속).

---

## Phase 191 — 폴리마켓 콜렉터 헬스체크 + ICT 페이퍼엔진 0건 근본원인 조사 + 전체 수정 (2026-07-30) ✅ SHIPPED

유저: "오더플로우 발열 말고 다른 작업할 거 없음?" → tmux 세션 훑다가 ICT 페이퍼엔진 10일째 0건 발견, 유저에게 보고 → "응 둘 다 해보자. 근데 폴리마켓 잘 모으고 있는거야? 확인해줘"로 두 가지 확정: (1) 폴리마켓 6개 콜렉터 헬스체크 (2) ICT 페이퍼엔진 0건 근본원인. 조사 완료 후 유저가 "전부 최종 목표를 위해 수정해줘"로 제안된 수정 전부 승인 → 이번 세션에서 전부 구현.

### 폴리마켓 콜렉터 (6개 tmux 세션)
- 정상(방금까지 기록 중): `polymarket-arb`, `polymarket-sharp-wallet-tick`, `polymarket-tick`, `polymarket-updown-arb`.
- **`polymarket-event-divergence` — 완전 hang 발견**: 01:01에 기동(전날 세션에서 이미 한번 9.7h 방치로 재기동했던 그 세션, [[project_fleet_health_monitoring_upgrade]] 참고)했는데 12:43 이후 9.5시간째 파일 안 씀. `ps`로 CPU 시간 두 번 측정(8초 간격)해서 완전히 0 증가 확인 = 진짜 hang(재시도 루프 아님). 코드(`run_polymarket_event_divergence_scan.py`) 자체는 try/except로 감싸져 있어 구조상 왜 hang이 나는지는 못 찾음 — 재발이라 다음에 또 걸리면 더 깊게 봐야 함.
- **`polymarket-whale-tick` — 구조적 버그 발견**: `run_polymarket_whale_collect.py`의 `run_forever()`가 5분마다 하는 마켓리스트 `refresh_fn()`과 5초마다 하는 실체결 `fetch_fn()`을 같은 try 블록에 묶어놔서, `refresh_fn()`이 DNS 등으로 한번 실패하면 `last_market_refresh`가 안 갱신되어 매 사이클(5초)마다 refresh부터 다시 실패 → `fetch_fn()`(진짜 체결 폴링)까지 아예 못 감. 오늘 이걸로 2.8시간 데이터 공백. 코드는 안 고치고 재기동만 함(재발 가능 — 다음 fix는 refresh/fetch try 블록 분리).
- 둘 다 kill 후 재기동, 재기록 확인은 Monitor로 백그라운드 진행 중.
- **부가 발견**: `scripts/deploy/ensure_collectors.sh`의 `ENSURE` 배열에 `polymarket-event-divergence`가 아예 없음 — 세션이 완전히 죽어도 launchd가 못 살림(다른 6개는 등록돼있는데 이것만 빠짐). 이 스크립트는 "세션 존재 여부"만 보고 되살리는 구조라 hang(세션은 살아있는데 멈춤)은 원천적으로 감지 불가 — `/lab/fleet`의 stuck 판정 쪽에서 이번 hang을 잡았는지도 확인 필요.

### ICT 페이퍼엔진(`ict-orderflow-paper`, BTC.HL) 10일 0건 조사
- HTF(15분) 폴링 DNS 실패는 10일간 단 2회뿐(tmux 스크롤백 전체가 221줄인데 그게 로그 전부, 나머지 ~958사이클은 조용히 성공한 걸로 추정) → 네트워크 문제가 주범 아님, 기각.
- LTF 반전트리거(`reversal_triggers.py`)는 대시보드 `/orderflow`의 흡수/스탑런/다이버전스 감지랑 완전 동일 로직 재사용 — 그게 Phase 189 발열 원인이 될 만큼 자주 튀는 걸 이미 확인했으므로, 트리거 자체가 안 튀는 게 문제는 아닐 가능성 높음.
- `_check_entry`(`state_machine.py`)가 요구하는 조건: HTF존(OB/iFVG) 안에 종가 있음 + 같은 방향 CISD + 같은 방향 반전트리거가 전부 5분(5봉) 이내에 동시에 겹침 + 다음 반대편 유동성 레벨(목표가)까지 확정. 코드 버그는 못 찾았고, 이 정도 좁은 4중 컨플루언스면 BTC 단일심볼 기준 10일 0건도 구조적으로 말이 되는 수준 — "진짜 안 나온 것"에 무게. 100% 확신하려면 단계별 카운터 계측 필요(수정 영역이라 이번엔 안 함).

### 수정 구현 (조사 다음 단계, 같은 날)
- **`research/net_utils.py`(신규) — DNS/connect 하드 타임아웃 유틸**: `requests`의 `timeout=`은 소켓 생성 *이후* 단계만 커버 — `getaddrinfo()`는 그 전 단계라 못 막음. 데몬 스레드에서 호출 돌리고 `queue.Queue.get(timeout=...)`로 기다려서 "OS 레벨 무응답"을 `TimeoutError`로 전환. 타임아웃 나면 스레드 1개 누수(못 죽임, python 한계)되지만 발생빈도 낮아 허용.
- **`polymarket/client.py`**: `_get()`의 `requests.get` 호출을 위 유틸로 감쌈(`_HARD_TIMEOUT = _TIMEOUT + 5.0`).
- **`research/run_polymarket_whale_collect.py`**: `fetch_trades()` 하드타임아웃 적용 + `run_forever()`의 refresh/fetch try블록 분리(refresh 계속 실패해도 fetch는 매 사이클 정상 실행) + 최초 `refresh_fn()` 호출도 try로 감쌈(예전엔 unguarded라 실패시 프로세스 자체가 죽음).
- **`research/ict/paper/htf_zones.py`**: `fetch_htf_bars()`의 `requests.post` 하드타임아웃 적용 — event_divergence와 같은 hang 클래스가 ICT HTF 폴링에서도 날 수 있어 선제 방어.
- **`scripts/deploy/ensure_collectors.sh`**: `ENSURE` 배열에 `polymarket-event-divergence` 추가 + **부가 발견**: `polymarket-mlb-specialist-tick`도 `lab_api.py`의 `COLLECTOR_SESSIONS`엔 있는데 이 스크립트엔 없었음(같은 클래스 누락) — 같이 추가. 이제 9개 전부 등록.
- **`research/ict/paper/state_machine.py`**: `_check_entry()`의 4단계 필터(zone_none/cisd_miss/trigger_miss/risk_invalid/target_none/entered)마다 `self._entry_stage_counts` 누적, 500봉마다 `logging.info`로 퍼널 로그 — "4중 컨플루언스 구조적 희소성" 가설을 데이터로 반증/확증 가능하게 계측만 추가(로직 변경 없음).
- 테스트: `test_net_utils.py`(신규), `test_ict_paper_htf_zones.py`/`test_run_polymarket_whale_collect.py`/`test_ict_paper_state_machine.py` 각각 회귀 테스트 추가. 전체 `pytest tests/ -q` **2031 passed**.
- 수정 반영된 콜렉터 3개(`polymarket-event-divergence`, `polymarket-whale-tick`, `ict-orderflow-paper`) kill 후 재기동 확인 — 크래시 없이 기동.

### 변경된 파일
- `research/net_utils.py`(신규), `tests/test_net_utils.py`(신규)
- `polymarket/client.py`
- `research/run_polymarket_whale_collect.py`, `tests/test_run_polymarket_whale_collect.py`
- `research/ict/paper/htf_zones.py`, `tests/test_ict_paper_htf_zones.py`
- `research/ict/paper/state_machine.py`, `tests/test_ict_paper_state_machine.py`
- `scripts/deploy/ensure_collectors.sh`

### 다음 할 일
- state_machine.py 계측 로그가 며칠 쌓이면 어느 필터가 병목인지 실측 확인(현재는 카운터만 추가, 아직 데이터 없음).
- event_divergence hang 재발 여부 계속 관찰 — 하드타임아웃으로 무한행은 막혔지만 왜 DNS가 멈추는지 근본원인은 여전히 미상(macOS 리졸버 이슈로 추정만).
- Phase 189 오더플로우 발열 유저 재확인 여전히 대기 중(별건).

### 추가 세션 (같은 날, "그러면 다음 할 일은?" → "1,2 해보자" → "지금 온도 오른다" → "그거 파보자")
- **funnel-log/hang 관찰 체크**: ICT 퍼널로그는 재기동 후 ~7분이라 아직 미출현(정상, 500봉=~8.3시간 필요). event_divergence는 CPU delta 측정(40초 창, 0.46s→0.51s)으로 hang 아님 확인됐으나 데이터 10시간+ 안 쌓임 발견 → 아래 Gamma API 버그로 근본원인 규명됨.
- **"온도 오른다" 조사**: systematic-debugging으로 root cause 추적. uvicorn/node/Chrome 전부 CPU 0~0.1%로 idle 확인, 유일한 스파이크는 `cross_venue_skew_collect`(정상 폴링 범위). 결론: 콜렉터 3개 재기동+수동 디버그스크립트 직후의 일시적 버스트(팬 관성)였고 이미 가라앉음 — 코드 문제 아님, 조치 불필요.
- **Gamma API 100개 캡 버그 발견+수정 (진짜 소득)**: `polymarket.client.get_markets(limit=300)`이 실제 300개가 아니라 100개만 반환하는 걸 발견 — Gamma API가 `limit`>100 요청을 에러 없이(status 200) 100개로 조용히 잘라버림(실측: 150/300/500 전부 100개). 영향받은 호출부 6곳: `run_polymarket_tick_collect.py`(300), `run_polymarket_whale_collect.py`(500), `polymarket_event_divergence/collector.py`(300), `polymarket_arb/collector.py`(300), `api_server/polymarket_bot.py`(500) — 전부 top-100 마켓 풀에서만 동작하고 있었음.
  - **fix**: `get_markets()`를 `offset` 페이지네이션(`_PAGE_SIZE=100`)으로 재작성 — limit까지 여러 페이지 자동 수집, 데이터 고갈시 조기 중단.
  - **파급 확인**: fix 전 `event_divergence.run_once()` 0건 → fix 후 즉시 6건 검출. [[project_fleet_health_monitoring_upgrade]]의 "필터 임계값상 정상 무신호" 결론이 틀렸던 것으로 정정 — 실은 다중마켓 이벤트 후보군 자체가 top-100 캡에 걸려 좁았던 것.
  - `polymarket-tick`/`polymarket-arb`/`polymarket-whale-tick`/`polymarket-event-divergence` 4개 세션 kill+재기동해서 fix 반영 확인.
  - 테스트: `tests/test_polymarket_client.py`에 페이지네이션 테스트 2개 추가. 전체 `pytest tests/ -q` **2033 passed**.
  - `research/data/polymarket_whale/`는 7/13 콜렉터 가동 이후 계속 이 캡에 걸려있었을 가능성 있음 — [[project_polymarket_whale_first_verdict]] 재검증 시 fix 이전/이후 표본 섞지 말 것.

### 변경된 파일 (추가)
- `polymarket/client.py`(`get_markets` 페이지네이션), `tests/test_polymarket_client.py`

### 다음 할 일 (갱신)
- event_divergence는 이제 정상적으로 divergence 검출 중 — 며칠 관찰해서 실제 시그널 품질(진짜 알파인지) 판단 필요.
- whale 재검증 트리거(표본 30건)는 유효하나, fix 시점(2026-07-30 23:05~) 이전 표본과 섞지 않기.

---

## Phase 190 — CommandRail(왼쪽 사이드바) IA 정리 (2026-07-30) ✅ SHIPPED

유저 리포트: "왼쪽 사이드바 보면 아주 빼곡하게 뭐가 뭔지도 모르는 페이지들이 나열되어있잖음." Phase 187에서 "유저 판단 필요한 IA 결정이라 임의로 안 건드림"으로 남겨뒀던 `CONSOLE_GROUPS`(신규 OS 레이어) vs `TERMINAL_GROUPS`(레거시 45p) 중복 이슈 재확인 → 유저가 "우리의 최종 목표를 위해 수정 방향을 선택해줘"로 방향 결정을 위임.

### 방향 결정
Phase 113(Jarvis Quant OS 안전골격)·Phase 132(집행 전환) 메모리 근거로 OS 레이어(`CONSOLE_GROUPS`)를 최종 목표(라이브 집행)의 메인 IA로 승격, Terminal은 하위 실행/데이터 도구로 유지(병합 아님, 위계만 명확화). 기존 코드도 이미 OS를 먼저 렌더 + Terminal에 "레거시" 딱지를 달아놨어서 순서는 그대로 두고 그룹 구조/라벨만 정리.

### 완료된 작업
- Research OS 21개 flat 리스트(스캔 불가 수준) → 성격별 4그룹 분리: `Research · 모니터링`(현황판 7개), `Research · 파이프라인`(에이전트/워크플로우 7개), `Research · 거버넌스`(위원회/설명가능성 5개), `Research · Lab`(Strategy Lab/Chat + 헷갈리던 단독 "Intelligence" 그룹(라벨도 "Research OS"였음)을 "Jarvis Live View"로 흡수).
- Markets 9→5: `/market`이 crypto/futures/forex/options를 탭으로 그대로 재렌더하는 아그리게이터라 4개를 최상위 nav에서 제거(진입은 `/market` 탭 안에서).
- `/auto-research` nav 제거(코드 자체 주석이 "사이드바 은퇴, AI LAB에 흡수됨"이라 명시했는데 계속 남아있던 죽은 링크).
- `/edges`(콜렉터 플릿/엣지 검증 모니터, 272줄 실기능인데 nav 어디에도 없던 orphan) → Research Lab 그룹에 추가.
- 동명이인 라벨 3쌍 구분: `/quant/validation` "Validation"→"Quant Validation Gates"(`/validation`="Validation Terminal", `/research-os/validation`="Validation Loop"와 이름충돌 해소), `/exec/orders` "Orders"→"Execution Gates", `/portfolio-os/risk` "Risk"→"Risk Limits".
- **실사용처 검증**(브라우저로 직접 열어봄): `/orders`(실제 체결 블로터, KR/US/옵션 상태필터) vs `/exec/orders`(4중 안전게이트 요청/응답/라이프사이클 카운터) — 완전 다른 관점 확인, 병합 대상 아님. `/risk-guard`(킬스위치+env기반 하드리밋 조작화면) vs `/portfolio-os/risk`(RiskGovernor 상태/autonomy 레벨 표시) — 이것도 서로 다른 시스템 감싸는 뷰라 병합 대상 아님. 둘 다 라벨 구분으로 충분하다고 결론.
- 검증: `npx tsc --noEmit` clean, `npm test` 313/313 통과, 브라우저로 `/hud` 열어 그룹 펼침/글리프/콘솔 에러 확인(하이드레이션 경고 1건 있었으나 `WorldClock` 서버/클라 시간차로 CommandRail과 무관, 기존 이슈).

### 변경된 파일
- `seokminal-dashboard/components/console/CommandRail.tsx`

### 다음 할 일
- 없음. Phase B로 분류했던 항목(OS/Terminal 위계, orders/risk 라벨 구분) 이번에 다 처리됨.

---

## Phase 189 — 오더플로우(/orderflow) 발열 근본원인 수정 (2026-07-30) ✅ SHIPPED

유저 리포트: "오더플로우 키면 발열 심해지는데." systematic-debugging 스킬로 진행. 1차 픽스(useMemo로 footprint/heatmap Array.from 참조 안정화, `hooks/useOrderflowSocket.ts`)는 유저가 "응 발열 난다"로 명시 반려 — Phase 1로 되돌아가 재조사.

### 완료된 작업
- **근거 수집**: 브라우저 계측(PerformanceObserver longtask)은 자동화 탭이 backgrounded라 `document.visibilityState==="hidden"`이라 전부 0으로 나와 폐기. 대신 `websockets` 클라이언트로 백엔드 WS에 직접 붙어 메시지 타입별 실측 → `heatmap_delta` 61.5/sec(체결 19.1건/초의 3배+), book_snapshot은 1.5/sec(스로틀 정상 작동 중)로 확인 — heatmap_delta만 스로틀이 안 걸려있었음.
- **원인 1(백엔드)**: `seokminal-multi-venue/orderflow/manager.py` — book_snapshot은 `BOOK_SNAPSHOT_THROTTLE_SEC=0.15`로 스로틀되는데 `aggregator.on_book_snapshot()`이 반환하는 heatmap_delta는 스로틀 없이 매 틱(원장 뎁스 변화마다) 그대로 브로드캐스트되고 있었음. `_SymbolWorker`에 `pending_heatmap` dict 추가, 같은 150ms 창 안에서는 키(ts,price)별 최신값만 모았다가 flush — `on_book_snapshot()` 자체는 매 틱 그대로 호출해 내부 상태(스푸핑 감시 등)는 안 건드림. 신규 테스트 2건 작성 중 tick_size=10 라운딩으로 bid(100)/ask(101)가 같은 heatmap 버킷에 충돌해 pending 값이 서로 덮어쓰는 테스트 픽스처 버그를 발견해 별도 수정.
- **원인 2(프론트, 더 지배적)**: 백엔드 픽스 후 재측정해도 heatmap_delta가 61.5→48.1/sec로만 줄어듦(같은 150ms 창 안에서도 여러 개별 가격 레벨이 실제로 바뀌는 게 정상이라 메시지 수 자체는 크게 안 줆). `lib/orderflow-data.ts`의 `applyHeatmapDelta`/`applyFootprintDelta`가 메시지 1건마다 `new Map(state.heatmap)` 전체 복사 + `evictOldest*Buckets`(전체 스캔+sort)까지 동기로 수행 — `useOrderflowSocket.ts`의 rAF 배칭은 setState(리렌더) 빈도만 60fps로 묶을 뿐 이 `ws.onmessage` 안의 O(n) 작업 자체는 원시 메시지 속도(초당 48~60건) 그대로 실행되고 있었음. `applyOrderflowMessageBatch()` 신규 추가 — onmessage에서는 배열 push(O(1))만, 무거운 Map 복사/eviction은 rAF flush 시점에 프레임당 최대 1회로 묶어서 처리하도록 `useOrderflowSocket.ts` 재작성.
- 검증: 백엔드 pytest 2024 passed, 프론트 vitest 313 passed, `npx tsc --noEmit` clean. uvicorn 재기동 완료(PID 42613). 브라우저 실측(CPU/발열 자체)은 여기서 확인 불가 — 유저 재확인 필요.

### 변경된 파일
- `seokminal-multi-venue/orderflow/manager.py`, `tests/test_orderflow_manager.py`
- `seokminal-dashboard/hooks/useOrderflowSocket.ts`, `lib/orderflow-data.ts`, `tests/lib/orderflow-data.test.ts`

### 다음 할 일
- 유저가 실제 발열 해소됐는지 재확인 필요 — 여전하면 3번째 픽스 시도 전에 아키텍처 자체(예: heatmap 보존 윈도우 90분치를 매번 통째로 들고 있는 구조) 재검토 권장(systematic-debugging Phase 4.5, 이미 픽스 2회 시도함).

---

## Phase 188 — 오더북 히스토리 저장 + Bookmap식 DOM 리플레이 (2026-07-30) ✅ SHIPPED

유저 지시: "너무 많은 용량 잡아먹지않게. 만들어줘. 그리고 이걸 플랫폼화할 수 있을지 여부도 알려줘." 중 구현 파트(1) 완료. 플랫폼화 평가(2)는 별도 채팅 응답으로 전달, 문서화는 안 함(일회성 질문 답변 성격).

### 완료된 작업
- **백엔드**(`seokminal-multi-venue`): 기존 상시가동 tmux 수집기 `research/run_hl_orderflow_tick_collect.py`를 확장 — 신규 수집기 안 만들고 기존 WS 연결에 `snapshot_append_fn` 주입만 추가(연결 오버헤드 최소화, `ensure_collectors.sh`/`lab_api.py` 변경 불필요). 3초 스로틀(이벤트 자체 ts 기준, wall-clock 아님) + 상위 15레벨만 `[price,size]` 압축 배열로 저장 → `research/data/hl_orderbook_snapshot/{coin}_{date}.jsonl`. 예상 용량 ~10MB/일(3코인 합계, gzip 후) — "용량 안 잡아먹게" 제약 직접 반영. 기존 `compress_old_data.py`가 파일명 패턴 기반이라 코드 변경 없이 자동으로 오래된 파일 gzip 압축.
- REST 엔드포인트 2개 신규(`api_server/router_orderflow.py`): `GET /orderflow/history/{symbol}/dates`(저장된 날짜 목록), `GET /orderflow/history/{symbol}?date=&start=&end=&limit=`(스냅샷 조회, plain/gzip 듀얼 포맷 리더, `_HISTORY_SNAPSHOT_MAX_LIMIT=20000`으로 응답 크기 캡).
- 백엔드 테스트: 수집기 14 passed, 라우터 14 passed(신규분 포함).
- **프론트엔드**(`seokminal-dashboard`): `lib/api.ts`에 `getOrderflowHistoryDates`/`getOrderflowHistory` 추가(raw fetch 금지 규칙 준수) → `hooks/useOrderbookReplay.ts`(날짜선택→스냅샷로드→재생, AbortController 컨벤션 그대로) → `components/orderflow/ReplayLadder.tsx`(신규 단일 컬럼 래더, 기존 `OrderBookLadder.tsx`는 `byVenue` 3분할 전용이라 재사용 불가 — 리플레이 스냅샷은 용량 절약을 위해 `by_venue` 자체를 저장 안 하므로 새 컴포넌트 필요) + `components/orderflow/OrderbookReplay.tsx`(날짜 select+재생/일시정지+슬라이더 컨테이너) → `app/orderflow/page.tsx`에 라이브/리플레이 토글 버튼 추가(active탭 `border-accent text-accent bg-accent/10` 컨벤션대로).
- 검증: `npx tsc --noEmit` clean, `npm test` 27 files/310 tests 전부 통과, 백엔드 pytest 2022 passed(pre-existing 실패 없음). `hl-orderflow-tick` tmux 세션 재기동(신규 코드 반영 위해 kill 후 `ensure_collectors.sh`로 재생성) → 재기동 15초 만에 BTC/ETH/PAXG 3개 jsonl 파일에 실제 스냅샷 기록 확인.

### 변경된 파일
- `seokminal-multi-venue/research/run_hl_orderflow_tick_collect.py`, `tests/test_run_hl_orderflow_tick_collect.py`
- `seokminal-multi-venue/api_server/router_orderflow.py`, `tests/test_router_orderflow.py`
- `seokminal-dashboard/lib/api.ts`, `tests/lib/api-orderflow.test.ts`
- `seokminal-dashboard/hooks/useOrderbookReplay.ts`(신규), `components/orderflow/ReplayLadder.tsx`(신규), `components/orderflow/OrderbookReplay.tsx`(신규), `app/orderflow/page.tsx`

### 다음 할 일
- `ReplayLadder`/`OrderbookReplay` 컴포넌트 자체 단위테스트는 아직 없음(훅/API 레이어만 테스트됨) — 필요시 추가.
- 브라우저 라이브 검증(리플레이 탭 실제 클릭+재생) 아직 안 함 — 다음 세션에서 `/orderflow` 페이지 열어 확인 권장.
- 플랫폼화 가능성은 채팅으로 답변 예정(이 문서엔 기록 안 함, 세션 내 대화 참조).

---

## Phase 187 — CommandRail 아코디언 접기 + Cmd+K 검색 팔레트 (2026-07-30) ✅ SHIPPED

이전 세션에서 넘어온 "사이드바 UX 재설계 + pre-existing 테스트 수정" 3파트 지시 중 나머지 두 파트 완료: (1) `seokminal-multi-venue` pytest 실패 6건 수정 커밋, (2) 사이드바 재설계.

### 완료된 작업
- **오진 주의**: 처음엔 `components/Sidebar.tsx`(상단 네비바 형태, `NAV_GROUPS` 6그룹)를 대상으로 착각해서 수정+`CommandPalette.tsx` 만들었다가, 브라우저로 실제 화면 스크린샷 찍어보니 렌더링 안 되는 다른 컴포넌트인 걸 발견. grep으로 전체 확인해보니 `Sidebar.tsx`는 앱 어디서도 import 안 되는 **완전 죽은 코드**(`04c7567` 커밋에서 좌측 사이드바→상단 네비바로 갈아탈 때 남겨진 잔재로 추정). 헛수고분 `git checkout -- Sidebar.tsx` + `rm CommandPalette.tsx`로 되돌리고, 진짜 대상인 `components/console/CommandRail.tsx`(`app/layout.tsx`에서 렌더되는 좌측 레일, 콘솔 7그룹+터미널 5그룹 합쳐 약 70개 링크가 전부 상시 펼쳐진 채 스크롤 하나에 쌓여있었음 — "사이드바에 페이지 너무 많다" 불만의 실제 원인)로 재작업.
- `components/console/CommandRail.tsx` — 그룹별 아코디언 접기/펼치기 추가. 기본은 현재 라우트가 속한 그룹만 펼침(active-group auto-expand), 수동으로 펼친/접은 상태는 `localStorage`(`commandRailOpenGroups`) 유지. 아이템 1개짜리 그룹(Investment OS 등)은 아코디언 없이 바로 링크로 축약.
- `components/console/CommandPalette.tsx`(신규) — Cmd/Ctrl+K 검색 팔레트. `ALL_GROUPS`(`CONSOLE_GROUPS`+`TERMINAL_GROUPS`) 평탄화해서 라벨/그룹명/href로 필터, 화살표+Enter로 즉시 라우팅. `.console-shell` CSS 커스텀 프로퍼티 디자인 토큰(`--c-panel`/`--c-hud` 등) 사용 — 메인 앱 Tailwind 토큰 규칙과 별개 시스템이라 프로젝트 CLAUDE.md의 `bg-bg/panel` 등 규칙 대상 아님.
- 검증: `npx tsc --noEmit` clean, `npx vitest run` 27 files/305 tests 전부 통과, 브라우저로 `/hud`·`/signal` 라이브 테스트(레일 접기/펼치기, 아코디언 토글, active-group 자동펼침, Cmd+K 검색→이동, 콘솔 에러 0건) 확인.
- `seokminal-multi-venue` 쪽: pytest 실패 6건(asyncio import 누락 1건 + 테스트 격리 4건 + assertion 갱신 1건) 수정 커밋(`0234faa`) — 상세는 그쪽 progress.md 참조.

### 변경된 파일
- `components/console/CommandRail.tsx` (수정)
- `components/console/CommandPalette.tsx` (신규)
- `components/Sidebar.tsx` — 최종적으로 무변경(헛수고분 되돌림), **죽은 코드로 확정, 다음 세션에서 삭제 후보**

### 다음 할 일
- `components/Sidebar.tsx`(및 그 안의 미사용 `IconDiscovery`/`IconStrategy`) 삭제 여부 — 이번 세션엔 남의 미완성 작업일 가능성 배제 못 해서 안 건드림, 확인 후 삭제 검토.
- `roadmap.md`에 존재하지 않는 `components/NavBar.tsx` 참조 남아있음 — `CommandRail.tsx`로 갱신 필요.
- `CONSOLE_GROUPS`/`TERMINAL_GROUPS` 두 계층이 중복 성격 있어보임(콘솔 신규 OS vs 레거시 터미널) — 통폐합은 이번엔 스코프 밖(유저 판단 필요한 IA 결정이라 임의로 안 건드림).

---

## Phase 186 — CPU 발열 원인(vitest 좀비 프로세스) 진단·제거 (2026-07-30) ✅ 완료

세션 중 유저가 "컴퓨터 왜 이렇게 뜨거워?" 질문 → `ps -Ao pcpu` 스캔으로 원인 특정: `--reload` 상시가동(기존 known 발열원)은 이번엔 안 켜져 있었음, 실제 범인은 `seokminal-dashboard`의 vitest fork worker(`node .../vitest/dist/workers/forks.js`, pid 78025) — 오래된 `npm test` watch 세션이 안 닫힌 채 CPU 100% 고정으로 9시간12분째 방치.

### 완료된 작업
- vitest 좀비 프로세스(pid 78025) `kill`로 종료, 소멸 확인.
- (참고) `seokminal-multi-venue` 쪽 `research.run_cross_venue_skew_collect` 파이썬 프로세스가 24.9% CPU로 5일+ 상시 실행 중인 것도 발견 — 정체/의도 불명, 안 건드림(다음 세션 확인 필요, `seokminal-multi-venue/docs/progress.md` 2026-07-30 항목에 기록).
- 같은 세션에서 jarvis 관련 테스트 스윕도 재확인(276 + 전체 15036 passed, 0 failed) — 상세는 `seokminal-multi-venue/docs/progress.md` 참조(백엔드 위주라 그쪽에 기록).

### 변경된 파일
- 없음 (프로세스 kill만, 코드 변경 없음)

### 다음 할 일
- `npm test` watch 모드 습관적으로 안 닫고 세션 종료하는 패턴 있는듯 — 다음에 또 CPU 뜨거우면 vitest fork worker부터 의심.
- `run_cross_venue_skew_collect` 정체 확인.
- `docs/progress.md`(이 파일) 3800줄/326KB로 비대 — 당장 문제 아니지만 오래된 Phase 아카이빙 고려.

---

## Phase 185 — `router_autopilot.py` 도메인별 분리 + 수집기 워치독 가동 (2026-07-26) ✅ SHIPPED

`seokminal-multi-venue` 백엔드 세션. 사용자 요청 3건: ① `api_server/router_autopilot.py`(1700줄+ 모놀리스) 도메인별 라우터로 분리 ② 9개 tmux 수집기 헬스체크/자동재시작 워치독 구축 ③ 이번 세션 정리(progress.md). (④ 업데이트 버튼에 Claude-핸드오프 플로우 추가는 "필요없다"고 명시 거부 — 손 안 댐.)

### 완료된 작업 (SHIPPED)
- **라우터 분리**: `api_server/router_autopilot.py`(1700줄+, 계좌/시세/주문 + 터미널(tmux/ttyd) + shutdown/update + 멀티에이전트 CRUD/틱/성과가 한 파일에 뒤섞여 있었음) → `api_server/routers/{alpaca_shared,alpaca_account,terminal,agents}.py` 4개 도메인 모듈로 분리. `router_autopilot.py`는 20줄짜리 재수출 shim으로 축소(`main.py`의 기존 import 그대로 동작하게). `alpaca_account.router`/`terminal.router` 둘 다 `prefix="/alpaca"`라 shim에서 `router=APIRouter()`(prefix 없음)로 include_router 두 번 해서 병합 — 처음에 shim에도 `prefix="/alpaca"` 붙였으면 `/alpaca/alpaca/...`로 겹쳤을 뻔, 코드 작성 중 자체 리뷰로 사전 발견.
  - 핵심 설계 제약: pytest `monkeypatch.setattr`은 특정 모듈 객체의 속성을 패치하므로, 분리된 모듈들은 서로의 헬퍼를 부를 때 반드시 `from api_server.routers import alpaca_shared as shared; shared.X(...)` 형태(모듈-한정 호출)로 참조해야 패치가 실제로 먹음. 이 원칙 위반을 조립 중 2건 자체 발견·수정: `agents.py`에서 `_fetch_kr_intraday_bars`/`_fetch_intraday_bars` 호출이 `shared.` 없이 bare로 남아있던 것(grep 자체점검으로 발견), `import os` 누락(원본엔 `import os` + `import os as _os` 둘 다 있었는데 새 헤더엔 `_os`만 챙기고 bare `os.environ.get(...)`용 plain import 빠뜨림).
  - 검증: `ast.parse` 문법체크 → 개별 모듈 import → `TestClient`로 `/alpaca/terminal/status`·`/agents` 실제 히트(FastAPI 0.138.0은 `include_router()` 후 `.routes`가 lazy `_IncludedRouter`라 `.path` 속성이 없어 직접 introspection 안 됨 — 발견 후 TestClient 방식으로 전환) → `api_server.main`(실제 앱) import → 전체 pytest 1397 passed(기존부터 있던 무관 실패 4~5건 제외, 리그레션 0).
  - 테스트 3개 파일도 갱신: `test_shutdown_api.py`(`router_autopilot`→`terminal` 모듈로 monkeypatch 대상 변경), `test_daytrade_tick.py`/`test_intraday_endpoint.py`(`rp`→`alpaca_shared as shared`로 변경).
- **워치독 가동**: 조사해보니 `ops/collector_watchdog.py`(순수 `to_restart()` + `/lab/fleet` 폴링+재시작 루프, 테스트까지 이미 존재) + `api_server/fleet_health.py`(`classify`/`fleet_summary` 순수 판정) + `api_server/lab_api.py`의 `COLLECTOR_SESSIONS`/`/lab/fleet`/`/lab/collectors/{key}/restart`가 이미 완성돼있었는데 한 번도 가동된 적 없었음(재구축 대신 활성화만 함).
  - 라이브로 죽어있던 `polymarket_updown_arb`(`dead`, `session_exists: false`) 기존 restart 엔드포인트로 즉시 복구.
  - 9개 tmux 수집기 중 레지스트리에 안 올라가 있던 `polymarket_event_divergence` 발견 → `COLLECTOR_SESSIONS`/`/lab/status`/`fleet_health.STALE_AFTER_S`(1800s, 스캔류)에 추가, `/lab/fleet`가 `n_total: 9`(기존 8)로 즉시 반영·`fresh` 확인.
  - `collector_watchdog.py`를 `collector-watchdog` tmux 세션으로 실제 가동(기존 tmux 컨벤션 그대로, launchd 미사용) — 이제 120초마다 `/lab/fleet` 폴링해서 `dead` 판정 나면 자동 재시작. `--restart-stale` 플래그는 README 자체 권고대로 더 공격적이라 켜지 않음(죽은 것만 재시작, 단순 stale은 안 건드림).
  - **의도적으로 안 건드린 것**: `research/run_ict_paper_engine.py`(ICT+오더플로우 페이퍼 엔진, `ict-orderflow-paper` 세션)는 tick 수집기가 아니라 실행 엔진 — 포지션 변화 있을 때만 상태 기록이라 기존 jsonl-mtime 방식 그대로 넣으면 거래 뜸한 구간에 가짜 `dead`가 뜸. 코드 읽고 판단해서 `COLLECTOR_SESSIONS`에 안 넣음(다음 세션 참고용으로 여기 기록).
- 업데이트 버튼 dogfooding: 이번 세션에서 만든 `lab_api.py`/`fleet_health.py` 변경 반영에 실제로 `/alpaca/update/execute`(지난 세션에 만든 그 업데이트 버튼 API) 써서 API 서버 재기동 — 발열 대응으로 만든 기능이 실제 설정변경 반영에도 정상 작동함을 실사용으로 확인.

### 변경된 파일
- (신규) `api_server/routers/alpaca_account.py`, `api_server/routers/terminal.py`, `api_server/routers/agents.py`
- (수정) `api_server/router_autopilot.py`(1700줄+ → 20줄 shim), `api_server/lab_api.py`(`polymarket_event_divergence` 등록), `api_server/fleet_health.py`(`STALE_AFTER_S`에 동일 키 추가)
- (수정, 테스트) `tests/test_shutdown_api.py`, `tests/test_daytrade_tick.py`, `tests/test_intraday_endpoint.py`
- `api_server/routers/alpaca_shared.py`는 지난 세션에 이미 작성 완료 상태라 이번 세션엔 무변경(참조만)

### 다음 할 일
- `ict-orderflow-paper` 세션 헬스 트래킹 — 지금은 워치독 커버리지 밖. 실행엔진용 다른 판정 로직(예: 포지션 상태파일 mtime이 아니라 프로세스 생존 + WS 하트비트 기반) 설계 필요, 다음에 붙일지 결정.
- Phase 183에서 남겨둔 ICT 엔진 자체의 Minor 항목들(재시작 시 존-소진 상태 미복원 등)은 여전히 미해결.
- 라우터 분리는 `router_autopilot.py` shim이 남아있는 구조 — 당장 문제 없으니 이번엔 shim까지 걷어내진 않음(호출부(`main.py`) 그대로 두고 안전하게 검증하는 쪽 택함).

### 막힌 부분/결정사항
- monkeypatch가 모듈 객체 단위로 동작한다는 제약이 분리 설계 전체를 결정함 — 분리 후 헬퍼 호출은 전부 `shared.X()` 식 모듈-한정 참조로 통일(안 그러면 테스트가 조용히 원본 함수를 패치 못 하고 실제 함수가 실행돼버림).
- 워치독 launchd 대신 tmux 세션으로 가동 — 기존 9개 수집기 전부 tmux 컨벤션이라 통일성 우선, `ops/com.seokminal.watchdog.plist`는 존재하지만 안 씀(단순함 우선).
- `--restart-stale` 계속 OFF 유지 — README 자체가 "더 공격적"이라 명시한 옵션이라 기본값(죽은 것만 재시작)이 안전.
- 업데이트 버튼에 Claude-핸드오프 플로우 추가는 사용자가 "필요없다"고 명시 거부 → 스코프에서 완전히 제외.

---

## Phase 184 — XAU 백테스트 노출 + MLB `/mlb` 페이지 분리 + 두 저장소 동기화 (2026-07-22) ✅ SHIPPED

XAU Session Confluence 백테스트를 `/validation` 페이지에 노출, 이어서 MLB Specialist Consensus(Polymarket 지갑 스코어링)를 공용 카드에서 전용 `/mlb` 페이지로 분리 요청 → 상단 네비 반영 확인까지 완료. 마지막으로 데스크탑 세션에서 넘어온 미동기화 작업(플랫폼 업그레이드 6종: 엣지 메타-대시보드/함대헬스/감쇠추적/집행시임/워치독) 확인 → 두 저장소 commit→pull(merge)→push로 동기화. 상세 로그는 `seokminal-multi-venue/docs/progress.md` "2026-07-22 (이어서 2~6)" 참조(백엔드 위주라 그쪽에 기록, 이 항목은 프론트+저장소 관점 요약).

### 완료된 작업 (SHIPPED)
- **XAU 노출**: `research_api.py`에 `/research/xau-session`(TSMOM과 동일한 60초 캐시 패턴, p-value 가설검증 아닌 단순 백테스트 통계라 `_EDGE_VAL_RUNNERS`엔 안 넣음) — `app/validation/page.tsx`에 `XauSessionPanel` 신설(심볼별 봉수/tick/트레이드/승률/PF/순손익 테이블), `lib/api.ts`에 `XauSessionSummary`/`getXauSession` 추가.
- **MLB `/mlb` 분리**: `EdgeReportCard`/`EdgeHeatmap`/`EdgeVariantTable`/`VERDICT_BADGE`를 `app/validation/page.tsx` 로컬정의 → `components/charts/EdgeReportCard.tsx`로 추출·export(양쪽 페이지 재사용). `app/mlb/page.tsx` 신설(`mlb_specialist_consensus` 리포트 전용 렌더 + 수집기 ON/OFF·재시작 버튼 + 재계산 버튼). `/validation`의 `EdgeValidationSection`에서 MLB 제외(중복 방지, sharp_wallet/whale만 남음).
- `lib/api.ts` `CollectorKey`/`LabStatus.processes`에 `polymarket_mlb_specialist_tick` 추가(백엔드는 이미 등록, 프론트 타입 누락 상태였음).
- `components/Sidebar.tsx` "검증" 그룹에 `/mlb` 링크 추가 — 병합 중 origin이 같은 자리에 추가한 `/edges`(데스크탑의 엣지 메타-대시보드 페이지)와 충돌, 둘 다 유지(`/validation`→`/edges`→`/mlb` 순).
- `app/hud/page.tsx` Unit 목록에 MLB 수집기 row 추가(기존 폴리마켓 수집기 패턴 동일).
- 브라우저 실검증(Chrome MCP): XAU 3심볼 테이블 정상, MLB 카드 `/validation`에서 사라지고 `/mlb`에서 정상 렌더, 상단 네비 "검증"→"MLB 스페셜리스트" 클릭 이동 확인, 콘솔 에러 0건.
- **저장소 동기화**: 데스크탑 미동기화 커밋(플랫폼 업그레이드 6종 + `/edges` 페이지) 확인 → `seokminal-dashboard`/`seokminal-multi-venue` 둘 다 commit→`git pull --no-rebase`(병합, git config 미변경)→충돌 해결→push 완료. `seokminal-multi-venue` 쪽은 `_EDGE_VAL_RUNNERS`(내 구버전) vs `research/hypothesis_registry.py` 기반 신규 아키텍처(origin) 충돌 — origin 채택 + `mlb_specialist_consensus`를 `warmable: True`로 승격(구현+수집기 라이브 기동 완료 확인됨, 테스트 갱신 포함). 최종 커밋: dashboard `ff88fc2`, multi-venue `adc93e9`.

### 변경된 파일
- `app/validation/page.tsx`, `app/mlb/page.tsx`(신규), `components/charts/EdgeReportCard.tsx`(신규), `lib/api.ts`, `components/Sidebar.tsx`, `app/hud/page.tsx`
- (multi-venue) `api_server/research_api.py`, `research/run_xau_session_backtest.py`, `research/hypothesis_registry.py`, `api_server/lab_api.py`, `tests/test_xau_backtest.py`, `tests/test_hypothesis_registry.py`

### 다음 할 일
- `/edges` 프론트 페이지(데스크탑 신규, 엣지 메타-대시보드) 브라우저 렌더 미확인 — 다음 세션에 확인.
- XAU TV 대조(유저 몫), MLB 데이터 축적(수집기 상시구동 중, 표본 쌓이면 자동 계산).

### 막힌 부분/결정사항
- MLB `warmable: True` 승격은 병합 중 내가 내린 판단(기계적 병합 아님) — 근거는 `load_and_report()` 구현 확인 + 수집기 라이브 확인, 두 전제 모두 레지스트리 자체 주석이 요구하는 승격조건과 일치.

---

## Phase 183 — ICT+오더플로우 페이퍼 트레이딩 엔진 구현 (2026-07-20) ✅ SHIPPED

사용자가 "ICT+오더플로우 합쳐서 거래 로그 적는 기능 이전에 요청했었다" + "금 전용 ICT 전략은 다른 클로드 세션에서 만들어 붙였다" 확인 요청 → 조사 결과 (1) `docs/superpowers/plans/2026-07-20-ict-orderflow-paper-engine.md`에 6-태스크 플랜은 이미 존재하지만 구현 0% 상태였고, (2) 금 ICT 전략은 완전히 별개 프로젝트(`~/Desktop/claude-test/ict-confluence-indicator/`)에 존재하지만 seokminal-multi-venue와 연결 안 됨(별건으로 남겨둠, 이번 세션에서 손대지 않음). 사용자가 "ICT+오더플로우 엔진 구현 시작" 선택 → `superpowers:subagent-driven-development` 스킬로 6개 태스크 전부 구현 완료, main에 직접 커밋, origin에 push까지 완료.

### 완료된 작업 (SHIPPED) — `seokminal-multi-venue` 저장소
6개 태스크 전부: implementer subagent → task reviewer(spec+quality 2개 verdict) → (필요시 fix+재리뷰) 사이클로 진행, 마지막에 최종 전체-브랜치 리뷰(opus) + fix 1회 + 재리뷰까지 완료.

- **Task 1** (`7c52ada`): `research/ict/paper/reversal_triggers.py` — LTF 1분봉 빌더(`LTFBarBuilder`) + 흡수(absorption)/스탑런(stop_run)/델타다이버전스(divergence) 반전 트리거 판정. 프론트 `lib/orderflow-data.ts`의 `detectAbsorption`/`detectStopRuns`/`detectDeltaDivergence` 임계값 그대로 1:1 포팅(재튜닝 없음).
- **Task 2** (`02070cb`→`cac6b4a`→최종수정 `0d97357`): `research/ict/paper/htf_zones.py` — HTF 15분봉 REST 폴링(`fetch_htf_bars`) + OB/iFVG 존 추적기(`ZoneTracker`). **리뷰 사이클 2번**: (a) 1차 구현에서 반영한 "존 플립 억제" 로직이 명세에 없는 변경이라 리뷰어 REJECT → verbatim 명세 코드로 롤백 + 테스트 픽스처만 수정하는 걸로 재수정. (b) 최종 전체-브랜치 리뷰에서 **Critical 버그** 발견: HTF 폴링이 겹치는 봉을 매번 재주입하면서 dedup이 없어 유령 존/스윙이 생성되는 문제 — timestamp 기반 dedup(재수신 봉 no-op, 형성 중인 봉은 in-place 덮어쓰기) + 무효화된 존 자동 프루닝(`_prune_stale_zones`) 추가로 수정, 재리뷰 통과.
- **Task 3** (`fdafee8`): `research/ict/paper/position_state.py` — 크래시 복구용 포지션 상태 JSON 저장/로드/삭제.
- **Task 4** (`17f10b2`): `research/ict/paper/journal_writer.py` — 거래 저널 CSV append (헤더 고정: `datetime,symbol,direction,ict_context,of_trigger,level_basis,entry,stop,target,risk_r,result_r,note`).
- **Task 5** (`440502b`): `research/ict/paper/state_machine.py` — `PaperEngine` (FLAT/IN_POSITION 상태머신, Task 1~4 통합, CISD 컨플루언스 확인 후 진입).
- **Task 6** (`4a717c4`): `research/run_ict_paper_engine.py` — Hyperliquid WS 오더플로우 스트림 + HTF REST 폴링 + `PaperEngine` 배선하는 상시 실행 진입점. `COIN="BTC"`, `HTF_POLL_SEC=900`, 저널은 `seokminal-dashboard/docs/orderflow-journal.csv`로 기록.

테스트: 격리 테스트 전부 통과, 전체 스위트 1217 passed / 5 failed (전부 기존부터 있던 무관한 실패 — test_auth.py×3, test_backtest_happy_path, test_orderflow_ib_adapter IB_PORT 환경변수 불일치).

**커밋 히스토리**: `f60608d..0d97357` (main에 직접 커밋, 8개 커밋) → `git push origin main` 완료.

### 아직 안 한 것 (다음 실행 시 수동 단계)
- **아직 실행 중이 아님** — 코드는 완성됐지만 tmux 세션으로 띄우는 건 사용자 몫: `tmux new -s ict-orderflow-paper 'cd .../seokminal-multi-venue && PYTHONPATH=. python3 research/run_ict_paper_engine.py'`
- 최종 리뷰에서 Minor로 남긴 것(고치지 않음, 향후 폴리시 대상): (1) 재시작 시 `ZoneTracker`의 존-소진(mark_consumed) 상태가 복원 안 됨 — 방금 청산한 존에 재진입 가능해짐, (2) 형성 중인 봉에서 파생된 존이 일시적으로 phantom "active" 상태로 남을 수 있음(가격이 무효화하면서 자연 소멸), (3) `active` 상태 존은 무효화 트리거 전까진 계속 쌓임(실전에선 자연 순환되지만 이론상 무제한).
- 30개 저널 항목 쌓이면 진행 상황 보고하라는 규칙 있음 (아직 거래 0건, 미해당).

---

## Phase 182 — HUD 수집기 kill/재시작 + 가격 트리거 자동화 브레인스토밍 착수 (2026-07-20)

사용자 "잠자기 같은거나 뭐 다운되어서 멈췄을 때에 hud에서 확인할 수 있게, 그리고 꺼졌을 경우에는 킬 수 있게 설정해줄래?" → HUD 수집기 kill+재시작 기능 SHIPPED. 이어서 "LangAlpha(외부 투자AI 플랫폼) 기능 어때?" 리서치 후 "가격 트리거 자동화 아이디어 브레인스토밍" 요청 → 진행 중 세션 종료.

### 완료된 작업 (SHIPPED)
- (백엔드) `api_server/lab_api.py`: `_tmux_process_status`가 기존엔 `tmux has-session`만 확인해 크래시(세션은 살아있는데 안의 python이 죽어 쉘만 남은 경우)를 못 잡던 문제 수정 — `tmux list-panes ... pane_current_command`로 실제 python 프로세스 생존까지 확인. `COLLECTOR_SESSIONS` 레지스트리(6개 수집기: polymarket_tick/arb/updown_arb, hl_orderflow_tick, cross_venue_skew_tick, polymarket_whale_tick) + `POST /lab/collectors/{key}/restart`(kill+재기동) 신규.
- (프론트) `lib/api.ts`: `CollectorKey` 타입, `restartCollector()`, `LabStatus.processes`에 `session_exists` 필드 추가. `app/hud/page.tsx`: `UnitCard`에 죽은 수집기용 빨간 깜빡임 OFF 배지 + 재시작 버튼(클릭 시 restartCollector 호출 → 토스트 → 즉시 재조회) 추가.
- 브라우저 라이브 검증: `cross-venue-skew-tick` tmux pane의 python 프로세스 강제 kill(-9) → HUD에서 OFF 배지+재시작 버튼 뜨는 것 확인 → 버튼 클릭 → "재시작 완료" 토스트 + ON 복구까지 실제 확인.
- 커밋 2건: `seokminal-multi-venue` f60608d(백엔드), `seokminal-dashboard` 450068c(프론트).

### 변경된 파일
- `seokminal-multi-venue/api_server/lab_api.py`
- `seokminal-dashboard/lib/api.ts`, `app/hud/page.tsx`

### 진행 중 — 가격 트리거 자동화 브레인스토밍 (미완료, 스펙 파일 없음)
LangAlpha(github.com/ginlix-ai/LangAlpha) 리서치 결과 참고 소재: "가격 연동 자동화"(가격 조건 도달 시 액션 실행) 개념. 기존 alert 시스템(`api_server/main.py:3500-`, `price_above/below`/`pnl_above/below`/`bot_error`/`bot_stopped`)은 **풀링 방식**(`GET /alerts/triggered` 호출될 때만 평가, 상시 백그라운드 루프 없음)이라 트리거돼도 "알림 표시"까지만 하고 액션 실행은 없음 — 이게 갭.

사용자가 원하는 액션 4종(전부 다 원함): ① 알림 강화(Slack/Discord 등 외부 채널 푸시) ② 리서치 자동 재실행(AI LAB 훅 필요, 미조사) ③ 페이퍼 포지션 자동 진입(`docs/superpowers/plans/2026-07-20-ict-orderflow-paper-engine.md`의 CISD+iFVG+오더플로우 컨플루언스 진입 로직과 겹침/충돌 가능성 — 같은 포지션 슬롯 쓰면 안 됨, 정리 필요) ④ 저널 자동 기록.

내가 제안한 단계 분리(사용자 응답 대기 중, 확정 안 됨):
- **1단계(이번 스펙 후보)**: 트리거 엔진 자체를 풀링→상시 백그라운드 루프(다른 수집기처럼 tmux 프로세스)로 전환 + 액션 ①(저널 기록, 가장 단순·사이드이펙트 없음), ②(알림 강화, 낮은 리스크)만 붙임
- **2단계 이후(별도 스펙)**: ③ 페이퍼 진입(ICT 엔진과 관계 정리 먼저), ④ 리서치 재실행(AI LAB 훅 존재 여부부터 조사)

### 다음 할 일
- **새 세션 시작 시**: 사용자에게 위 단계 분리 제안에 대한 답 받고 브레인스토밍 이어가기(`superpowers:brainstorming` 스킬 진행 중, 질문 1개 답변 대기 상태였음 — 컨텍스트 재확인 위해 이 progress.md와 대화 이어가면 됨). 아직 design spec 파일 생성 전 단계.
- ICT+오더플로우 페이퍼 엔진(`docs/superpowers/plans/2026-07-20-ict-orderflow-paper-engine.md`)도 여전히 미착수 상태로 남아있음 — Subagent-Driven vs Inline 실행 방식 미확정.

---

## Phase 181 — 호가 래더/COB 버그 수정 + ×1000 그룹핑 + OKX→Bybit 벤뉴 교체 (2026-07-19) ✅ SHIPPED

사용자 리포트 "100배했을 때 호가창 이거 너무 정보가 적어. 그리고 리퀴디티 풀 차트에서 안나오는거 이거 너무해" → 두 버그 root-cause. (a) ×100에서 행이 몇 개 안 채워짐: `orderflow/multi_venue_adapter.py`의 `VENUE_DEPTH_LEVELS`가 백엔드 어댑터가 실제 확보한 뎁스보다 앞서 잘라내고 있었음. (b) 온차트 COB 유동성 바가 캔들/현재가 근처에 안 뜸: `OrderBookPrimitive.ts`가 `bookBarLayout()`으로 순위 기반(차트 높이를 행 개수로 균등분할) y좌표를 썼던 게 원인 — 실제 가격과 무관하게 배치됨.

이어서 "오더플로우 실시간 풋프린트·호가·체결 흐름을... 이거 텍스트 지우고. 100배보다 더 높게 확대?" → 페이지 부제 제거 + ×1000 옵션 추가. 마지막으로 "okx 보다 폭이 넓다는거잖아. 바이비트로 대신 껴봐" → 멀티벤뉴 오더플로우 뎁스 소스를 OKX에서 Bybit로 교체(Binance >> OKX≈Bybit > Coinbase > Kraken 순으로 판단, Bybit가 OKX 대비 유동성 열위 아님).

### 완료된 작업
- (백엔드, `seokminal-multi-venue`) `orderflow/binance_adapter.py`: `DEPTH_SNAPSHOT_LIMIT`/`LOCAL_BOOK_MAX_LEVELS` 5000까지 확장(REST 공식 상한까지). `orderflow/multi_venue_adapter.py`: `VENUE_DEPTH_LEVELS` 150→3000, OKX 클라이언트/펌프 라벨(`okx-trades`/`okx-depth`)을 Bybit로 전면 교체.
- (신규) `orderflow/bybit_adapter.py` — `okx_adapter.py`와 동일 계약(`stream`/`stream_depth`, REST 없이 WS `type: snapshot/delta` 병합)으로 Bybit v5 퍼블릭 WS(`publicTrade.{symbol}`/`orderbook.200.{symbol}`) 신규 구현. `okx_adapter.py` 자체는 `research/run_cross_venue_skew_collect.py`가 여전히 참조 중이라 삭제하지 않고 유지.
- (신규) `tests/test_orderflow_bybit_adapter.py`, `tests/test_orderflow_multi_venue_adapter.py` 벤뉴 페이크 이름 bybit로 갱신.
- (프론트, `seokminal-dashboard`) `lib/orderflow-chart-coords.ts`: `bookBarLayout()`(순위 기반 레이아웃) 완전 제거. `OrderBookPrimitive.ts`: `series.priceToCoordinate(price)`로 실제 가격 기준 y좌표 렌더링으로 교체, `VENUE_LABELS`를 Bybit로 갱신.
- `OrderBookLadder.tsx`: `GROUP_MULTIPLIERS`에 1000 추가, `VENUE_LABELS`/`VENUE_ORDER` Bybit로 교체.
- `lib/i18n-utils.ts` + `components/PageBanner.tsx`: `page.orderflow.desc` 빈 문자열로 비우고 배너 쪽 조건부 렌더 가드 추가(빈 desc여도 `<p>` 안 뜨게).
- `lib/orderflow-data.ts`: 벤뉴 라벨 주석 갱신.

### 변경된 파일
- `seokminal-multi-venue/orderflow/{binance_adapter,multi_venue_adapter,bybit_adapter}.py`(신규 bybit_adapter), `tests/test_orderflow_{bybit,multi_venue}_adapter.py`
- `seokminal-dashboard/lib/{orderflow-chart-coords,orderflow-data,i18n-utils}.ts`, `components/PageBanner.tsx`, `components/orderflow/{OrderBookLadder.tsx,OrderBookPrimitive.ts}`, `tests/lib/orderflow-chart-coords.test.ts`

### 검증
- 백엔드: `pytest tests/ -q` 1173 passed(pre-existing 실패 5개 — test_auth×3, test_backtest_happy_path, test_orderflow_ib_adapter 무관 이슈 — 무시 대상과 일치).
- 프론트: `npx tsc --noEmit` 클린, `npx vitest run tests/lib/orderflow-chart-coords.test.ts` 15/15 통과.
- 브라우저 라이브 확인: COB 바가 현재가(64350-64650) 근처로 이동(수정 전엔 65200/64200에 붕 떠 있었음), 래더 3컬럼이 "BIN BYBIT HL"로 정상 렌더, ×1000에서 Binance~6행/Bybit~2행/HL~1행(과장 없이 실제 확보 뎁스 그대로), 온차트 COB 라벨도 "BIN BYBIT HL"로 정상 표시. WS로 `bybit-depth` 200레벨 라이브 확인.

### 다음 할 일
- 없음(요청 항목 전부 완료, 커밋 완료).
- 참고: `DEPTH_SNAPSHOT_LIMIT=5000`처럼 큰 뎁스 상한 올릴 때 `uvicorn --reload` 재기동이 60-100초 걸릴 수 있음(크래시 아님, REST 재스냅샷 시간).

---

## Phase 180 — Bloomberg UX/UI 업그레이드: 공통 프리미티브 + 전체 롤아웃 (2026-07-18) ✅ SHIPPED

사용자 요청 "전반적으로 UXUI 업그레이드하고싶어, 블룸버그 디자인 그대로 따라가면서". 37개 페이지 전체를 한 번에 손대지 않고 공통 프리미티브부터(전체 페이지에 자동 반영되는 지레점) + 이탈 심한 페이지 하나 파일럿으로 검증 → 승인 후 나머지 페이지 일괄 롤아웃 순서로 진행. SDD 없이 직접 구현.

진단: `app/globals.css`가 `@theme`로 `--radius*` 전부 0px 매핑해서 라운드 문제는 이미 토큰 레벨에서 해결돼 있었음(스크린샷에서 둥글어 보인 요소는 `rounded-full`류 별개 유틸, 이번 스코프 아님). 진짜 갭은 컴포넌트 레벨 중복 — 페이지마다 "border-row 세그먼트 토글" 패턴이 조금씩 다르게 재구현돼 있었고, `Panel`/`PanelHeader`(오렌지 헤더바) 안 쓰고 그냥 맨 폼으로 떠 있는 곳이 많았음.

### 완료된 작업
- `components/ui/Button.tsx` — variant(primary/buy/sell/outline/ghost) × size(sm/md) 버튼 프리미티브 신규.
- `components/ui/SegmentedToggle.tsx` — 제네릭 세그먼트 토글(`T extends string | boolean`), 옵션별 `activeClass` 오버라이드로 buy=pos색/sell=neg색 커스터마이즈 가능.
- `components/ui/index.ts` — 위 2개 + 기존 `Panel`/`PanelHeader` export 추가(additive, 기존 직접 import 안 깨짐).
- `components/market/TradeTab.tsx` — 파일럿: `Panel`/`PanelHeader`로 감싸고 세그먼트 토글 4개 + 제출/스테퍼/모달 버튼 전부 교체. 파일럿을 "after" 레퍼런스로 삼아 나머지 페이지 기계적 스왑.
- 롤아웃(7개 배치, 병렬 서브에이전트) — 28개 파일에 `Button`/`SegmentedToggle` 실적용(grep 검증): `app/agents,backtest,backtest/heatmap,calendar,copytrade,data-quality,event-study,forex,ict,insider,lab,macro,news,options,orders,pairs,polymarket,portfolio,search,signal,universe/page.tsx`, `components/{AutoResearchPanel,GroqSummaryPanel,backtest/MonteCarloPanel,market/AlertTab,market/SearchTab,notebooks/NoteBlockEditor,strategies/SaveStrategyForm}.tsx`.
- 각 배치는 "기계적 스왑만, 안 맞으면 스킵" 원칙으로 진행 — 예: 캘린더 Impact 필터(비활성 시 무테두리라 프리미티브 적용하면 시각적 변화 생김), OrderflowLegend/ComparisonTab의 다중선택·고정폭 정렬 제약, `futures`/`ib` 페이지의 disabled-per-option 필요 등은 의도적으로 미적용.

### 변경된 파일
- `seokminal-dashboard/components/ui/Button.tsx`(신규), `SegmentedToggle.tsx`(신규), `index.ts`
- 위 28개 파일(상세는 완료된 작업 참조)

### 검증
- `npx tsc --noEmit` 클린(전체), `npm test` 287/287 통과(회귀 없음)
- 브라우저 라이브 확인: `/market` → 매도/지정가 토글 클릭, 색상·레이아웃 정상(빨강 매도, 지정가 입력창 노출), 오렌지 PanelHeader 적용 확인.

### 다음 할 일
- 미커밋 상태 — 커밋 여부 사용자 확인 필요(작업 트리에 이번 롤아웃과 무관한 기존 미커밋 변경도 섞여 있어 스테이징 시 파일 단위로 골라야 함).
- `WatchlistSidebar.tsx`는 이미 밀도 있는 행 리스트라 이번 스코프 제외(재확인 결과 문제 없음).

---

## Phase 179 — Composite Value Area (2026-07-18) ✅ SHIPPED

Bookmap 기능 인벤토리(iceberg/big order alert/stop volume profile/options level/spotgamma/GEX/TPO/VA/composite VA 9개 점검) 중 유일하게 전무했던 composite VA 구현. SDD 없이 직접 구현(`feedback_no_process_theater`).

핵심 제약: 클라 라이브 버퍼가 `MAX_TIME_BUCKETS=300`(60s 버킷)로 ~5시간 캡 — Bookmap 원래 정의(여러 거래일 세션 병합)를 그대로 하려면 별도 히스토리 저장/조회 파이프라인이 필요한데, 백엔드에도 가격대별 히스토리 볼륨(틱 단위) REST 엔드포인트가 없어(`router_orderflow.py`엔 symbols/funding/WS뿐) 새 배관을 까는 건 요청 범위를 넘어선다고 판단. 대신 **정직한 스코프**로: 지금 버퍼 안에서 UTC 자정을 걸치는 구간이 생기면(크립토 24/7이라 거래소 세션 없음, UTC 캘린더 day가 세션 단위) 그걸 자동으로 별개 세션으로 인식해 합성 — 세션 2개 미만이면 `null`(표시 안 함, 가짜 composite로 오인 방지). 버퍼가 커지거나 향후 히스토리 배관이 생기면 같은 함수가 그대로 더 많은 세션을 합성함.

### 완료된 작업
- `lib/orderflow-data.ts` — `splitFootprintByUtcDay(cells)`(UTC day별 셀 분리, `vwapPeriodKey`의 day 앵커와 동일 규칙), `computeCompositeValueArea(dayProfiles)`: 세션별 볼륨 프로파일을 가격대로 합산 후 `computeValueArea()` 그대로 재사용(TPO와 동일 패턴, 신규 POC/VA 로직 없음), `CompositeValueArea = ValueArea & {sessionCount}`. 세션 <2개면 `null`.
- `components/orderflow/OrderflowChart.tsx` — `compositeValueArea` useMemo(footprint를 day로 쪼개 각각 volume profile → composite), 캔들 시리즈에 cPOC/cVAH/cVAL price line 추가(`layers.compositeValueArea` 게이트, TOKEN.info 색상으로 기존 POC/VA 주황과 구분), `OrderflowSignalPanel`에 prop 전달.
- `components/orderflow/OrderflowLegend.tsx` — `compositeValueArea` LayerKey 추가(기본 on), "cVA" 토글 칩(설명에 "세션 2개 이상 확보 시만 표시" 명시).
- `components/orderflow/OrderflowSignalPanel.tsx` — "주요 레벨" 섹션에 cPOC(N일)/cVAH/cVAL 행 추가(compositeValueArea null이면 자동 미표시).
- `tests/lib/orderflow-data.test.ts` — `splitFootprintByUtcDay` 2개, `computeCompositeValueArea` 3개(세션<2 null, 가격별 합산 후 POC/VA 검증, 합산 거래량 0이면 null) 추가.

### 변경된 파일
- `seokminal-dashboard/lib/orderflow-data.ts`
- `seokminal-dashboard/components/orderflow/OrderflowChart.tsx`, `OrderflowLegend.tsx`, `OrderflowSignalPanel.tsx`
- `seokminal-dashboard/tests/lib/orderflow-data.test.ts`

### 검증
- `npx tsc --noEmit` 클린, `npx vitest run` 287/287 통과(신규 5개 포함)
- 브라우저 라이브 확인 안 함 — 버퍼가 5시간 캡이라 세션 2개(UTC 자정 걸침) 조건이 실시간으로 재현하기 어려움. 다음 세션에서 자정 근처 시간대에 `/orderflow` 열어서 cVA 토글이 실제로 값을 채우는지 확인 권장.

### 막힌 부분 / 결정사항
- 진짜 다중일(수일치) composite는 백엔드 히스토리 볼륨 엔드포인트가 없어 이번 스코프에서 제외 — 필요해지면 틱 컬렉터(`research/data/hl_orderflow_tick`)를 세션별로 사전집계해 REST로 노출하는 방식으로 확장 가능.

### 다음 할 일
- 없음(요청 항목 완료). 자정 근처 브라우저 라이브 확인만 다음 세션 권장.

---

## Phase 178 — deepchart.com 갭 closing: 주간/월간 VWAP + 체결속도 + TPO + 스푸핑 휴리스틱 (2026-07-17) ✅ SHIPPED

deepchart.com 대비 기능격차 조사 후(replay UI, Deep-M 독점 블랙박스 모델은 제외 — 플랫폼의 "검증된 시그널만" 원칙과 안 맞음) 나머지 4개 항목을 오더플로우 콕핏에 추가. SDD 없이 직접 구현(`feedback_no_process_theater`). 사용자가 자리 비운 동안 4개 항목 전부 이어서 완료.

### 완료된 작업
- **주간/월간 VWAP**: `lib/orderflow-data.ts`의 `computeVwapBands(bars, period)` — UTC 캘린더 기준 앵커 리셋(일=ISO date, 월=ISO year-month, 주=epoch/7일 버킷 단순화). `OrderflowChart.tsx`에 일/주/월 3버튼 토글 추가(`OrderflowLegend.tsx`, localStorage persist, first-effect-guard 패턴으로 마운트 시 기본값 덮어쓰기 방지).
- **체결속도(Speed of Tape)**: 클라이언트 cell-diffing(rAF 배칭 탓에 부정확)이 아니라 백엔드 `orderflow/aggregator.py`에서 실체결마다 정확히 계산(`TAPE_WINDOW_SEC=10s` 롤링, frozen). `footprint_delta` 메시지에 `tape_trades_per_sec` 실어서 프론트로 전달 → `OrderflowSignalPanel`에 표시.
- **Market Profile(TPO)**: `computeTpoProfile()` — 30분 구간(`TPO_PERIOD_SEC=1800`, frozen)을 알파벳 1글자로 매핑(전통 CBOT 관례, 26개 넘으면 소문자 wrap). 기존 `computeValueArea()`를 "거래량" 대신 "구간터치횟수"로 재사용해 POC/VA 산출(신규 알고리즘 없음). 패널에 POC 중심 가격 래더로 표시(별도 캔버스 프리미티브 없이 우측 정보 패널 텍스트 섹션으로 — deepchart처럼 차트 위 레터 컬럼은 아니지만 POC/VA 정보량은 동일).
- **스푸핑 의심 휴리스틱**: `orderflow/aggregator.py`에 `_check_spoof_watch`/`_resolve_spoof_watch` 추가 — 같은 스냅샷 같은 사이드 잔량 중앙값 대비 5배 이상(`SPOOF_SIZE_MULTIPLIER`, frozen) 큰 레벨이 3초 이내(`SPOOF_MAX_LIFETIME_SEC`, frozen) 체결 없이 사라지거나 축소되면 `spoof_alert` 발생. **중요한 한계**: L2 스냅샷(가격×잔량)만 있고 거래소 order-id/추가·취소·정정 이벤트가 없어 진짜 스푸핑 탐지가 구조적으로 불가능 — 정상 유동성 인출이나 상위 25단계 depth 밖으로 가격 밀려난 경우도 같은 패턴을 만들어 오탐 가능. 프론트 전 구간에 `confidence: "low"` + 설명 문구를 강제로 동반 표시(패널 이벤트 피드 + 활용가이드 문구).

### 변경된 파일
- `seokminal-multi-venue/orderflow/aggregator.py` — `TAPE_WINDOW_SEC`/`_tape_speed`, `SPOOF_*` 상수/`_check_spoof_watch`/`_resolve_spoof_watch`/`_traded_at_price_between`
- `seokminal-multi-venue/tests/test_orderflow_aggregator.py` — tape_speed 2개, spoof_alert 5개 테스트 추가(17/17)
- `seokminal-dashboard/lib/orderflow-data.ts` — `VwapPeriod`/`computeVwapBands` 리셋 로직, `tapeSpeed` 필드, `computeTpoProfile`/`TpoLevel`/`TpoProfile`, `SpoofAlertMsg`/`SpoofAlert`/`applySpoofAlert`
- `seokminal-dashboard/hooks/useOrderflowSocket.ts`, `app/orderflow/page.tsx` — `tapeSpeed`/`spoofAlerts` 배선
- `seokminal-dashboard/components/orderflow/OrderflowChart.tsx`, `OrderflowLegend.tsx`, `OrderflowSignalPanel.tsx` — VWAP 기간 토글, 체결속도 표시, TPO 래더 섹션, 스푸핑 알림 피드
- `seokminal-dashboard/tests/lib/orderflow-data.test.ts` — VWAP 리셋 3개, tapeSpeed 2개, TPO 5개, spoofAlert 4개 추가(97/97)

### 검증
- `pytest tests/` 1145 passed — pre-existing 실패 5건만(test_auth.py×3, test_backtest_happy_path, test_orderflow_ib_adapter.py 포트 7497/7498 불일치), 신규 회귀 없음
- `npx tsc --noEmit` 클린, `npx vitest run` 282/282 통과
- 브라우저 라이브 확인은 안 함(사용자 부재중 자율 진행 지시라 코드리뷰+단위테스트로만 커버) — 다음 세션에서 `/orderflow` 페이지 라이브 확인 권장

### 막힌 부분 / 결정사항
- TPO는 deepchart처럼 차트 위 레터 컬럼 시각화 대신 우측 패널 텍스트 래더로 구현 — 신규 캔버스 프리미티브 없이 정보량은 동일하게 확보하는 절충. 나중에 시각적으로 더 필요해지면 `VolumeProfilePrimitive.ts` 패턴으로 캔버스 컬럼 추가 가능.
- 스푸핑 알림은 라이브 이벤트 전용(스냅샷에 과거분 없음, `emptyOrderflowState`/`applySnapshot` 둘 다 `spoofAlerts: []`) — 재접속하면 피드가 비워짐, 필요해지면 백엔드 aggregator에 최근 N개 버퍼링해서 snapshot()에 포함시키면 됨.

### 다음 할 일
- 없음 (요청 항목 4개 전부 완료). 브라우저 라이브 확인만 다음 세션 권장.

---

## Phase 177 — 실현 손익 대시보드 (OMS FIFO 매칭) (2026-07-17) ✅ SHIPPED

로드맵 "실매매 안전화 후속" 마지막 항목. 파다가 구멍 발견: KIS 주문 응답/상태조회 어디에도 실 체결가가 없음(`KISOrderClient._row_to_status_dict`는 filled/remaining만 반환), 라이브 브로커 커미션 캡처하는 코드도 전무(backtest용 `cost_bps`뿐). 지어낸 숫자를 실제 계좌 손익처럼 보여주면 더 위험하다고 판단 — 체결가는 브로커값 있으면 그것, 없으면(KR) 주문가로 "추정" 배지 달아 표시, 수수료는 env로 설정하는 bps 추정값으로 명확히 라벨링(`fee_model.py`, 기본 0=조정 없음). SDD 없이 직접 구현(`feedback_no_process_theater`).

또 하나 발견: `order_audit.jsonl`은 place 호출 순간 스냅샷이라 KIS/IB는 항상 filled=0으로 찍힘(체결은 비동기 확정) — PnL 계산은 `order_audit`이 아니라 이미 place/cancel/status 전체를 관통하는 `oms.py`의 최신 상태에서 가져와야 정확함. 대신 `oms.py`는 지금까지 symbol/side/price를 안 들고 있었어서(체결 진행률만 추적) 확장 필요했음.

### 완료된 작업
- `api_server/oms.py` 확장 — `record_event(venue, result, *, symbol=None, side=None)`. symbol/side는 place 호출 시점에만 알 수 있어(cancel/status 콜엔 없음) 한 번 세팅되면 유지(sticky). price는 `avg_fill_price`(IB)/`filled_avg_price`(Alpaca)를 발견할 때마다 갱신 — status/filled/remaining과 달리 종결 상태 이후에도 계속 갱신되게 함(IB가 Filled를 avg_fill_price보다 먼저 찍는 경우 늦게 온 진짜 체결가를 놓치면 안 됨).
- `api_server/fee_model.py` 신규 — venue별 `PNL_FEE_BPS_KR`/`_US`/`_US_OPTIONS` 환경변수 bps, 미설정 시 0.
- `api_server/order_pnl.py` 신규 — `compute_realized_pnl(orders, price_fallback)`: `oms.list_orders()` 결과를 venue+symbol별 FIFO 매칭(agent_perf.py와 동일 패턴). `price_fallback_from_audit(entries)`: order_audit 요청의 `price`/`limit_price`를 (venue, order_id)로 매핑 — OMS에 price 없는 주문(KR)만 이걸로 채우고 `price_source="estimated"` 표시, 그마저 없으면(KR MARKET) `unpriced_fills`에 세고 PnL 계산에서 제외.
- `api_server/main.py` — `GET /pnl/realized` 신규. place 호출 9곳 중 3곳(KR/US-Alpaca/US-IB/options place)에 symbol/side 전달 추가 — Alpaca 분기는 `filled_avg_price`가 raw 응답 `r`에만 있고 `resp`엔 없어서 OMS에 별도로 얹어 전달.
- `tests/test_fee_model.py`(4), `tests/test_order_pnl.py`(11), `tests/test_oms.py`에 symbol/side/price 캡처 테스트 4개 추가.
- 프론트 `app/pnl/page.tsx` 신규 — venue별 카드(총/수수료/순 실현손익 + 보유포지션 + 체결 로그), "추정" 배지로 브로커값 아닌 체결가 구분, 수수료 옆에 "(설정값, 추정)" 명시. `lib/api.ts`에 `getRealizedPnl`/`VenuePnl`/`PnlTrade` 추가. `Sidebar.tsx` "집행" 그룹에 "실현 손익" 추가.
- `docs/roadmap.md` — 이 항목 체크 처리. 겸사겸사 로드맵에 남아있던 stale 항목 정리: "ai-trader → /agents 완전 대체"는 코드베이스에 ai-trader 흔적이 이미 0개라 Phase 46에서 끝나 있었음(기록만 안 지워짐) — 체크 처리. "장중 5분 사이클 실가동 e2e"는 코드 작업이 아니라 장중에 직접 지켜봐야 하는 운영 확인이라 보류로 남겨둠.

### 변경된 파일
- `seokminal-multi-venue/api_server/oms.py`
- `seokminal-multi-venue/api_server/fee_model.py` (신규)
- `seokminal-multi-venue/api_server/order_pnl.py` (신규)
- `seokminal-multi-venue/api_server/main.py`
- `seokminal-multi-venue/tests/test_fee_model.py` (신규)
- `seokminal-multi-venue/tests/test_order_pnl.py` (신규)
- `seokminal-multi-venue/tests/test_oms.py`
- `seokminal-dashboard/lib/api.ts`
- `seokminal-dashboard/app/pnl/page.tsx` (신규)
- `seokminal-dashboard/components/Sidebar.tsx`
- `seokminal-dashboard/docs/roadmap.md`

### 검증
- `pytest tests/test_fee_model.py tests/test_order_pnl.py tests/test_oms.py tests/test_orders_api.py` 41/41, `pytest tests/` 1125 passed — pre-existing 실패 5건만(변경 전 main에서도 동일하게 실패함을 `git stash`로 재확인), 신규 회귀 없음
- `npx tsc --noEmit` 클린, `npm test` 266/266 통과
- 브라우저 라이브 확인(Chrome 확장) — `/pnl` 페이지 로드, 빈 상태 정상 렌더링, 콘솔 에러 없음. 실제 체결 있는 상태(수수료 적용/추정가 배지/포지션 카드) 렌더링은 라이브 주문 발생 전이라 코드 리뷰+단위테스트로만 커버(실 브로커에 모의주문 넣는 건 스코프 밖으로 판단해 안 함)

### 막힌 부분 / 결정사항
- KR(KIS) 체결가는 구조적으로 브로커가 안 줌 — `KISOrderClient`가 실 체결가를 캡처하려면 KIS API 자체를 더 파야 함(다른 엔드포인트 있는지 확인 필요), 지금은 주문가 추정으로 남겨둠. 나중에 KR 실계좌 비중 커지면 우선순위 올릴 것.
- 수수료 bps는 아직 아무 값도 안 정해짐(기본 0) — 실제 계좌의 진짜 수수료율 알게 되면 `.env`에 `PNL_FEE_BPS_KR` 등으로 채워 넣으면 바로 반영됨.

### 다음 할 일
- 요청 항목(백로그 3개) 전부 처리: ai-trader→/agents는 이미 완료 확인, PnL 대시보드는 이번에 완료, 장중 5분 사이클 실가동 e2e만 운영 작업으로 남음(장 열렸을 때 별도 진행).

---

## Phase 176 — OMS 레이어 (상태머신 + 부분체결 추적 + 주문현황 UI) (2026-07-17) ✅ SHIPPED

로드맵 "실매매 안전화 후속" 잔여 항목. 기존엔 `order_audit.py`가 append-only 이벤트 로그(제출/거절/에러)만 남기고 있었고, place/cancel/status 응답의 `status`/`filled`/`remaining`은 그 요청 순간에만 존재했다가 사라짐 — 재시작 없이도 "이 주문 지금 얼마나 체결됐나"를 한눈에 볼 방법이 없었음. 브로커별 상태 문자열도 제각각(KIS: SUBMITTED/OPEN/PARTIAL/FILLED/CANCELLED, IB ib_insync: PendingSubmit/Submitted/Filled/Cancelled/Inactive 등) — 프론트가 직접 브로커별 문자열 분기하지 않도록 서버에서 공통 상태로 정규화. SDD 없이 직접 구현(`feedback_no_process_theater`).

### 완료된 작업
- `api_server/oms.py` 신규 — in-process 상태머신. `(venue, order_id)` 키로 현재 상태 보관, `_derive_status(raw_status, filled, remaining)`가 브로커별 원문 상태 대신 `filled`/`remaining` 숫자를 우선해 정규 상태(OPEN/PARTIALLY_FILLED/FILLED/CANCELLED/REJECTED) 도출 — CANCELLED/REJECTED만 원문 문자열로 판별(체결 숫자만으론 구분 불가). 종결 상태(FILLED/CANCELLED/REJECTED) 도달 후 들어오는 모순 업데이트는 상태를 덮어쓰지 않고 `history`에만 적재(브로커 쪽 지연 응답 방어). `idempotency.py`와 동일하게 프로세스 재시작 시 초기화되는 게 의도(영구 기록은 기존 `order_audit.py` JSONL이 계속 담당).
- `api_server/main.py` — place/cancel/status 9개 엔드포인트(KR 3, US 3, options 3) 전부 브로커 응답을 `oms.record_event(venue, result)`로 흘려보내도록 배선. US paper(Alpaca) 분기는 `USOrderResponse.order_id`가 항상 0 placeholder(Alpaca 실제 id는 UUID, 필드는 int)라 그대로 넘기면 서로 다른 주문이 전부 같은 키로 뭉개짐 — Alpaca 응답의 실제 `id`를 OMS 키로 대신 사용하도록 처리. `GET /orders/oms` 신규(venue/status 필터 + limit, 최근 업데이트순) — 기존 `GET /orders/audit`(원본 이벤트 로그)는 그대로 유지, 성격이 다른 두 뷰로 병존.
- `tests/test_oms.py` 신규 7개, `tests/test_orders_api.py`에 OMS 반영 확인 테스트 1개 추가.
- `tests/conftest.py`의 전역 리셋 픽스처에 `oms._orders.clear()` 추가([[Phase 175]]에서 만든 `_ib_order_clients`/`idempotency._cache` 리셋과 동일한 이유 — 모듈 전역 상태라 테스트 간 누수).
- 프론트 `app/orders/page.tsx` 신규 — venue/status 필터, 체결 진행률 바, 클릭 시 주문별 `history` 펼쳐보기. `lib/api.ts`에 `getOmsOrders`/`getOrdersAudit` + `OmsOrder`/`OrderAuditEntry` 타입 추가(raw fetch 금지 컨벤션 준수). `Sidebar.tsx` "집행" 그룹에 "주문 현황 (OMS)" 메뉴 추가. 디자인 토큰만 사용(`bg-panel`, `text-pos/neg/warn/info` 등), 진행률 바 `style={{width}}`는 `risk-guard` 페이지 기존 관행 그대로 따름.

### 변경된 파일
- `seokminal-multi-venue/api_server/oms.py` (신규)
- `seokminal-multi-venue/api_server/main.py`
- `seokminal-multi-venue/tests/test_oms.py` (신규)
- `seokminal-multi-venue/tests/conftest.py`
- `seokminal-multi-venue/tests/test_orders_api.py`
- `seokminal-dashboard/lib/api.ts`
- `seokminal-dashboard/app/orders/page.tsx` (신규)
- `seokminal-dashboard/components/Sidebar.tsx`

### 검증
- `pytest tests/test_oms.py` 7/7, `pytest tests/` 1106 passed — pre-existing 실패 5건만(`test_auth.py`×3, `test_backtest_happy_path`, `test_orderflow_ib_adapter.py` flaky), 신규 회귀 없음
- `npx tsc --noEmit` 클린, `npm test` 266/266 통과
- 브라우저 라이브 확인(Chrome 확장) — `/orders` 페이지 로드, venue/status 필터 클릭 정상 동작, 콘솔 에러 없음(HMR/DevTools 로그만). 실제 주문 미체결 상태라 빈 목록만 확인 — 실 주문 흐름에서 부분체결 진행률/history 렌더링 자체는 미검증(코드 리뷰+단위테스트로만 커버)

### 다음 할 일
- 없음(요청 항목 완료). 실제 부분체결 케이스에서의 UI 확인은 라이브 주문 발생 시 함께 확인 권장.
- 남은 백로그: ai-trader → `/agents` 완전 대체, Polymarket whale validate 재실행(BLOCKED, 데이터 부족), 실시간 포지션·PnL 대시보드.

---

## Phase 175 — 주문 멱등성 + IB 연결 풀링 (2026-07-17) ✅ SHIPPED

로드맵 "실매매 안전화 후속" 잔여 항목. 두 개 독립 이슈 한 스코프로 묶어 처리: (1) 클라이언트 재시도 시 브로커에 중복 주문 위험 (2) `/orders/us`, `/orders/options` 6개 엔드포인트가 매 요청마다 `IBOrderClient` 새로 만들고 요청 끝나면 `close()` — TWS 핸드셰이크를 매번 반복. SDD 없이 직접 구현(`feedback_no_process_theater`).

### 완료된 작업
- `api_server/idempotency.py` 신규 — in-process TTL(5분)/사이즈캡(1000, 오래된 것부터 제거) 캐시, `(venue, client_order_id)` 키. `client_order_id` 없으면 완전 no-op(기존 클라이언트 하위호환).
- `KROrderRequest`/`USOrderRequest`/`OptionOrderRequest`에 `client_order_id: str | None = None` 옵션 필드 추가.
- `place_kr_order`/`place_us_order`(Alpaca paper 분기 포함)/`place_option_order` — 캐시 히트 시 재주문 없이 저장된 응답 바로 반환, 성공 시 결과 저장.
- `api_server/main.py`에 `_ib_order_clients: dict[(host,port,client_id), IBOrderClient]` 모듈 전역 풀 + `_get_ib_order_client()` 헬퍼 신규. `place_us_order`/`cancel_us_order`/`get_us_order_status`/`place_option_order`/`cancel_option_order`/`get_option_order_status` 6곳 모두 `IBOrderClient(...)` 직접 생성 → 헬퍼 호출로 교체, 매 요청 끝 `finally: await ib_client.close()` 제거. `IBOrderClient._ensure_connected()`가 이미 연결 상태면 no-op이라 재사용 시 안전. `IBClient`(히스토리컬 바용, 랜덤 client_id로 동시요청 충돌 회피 목적) 경로는 건드리지 않음 — 별개 이유로 풀링 대상 아님.
- 프론트 `client_order_id` 배선(주문 폼에서 UUID 생성해 전송)은 안 함 — 로드맵에 Backend 스코프로만 명시, UI 폼 컴포넌트 찾아 배선하는 건 별도 작업. 백엔드는 옵션 필드라 나중에 필요해지면 붙이면 됨.
- `tests/conftest.py` 신규 — 전역 `autouse` 픽스처로 `_ib_order_clients`/`idempotency._cache` 매 테스트 전후 리셋. 풀링 도입 후 `test_orders_us_api.py`(기존 파일) 테스트 2건이 이전 테스트가 심어둔 mock 인스턴스를 풀에서 재사용해버려 실패하던 것 발견해 수정 — 모듈 전역 상태는 세션 전체에 걸쳐 누수된다는 게 원인. 앞으로 비슷한 풀링/캐시 추가 시 이 패턴 따라갈 것.
- `tests/test_idempotency.py` 신규 7개, `tests/test_orders_api.py`에 멱등성/풀링 재사용 테스트 7개 추가(KR 1, US 3, options 2 + 기존 1).

### 변경된 파일
- `seokminal-multi-venue/api_server/idempotency.py` (신규)
- `seokminal-multi-venue/api_server/main.py`
- `seokminal-multi-venue/tests/conftest.py` (신규)
- `seokminal-multi-venue/tests/test_idempotency.py` (신규)
- `seokminal-multi-venue/tests/test_orders_api.py`

### 검증
- `pytest tests/test_idempotency.py` 7/7, `pytest tests/test_orders_api.py` 14/14 통과
- `pytest tests/` 1098 passed, pre-existing 실패 5건만(`test_auth.py` ×3, `test_backtest_happy_path`, `test_orderflow_ib_adapter.py` flaky 1건) — 신규 회귀 없음
- `python3 -c "import api_server.main"` 정상

### 다음 할 일
- 없음(요청 항목 완료). 프론트 `client_order_id` 배선은 필요 시 별도 작업으로.

---

## Phase 174 — KIS get_position 구현 (KR 봇 reconciliation) (2026-07-17) ✅ SHIPPED

로드맵 "실매매 안전화 후속" 잔여 항목 착수. `live_engine/engine.py::_reconcile_position`이 이미 봇 시작 시 `broker.get_position()`을 호출해 저장된 상태를 무시하고 실제 브로커 포지션으로 재설정하는 로직을 갖고 있었음(Phase 43에서 `IBBroker.get_position`만 구현하고 KIS는 미구현으로 명시적으로 남겨둠) — `KISBroker`만 `BrokerInterface`의 기본 `get_position`(`None` 반환, "항상 flat 시작")을 오버라이드 안 하고 있어서 KR 봇만 재시작 시 실제 보유 잔고를 무시하던 상태였음. SDD 없이 직접 구현(`feedback_no_process_theater`, 단일 파일 확정 스코프).

### 완료된 작업
- `live_engine/kis_broker.py::KISBroker.get_position` 신규 — 기존 `KISOrderClient.get_holdings()`(모의투자 `inquire-balance` API, 이미 구현돼 있었음)를 `asyncio.to_thread`로 감싸 호출, 종목코드 매칭되는 보유분을 `Position(side="LONG", ...)`으로 반환(KR 현물 계좌는 공매도 불가라 side 분기 불필요). 매칭 없으면 `None`(flat).
- `tests/test_kis_broker.py` 신규 3개 — 보유분 매칭/코드 불일치/빈 잔고(flat) 케이스.

### 변경된 파일
- `seokminal-multi-venue/live_engine/kis_broker.py`
- `seokminal-multi-venue/tests/test_kis_broker.py` (신규)

### 검증
- `pytest tests/test_kis_broker.py` 3/3 통과
- `pytest tests/` 1085 passed, pre-existing 실패 5건만(`test_auth.py` ×3, `test_backtest_happy_path`, `test_orderflow_ib_adapter.py` flaky 1건) — 신규 회귀 없음

### 다음 할 일
- 없음(요청 항목 완료). 실계좌 라이브 검증은 미실시(모의투자 API 경로만 코드 리뷰+단위테스트로 검증 — 실 KR 봇 재시작 시나리오는 실계좌 전환 시점에 함께 확인 권장).

---

## Phase 173 — NQ 오더플로우 라이브 검증 + IB 포트/선물 히스토리컬 바 버그 2건 수정 (2026-07-17) ✅ SHIPPED

Phase 168에서 미실시로 남았던 "TWS 켜고 NQ 실데이터 확인" 작업. 유저가 TWS를 이미 켜둔 상태([[Phase 172]])라 바로 진행 — `/orderflow`에서 NQ 선택하니 즉시 `[Errno 61] Connection refused`. 파고들어 보니 서로 독립된 버그 2개가 겹쳐 있었음.

### 근본 원인 1 — `IBClient` 포트 하드코딩
`backends/ib/client.py::IBClient`의 `port` 기본값이 `7497`로 하드코딩돼 있고 `IB_PORT` 환경변수를 아예 안 읽음. `orderflow/ib_adapter.py`(라이브 틱 데이터용, `os.environ.get("IB_PORT", "7497")` 패턴 이미 있음)와 정반대. 이 계정은 TWS가 커스텀 포트 7498을 쓰는데, `.env`에 `IB_PORT` 자체가 존재하지 않아 `IBClient()`를 쓰는 `/ib/bars`, `/ib/options/chain` 등 모든 엔드포인트가 이 계정에서 항상 refused였음(VRP만 자체 `_ib_port()` 기본값이 우연히 7498이라 안 걸렸던 것).

### 근본 원인 2 — 선물 히스토리컬 바 asset_type 미지정
포트 고친 뒤 NQ 선택하니 이번엔 `no historical bars returned for NQ ... check IB market data permissions`. `lib/chart-bars.ts::fetchBarsForSymbol`이 접미사 없는 심볼(NQ 포함) 전부 `asset_type: "stock"`으로 `/ib/bars` 호출 — NQ는 선물인데 주식으로 조회하니 당연히 빈 응답. `ib_adapter.py`엔 이미 NQ용 선물 계약 해석(`_FUTURES_SYMBOLS`, 만기 미지정 시 `reqContractDetailsAsync`로 front-month 자동 선택) 로직이 있었지만, 히스토리컬 바 경로(`backends/ib/client.py::get_daily_bars_future`)는 애초에 `expiry` 필수 파라미터였고 프론트도 넘긴 적이 없어 미구현 상태였음.

### 완료된 작업
- `backends/ib/client.py` — `IBClient.__init__`의 `port` 기본값을 `None`으로 바꾸고 `IB_PORT` 환경변수 읽도록 수정(`ib_adapter.py`와 동일 패턴).
- `.env` — `IB_PORT=7498` 추가(이 계정 TWS 커스텀 포트, 이전엔 아예 없었음).
- `backends/ib/client.py::get_daily_bars_future` — `expiry` 빈 문자열이면 qualify 실패(conId=0)를 감지해 `reqContractDetailsAsync`로 만기 지나지 않은 최근월물을 직접 선택하도록 추가(`ib_adapter.py::_resolve_contract`와 동일 패턴 재사용).
- `lib/chart-bars.ts` — `FUTURES_EXCHANGE` 매핑(`ib_adapter.py::_FUTURES_SYMBOLS`와 동일: NQ/MNQ/ES/GC) 추가, 매핑에 있으면 `asset_type: "future"` + `exchange`를 넘기도록 수정. 매핑 밖 심볼(AAPL 등)은 기존 `stock` 동작 그대로.

### 변경된 파일
- `seokminal-multi-venue/backends/ib/client.py`
- `seokminal-multi-venue/.env`
- `seokminal-multi-venue/tests/test_ib_client.py` (FakeIB에 `qualifyContractsAsync` conId 시뮬레이션 + `reqContractDetailsAsync` 추가, front-month 해석 테스트 1개 신규)
- `seokminal-dashboard/lib/chart-bars.ts`
- `seokminal-dashboard/tests/lib/chart-bars.test.ts` (NQ 테스트를 stock→future 기대치로 수정, AAPL stock 테스트 1개 신규)

### 검증
- 백엔드 `pytest tests/` 1083 passed, pre-existing 실패 3건만(`test_auth.py` ×2, `test_backtest_happy_path`) — 신규 회귀 없음. (`test_orderflow_ib_adapter.py`의 한 테스트가 전체 스위트에서 1회 흔들렸으나 단독/파일 단위 재실행 시 항상 통과 — 기존에도 있던 flaky, 이번 변경과 무관 확인)
- 프론트 `npx tsc --noEmit` 클린, `npx vitest run tests/lib/chart-bars.test.ts` 6/6 통과
- 브라우저 라이브 확인: `/orderflow`에서 NQ 선택 → 캔들스틱 28,xxx~29,xxx대 정상 렌더(나스닥100 선물 가격대 일치), "라이브" 상태, VWAP 값이 29,140.05→29,139.52로 실시간 갱신 확인. 콘솔 에러/경고 없음.

### 다음 할 일
- 없음(요청 항목 완료). 우측 패널 "워밍업 중 — 체결 표본 수집(20건 필요)"은 정상 초기 상태(틱 쌓이면 자동 해소).

---

## Phase 172 — VRP HUD stale 에러 표시 버그 수정 (2026-07-17) ✅ SHIPPED

HUD `VRP 아이언콘도어` 유닛이 `⚠ [Errno 61] Connection refused` 계속 표시. 처음엔 TWS/IB Gateway가 이 맥에 안 떠 있어서 난 진짜 에러였음(포트 7498 리스닝 없음) — 유저가 TWS 직접 켬. 근데 켠 뒤에도, `/vrp/run-now`로 수동 재시도해서 백엔드는 정상 성공(`entered:0, closed:0`, 새 scan_fail 로그 없음)했는데도 HUD는 계속 옛날 에러를 보여줌 — 이건 별도의 진짜 프론트 버그였음.

### 근본 원인
`vrp_bot.py::tick()`은 `last_run`을 매 tick마다 갱신하지만 `_log_event()`는 scan_fail/entry/exit 같은 "이벤트가 있을 때만" 기록함. 조용히 성공한(포지션 미진입) tick은 로그를 안 남김. `app/hud/page.tsx`가 `vrp.log[0]`(가장 최근 로그 항목)이 곧 최신 tick 결과라고 가정하고 그대로 표시 — 하지만 로그가 안 남는 성공 tick이 여러 번 지나가도 `log[0]`는 몇 tick 전 마지막 실패 그대로라 stale 에러가 계속 뜸.

### 완료된 작업
- `app/hud/page.tsx` — `vrp.last_run`과 `vrp.log[0].ts` 차이가 90초 이내일 때만 `log[0]`을 "이번 tick 결과"로 신뢰하도록 `lastLogIsCurrent` 가드 추가. 벗어나면 옛 에러 무시하고 `마지막 스캔 HH:MM:SS`로 표시.

### 변경된 파일
- `seokminal-dashboard/app/hud/page.tsx`

### 검증
- 프론트 `npx tsc --noEmit` 클린
- 브라우저 라이브 확인: TWS 켠 뒤 `/vrp/run-now` 수동 트리거 → `last_run` 14:01:37 UTC로 갱신, 신규 scan_fail 없음 → HUD `VRP 아이언콘도어` 카드가 `⚠ Connection refused`에서 `마지막 스캔 14:01:37`로 정상 전환 확인

### 다음 할 일
- 없음(요청 항목 완료).

---

## Phase 171 — OrderflowLegend Hydration 경고 수정 (2026-07-17) ✅ SHIPPED

Phase 167에서 미수정으로 남겼던 항목. "지금 문제 많은 것 같은데" 질문에 progress.md 미해결 목록 제시 → 유저가 이 항목 지목. SDD 미사용, 직접 수정(`feedback_no_process_theater`).

### 근본 원인
`OrderflowChart.tsx`의 `layers` state가 `useState(loadStoredLayers)`로 선언돼 클라이언트 첫 렌더(hydration) 때 곧바로 localStorage를 읽음. 서버는 `typeof window === "undefined"`라 `DEFAULT_LAYERS`(전부 on)로 SSR HTML을 그리는데, 클라이언트에 저장된 prefs가 있으면(레이어 하나라도 off) 첫 렌더 결과가 서버 HTML과 달라져 React hydration mismatch 발생.

### 완료된 작업
- `layers` 초기값을 `DEFAULT_LAYERS`로 SSR과 일치시키고, mount 후 `useEffect`에서 `loadStoredLayers()` 호출해 실제 값 반영
- persist effect(`[layers]` 의존)에 `layersFirstEffectRef` 가드 추가 — 마운트 첫 실행(아직 DEFAULT_LAYERS인 시점)에 localStorage를 덮어쓰지 않도록 방지. 가드 없으면 로드 effect가 반영되기 전에 기본값이 저장돼 사용자의 레이어 토글 설정이 초기화될 위험 있었음.

### 변경된 파일
- `seokminal-dashboard/components/orderflow/OrderflowChart.tsx`

### 검증
- 프론트 `npx tsc --noEmit` 클린, `npx vitest run` 265/265 통과(회귀 없음)
- ~~브라우저 라이브 콘솔 확인 미실시~~ — [[Phase 173]] 이후 세션에서 확장 연결 후 `/orderflow` 2회 refresh, hydration 경고 없음(React DevTools/HMR 로그만 존재) 확인 완료.

### 다음 할 일
- 없음(요청 항목 완료).

---

## Phase 169 — Polymarket Whale Tracking 가설 (2026-07-13) ✅ SHIPPED

유저 취침 중 "고래찾기 + 1초마다 돈버는 봇(아마 차익매매)" 요청, 허락 없이 야간 자율 작업 지시. 두 갈래로 처리: (1) whale tracking은 브레인스토밍→플랜→SDD 6-task 파이프라인으로 완성, (2) "1초마다 돈버는 봇"은 라이브 집행 봇으로 짓지 않고 스코프를 재해석해 처리(아래 참고).

### HUD 정리 (whale tracking 착수 전 선행작업)
- `api_server/lab_api.py`+`research/lab/service.py` — `cross_venue_skew_tick` HUD 상태 등록 + jarvis 브릿지 테스트. 프론트 `app/hud/page.tsx`+`lib/api.ts`도 동일 카드 추가. (커밋 `f4641e7`(백엔드), `b6b7a4f`(프론트))

### Whale Tracking 설계 결정 — "1초마다 돈버는 봇" 스코프
기존 CLOB WSS `market` 채널은 오더북 델타(book/price_change)만 있고 체결(fill)이 없음 — whale tracking엔 못 씀. Data-API `/trades`(공개 REST, 폴링) 채택. "1초마다 돈버는 봇" 요청은 라이브 집행 봇으로 짓지 않기로 결정 — Jarvis Quant OS의 arm_criteria(6개월 페이퍼 트레이딩 최소 기간) 안전장치를 취침중 "허락 맡지말고" 지시로도 우회하지 않음. 대신 두 갈래: (a) whale tracking 자체를 "고래 체결 후 가격 선행" 가설로 구현, (b) 차익매매 재해석은 별도 트랙으로 명시적으로 미룸(스펙 10절) — 크립토 up/down 5min/15min 초단기 마켓(현재 `market_selector`가 노이즈 이유로 제외 중인 패밀리)에서 페이퍼 전용 재검증, 다음 세션 과제로 남김.
- 스펙: `docs/superpowers/specs/2026-07-13-polymarket-whale-tracking-design.md` (커밋 `3c3cb3c`)
- 플랜: `docs/superpowers/plans/2026-07-13-polymarket-whale-tracking.md` (커밋 `6e3a57a`)

### 구현 (SDD 6-task, 전부 review clean)
- Task 1: `research/validation/cost_model.py` — `polymarket_effective_cost_bps()`(taker 0bps + spread/2, spread 200bps 근사치) + 테스트 3개. 커밋 `6649c85`.
- Task 2: `research/run_polymarket_whale_collect.py`(신규) — Data-API `/trades` 5초 폴링, Gamma 마켓스코프 5분마다 재조회(`market_selector.select_target_markets()` 재사용, news/sports만), transactionHash+timestamp 커서 dedup(링버퍼 2000), `research/data/polymarket_whale/{date}.jsonl` 저장, tmux `polymarket-whale-tick`. family 태그를 수집 시점에 붙임(스코프 필터링 때 이미 아는 값이라 검증러너 그룹핑용으로 원본에 저장 — 의도적 예외, 문서화됨). 테스트 10개. 커밋 `35a7f5f`.
- Task 3: `research/hypotheses/polymarket_whale.py`(신규) — notional z-score(condition_id별 롤링, LOOKBACK=100/WARMUP=20) → 스파이크 탐지(THRESHOLD=2.0) → 가격시계열(RESAMPLE_GRID_S=5s ffill) → 다중호라이즌(30/120/300s) forward return 라벨링. 구현 중 브리프 자체 버그 발견·수정: `build_price_series` 그리드 개수 계산이 floor division이라 그리드가 부족했음(`math.ceil`로 교체, 컨트롤러 사전승인 후 리뷰어 재검증 완료). 테스트 10개. 커밋 `dce0536`.
- Task 4: `research/run_polymarket_whale_validate.py`(신규) — family(news/sports)×horizon(3) 최대 6개 p-value, 방향 셔플 랜덤베이스라인(N_RUNS=500, SEED=42) 대비 empirical p-value, 신규 독립 BH-FDR 풀(alpha=0.1, 기존 가설 풀과 절대 안 섞음). 테스트 3개. 커밋 `9d2a45a`.
- Task 5: HUD 등록 — 백엔드 `api_server/lab_api.py`(`polymarket_whale_tick` 프로세스 상태, 커밋 `951687e`) + 프론트 `lib/api.ts`+`app/hud/page.tsx`(유닛카드, 커밋 `c5df7c7`).
- Task 6: 회귀+라이브 검증 — 백엔드 전체 스위트 1006 passed(pre-existing fail 4건만, 신규 회귀 없음), tmux `polymarket-whale-tick` 기동 확인, `/lab/status`에서 `running: True` 라이브 확인. 데이터 파일은 첫 고래 체결 잡히기 전이라 아직 미생성(정상, append 시점에 생성).

### 다음 할 일
- 고래 데이터 며칠 쌓인 뒤 `run_polymarket_whale_validate.py` 재실행해 p-value/BH-FDR 결과 확인 — 지금은 막 기동해서 데이터 없음(BLOCKED 예상).
- 별도 트랙(크립토 up/down 초단기 마켓 차익매매 페이퍼 재검증)은 [[Phase 170]]에서 착수·완료.

---

## Phase 170 — 크립토 up/down 초단기 마켓 차익 재검증 트랙 (2026-07-13) ✅ SHIPPED

Phase 169 스펙 10절에서 미룬 항목. 기존 `research/polymarket_arb/*`(일반 차익 스캐너, `MIN_DAYS_TO_RESOLUTION=3` 플로어라 5분/15분 up/down 마켓은 전부 걸러짐)와 `run_polymarket_arb_validation.py`(완전 제네릭, `--data-dir`만 바꾸면 재사용 가능)를 조사한 결과 스코프가 예상보다 훨씬 작음을 확인 — 신규 검증러너나 가설 파이프라인 불필요, 셀렉터+얇은 수집기 진입점+클라이언트 필드 추가+HUD 등록만 필요. SDD 없이 직접 구현(`feedback_no_process_theater`, 소규모 확정 스코프).

### 구현
- `polymarket/client.py` — `slug`, `end_datetime`(전체정밀도 ISO) 필드 additive 추가(기존 `end_date`는 날짜만 truncate 유지, 기존 소비자 무영향) + `get_updown_markets()`. 초기엔 `order=startDate desc`로 짰다가 라이브 검증에서 0건만 골라지는 버그 발견 — up/down 마켓은 실제 판정 5분/15분 구간보다 ~24시간 먼저 개설되므로 최신개설순 정렬로는 "막 열린(마감 24h 남은)" 마켓만 잡힘. `end_date_min=now` + `order=endDate asc`로 수정해 마감임박 마켓부터 받도록 고침.
- `research/polymarket_arb/updown_selector.py`(신규) — `select_updown_markets()`: 슬러그 패턴(`{coin}-updown-{5m|15m}-{ts}`) + 마감임박(기본 15분 이내) + 최소유동성(`MIN_LIQUIDITY=1000`, 일반 5000보다 낮음 — 라이브 확인 결과 마감임박 up/down 마켓 유동성이 2000~15000대로 관측된 미검증 근사치) 필터링하는 순수함수. 테스트 8개.
- `research/run_polymarket_updown_arb_scan.py`(신규) — 얇은 수집기 진입점. `collector.py::snapshot_market`/`detector.py::evaluate_snapshot`을 그대로 재사용(신규 판정로직 없음), `research/data/polymarket_updown_arb/{date}.jsonl` 저장, tmux `polymarket-updown-arb`, 5초 폴링. 테스트 5개.
- HUD 등록 — 백엔드 `api_server/lab_api.py`(`polymarket_updown_arb` 프로세스 상태) + 프론트 `lib/api.ts`+`app/hud/page.tsx`(유닛카드, href `/lab`).
- 검증은 기존 `research/run_polymarket_arb_validation.py --data-dir research/data/polymarket_updown_arb`를 그대로 재사용(신규 파일 없음, 데이터 쌓인 뒤 실행).

### 검증
- 백엔드 전체 스위트 1023 passed(pre-existing fail 4건만, 신규 회귀 없음).
- 프론트 `npx tsc --noEmit` 0 errors.
- tmux `polymarket-updown-arb` 기동, `/lab/status`에서 `running: True` + `last_write` 갱신 라이브 확인(수정 후 마감임박 마켓 27건 실제로 잡혀 스냅샷 기록 시작).

### 다음 할 일
- 차익 스냅샷 며칠 쌓인 뒤 `run_polymarket_arb_validation.py --data-dir research/data/polymarket_updown_arb` 실행해 go/no-go 판정(REJECT_NO_PERSISTENT_RUNS / REJECT_NO_POSITIVE_MARGIN / CANDIDATE).
- `MIN_LIQUIDITY=1000`, `MAX_MINUTES_TO_RESOLVE=15.0`는 미검증 근사치 — 표본 쌓이면 재조정 검토.

---

## Phase 167 — 오더플로우 히트맵 성능/보존창 개선 (2026-07-12) ✅ SHIPPED

"히트맵이 차트 하나에 조금만 나온다, 유동성 풀이 안 보인다" + Bookmap 레퍼런스 이미지(IMG_9389/9390) 비교 요청. SDD 미사용, 직접 진행(`feedback_no_process_theater`).

### 근본 원인 진단
1. 보존창이 너무 짧음 — 백엔드 `heatmap_max_window_sec`(300s) / 프론트 `MAX_TIME_BUCKETS`(footprint와 공용, heatmap 기준 10분)가 기본 차트 가시범위(~90분)보다 훨씬 짧았음.
2. 더 심각한 문제: `on_book_snapshot()`이 매 틱(초당 ~16.7회)마다 near-touch 레벨 최대 50개를 무조건 재전송 → 실측 초당 835건 `heatmap_delta`. 프론트도 메시지 하나마다 `setState`(Map 통째 복사+O(n) 이벤트 스캔) → 보존창을 단순히 늘리면 이 비용이 그대로 배로 늘어 브라우저 탭이 멎을 위험.
3. Bookmap 이미지 재검토 결과 캔들 없는 연속 틱 렌더링(우리 차트는 60초봉 단위로 히트맵을 뭉개는 구조) — 시각적 밀도 차이의 상당 부분은 보존기간이 아니라 캔들 해상도 문제. 5초봉 도입은 검토 후 기각(BTC 스윙 트레이딩엔 과함, NQ/XAU 스캘핑용 니즈 아님).

### 백엔드 (`seokminal-multi-venue`, `orderflow/aggregator.py`)
- `on_book_snapshot()`: 같은 `(bucket_ts, price)` 키의 size가 안 바뀌면 delta 생략(diff). 실측 835/s → ~108/s.
- `heatmap_max_window_sec`(내부 보존) 300s → 5400s(90분)와 `heatmap_snapshot_window_sec`(신규 접속자 초기 snapshot() 페이로드, 600s=1MB WS 한도 내) 분리 — 내부 보존을 늘려도 신규 접속 페이로드 크기엔 영향 없음, 이미 붙어있는 클라는 delta 스트림으로 자연 누적.
- 테스트: `tests/test_orderflow_aggregator.py` +2 (diff 스킵, snapshot 슬라이싱) — 10/10 통과.

### 프론트 (`seokminal-dashboard`)
- `hooks/useOrderflowSocket.ts`: 메시지마다 하던 `setState`를 ref 누적 + rAF 1프레임당 1회 flush로 변경.
- `lib/orderflow-data.ts`: `MAX_TIME_BUCKETS`(footprint 전용, 5h)와 `MAX_HEATMAP_TIME_BUCKETS`(신규, 2700=90분) 분리.
- 커밋: `5a699fc`(rAF 배치), `49e3984`(백엔드 diff), `110d096`(프론트 보존창 분리), `9505543`(백엔드 스냅샷/보존 분리).

### 검증
- 백엔드 10/10, 프론트 265/265, tsc 클린.
- 실측 WS 캡처(10초 접속): heatmap_delta 108.3/s, footprint_delta 33.8/s, book_snapshot 2.5/s.
- 브라우저 라이브 확인: 정상 렌더/갱신, 콘솔 에러 없음(기존부터 있던 무관한 hydration 경고 1건 재확인 — `OrderflowLegend.tsx` className 서버/클라 불일치, 이번 작업과 무관, 미수정 상태로 남음).

### 다음 할 일
- `OrderflowLegend.tsx` hydration 경고(className 서버/클라 불일치) — [[Phase 171]]에서 수정 완료(원인은 `OrderflowLegend.tsx` 자체가 아니라 `OrderflowChart.tsx`의 layers state 초기화였음).

---

## Phase 168 — NQ 오더플로우 점검 + client_id 충돌 수정 (2026-07-12) ✅ DONE

유저 요청 "nq 붙여줘". 조사 결과 **이미 다 구현되어 있었음** — 위 Phase 167에 적었던 "신규 IB 라이브 뎁스 어댑터 필요"는 틀린 판단(정정). `orderflow/ib_adapter.py::IBOrderflowClient`가 `reqMktDepth`+`reqTickByTickData`로 이미 구현돼 있고, 프론트 `InstrumentSelect.tsx`에도 "NQ" 이미 등록, `manager.py`가 `.HL` 아닌 심볼을 자동으로 IB로 라우팅. 기존 테스트도 통과 상태였음.

유일하게 실제로 발견한 문제: `IBOrderflowClient` 기본 `client_id=1`이 `live_engine/ib_broker.py`의 데이터클라 client_id=1과 충돌 — 라이브 봇 구동 중 오더플로우 스트림(NQ 등) 동시 오픈 시 같은 IB Gateway에서 접속 거부/킥 위험. 기본값 20으로 변경, `IB_ORDERFLOW_CLIENT_ID` env override 추가. 커밋 `fd1c755`. 테스트 20/20 통과.

### 다음 할 일
- ~~IB Gateway/TWS 실접속 라이브 테스트 미실시~~ — [[Phase 173]]에서 실시, 이 과정에서 별도 IB 포트/선물 히스토리컬 바 버그 2개 발견·수정.
- 프론트에서 NQ+ES 등 non-.HL 심볼 2개 이상 동시에 띄우면 여전히 같은 client_id(20)로 충돌 — 현재 프론트 datalist엔 NQ만 노출돼 있어 당장 리스크 낮음, 필요해지면 워커별 client_id 할당 로직 추가.

---

## Phase 166 — HL 펀딩비+OI 패널 + 청산 히트맵 추정 (2026-07-12) ✅ SHIPPED

Phase 165에서 "미착수(백엔드 필요)"로 남겼던 2건 요청 → "펀딩비, 청산 히트맵 추정 작업 진행해줘"로 착수. SDD 미사용, 기존 GEX 폴캐시 패턴 그대로 복제(`feedback_no_process_theater`).

### 백엔드 (`seokminal-multi-venue`)
- `orderflow/hl_funding.py` (신규) — `orderflow/gex.py`와 동일 폴캐시 패턴. `hyperliquid.client.get_meta_and_ctxs()`(기존 함수, 재사용)를 `asyncio.to_thread`로 60초마다 폴링, coin별 funding/OI/markPx/prevDayPx/dayNtlVlm 캐시. fetch 실패 시 마지막 캐시 유지(clear 안 함).
- `api_server/router_orderflow.py` — `GET /orderflow/funding/{coin}` 추가, 캐시 미스 시 0값 기본 응답.
- `api_server/main.py` — startup에 `funding_poll_loop()` task 추가.
- 테스트: `test_orderflow_hl_funding.py`(6개, 신규) + `test_router_orderflow.py`(+3개) — 전부 통과.

### 프론트 (`seokminal-dashboard`)
- **청산 히트맵은 추정치임을 명시** — HL 공개 체결 스트림에 청산 플래그 없음(`orderflow/models.py::TradeEvent` 확인) → 실측 불가. OI+funding 부호 기반 근사치로 구현하고 UI에 "실제 청산 데이터가 아닙니다" 디스클레이머 명시(패널 본문 + 범례 hover).
- `lib/orderflow-data.ts` — `hlCoinForSymbol()`("COIN.HL"→"COIN", 전 종목 지원 — `currencyForSymbol`과 달리 BTC/ETH 한정 아님) + `estimateLiquidationLevels()`(레버리지 3/5/10/20/50x 구간별 청산가 `entry*(1∓(1/L−0.005))`, funding 부호로 롱/숏 비중 약 skew).
- `lib/api.ts` — `getHlFunding()` 추가.
- `hooks/useFundingSnapshot.ts` (신규) — `useGexSnapshot.ts` 패턴 복제, 60초 폴링 + 5분 stale 판정.
- `components/orderflow/LiquidationLevelsPrimitive.ts` (신규) — `GexLevelsPrimitive.ts` 구조 복제, 롱청산(빨강)/숏청산(초록) 점선 + 레버리지 라벨.
- `components/orderflow/FundingPanel.tsx` (신규) — 펀딩비(1h)/연율화/OI/전일대비 4칸 + 디스클레이머 텍스트, GEX 패널 위에 배치.
- `components/orderflow/OrderflowLegend.tsx` — "청산(추정)" 칩 추가.
- `components/orderflow/OrderflowChart.tsx`, `app/orderflow/page.tsx` — wiring.

### 검증
- 백엔드 `pytest tests/ -q` 879 passed / pre-existing 4 fail(문서화된 목록과 일치, 회귀 없음)
- 프론트 `npx tsc --noEmit` 클린, `npx vitest run` 265/265 통과(신규 12: orderflow-data 9 + api-hl-funding 3)
- 브라우저 라이브 확인: `/orderflow` BTC.HL — 범례에 "청산(추정)" 칩, 하단 "BTC 펀딩비 · OI" 패널(펀딩비 0.0013%, 연율화 10.9%, OI 37,335.8 BTC, 전일대비 -0.26%, mark 63,894 — 전부 실데이터) + 디스클레이머 문구 정상 렌더, 기존 GEX 패널/시그널 패널 회귀 없음, 콘솔 에러 없음.

### 다음 할 일
- 없음(요청 2건 완료). 청산 라인이 현재 차트 줌 레벨에서 시각적으로 화면 밖(가격범위 대비 레버리지 거리)일 수 있음 — 필요시 차트 줌아웃해서 확인, 기능 자체는 단위테스트로 수식 검증 완료.

---

## Phase 165 — Orderflow 보조지표 5종 (2026-07-12) ✅ SHIPPED

"같이 쓰면 좋은 지표" 요청 → 프론트 전용 5종 직접 구현 (커밋 99f85a7):

- **POC/VA** — `computeValueArea()` (POC + 70% Value Area 탐욕 확장), 캔들 price line(POC 주황 실선+축 라벨, VAH/VAL 점선)
- **VWAP ±1σ/±2σ** — `computeVwapBands()` (σ²=Σv·tp²/Σv−vwap² 증분식), 가격 페인 노란 실선+회색 점선 밴드
- **델타 다이버전스** — `detectDeltaDivergence()` (20봉 신고/신저 + 반대 델타, |델타|≥총량 25% 게이트), 보라 원 마커 + 이벤트 피드
- **델타 히스토그램** — `computeDeltaSeries()` (CVD 비누적 버전), 서브페인
- **세션/전일 고저** — `computeSessionLevels()` (UTC 자정 경계), 점선 price line

시그널 패널에 "주요 레벨" 섹션(가격순 정렬 + 현재가 대비 ▲위/▼아래), 범례에 VWAP/POC·VA/세션고저/델타 토글 4개 + 다이버전스 마커 칩, 활용 가이드 3줄 추가. CandlestickChart에 `vwapSeries`/`deltaSeries`/`divergenceMarkers` prop. price line은 OrderflowChart가 candleSeries ref로 직접 관리(매 갱신 remove→create).

검증: tsc 클린, 253/253(신규 17), 브라우저 라이브 확인(VWAP 선·POC 라벨·주요 레벨 판독·델타 페인·콘솔 클린).

미착수(백엔드 필요): HL 펀딩비+OI 패널, 청산 히트맵.

---

## Phase 164 — Orderflow UX 강화: 범례/토글 + 시그널 패널 (2026-07-12) ✅ SHIPPED

"뭐가 뭔지 모르겠어, 실시간 매매에 활용" 요청. 캔버스 8겹 오버레이에 라벨/설명 전무했던 문제 해결. 경량 직접 구현(SDD 미사용).

### 추가된 것
- **레이어 범례바** (`components/orderflow/OrderflowLegend.tsx` 신규): 8개 오버레이 칩(히트맵/풋프린트/SVP/CVP/호가래더/대량체결/GEX/임밸런스) — 색 견본 + hover 설명 + 클릭 토글, 흡수/스탑런 마커 설명 칩. 토글 상태 localStorage(`orderflow-layers`) 유지.
- **시그널 패널** (`components/orderflow/OrderflowSignalPanel.tsx` 신규, 차트 우측 w-72): 종합 편향(호가+체결+CVD 3신호 중 2개 합의 시 매수/매도 우위), 임밸런스 게이지 2종(호가 잔량/최근 체결 매수%), CVD 값+10봉 기울기, 아이스버그 의심 레벨 목록(매수벽/매도벽+비율), 이벤트 피드(흡수·스탑런·대량체결 시간순 14건), 접이식 활용 가이드.
- **캔버스 라벨**: SVP·30분/CVP·전체 컬럼 헤더 텍스트, 임밸런스 바에 "호가/체결 매수 N%" 텍스트.
- **전 primitive `setVisible()`**: 7개 primitive에 visible 플래그 + draw 가드 (renderer 최상단 early return).

### 검증
- tsc 클린, 236/236 테스트 통과, 브라우저 라이브 확인(범례/패널/라벨 렌더, 히트맵 토글 on/off 동작, 피드 실시간 갱신, 아이스버그 감지 표시, 콘솔 에러 없음). 커밋 14bbf12.

---

## Phase 163 — Orderflow Cockpit v2: Bookmap 기능 5종 (2026-07-12) ✅ SHIPPED

"저 bookmap이라는 사이트의 기능을 다 쓰고싶어서" 요청으로 브레인스토밍→플랜→SDD 10-task 파이프라인 전체 실행(implementer haiku, task reviewer sonnet, 통합 task 10은 sonnet, 최종 브랜치 리뷰 opus). `/orderflow` 페이지에 Bookmap 대비 5개 기능 추가:

- **Volume Profile (SVP+CVP)** — `computeVolumeProfile()`, 3컬럼 인셋 좌측 2칸(SVP=30분 롤링, CVP=전체)
- **Iceberg/refill 감지** — `detectIcebergLevels()`(CVP÷book 비율≥5, noise floor 20×median), COB 인셋에 warn색 테두리 하이라이트
- **Stop-run 감지** — `detectStopRuns()`(20봉 돌파+반전, 10×median 거래량 게이트), 캔들차트에 "스탑런" 마커
- **Book%/Volume% 임밸런스 바** — `computeImbalance()`, 차트 좌상단 고정 오버레이 2줄 바
- **COB 숫자 래더** — 행 높이 9px 이상일 때 수량 텍스트 표시, 3컬럼 레이아웃(SVP/CVP/COB)을 `stackedInsetColumns()`로 통일

### 파일
- `lib/orderflow-data.ts` — 4개 pure function 추가 (Task 1-4)
- `lib/orderflow-chart-coords.ts` — `stackedInsetColumns()` (Task 5)
- `components/orderflow/VolumeProfilePrimitive.ts` (신규, Task 6)
- `components/orderflow/OrderBookPrimitive.ts` (3컬럼+iceberg+래더로 전면 교체, Task 7)
- `components/orderflow/ImbalanceBarPrimitive.ts` (신규, Task 8)
- `components/CandlestickChart.tsx` — `stopRunMarkers` prop 추가 (Task 9)
- `components/orderflow/OrderflowChart.tsx` — 전체 wiring (Task 10)

### 버그 1건 (Task 6 fix round)
플랜 브리프 코드 자체에 있던 버그: 단일 가격레벨일 때 이웃탐색이 `sortedPrices[-1]`(undefined)로 빠져 NaN 좌표 생성 → 캔버스가 조용히 그리기를 건너뜀(크래시 없음). 고정 20px 높이의 단일레벨 분기 추가로 수정, 재검토 통과.

### 검증
- `npx tsc --noEmit` 클린, `npm test` 236/236 통과 (전 태스크 공통)
- 최종 브랜치 리뷰(opus): cross-task 데이터플로우(ts_event 나노초→초 단위 정합), 3컬럼 상수 동일성(SVP/CVP/OrderBookPrimitive 3파일), z-order 충돌 없음, 심볼전환 시 fail-closed 안전성(rollingMedian≤0 가드) 모두 재검증 완료. Critical/Important 0건, Minor 3건(전부 비차단, 기존에 이미 알려진 항목).
- 브라우저 스팟체크 완료: `/orderflow` BTC.HL 라이브. 3컬럼 인셋 좌→우 SVP(초록/빨강 분할 바)→CVP(동일)→COB 숫자 래더+깊이 바 순서로 명확히 구분 렌더 확인(줌 스크린샷). COB 인셋 수량 텍스트("0.84, 0.41..." 등) 정상 표시, "BIN HL OKX" 뱃지 정상, 임밸런스 바 좌상단 2줄 정상, 콘솔 에러 없음.

### 다음 할 일
- 없음 — 10개 태스크 + 버그수정 1건 + 최종 리뷰 + 브라우저 검증 전부 완료
- main에 이미 직접 커밋됨 (base 7ca137c..5e0b334, 12 commits) — 별도 머지 불필요

---

## Phase 162 — uvicorn reload 행(hang) 근본원인 수정 + liquidity pool 벤뉴 뱃지 UI (2026-07-11) ✅ DONE

로컬 IB TWS 켜서 ES/GC/NQ 라이브 검증(별도 항목, `seokminal-multi-venue/docs/progress.md` 참고) 후 "더 업그레이드할 거 없나" 질의에 대한 후속 2건. SDD 없이 직접 진행(`feedback_no_process_theater` 컨벤션).

### 1) uvicorn `--reload` 무한 행 근본원인
반복 재발하던 백엔드 reload/shutdown 행이 우연한 오브젝트가 아니라 구조적 버그였음: `timeout_graceful_shutdown` 기본값이 `None`이라 `asyncio.wait_for(..., timeout=None)`이 절대 타임아웃 안 나서 강제 `cancel()` 분기가 못 걸리고, `/ws/orderflow/{symbol}` 핸들러가 `websocket.receive()` 없이 `await queue.get()`으로만 블록해서 disconnect를 능동감지 못함 — 새 메시지 안 들어오면 shutdown 영구 대기. 코드 버그 아니라 CLI 미설정 문제로 판단, 부모 `CLAUDE.md`의 백엔드 실행커맨드에 `--timeout-graceful-shutdown 10` 추가로 해결.

### 2) liquidity pool 벤뉴 뱃지 UI
멀티벤뉴 오더북 풀링(HL+Binance+OKX)이 화면상 구분 안 되던 걸(이전 세션 노트) 노출.
- `lib/orderflow-data.ts` — `OrderBookState`/`BookSnapshotMsg`에 `venues: string[]` 추가, `emptyOrderflowState`/`applySnapshot`/`applyBookSnapshot` 반영.
- `components/orderflow/OrderBookPrimitive.ts` — COB 인셋 우상단에 `HL`/`BIN`/`OKX` 텍스트 뱃지로 현재 풀 기여 벤뉴 렌더링.
- 백엔드(`seokminal-multi-venue`)는 `OrderBookSnapshot.venues` 필드 신규 + `_pool_books`/`latest_book`이 채워서 WS로 전달(별도 커밋).

### 검증
- 프론트 215/215 통과, `npx tsc --noEmit` 클린. 백엔드 870 passed(pre-existing 4개 실패만).
- 브라우저 라이브 확인: `/orderflow` BTC.HL COB 인셋에 "BIN HL OKX" 뱃지 정상 렌더링, 콘솔 에러 없음.

### 다음 할 일
- 없음(요청 범위 완료)

---

## Phase 161 — 대량체결 임계값 백테스트 + 폭주붕괴 버그 수정 + 바이낸스/OKX 체결 합류 (2026-07-11) ✅ DONE

Phase 160 노트에 남아있던 "대량체결/흡수 임계값 미백테스트" 후속. SDD 없이 직접 진행(`feedback_no_process_theater` 컨벤션).

### 백테스트로 발견한 버그
`applyLargeTradeTracking`(대량체결 판정)이 median×3 고정배수 + 대량체결은 표본에서 제외하는 로직이었는데, HL 체결크기 분포가 극단 우편향(p50=0.0022, p90=0.149, ~68배 스프레드)이라 제외 로직과 맞물려 median이 최솟값 근처로 폭주 붕괴 → BTC 기준 틱의 **70%**가 대량체결로 오탐되고 있었음(78,292건/2일). Phase 160의 "버블 겹쳐서 안 보임" 리포트도 반경 문제가 아니라 이 오탐 폭주가 근본 원인이었을 가능성 높음.

### 수정 (`seokminal-dashboard` 커밋 `ed4dbd3`, `seokminal-multi-venue` 커밋 `1e92c27`)
- `lib/orderflow-data.ts` — `applyLargeTradeTracking`을 median×3(표본제외)→**rolling p95(제외없음)**로 교체. p95는 표본 제외 없이도 창(window) 자체가 항상 상위 5%를 가리켜 분포 모양과 무관하게 안정적. 회귀 테스트 추가(대량체결 반복 유입 시 문턱 폭주 붕괴 안 하는지).
- `research/strategies/orderflow_absorption.py` — 동일 알고리즘으로 동기화, 재실행.
- **재검증 결과**: BTC 대량체결 이벤트 78,292건(70%, 버그)→**6,627건(5.8%, 정상)**. 절대 수치는 바로 잡혔지만 신호 자체는 여전히 **REJECT**: 흡수 percentile ~44(랜덤과 구별 불가), 대량체결 방향추종 승률 0.02~3.6%·비용압도(진짜 무의미한 신호, 버그 아님).

### 바이낸스/OKX 체결 스트림 추가 (`seokminal-multi-venue` 커밋 `eda99ac`)
CVD/흡수/대량체결 표본을 HL 단독보다 넓히기 위해 체결 테이프만 다중거래소화.
- `orderflow/binance_adapter.py`, `orderflow/okx_adapter.py` — 퍼블릭 WS 체결 파서(`hl_adapter.py`와 동일 패턴).
- `orderflow/multi_venue_adapter.py` — HL(오더북+체결)+Binance+OKX(체결만)를 하나의 스트림으로 병합, 거래소별 독립 재연결(한 소스 끊겨도 나머지 유지). 셋 다 기존 `{coin}.HL` 심볼로 합류시켜 `aggregator.py` 이후 파이프라인 무수정.
- `orderflow/manager.py` — 기본 어댑터 팩토리를 `MultiVenueOrderflowClient`로 교체.
- **오더북 뎁스(COB)는 HL 전용 유지** — 실제 체결 가능한 유동성은 계좌가 물려있는 거래소별로 분리돼야 하므로 병합 대상 아님(병합하면 실행 불가능한 유동성을 있는 것처럼 보여줘서 트레이딩 판단 왜곡).

### 검증
- 백엔드 854 passed(pre-existing 4개 실패만, 신규 0). 프론트 215/215 통과, tsc 클린.

### 다음 할 일
- 브라우저 스팟체크 아직 없음: `/orderflow` 라이브에서 대량체결 버블 빈도가 줄었는지(5.8% 근처), 바이낸스/OKX 체결 합류로 CVD 델타가 체감상 달라졌는지 확인.
- Binance/OKX WS 실제 연결 검증 미실시(코드는 공개 API 문서 스펙대로 작성, 단위테스트는 페이크 커넥션 기준) — 실 서버 기동 후 재연결/파싱 라이브 확인 필요.
- 대량체결/흡수 둘 다 REJECT 확정이므로 라이브 대시보드 마커는 계속 "미검증 v1 시각화용"으로만 취급할 것 — 매매 판단 근거로 못 씀.

## Phase 160 — Orderflow GEX 패널 병합 + 차트 확대 + 버블 축소 (2026-07-10) ✅ DONE

Phase 159 직후 유저 리포트: "옵션 겍스 차트 안으로 넣어주고 차트 키워줘. 히트맵 원이 너무 커서 서로 가려가지고 하나도 모르겠다" — SDD 없이 직접 수정(작은 변경, `feedback_no_process_theater` 컨벤션).

### 변경 (`seokminal-dashboard`, 커밋 `786bbc2`)
- `components/orderflow/OptionsFlowPanel.tsx` — 독립 D3 GEX 바 차트 제거(메인 차트에 `GexLevelsPrimitive`가 이미 스트라이크 라인+감마월을 그리므로 중복). spot/stale 배지 헤더 + 옵션 체결 티커만 남김, 자체 `border`/`rounded-lg` 제거(부모 카드에 흡수).
- `components/orderflow/OrderflowChart.tsx` — `OptionsFlowPanel`을 캔들차트와 같은 `border border-border bg-panel` 래퍼 안에 `border-t` 구분선으로 붙여 렌더(기존엔 `app/orderflow/page.tsx`에서 별도 박스로 아래 렌더).
- `app/orderflow/page.tsx` — 중복된 `OptionsFlowPanel` 렌더 제거(`OrderflowChart`가 대신 렌더).
- `components/CandlestickChart.tsx` — `height` prop 추가(기본 480, 기존 4개 소비처 전부 하위호환). 오더플로우 차트만 `height={720}` 전달. 서브페인 스트레치팩터(`panes[0]=3, others=1`)는 기존 로직 그대로라 확대해도 비율 유지.
- `components/orderflow/LargeLotPrimitive.ts` — `radiusFor()` 반경 범위 `6~24px → 4~12px`(스케일 계수도 3→2)로 축소, 버블이 흡수 마커/다른 버블과 겹쳐 안 보이던 문제 해결.
- 검증: `npx tsc --noEmit` 클린, `npx vitest run` 214/214 통과. 브라우저 라이브 확인(`/orderflow` BTC.HL) — GEX 패널이 차트 카드 안에 붙어 렌더, 차트 높이 커짐, 감마월 점선 라인 정상 표시, 버블 크기 축소되어 겹침 해소, 콘솔 에러 없음.

### 다음 할 일
- 딱히 남은 후속 작업 없음. Phase 159의 미확인 항목(footprint 셀 숫자 고줌 렌더, 대량체결/흡수 임계값 백테스트)은 여전히 대기 중.

## Phase 159 — Orderflow 트레이딩 콕핏 5종 (2026-07-10) ✅ DONE

유저 요청(잘 동안 무중단 자율 작업 지시): `/orderflow` 캔들차트에 Bookmap 스타일 실시간 트레이딩 UX 5종 추가 — "착 보고 착 매수/매도" 목표. 브레인스토밍(`docs/superpowers/specs/2026-07-10-orderflow-trading-cockpit-design.md`) → 플랜(`docs/superpowers/plans/2026-07-10-orderflow-trading-cockpit.md`, 9태스크) → `superpowers:subagent-driven-development`로 전 태스크+최종 전체 리뷰까지 자율 실행. 상세 태스크별 리뷰 로그: `.superpowers/sdd/progress.md` ("SDD Progress — 2026-07-10 Orderflow Trading Cockpit" 섹션).

### 백엔드 (`seokminal-multi-venue`, 커밋 `ac37bca..d278a0c`)
- `orderflow/aggregator.py` — `latest_book()`: L2 북 스냅샷을 가격순 정렬+상위 N레벨로 정리.
- `orderflow/manager.py` — `book_snapshot` 브로드캐스트에 심볼별 150ms 스로틀 추가(`BOOK_SNAPSHOT_THROTTLE_SEC`).
- 백엔드 전체 스위트: 829 passed, pre-existing 4개 실패(test_auth.py×3, test_backtest_happy_path)만, 신규 실패 0.

### 프론트엔드 (`seokminal-dashboard`, 커밋 `6b6913c..dfcb323`, 12커밋)
5개 기능 모두 기존 `ISeriesPrimitive` 패턴(`HeatmapPrimitive`/`FootprintPrimitive` 선례) 그대로 확장:
1. **COB 뎁스 인셋** — `OrderBookPrimitive.ts`, 차트 우측 90px 독킹 바(빨강 ask/초록 bid).
2. **아이스버그/대량체결 트래커** — `LargeLotPrimitive.ts` + `lib/orderflow-data.ts`(`applyLargeTradeTracking`, 롤링 중앙값 200틱 기준 3배 이상 시 플래그, 플래그된 체결은 베이스라인 갱신에서 제외 — 자기억제 버그 방지).
3. **CVD 서브페인 + 셀별 델타** — `computeCvdSeries()`, `CandlestickChart.tsx`에 히스토그램 페인 추가, `FootprintPrimitive.ts`에 매수-매도 델타 숫자 라인 추가.
4. **흡수(Absorption) 하이라이팅** — `detectAbsorption()`(우세비율 0.7 + 노이즈플로어 10배 + 가격방향 조건, `rollingMedian<=0` 시 fail-closed), 마커는 `CandlestickChart.tsx`의 기존 마커 파이프라인에 합류.
5. **GEX 스트라이크 라인** — `GexLevelsPrimitive.ts`, `hooks/useGexSnapshot.ts`(Phase 158 `OptionsFlowPanel`에서 추출한 공용 훅)로 감마월(최대 |net_gex| 스트라이크) 강조선.
- 프론트 전체 스위트: 214/214 통과, tsc 클린.

### 리뷰 루프에서 발견·수정한 이슈
- **Task 6 Critical**: CVD `HistogramSeries`가 매 이펙트 재실행마다 이전 시리즈 제거 없이 재생성 → `footprint`가 거의 매 WS 틱마다 바뀌므로 라이브 트레이딩 중 무한 시리즈 누적. `overlaySeriesRef`와 동일한 drain-then-rebuild로 수정.
- **Task 7 Important**: `absorptionMarkers` useMemo가 별도 useEffect에서만 쓰이는 `medianSizeRef.current`를 읽어 항상 한 사이클 전 중앙값으로 평가(React가 이펙트 실행 전 모든 useMemo를 먼저 완료하기 때문). `detectAbsorption()` 호출을 중앙값을 계산하는 바로 그 이펙트 안으로 옮기고 `useState`로 전환해 수정.
- **최종 전체 리뷰(opus) Important**: `largeTradeTrackerRef`/`prevFootprintRef`가 심볼 전환 시 리셋 안 됨(컴포넌트가 언마운트 안 되므로) → 두 심볼의 체결 크기 스케일이 섞여 대량체결/흡수 임계값이 왜곡되고, 이전 심볼의 잔여 버블 마커가 새 차트에 렌더될 수 있었음(실제 트레이딩 액션에서 흔히 발생, 신호 정확성에 직결). `[symbol]` 키 이펙트로 트래커/마커 리셋 추가해 수정.
- **최종 전체 리뷰 Minor**: `OrderflowChart`와 `OptionsFlowPanel`이 `useGexSnapshot`을 각자 호출해 GEX 폴링 중복(암호화폐 심볼은 2배, 비암호화폐는 무의미한 404 폴링) → 훅 호출을 `app/orderflow/page.tsx`로 올려 `gex` prop으로 양쪽에 전달.

### 브라우저 확인 (완료)
`/orderflow` BTC.HL 라이브 상태에서 확인: COB 인셋(빨강/초록 바) 렌더, CVD 서브페인 값 실시간 변동(-0.18→-1.17), 대량체결 버블 실시간 색 변경, 흡수 마커("흡수" + 화살표) 실제 발화, GEX 패널(spot 표시) 정상. 콘솔 에러 없음. **미확인**: footprint 셀별 매수/매도 숫자·델타 라인(1분봉 저줌에서 40px bar-spacing 게이트 미충족, 브라우저 자동화로 캔버스 확대 불가 — Phase 157에서도 동일 제약 겪음, 코드 레벨로는 검증 완료).

### Minor(안 고침, 기록만)
- OrderBookPrimitive `zOrder: "top"` 최근접 부착으로 우측 끝 footprint 컬럼 몇 개를 코스메틱하게 덮음(Task 4에서 flagged).
- 5개 프리미티브 모두 언마운트 시 명시적 `detachPrimitive()` 안 함 — `CandlestickChart.tsx`의 `chart.remove()`가 암묵적으로 정리하므로 실제 누수는 아님(최종 리뷰에서 확인).
- 대량체결 임계값(3배 롤링 중앙값)/흡수 임계값(0.7 우세비율)은 전부 미백테스트 v1 상수.

### 다음 할 일
- 유저 브라우저 재확인: footprint 셀 숫자가 고줌(넓은 bar-spacing)에서 정상 렌더되는지, GEX 라인이 히트맵/COB/버블과 시각적으로 충돌 안 하는지 직접 스팟체크.
- Phase 157/158에서 넘어온 미확인 항목(줌 유지 최종 확인, Deribit GEX 실API 필드명 검증) 여전히 대기 중.
- 대량체결/흡수 임계값 백테스트 검증 — 미착수.

## Phase 158 — Deribit BTC/ETH 옵션플로우 + GEX (2026-07-10) ✅ DONE

Phase 157 후 브레인스토밍 재개 → 스펙(`docs/superpowers/specs/2026-07-10-deribit-options-flow-gex-design.md`) → 플랜(`docs/superpowers/plans/2026-07-10-deribit-options-flow-gex.md`, 8태스크) → `superpowers:subagent-driven-development`로 실행(유저 선택: Subagent-Driven). 전 태스크 첫 시도에 구현/리뷰 통과(fix-재리뷰 사이클 0회), 최종 전체 리뷰에서 Important 1건 발견해 수정. 상세 태스크별 리뷰 로그: `.superpowers/sdd/progress.md`.

### 백엔드 (`seokminal-multi-venue`, 커밋 `5faea81..ac37bca`)
- `orderflow/deribit_adapter.py` — Deribit WS 체결 스트림 어댑터(`OptionTradeEvent`), `orderflow/hl_adapter.py` 패턴 그대로.
- `orderflow/options_flow_manager.py` — 통화별 fan-out 매니저(구독/재연결 백오프), 기존 `orderflow/manager.py` 패턴 그대로.
- `orderflow/gex.py` — 스트라이크별 감마 익스포저 계산(`fetch_gex_by_strike`, `options/pricer.py:bs_greeks` 재사용), 60초 REST 폴링 캐시(`gex_poll_loop`).
- `api_server/router_options_flow.py` + `main.py` 배선(라우터 등록 + `gex_poll_loop` 백그라운드 태스크 1회 생성) — `GET /options-flow/gex/{currency}`, `WS /ws/options-flow/{currency}`.
- 백엔드 전체 스위트: 823 passed, pre-existing 4개 실패(test_auth.py×3, test_backtest_happy_path)만 무시 대상, 신규 실패 0.

### 프론트엔드 (`seokminal-dashboard`, 커밋 `52e63f1..e9fd36e`)
- `lib/api.ts` — `getOptionsGex`/`GexSnapshot`/`GexLevel`.
- `hooks/useOptionsFlowSocket.ts` — `useOrderflowSocket.ts`와 동일 패턴(재연결/cleanup) WS 훅.
- `components/orderflow/OptionsFlowPanel.tsx` — GEX D3 바 차트(스트라이크별, spot 점선) + 옵션 체결 티커. 디자인 토큰만 사용(`var(--color-pos/neg/accent/border/text-2)` for D3, Tailwind 토큰 for 나머지).
- `lib/orderflow-data.ts` — `currencyForSymbol("BTC.HL"→"BTC" / "ETH.HL"→"ETH" / else→null)`, `app/orderflow/page.tsx`에서 BTC/ETH 심볼일 때만 패널 노출.
- 프론트 전체 스위트: 194/194 통과, tsc 클린.

### 최종 전체 리뷰(opus)에서 발견·수정한 Important 1건
GEX 폴링 실패 시 `setGex(null)`로 차트가 통째로 비워짐(백엔드는 실패 시 마지막 캐시 유지하는데 프론트만 안 그랬음) + 스펙이 요구한 `updated_at` 기준 stale 배지 미구현. → 커밋 `e9fd36e`: catch에서 더 이상 null 안 함(마지막 스냅샷 유지), `updated_at`(epoch seconds) 기준 5분 초과 시 `text-warn` "· 데이터 지연" 배지 추가. 재리뷰 승인.

### Minor(안 고침, 기록만)
"live" 상태는 재연결 후에만 브로드캐스트(최초 연결 시엔 안 함, 기존 `orderflow/manager.py`와 동일한 기존 동작), `gex_poll_loop`는 뷰어 유무 무관하게 항상 폴링(설계상 의도), `test_orderflow_gex.py` 미사용 `pytest` import, GEX 데이터 없을 때 헤더에 "spot 0" 표시(cosmetic).

### 다음 할 일
- 유저 브라우저 스팟체크: `/orderflow`에서 BTC.HL 선택 → GEX 바 차트(스트라이크별, spot 점선)와 옵션 체결 티커 렌더 확인, NQ 등으로 바꾸면 패널 사라지는지 확인. Deribit 실API 응답 필드명이 가정과 다르면 `orderflow/gex.py`/`orderflow/deribit_adapter.py` 파싱 부분만 조정 필요(스펙 범위 밖으로 명시됨).
- Phase 157에서 넘어온 미확인 항목(줌 유지/footprint 색) 유저 재확인 아직 없음 — 계속 대기 중.
- 델타/absorption 인디케이터: 기존 footprint 데이터로 바로 가능, 여전히 미착수.

## Phase 157 — Orderflow 줌 리셋 + footprint 색 미표시 버그 (2026-07-10) ✅ DONE

유저 리포트: "확대하면 알아서 줌 풀림(UX 매우 별로)" + "갈색(히트맵)만 뜨고 footprint 색은 안 보임". Phase 154의 `visibleRangeRef` 저장/복원 방식이 불안정했던 게 버그4, Phase 156에서 미확인으로 남긴 footprint 항목이 실은 진짜 버그(버그5)였음. SDD 안 씀 — 직접 디버깅.

### 버그 4 — 30초 폴링마다 차트 전체 destroy→recreate, 줌 유실
`CandlestickChart.tsx`가 `useEffect` 1개(`deps`에 `bars` 포함)에서 `createChart`~`chart.remove()`까지 다 처리 → `OrderflowChart`의 30초 폴링(`REFRESH_INTERVAL_MS`)마다 차트 객체 자체가 완전히 새로 생성됨. `visibleRangeRef` 저장/복원(Phase 154 수정)으로 땜질했지만 재현성 낮고 근본 원인 아님.
- `components/CandlestickChart.tsx`: 이펙트 2개로 분리 — ① 마운트 1회만(`deps=[]`) 차트+캔들시리즈 생성, `onSeriesReady` 1회 호출, cleanup에서만 `chart.remove()`. ② `bars`/지표/스펙 변경 시(`deps=[bars, trades, emaFast, emaSlow, sma, bollingerPeriod, bollingerStd, specsKey]`) 기존 차트에 `setData`/오버레이 시리즈만 갱신, `chart.remove()` 안 함 → `chart.timeScale()` 객체가 안 죽으니 줌/팬이 자동으로 유지됨(별도 저장/복원 로직 불필요, `visibleRangeRef` 제거).
- 오버레이 라인시리즈는 `overlaySeriesRef`로 추적, 갱신마다 `chart.removeSeries()` 후 재생성. 마커는 `markersRef`(`ISeriesMarkersPluginApi<Time>`)에 저장해 `createSeriesMarkers` 재호출 대신 `.setMarkers()` 사용(중복 플러그인 스태킹 방지).
- `onSeriesReady`는 4개 소비처 중 `OrderflowChart.tsx`만 사용(grep 확인) → 1회 호출로 변경해도 다른 3곳(`ChartTab`/`ChartPanel`/forex 페이지) 영향 없음.

### 버그 5 — footprint 매수/매도 색 배경이 히트맵과 달리 저줌에서 전혀 안 그려짐
`FootprintPrimitive.ts`가 `if (barSpacing < MIN_BAR_SPACING_FOR_TEXT) return;`을 렌더 함수 맨 앞에서 실행 → 숫자뿐 아니라 색 배경까지 통째로 스킵됨. 히트맵(`HeatmapPrimitive.ts`)엔 이런 게이트가 없어서 히트맵 틴트만 보이고 footprint는 아예 안 보였던 것.
- `lib/orderflow-chart-coords.ts`: `footprintCellRect()` 추가 — `footprintColumnX`(캔들 폭 전체) + 기존 `neighborDistance`(이웃 가격 거리로 높이 계산)로 셀 사각형 산출.
- `components/orderflow/FootprintPrimitive.ts`: 색 배경 렌더(매도=빨강/매수=초록, `sellVol`/`buyVol` 강도에 따라 opacity 스케일)를 줌 게이트보다 앞으로 빼서 항상 그리고, 숫자 텍스트만 기존처럼 `barSpacing<40`이면 스킵.
- `tests/lib/orderflow-chart-coords.test.ts`: `footprintCellRect` 테스트 4건 추가(정상 계산/가격 없음/시간 범위 밖/이웃 없음).

### 검증
- `npx tsc --noEmit` 클린.
- `npx vitest run tests/lib/orderflow-chart-coords.test.ts tests/lib/orderflow-data.test.ts` — 29/29 통과.
- **미확인**: 브라우저 실줌인/장시간(30초+) 방치로 실제 zoom-persist 육안 재현 — 브라우저 자동화로 barSpacing 조작이 안 되는 기존 한계(Phase 156 버그3 참고) 그대로라 코드 레벨 검증까지만 함. 유저 직접 재확인 필요.

### 다음 할 일
- 유저 스팟체크: `/orderflow`에서 트랙패드 확대 후 30초+ 방치해도 줌 유지되는지, footprint 빨강/초록 배경이 보이는지.
- Deribit 옵션플로우+GEX 스펙: 브레인스토밍 중 이번 버그리포트로 중단됨. 마지막 질문("`docs/superpowers/specs/2026-07-10-deribit-options-flow-gex-design.md`로 스펙 써도 될까?") 재확인 필요.
- 델타/absorption: 기존 footprint 데이터로 바로 가능(신규 데이터 불필요), 미착수.

## Phase 156 — Orderflow 히트맵 미표시 버그 (2026-07-10) ✅ DONE

유저 리포트: "/orderflow 캔들만 뜨고 나머지 안 보임". Phase 154가 "미확인"으로 남겼던 두 항목 중 하나(히트맵 틴트)를 직접 검증하다 실제 버그 2건 확인·수정. SDD 안 씀 — 직접 디버깅.

### 버그 1 — 히트맵 좌표 정확일치 버그 (프론트)
`heatmapCellRect`가 `sortedBuckets.indexOf(cell.ts)` 정확일치를 요구했는데, heatmap은 2초 버킷·캔들은 60초 버킷이라 거의 항상 어긋남 → `timeToCoordinate`가 데이터에 없는 시각이라 null 반환 → 히트맵이 사실상 전혀 렌더링 안 됨. Phase 154 진행기록의 "슬리버 폭 0.2~1.3px, 코드는 정상" 판단은 틀렸음(실제로는 0개 렌더).
- `lib/orderflow-chart-coords.ts`: 캔들 open time으로 floor한 시각만 `timeToX`에 넘기고 그 안에서 `barSpacing` 비율로 보간하도록 재작성.
- `components/orderflow/HeatmapPrimitive.ts`: `CANDLE_INTERVAL_SEC=60`/`HEATMAP_BUCKET_SEC=2` 상수 추가, `barSpacing` 전달.
- `tests/lib/orderflow-chart-coords.test.ts`: 새 시그니처로 전체 재작성, 8/8 통과.
- 커밋 `abf2f07` (dashboard).

### 버그 2 — heatmap 무한 증식으로 백엔드 행 (더 심각, 원인 불명 서버 무응답의 정체)
디버깅 중 WS 프로브가 `1009 message too big`으로 끊김 → `orderflow/aggregator.py`가 heatmap(2초 버킷)도 footprint와 같은 `max_window_sec=7200`(2시간) 윈도우를 씀 → 워커가 오래 떠 있으면 스냅샷이 WS 1MB 한도 초과. 게다가 `_prune()` 대상 dict가 무한정 커지며 워커 하나가 **94% CPU에 7.5시간 고정**되어 이벤트루프까지 행 → `uvicorn --reload`가 파일 변경도 못 감지, 신규 연결/curl 전부 타임아웃(서버가 완전히 멈춘 상태였음).
- `orderflow/aggregator.py`: `heatmap_max_window_sec=300.0` 분리(footprint와 별도) + 레벨당 `MAX_LEVELS_PER_SIDE=25` 캡으로 스냅샷 크기 상시 유계화.
- 행 걸린 워커(PID 83281, 부모 39399) kill 후 서버 재기동 — 재기동 즉시 정상 응답.
- pytest 7/7 통과. 커밋 `5faea81` (multi-venue).

### 버그 3 — 히트맵 셀이 저줌에서 sub-pixel이라 안 보임 (버그1 고친 후 유저가 재확인, "still 안 보임")
버그1 수정 후에도 유저가 여전히 아무것도 안 보인다고 재확인. 원인: heatmap 원본 2초 버킷 폭이 캔들(60초) 대비 `barSpacing/30` — 기본 줌(barSpacing≈6px)에서 0.2px, 사실상 렌더 자체가 안 보임(좌표 계산은 맞지만 폭이 없어서). 브라우저 자동화로 줌 조작 시도(실제 wheel, ctrl+wheel, 축 드래그, chart API `applyOptions({barSpacing:60})` 직접 호출까지 7가지) 전부 실패 — 앱이 mouse handleScale을 꺼둔 것으로 추정, 자동화로는 못 뚫음. 대신 **근본적으로 재설계**: 캔들 구간별로 (price당) 최댓값만 남겨 캔들 하나 = 셀 하나로 합치는 `aggregateHeatmapByCandle` 추가, 셀 폭을 늘 `barSpacing` 전체로 그림.
- `lib/orderflow-data.ts`: `aggregateHeatmapByCandle(cells, candleIntervalSec)` — max 집계(sum 아님, 같은 잔량이 여러 2초 스냅샷에 중복 관측되는 걸 방지).
- `lib/orderflow-chart-coords.ts`: `heatmapCellRect`에서 `heatmapBucketSec`/보간 로직 제거, 항상 `barSpacing` 폭 전체 채우도록 단순화.
- `components/orderflow/HeatmapPrimitive.ts`: draw 전 `aggregateHeatmapByCandle` 호출.
- 테스트 갱신+추가(`orderflow-data.test.ts` 3건, `orderflow-chart-coords.test.ts` 재작성), 커밋 `02ea554`.
- **육안 확인 완료**: 기본 줌(barSpacing≈6px)에서도 최근 캔들 아래 주황/갈색 박스로 잔량 표시됨(스크린샷 확인).

### 검증
- WS 프로브: 재기동 후 스냅샷 2.4KB(이전엔 1MB 초과로 끊김), heatmap_count 40(캡 정상 작동), footprint/heatmap delta 스트림 정상.
- 브라우저 `/orderflow` 렌더 확인, 콘솔 에러 없음, 히트맵 틴트 육안 확인 완료(위 버그3 참고).
- **미확인 유지**: footprint 줌인 숫자(barSpacing≥40px에서만 표시) — 브라우저 자동화로 줌 자체가 안 되는 한계라 이건 여전히 못 봄. 코드 레벨(MIN_BAR_SPACING_FOR_TEXT=40 게이트)은 확인됨.

### 다음 할 일
- footprint 줌인 숫자 유저 직접 스팟체크(`/orderflow` → BTC.HL → 트랙패드로 확대).
- 델타/absorption/options flow/GEX level 확장 — 델타·absorption은 기존 데이터로 바로 가능(신규 데이터 불필요), options flow/GEX는 크립토(Deribit, 무료 API)로 결정, 스펙 작성 예정.

## Phase 155 — HUD 프로세스 가시성 (폴리마켓 틱/arb) (2026-07-10) ✅ DONE

이전 세션에서 스택(`wip: HUD phase1 process-visibility`)해뒀던 작업 pop해서 완료. SDD/subagent 안 씀 — 2파일 프론트 + 1파일 백엔드 소품 변경.
- 백엔드(`seokminal-multi-venue` `api_server/lab_api.py`, 커밋 `2481709`): `_tmux_process_status(session, data_dir)` — tmux 세션 생존 + 최신 jsonl mtime으로 `polymarket-tick`/`polymarket-arb` 상태 판정, `/lab/status` 응답에 `processes` 필드 추가.
- 프론트(`lib/api.ts` `LabStatus.processes` 타입, `app/hud/page.tsx` `formatAge()` + 유닛 로스터 2건 추가, 커밋 `c0089f0`).
- 검증: 백엔드 uvicorn --reload 상태에서 `/lab/status` curl로 실제 값 확인(둘 다 running, age 0~수초), 프론트 tsc 클린, 브라우저로 `/hud` 렌더 확인(로스터에 "폴리마켓 틱 수집기"/"폴리마켓 arb 스캐너" 정상 표시, 9/11 가동).
- `seokminal-multi-venue` 쪽 나머지 uncommitted 변경(`graph_api.py`, jarvis state jsonl, research 데이터)은 이번 작업과 무관 — 손대지 않고 그대로 둠.

### 다음 할 일
- (완료) `/hud` "계좌 정보 로딩 중…" 재확인: 버그 아님. IB Gateway 로컬 미실행 → `getAccountBalances()` 응답이 `[Errno 61] Connection refused` 대기로 ~6~8초 걸리는 동안만 로딩 문구 표시, 이후 6개 계좌 전부 정상 렌더(IB만 error 필드로 표시). 콘솔 에러/네트워크 실패 없음. 이월 항목에서 제거.

## Phase 154 — Orderflow Chart Overlay (2026-07-09~10) ✅ DONE

플랜: `docs/superpowers/plans/2026-07-09-orderflow-chart-overlay.md`, 스펙: `docs/superpowers/specs/2026-07-09-orderflow-chart-overlay-design.md`. SDD 방식 7태스크. 커밋 `2cdfcf8`(플랜)~`795a506`(최종 수정), 원장은 `.superpowers/sdd/progress.md`.

### 변경 내용
`/orderflow` 페이지를 v1(FootprintChart+LiquidityHeatmap 개별 스택 캔버스 패널) → v2(lightweight-charts v5 Series Primitives로 캔들차트 위에 footprint/heatmap 직접 오버레이)로 전면 교체. v1 컴포넌트 삭제.
- `lib/chart-bars.ts`: `ChartTab.tsx`에서 `fetchBarsForSymbol` 공용 헬퍼 추출(벤뉴 라우팅 보존, 리팩터 중 XKRX-intraday 에러 메시지 회귀 발견→수정).
- `lib/orderflow-chart-coords.ts`: 순수 좌표 매핑 함수(footprintColumnX 등).
- `components/CandlestickChart.tsx`: `onSeriesReady` 콜백 노출(차트/캔들시리즈 생성 직후 호출, primitive attach용).
- `components/orderflow/{HeatmapPrimitive,FootprintPrimitive}.ts`: Series Primitive 배경/전경 레이어. footprint는 barSpacing<40px에서 숫자 숨김.
- `components/orderflow/OrderflowChart.tsx`: 조합 컴포넌트(30초 폴링 캔들 + primitive 데이터 갱신).

### 최종 전체브랜치 리뷰 (opus) — Important 1건 발견·수정
30초마다 새 `bars` 배열이 `CandlestickChart`의 이펙트 의존성에 걸려 차트 전체가 destroy→recreate됨 → 줌/팬 상태가 30초마다 초기화 → footprint 숫자를 보려고 40px 이상 줌인해도 30초 안에 리셋되는 문제(핵심 신규 기능이 사실상 지속 사용 불가). 수정(`795a506`): `CandlestickChart.tsx`에 `visibleRangeRef`(`useRef<LogicalRange|null>`) 추가 — cleanup에서 `getVisibleLogicalRange()` 저장, 다음 마운트에서 `setVisibleLogicalRange()`로 복원, null-guard라 다른 3개 소비처(`ChartTab`/`ChartPanel`/forex 페이지) 첫 마운트 동작은 무변화. 부수로 `FootprintPrimitive.ts`의 죽은 `computeFootprintLayout()` 호출, `ChartTab.tsx`의 죽은 `TIMEFRAMES.bar/.dur` 필드도 함께 정리. 재리뷰 클린(tsc/vitest 181/181).

### 브라우저 수동 확인 (컨트롤러 직접, subagent 아님)
BTC.HL 1분봉 렌더링, WS 연결상태 배지(라이브/재연결중/오류), 심볼 전환(BTC.HL↔NQ) 잔상 없이 클린 — 전부 확인. **미확인**: 히트맵 배경 틴트(60초 캔들 대비 2초 버킷이라 슬리버 폭 0.2~1.3px, 육안 확인 어려움 — 리뷰어가 코드 레벨로는 정상 확인), footprint 줌인 숫자(브라우저 자동화 scroll-to-zoom이 차트 캔버스에 안 먹힘, 크로스헤어 마우스무브는 정상 동작해서 툴 한계로 판단, 코드 레벨은 검증됨).

`git push origin main` 완료 (`795a506`, origin이 202커밋 뒤처져있던 것 포함 전체 push).

### 다음 할 일
- 위 미확인 2건(히트맵 틴트 육안, footprint 줌인 숫자) 유저 직접 스팟체크 권장 — `/orderflow`에서 BTC.HL 진입 후 스크롤로 barSpacing 40px 이상 확대.
- 스택된 채 미착수: HUD Phase 1 프로세스 가시성 변경(`git stash@{0}`, "wip: HUD phase1 process-visibility") — 이번 오더플로우 작업과 무관, 다음 세션에서 pop 후 이어가기.

## Phase 153 — 아크리액터 오브 제거 (2026-07-09) ✅ DONE

커밋 `6a3afc7`. 유저 지적: 캔버스 파티클 오브(ReactorCore, Iron-Man 아크리액터)가 블룸버그 톤과 안 어울림. "오브 버려도 됨" 확인받고 직접 수정(작은 UI 교체, subagent/plan 안 씀).
- `components/ReactorCore.tsx` 삭제. `components/Hud.tsx`의 `ArcReactor`를 SVG 타겟팅 링 + 톤별(accent/pos/info/neg) 테두리 박스 + LED 펄스로 재설계 — 파티클 캔버스 없음, 색은 디자인 토큰만.
- 사용처 3곳: `/agents`(Lv3 자율학습 에이전트, 레벨→톤 매핑 `lvToTone`), `/buyback-doctor`(DX 박스), `/lab`·`/auto-research`(AutoResearchPanel) — 후자 둘은 prop 시그니처 그대로라 무변경.
- 부수 정리: 미사용 `JarvisOrb`(components/Jarvis.tsx) 및 관련 `radar`/`orb` keyframe·`--animate-radar`/`--animate-orb` 삭제, ReactorCore 전용이던 고아 `*-glow-lg` 클래스(green/blue/yellow/orange/red/pink/amber) 정리.
- tsc/build(45라우트)/test(151/151) 클린, `/agents`·`/buyback-doctor` 브라우저 확인 완료.

### 다음 할 일
- `/lab`의 AutoResearchPanel ArcReactor는 코드 리뷰로 확인, 브라우저 스크린샷으로는 미확인(스크롤 위치상 안 보임) — 다음 세션에서 필요시 확인.

## Phase 152 — 블룸버그 터미널 리디자인 Phase 2 (2026-07-09) ✅ DONE

플랜: `docs/superpowers/plans/2026-07-09-bloomberg-redesign-phase2.md`, SDD 방식(subagent-driven-development) 7태스크 실행. 커밋 `db017d8`(플랜)~`c124905`(최종 리뷰 수정), 전 과정 `.superpowers/sdd/progress.md` 원장 참고.

### 1. Task 1-6 — 나머지 ~40개 페이지 Panel/PanelHeader 전환
- 그룹별(집행/포트폴리오, AI에이전트, 리서치, 검증/백테스트, 마켓/자산군, 교육/기타) 순차 실행. 각 태스크: implementer subagent → task reviewer → 발견사항 수정 → 재리뷰 클린.
- 정착된 규칙: 정적 색상 박스도 패턴A 대상(동적 데이터 기반 GO/WAIT/KILL 배너만 예외), 아코디언 토글 헤더는 PanelHeader 비대화형이라 예외, PanelHeader `right` 슬롯은 `text-black text-[10px] font-data`만 상속(uppercase/bold/tracking 없음 — 거기 넣는 override 클래스는 죽은 코드), 패턴B(부호조건 틴트)는 헤드라인 스탯뿐 아니라 테이블 컬럼·리스트 각 행까지 전부 적용 대상(태스크 전반에서 가장 자주 놓친 부분), `space-y-2` 수직 카드 스택은 카드그리드 예외 대상이 아니라 일반 패턴A 대상.
- 세션 중 implementer subagent가 API 세션 한도로 2번(Task5, Task6) 도중 끊김 → 재디스패치 대신 직접 `git status`로 남은 diff 확인→tsc/test 직접 재검증→나머지 파일 직접 완료→커밋 후 리뷰어만 디스패치하는 방식으로 복구(중복 작업/재한도 방지).

### 2. Task 7 — 최종 검증
- `npx tsc --noEmit` 클린, `npm run build` 45라우트 전부 정상, `npm test -- --run` 151/151.
- 브라우저 6페이지 샘플 점검(`/lab/execution`, `/agents`, `/lab`(Jarvis 모션 CSS 클래스 보존 확인), `/backtest`, `/crypto`, `/quant`) 전부 정상, 이슈 없음.

### 3. 전체브랜치 최종 리뷰 (opus) — Minor 3건 발견·수정
- `app/lab/tasks/page.tsx`: 미사용 `pctColor()` 삭제.
- `app/copytrade/page.tsx`: 트레이더 카드 헤드라인 수익률(`avg_return_pct`)에 패턴B 틴트 누락 — 같은 카드의 보유종목별 수익률은 이미 틴트 적용돼있어 불일치. 수정.
- `app/backtest/page.tsx`, `app/event-study/page.tsx`: `null` 값이 `>= 0` 삼항연산 폴스루로 빨강(neg)으로 잘못 렌더되던 3곳 → `== null` 가드 추가, `text-text-2`로 중립화.
- 수정 후 tsc/build/test 재확인 클린. 커밋 `c124905`.

### 다음 할 일
- Phase 3 후보(범위 밖으로 명시적 보류): 카드그리드→테이블로우 밀도 전환, `/hud` 전용 위젯(월드클락 등) 다른 페이지 확장, 헤더 색상 다양화(현재 전패널 오렌지 단색), 스파크라인 인라인.
- Task 1-6에서 로그된 pre-existing dead code(`normal-case tracking-normal font-normal` in `right` 슬롯, `app/macro/page.tsx:125,230`, `app/ict/page.tsx:335,362`, `app/validation/page.tsx:137`, `app/forex/page.tsx:500`) — 아직 미수정, 향후 정리 후보.
- `/hud` 계좌 정보 "로딩 중…" 멈춤 현상(Phase 1에서 미확인 상태로 남김) — 여전히 미점검.

## Phase 151 — 블룸버그 터미널 리디자인 Phase 1 (2026-07-09) ✅ DONE (Phase 2 대기)

커밋: `1e5cec5`(Phase1 완료), `028b85e`(밀도 패스), `3ac81ad`(HUD 정보밀도 보강).

### 1. SDD 8태스크 실행 (플랜: `docs/superpowers/plans/2026-07-09-bloomberg-redesign-phase1.md`)
- 디자인 토큰(`app/globals.css`) 각짐(`--radius-*`=0), 색상 팔레트 재정의, NAUTILUS→SEOKMINAL 리브랜드.
- `components/ui/Panel.tsx` 신규(`Panel`/`PanelHeader`, 오렌지 헤더바) — Phase 2에서 41개 페이지에 복제 예정.
- `/hud`, `/market`(ComparisonTab) 파일럿 적용. 최종 전체브랜치 리뷰에서 PanelHeader `right` 슬롯 대비 버그 발견→수정(`text-black` 기본값화).

### 2. 사용자 피드백 — "블룸버그 같지 않다" → 밀도 패스
유저가 결과물이 스펙 충족에도 불구하고 블룸버그 터미널 느낌이 안 난다고 지적. 진단: (1) 카드형 레이아웃 vs 블룸버그의 밀집 테이블/그리드, (2) 폰트 — 모노스페이스가 일부 숫자에만 적용, (3) `--color-panel`이 배경과 너무 대비돼 "떠있는 카드"처럼 보임.
- `--color-panel`/`--color-panel-2`를 배경에 가깝게 낮춤(플랫 서피스화).
- `/hud`의 `UnitCard`를 패딩 카드 그리드→보더 구분 테이블 로우로 전환, 페이지 전체 `font-data` 적용.
- 돈길 통계 셀도 개별 박스→`divide-x` 구분선 방식으로 전환.

### 3. HUD 정보 밀도 보강
유저가 재차 "여전히 블룸버그 같지 않다, HUD 메인이 정보가 너무 없어서 그런가?" 지적 → 돈길 패널 아래 빈 공간에 기존에 있지만 노출 안 하던 데이터(`lib/api.ts`의 `LabState.log`, `ExecutionConsole.paper.recent_closed`) 활용해 "AI LAB 로그"·"최근 페이퍼 체결" 패널 추가.

### 4. 순흑 톤 전면 재조정 (유저가 실제 블룸버그 스크린샷 제시, "완전 다르다" 지적)
진단: 파스텔 남색 배경 + 무채색 시그널컬러가 근본 원인 — 블룸버그는 순흑(#000) + 쨍한 채도 그린/레드/옐로.
- `--color-bg` `#05070B`→`#000000`, panel도 거의 흑색. pos/neg/warn 채도 대폭 상승(`#00D964`/`#FF3B30`/`#FFD60A`). 기본폰트 14→13px.
- `/hud` 상단 서울·뉴욕·런던·도쿄 월드클락 스트립 신설.
- ON/OFF 뱃지·체결 pnl%를 텍스트색상만→배경틴트 있는 히트맵 셀로 전환.
- Panel/PanelHeader 패딩·폰트 축소(공유 컴포넌트, `/market` 회귀 확인 완료).
- 커밋 `7ba987b`.

### 다음 할 일
- Phase 2: 나머지 41개 페이지 `<Panel>`/`<PanelHeader>` + 순흑톤 전환 — 별도 세션, 별도 plan.
- `/hud` 추가 유저 피드백 있을 시 같은 패턴(직접 수정, subagent 안 씀 — 작은 반복 UI 폴리싱은 프로세스 극장 금지)으로 대응.
- 계좌 정보 "로딩 중…"에서 멈춰있는 현상 미확인 상태 — 브로커 API 지연/에러인지 다음 세션에서 점검.

## Phase 150 — ICT 조합빌더 오버레이 + GC/ES/NQ/EURUSD/USDJPY/GOLD 인트라데이 데이터 (2026-07-08~09) ✅ DONE

커밋(seokminal-multi-venue): `eeea0de`.

### 1. ICT 프리미티브 자유조합 백테스트 + 캔들차트 오버레이
- 기존 ICT 프리셋 탭 제거 → 단일 조합빌더로 통합(`research/ict/combinator.py`, `api_server/router_ict.py`).
- 캔들차트 위 FVG/OB 등 zone 실시간 오버레이(`research/ict/primitives.py` 직렬화 확장), 브라우저 실검증 완료.
- `/ict/symbols`는 `data/intraday/*.parquet` glob 기반이라 신규 심볼 추가 시 프론트/백엔드 코드변경 불필요(파일만 놓으면 즉시 노출).

### 2. IB 선물/FX 인트라데이 데이터 확보 (GC·ES·NQ·EURUSD·USDJPY)
- IB 에러 162("다른 IP에서 연결됨")는 VPN이 아니라 IBKR 웹 Client Portal 동시 로그인 충돌이 원인 — 웹 포탈 로그아웃으로 해결.
- `ContFuture`(GC/ES/NQ)는 `endDateTime=""` 단발요청만 허용, `Forex`(EURUSD/USDJPY)는 15m 커서 워크 + 1m/5m 실측 상한 단발요청으로 1m/5m/15m 전부 확보.
- XAUUSD는 `Forex('XAUUSD')` qualify 자체 실패(계정 contract 미지원) — 보류.
- 1h/4h는 별도 수집 불필요(기존 `_resample_from_15m()`이 15m 원본에서 자동 합성).
- 상세: `seokminal-multi-venue/docs/progress.md` 세션7.

### 3. XAUUSD 대안 — Hyperliquid GOLD 트랙 (xyz:GOLD)
- IB XAUUSD 미해결 대안으로 HL 조사 → 기본 퍼프 유니버스엔 `PAXG`뿐(거래량 $440만/일, 얇음).
- HL 빌더배포 dex(HIP-3) `"xyz"`에서 `xyz:GOLD` 발견 — 거래량 $4,390만/일(PAXG 10배), 가격도 GC와 거의 일치.
- 기존 `hl_candle_loader.py`/`router_ict.py`가 prefix 붙은 빌더dex 심볼(`xyz:GOLD`)을 코드변경 없이 그대로 처리 — `LIQUID_PERPS` 한 줄 추가만으로 편입.
- PAXG/xyz:GOLD 둘 다 1m/5m/15m parquet 캐시 확보 완료.

### 다음 할 일
- XAUUSD(IB 정식) 데이터는 `Commodity`/`CFD` contract 타입 재조사 필요 시에만 — `xyz:GOLD`로 사실상 대체돼 우선순위 낮음.
- GC/ES/NQ/EURUSD/USDJPY/xyz:GOLD 주문 실행 코드는 아직 없음(`backends/ib/order_client.py`는 `Stock`만) — 집행은 범위 밖, 데이터/백테스트만.
- ICT 조합빌더에서 이 심볼들로 유의미한 조합 나오면 BH-FDR 정식 파이프라인행 검토.

## Phase 149 — Gold Haven 가설 (금 안전자산 단일자산 전략) 검증 → REJECT (2026-07-07) ✅ DONE

커밋(seokminal-multi-venue): 스펙 `b41773b`, 계획 `3001d79`, Task1 `7f8b31b`, Task2 `6ecd4ba`, Task3 `77b7fee`.

### 배경
Phase 148 논의에서 나온 "금/비트코인 등 자산 한정(narrow-universe) 전략 트랙" 검토의 첫 시도.
실질금리 하락 레짐 게이트 + VIX/신용스프레드 리스크오프 부스트(롱/플랫만, 매일 체크) 가설을
SDD(Subagent-Driven Development)로 스펙→계획→3-task 구현→태스크별 리뷰→전체 브랜치 리뷰까지
전체 파이프라인 실행.

### 결과: REJECT
GC 932일(2022-09-30~2026-07-01) 실행 — Sharpe 0.352 vs buyhold 1.257(패배), random baseline
15th percentile/p=0.85(기준 미달), walk-forward 전반/후반 둘 다 양수(0.267/0.374, 이 기준은 통과),
cost stress(20bps) Sharpe 0.145. 종합 REJECT — buyhold를 못 이긴 게 결정적.

상세: `docs/superpowers/specs/2026-07-07-gold-haven-hypothesis-design.md`의 "결과(2026-07-07 실행)" 절.

### 결론
"금 단일자산 특화 로직이 광역 TSMOM(이미 GC 포함·검증통과)보다 낫다"는 가설은 이번 시도에서
지지받지 못함. 스코프 밖 후보(DXY 역상관/이벤트트리거/레짐스코어 통합) 재시도는 보류 — 이번
실패의 구체적 원인 분석 없이 재시도할 근거 없음. narrow-universe 트랙 자체는 이 결과 하나로
폐기 판단하지 않음(다른 자산·다른 메커니즘으로 재검토 여지는 있음), 단 급하지 않음.

## Phase 148 — 24/7 러너 맥북 롤백 + god_mode/condition_tick 복구 + Polymarket Layer1 라이브 착수 (2026-07-07) ✅ DONE

커밋: 백엔드 `5b83417`(god_mode/condition_tick 복구). Polymarket 콜렉터·Seokminal.app 변경은 레포 밖(seokminal 루트 미git).

### 1. 24/7 러너 데스크탑 → 맥북 롤백
- Phase 147 #7의 "데스크탑 이전 완료"는 **취소됨**. 사용자 결정: 데스크탑 아니라 맥북 하나로 간다.
- 맥북에서 `tmux` + `caffeinate -i`로 장시간 프로세스 직접 기동하는 방식으로 원복(SSH/터미널 닫아도 안 죽음).
- 데스크탑(`100.93.202.127`) 현재 접속 자체가 안 됨(Network unreachable) — 켜져있는지/에이전트 루프가 아직 도는지 미확인. `deploy/wsl/` 키트는 참고용으로만 남김.

### 2. god_mode / condition_tick 모듈 복구
- 2026-07-06 커밋 `a244861`에서 도입됐던 `api_server/god_mode.py`, `api_server/condition_tick.py`가 소스는 커밋 안 되고 `.pyc`만 남아 `router_autopilot.py` import가 깨져있던 걸 발견, bytecode 역어셈블+문서 대조로 두 모듈과 테스트 전부 재구성.
- 재구성 중 버그 1건 수정: 테스트 mock의 `KISOrderClient`/`place_order` 시그니처가 실제 호출부(`router_autopilot.py`)와 인자 개수 안 맞아 `TypeError`가 `try/except`에 먹혀 SKIP으로 위장됨 → `*args, **kwargs`로 수정.
- 전체 테스트 725 passed (기존 알려진 실패 4건 제외 회귀 없음).

### 3. Polymarket 구조적 엣지 봇 — Layer 1(YES+NO 무위험차익) 라이브 수집 착수
- `research/run_polymarket_arb_scan.py`를 맥북 tmux 세션 `polymarket-arb`로 상시 기동, 스냅샷 JSONL 누적 확인.
- `Seokminal.app` 실행 시 해당 tmux 세션이 없으면 자동 기동하도록 idempotent 체크 추가(레포 밖 파일이라 git에는 없음).
- 목표: 2주 내외 라이브 스냅샷 축적 후 `research/run_polymarket_arb_validation.py`(커밋 `809cb98`, YES+NO 합가격 기회런 탐지+평가)로 실제 기회 빈도/margin 검증.

### 4. Layer 2(마켓메이킹)/Layer 3(모델 기반 EV 배팅) — 의도적 보류
- 사용자가 제안한 3계층 폴리마켓 봇 프롬프트 중 Layer 1만 진행 중. Layer 2/3는 Layer 1 라이브 검증 결과가 나오기 전까지 미착수.
- 사유: 하우스 컨벤션(`random baseline p-value` + WF 안정성 + cost-robust 통과 전엔 알파 주장 금지, [[feedback_tsmom_paper_discipline]])을 그대로 적용 — Layer 1 페이퍼 후보 승격 여부가 갈리기 전에 Layer 2/3 스펙부터 짜는 건 순서가 안 맞음.

### 다음 할 일
- Layer 1 라이브 수집 ~2주 후 validation 재실행 → 기회 빈도/margin 확인, 페이퍼 후보 승격 여부 판단.
- 승격되면 Layer 2/3 브레인스토밍(별도 spec) 착수, 기각되면 3계층 프롬프트 전체 재검토.
- 데스크탑 상태 확인(켜져 있는지, 재사용할지 완전히 접을지) — 다음에 얘기 나오면 먼저 확인.
- 금/비트코인 등 **자산 한정(narrow-universe) 전략 트랙**: 현재 autoresearch/Jarvis는 전 종목 대상 광역 탐색 — 특정 자산군(원자재/크립토) 한정 탐색이 별도 트랙으로 나을지 검토 예정 (2026-07-07 논의 시작, 미착수).

## Phase 147 — option_lv1·macro 라이브·UI 최적화·Lv3 기대값 전환·HL 사고 수습·데스크탑 이전 (2026-07-06) ✅ DONE

하루 대형 세션. 커밋: 백엔드 `a244861`·`c14a0ec`·`f81107e`, 프론트 `b1f33eb`·`4556f9e`·`d4477d2`.

### 1. option_lv1 에이전트 (a244861 / b1f33eb)
- condition_lv1과 동일 시그널, 집행만 IB 옵션 주문(`place_option_order`, 항상 paper 7497).
- agent_store 프로필/컬럼/검증 + `POST /agents/{id}/option-condition-tick` + 백테스트 승급 UI(만기/행사가/콜풋/계약수, KR 종목은 숨김).

### 2. Macro 라이브 지표 (a244861 / b1f33eb)
- US=FRED 4종, KR=ECOS 7종(기준금리·KOSPI·원달러·CPI·수출·수입·M2), 30분 자동갱신, 레짐 스코어(0~100).
- **ECOS 버그 2개 수정**: ① ISO 날짜 무변환 통과로 전 시리즈 빈 배열(`_iso_to_ecos_period` 추가) ② EXPORT/IMPORT item_code `I`→`*AA`, M2 구지표 101Y004→신지표 161Y006/BBHA00.
- LKG 6h 스케줄러 주말 스킵(일 18시 KST 캐치업 1회).

### 3. 페이지 정보구조 최적화 (4556f9e)
- 원칙: 페이지당 질문 하나, 답을 최상단에. /hud(유닛 로스터 메인, N/M 가동), /lab/execution(ARM 판정 최상단), /overview(요약 4칸 최상단), /agents(성과 먼저·생성폼 접기), /lab(리액터 헤더→컴팩트 스트립).
- 이미 최적이라 미변경: portfolio/performance/validation/dart-auto/lab-tasks/insider.

### 4. Lv3 자가학습 기대값 전환 + 검증 게이트 (c14a0ec)
- **치명 버그 수정**: 청산 라벨이 한글(익절/손절)인데 영문 tp/sl만 탐지 → 전 거래 패배 분류로 학습 오염. 실현 수익률 % 파싱(net_ret) 추가.
- 조정 규칙 승률→비용(10bps) 차감 기대값+경로 MDD (shrinkage n/(n+10), MDD>10% 사이즈 거버너).
- `validate_proposal()`: Claude 3-Phase 제안 threshold를 counterfactual replay로 게이트(상향=부분집합 비교, 하향=기대값 플러스+폭5 이내만). 3개 프롬프트 전부 기대값 목표함수로 재작성. 신규 테스트 9건.

### 5. 백테스트 개선 (d4477d2 / f81107e)
- 조건식 지표 차트 자동 표시: `chartSpecsFromRules()` → MA/BB/EMA 가격 오버레이, RSI/MACD/CCI/OBV 서브페인(v5 멀티페인) + 헤더 칩.
- **온디맨드 카탈로그 적재**(`api_server/auto_ingest.py`): /bars·/backtest에 없는 종목이면 yfinance 3년 자동 수집. US/KR(.KS→.KQ 폴백)/크립토(.HL→-USD). GOOGL·카카오·BTC.HL 실증.

### 6. HL 에이전트 8시간 중단 사고 수습 (f81107e)
- 원인: `hyperliquid/trader.py`가 SDK 임포트마다 전역 sys.path 스왑→복원 — 스레드 경합으로 레포 루트 영구 소실 → `hyperliquid.trader` 임포트 전멸.
- 수정: importlib 직접 로드+락+캐시, main.py에 레포 루트 sys.path 고정, agent_loop.sh curl --max-time 240. 복구 확인(사이클 재개+주문 실행).
- 참고: 나머지 Lv3 에이전트 3개는 정상이었음(매크로 게이트 4<5 미달로 관망 중이었을 뿐).

### 7. 데스크탑(독일, 윈도우+WSL2) 24/7 러너 이전 — 완료 (⚠️ Phase 148에서 롤백됨, 아래는 당시 기록)
- 배경: 맥북 발열+이동성. `deploy/wsl/` 키트 신규(setup.sh, systemd 유닛 tpl, resume_agents.py, README).
- 데스크탑: WSL2 Ubuntu 22.04(deadsnakes python3.12), 백엔드+에이전트 루프 4개 가동 확인. pyproject 밖 추가 의존성: yfinance/HL SDK/xgboost/openai/alpaca-py/statsmodels/hmmlearn 등(setup.sh에 반영).
- 접속: Tailscale — 데스크탑 `100.93.202.127`, 백엔드 `--host 0.0.0.0`. 맥북 `.env.local`→`NEXT_PUBLIC_API_URL=http://100.93.202.127:8000`. 맥에서 대시보드 실동작 확인.
- 맥북 정리: 에이전트 tmux 4개+uvicorn 종료(중복 방지). **이제 맥에서 로컬 백테스트 시 uvicorn 수동 기동 필요.**
- 미커밋(레포 밖): `deploy/wsl/*`, `autopilot/agent_loop.sh` 타임아웃 패치, `.env.local`(gitignore) — seokminal 루트가 git 레포 아님.

### 다음 할 일
- 데스크탑 재부팅 시 자동시작(작업 스케줄러) 미설정 — 윈도우 업데이트 재부팅 시 수동 `systemctl start` 필요.
- ECOS 잔여: 없음(수출/수입/M2 복구됨).
- Lv3 후속(선택): 거래별 피처 저장 → 컨텍스추얼 학습, v2 shadow A/B.

## Phase 145 — 옵션 체인 데드락 버그 수정 + 실TWS 검증 (2026-07-06) ✅ DONE

"tws 했어. 나머지 다 작업해줘" 요청으로 Phase143 이월 항목 "옵션 실TWS 검증" 진행 중 `GET /ib/options/chain` 완전 행(hang) 발견 — 60초 응답 없음, 이후 `/health`까지 죽어서 서버 전체가 wedge됨.

### 원인 — `backends/ib/client.py::get_option_chain()` 3중 버그
1. **동기 메서드를 async 함수 안에서 호출**: `self._ib.reqTickers(...)`(동기, 내부적으로 `loop.run_until_complete()` 호출)를 이미 실행 중인 이벤트루프 위 코루틴에서 호출 — 순정 asyncio라면 `RuntimeError`를 즉시 던지지만, uvicorn 서버 쪽에선 예외 대신 이벤트루프 자체가 멎어버림(정확한 내부 메커니즘은 uvloop 특성 추정, 확정은 안 함). 재현: standalone 스크립트에서 동일 호출 시 `RuntimeError: This event loop is already running`. → `await self._ib.reqTickersAsync(...)`로 교체, `asyncio.wait_for(..., timeout=N)`로 감쌈(참고: `reqTickersAsync`도 내부 `ib.RequestTimeout` 기본값이 `0`이라 자체 타임아웃이 원래 전혀 없었음).
2. **옵션 계약 미검증(qualify) 상태로 조회**: `Option(...)`으로 직접 만든 계약은 `conId`가 없어서 `reqTickersAsync` 호출 시 `"can't be hashed because no 'conId' value exists"` 에러. → 호출 전 `await self._ib.qualifyContractsAsync(*contracts)` 추가, 매칭 실패(`None`) 계약은 필터링.
3. **NaN → int 변환 크래시**: `open_interest` 필드가 TWS에서 `NaN`으로 오는 경우 `int(NaN)` = `ValueError`. → `oi == oi`(NaN 자기부정 성질 이용) 체크 후 변환.

### 조치
- 서버 프로세스(uvicorn, PID 23789)가 진짜로 wedge된 것 확인(`/health`도 timeout) → `kill -9`로 부모+자식(multiprocessing fork) 전부 종료 후 재기동.
- TWS 포트 재확인 습관 유지: 이번 세션 중 한 번 TWS가 7496(LIVE)로 떠 있는 걸 발견해서 주문 테스트 전면 중단 후 사용자 확인 요청 → 사용자가 7497(paper)로 재접속 확인 후 진행.

### 실TWS 검증 (paper, 7497) — 전부 통과
- `GET /ib/options/chain?symbol=AAPL` → 실 체인 데이터 정상 반환(HTTP 200).
- `POST /orders/options`(AAPL 135P 20260710 LIMIT BUY 1@0.10, paper=true) → `order_id=4` 정상 접수.
- `GET /orders/options/4/status` → `PreSubmitted` 정상 조회(최초 1회 지연 있었으나 재시도 시 0.3s, 일회성으로 판단).
- `POST /orders/options/4/cancel` → `PendingCancel` 정상 취소, 테스트 주문 정리 완료.
- 회귀 테스트: `pytest tests/ -q` → 668 passed, 기존 pre-existing 실패 4건(test_auth×3, test_backtest_happy_path)만 남음 — 신규 회귀 없음.

### 옵션 전용 리스크가드 (만기 기반)
- `live_engine/risk_guard.py`: `RiskConfig.min_option_dte`(env `MIN_OPTION_DTE`, 기본 0=비활성) + `validate_option_expiry(expiry, config)` 신규 — 만기까지 D일 미만인 옵션 주문 차단(0DTE 등 핀/배정 리스크). 기본값 0이라 기존 동작엔 영향 없음, 필요 시 env로 켜는 옵트인 방식.
- `_check_risk()`에 `option_expiry` 파라미터 추가, `POST /orders/options`에서 전달. `GET /trading/mode`에도 `min_option_dte` 노출.
- Greeks(delta) 기반 한도는 보류 — 주문 시점에 매번 `reqTickersAsync` 왕복이 추가로 필요해 레이턴시/복잡도 대비 실익 낮다고 판단, 만기 기반 가드로 우선 커버.
- `tests/test_risk_guard.py`에 정식 테스트 4건 추가(기본값 비활성/0DTE 차단/2DTE 이상 통과/env 로딩) + 전체 pytest 672 passed(기존 4건 pre-existing만 잔존) 확인.

### 옵션 폼 IV/Delta 노출
- `app/orders/page.tsx` OPT 탭 체인 테이블에 IV/Delta 컬럼 추가(백엔드는 Phase143부터 이미 반환하고 있었는데 테이블에 안 그려지고 있었음). `npx tsc --noEmit` 클린.

### 다음 할 일
- ~~백테스트 단일모드 → composite 통합~~ → Phase146에서 완료.
- ~~mock 잔고 리셋 여부 결정~~ → 사용자 결정: 그대로 둠(액션 없음), 종결.

## Phase 146 — 백테스트 단일모드 제거, composite 통합 (2026-07-06) ✅ DONE

Phase145에서 이월된 결정 사항 중 "단일모드는 없애고 composite로 통합해줘" 사용자 확정 지시 처리. mock 잔고는 그대로 두기로 결정 완료(액션 없음).

### 변경
- `lib/backtest-types.ts`: `Mode` 타입 `"single" | "composite" | "portfolio"` → `"composite" | "portfolio"`.
- `components/ui/StrategyModeTabs.tsx`: "Single Strategy" 탭 제거.
- `components/ui/ChartPanel.tsx`: `emaFast`/`emaSlow`/`mode` prop 제거, EMA 범례를 항상 표시되는 Buy/Sell 범례로 단순화. (`CandlestickChart` 자체는 그대로 — `bots`/`forex`/`ChartTab`에서 계속 emaFast/emaSlow 사용 중이라 미변경)
- `app/backtest/page.tsx`: 단일모드 전용 state(`costBps`, `xgb*`, `optimizing`, `optimizeResult`) 제거, `run()`에서 단일/composite 분기 제거하고 항상 `gated` 전략 빌드, `optimize()`/`applyBestParams()` 삭제, `currentStrategyParams()` 단순화, URL 쿼리파람 프리필에서 strategy 관련 로직 제거(instrument/start/end 프리필은 유지 — 원래도 `instrument_id`가 아니라 `instrument` 키라 freeform 딥링크와는 무관했음), `mode === "single"` JSX 블록 전체 삭제.
- 분석 패널 게이팅: `TradeAnalyticsPanel`/`MonteCarloPanel`/`PositionSizingPanel` — `mode === "single"` → `mode === "composite"`로 변경(세 컴포넌트 다 전략 타입 의존성 없음, props 확인함).
- `StrategyComparePanel`/`WalkForwardPanel` — composite로 이관 불가라 완전 제거 후 파일 삭제:
  - `StrategyComparePanel`: EMA/MACD/RSI/XGBoost 캔드 전략 비교가 목적이라 단일모드 개념 자체가 사라지면 의미 없음.
  - `WalkForwardPanel`: 백엔드 `GET /backtest/walk-forward`가 `_SIMPLE_STRATEGIES = {macd,rsi,xgb,ema_cross}` 외 전략을 400으로 명시 거부(`api_server/main.py`) — composite(`gated`) 전략으론 애초에 동작 불가, 백엔드 변경은 이번 스코프 밖.
- 오펀 파일 삭제: `components/ui/SingleStrategyForm.tsx`, `components/backtest/StrategyComparePanel.tsx`, `components/backtest/WalkForwardPanel.tsx`. `components/ui/index.ts`에서 `SingleStrategyForm` export 제거.
- 포트폴리오 모드는 자체 전략 선택 UI(strategyType/macdFast 등 동일 state 공유)라 전혀 미변경.

### 검증
- `npx tsc --noEmit` 클린, `npm test -- --run` 190/190 통과(회귀 없음).
- 브라우저 실동작 확인(dev server): `/backtest` 진입 시 Composite/Portfolio 탭만 존재, 기본 composite 모드로 진입. Rule 조건 기반 백테스트 Run → 차트/Performance/거래분석/Monte Carlo/포지션사이징/Lv1승급 패널 전부 정상 렌더. Portfolio 탭 전환 후 기존 전략선택 UI 그대로 동작 확인.

### 다음 할 일
- 없음 (요청된 작업 완료).

## Phase 144 — control_change/buyback_cancel Auto-Research 배치 (2026-07-06) ✅ DONE

오래 밀려있던 요청("buyback_cancel, control_change 배치 지금 돌려줘"). `control_change` DART 재pull이 여러 세션째 백그라운드에서 이유 없이 죽는 문제부터 해결해야 했음.

### 원인 (무한루프 아니었음)
- `research/scanner/families.py`의 `control_change` 키워드가 `["최대주주변경","경영권"]`였는데, 실제 DART 리포트명은 `"최대주주등소유주식변동신고서"` — 매치 자체가 안 되는 버그. `"최대주주등소유주식변동"` 키워드 추가로 수정.
- `pblntf_ty=I`(지분공시) 카테고리가 원체 커서(최근 분기 기준 월 4000~2만건, 윈도우당 최대 200페이지+) 6.5년 풀스캔에 요청당 3.5~100초(간헐적 타임아웃 재시도 포함)씩 걸림 — 배경 작업 하나가 감당하기엔 너무 김. "무한루프"로 보였던 건 실은 이 볼륨 때문에 하네스 백그라운드 잡 제한시간에 걸려 죽은 것.
- `research/data/kr_dart_events.py::_fetch_window()`의 `except Exception: sleep(1); continue`에 재시도 상한이 없던 것도 잠재 위험이라 5회 연속 실패 시 예외 raise하도록 방어 추가.

### 재개형(resumable) pull 신규
- `_fetch_window()`에 `resume_page`/`on_row`/`on_progress` 파라미터 추가(하위호환, 기존 `pull_events()` 호출부 무영향).
- `pull_events_resumable(event, d, out_path, checkpoint_path, years, ...)` 신규 — 페이지 완료마다 즉시 jsonl에 append+flush, 체크포인트(`{window_idx, page}`) 갱신. 죽어도 동일 커맨드 재호출하면 마지막 완료 페이지부터 이어짐(dedup은 out_path 기존 내용 재로드로 처리). `data/kr/events_control_change.jsonl` 이걸로 6.5년(28윈도우) 완주 — 5번 죽고 재개 반복 끝에 총 24,069건 수집.

### 배치 결과
- `research.autoresearch.engine.run_batch()` 실행 완료.
- **`ev_control_change`**(최대주주변경=경영권 프리미엄 가설): n=22,251, p=1.0, `REJECT_BH`(random_baseline·walk_forward·cost_stress 전부 탈락, net -1.26%/median -2.53% 마이너스). 가설 반증 — 엣지 없음.
- **`ev_buyback_cancel`**(자사주 소각): n=0, `UNDERPOWERED`. DART에 "소각" 독립 리포트 타입이 없어 원천적으로 검증 불가 — 버그 아니고 정직한 데이터 부재 처리(`families.py` 주석에 기록됨).
- 결론: 두 이벤트 모두 실전 투입 불가. 기존 `paper_candidate`(TSMOM 등) 상태 변경 없음.

### 다음 할 일
- 없음(이 배치 요청 자체는 완결).

### 부가 — InstrumentSelect 하드코딩 개선 (Phase141 이월 항목 처리)
- `components/InstrumentSelect.tsx`: 고정 `<select>`(심볼 4개 고정, 그 외 입력 불가) → `<input list=...>` + `<datalist>` 콤보박스로 교체. 알려진 심볼 8개(NVDA/TSLA/035420/035720 추가)는 자동완성 제안일 뿐, 목록에 없는 임의 심볼도 자유 입력 가능. `app/backtest/heatmap/page.tsx`·`StrategyControlPanel.tsx` 호출부는 동일 `value`/`onChange` 인터페이스라 무변경. 디자인 토큰(`border-border bg-panel-2 text-text-1`) 적용. tsc/npm test(190) 통과.
- 남은 것: Phase145 참고 (옵션 실TWS 검증 완료, 옵션 리스크가드/백테스트 통합/mock 잔고 리셋은 계속 이월).

## Phase 143 — 옵션 매매 실행 (신규 구축) (2026-07-05) ✅ SHIPPED

Phase 142 6번 항목("옵션 매매 가능여부")을 사용자가 "옵션 매매 만들어주고"로 업그레이드. GitHub 5개 링크(lightweight-charts, finance repo 검색, FinGPT, PyPatel/Options-Trading-Strategies-in-Python, optionlab) 검토 — optionlab·PyPatel 둘 다 분석/전략 코드만 있고 브로커 주문 연동 전무 확인. 결국 기존 `ib_async` 기반 IB 연동을 직접 확장하는 수밖에 없어 그대로 진행.

### 백엔드
- `backends/ib/order_client.py` — `IBOrderClient.place_option_order()` 신규. `Option(symbol, lastTradeDateOrContractMonth=expiry, strike, right, exchange="SMART", currency="USD")` 계약빌더는 기존 `backends/ib/client.py`의 `get_option_chain()`/`get_daily_bars_option()` 패턴 그대로 재사용. `cancel_order()`/`get_order_status()`는 `orderId` 기반이라 계약 종류 무관하게 이미 동작 — 수정 불필요.
- `api_server/main.py` — `OptionOrderRequest`/`OptionOrderResponse` 모델 + `POST /orders/options`(+ `/cancel`, `GET /status`) 신규. 기존 `/orders/us` 패턴(`_check_risk()` 사전 리스크가드 → `record_order()` 감사로그 → `ConnectionRefusedError`/`OSError`→503, 기타→400) 그대로 미러링. 리스크 체크 시 `price_estimate = limit_price * 100`(1계약=기초자산 100주 승수) — 계약수 자체 한도(`max_order_qty`)는 그대로, 달러 한도(`max_order_notional`)만 승수 반영.
- 라우팅: 옵션은 항상 IB 직결(Alpaca 옵션 미지원) — `paper=True`→포트 7497, `paper=False`→7496. 기존 매뉴얼 주문 철학("실 주문=사람이 이미 결정")을 그대로 따름 — Phase113 risk-governor/exec-gateway는 옵션 자산군 인지가 아직 없지만, 이 엔드포인트는 자동화 봇이 아니라 사람이 UI에서 직접 누르는 수동 주문이라 기존 US/KR 수동주문과 동일 신뢰 수준으로 판단.

### 프론트엔드
- `lib/api.ts` — `placeOptionOrder`/`cancelOptionOrder`/`getIBOptionChain` + 관련 타입 신규.
- `lib/order-storage.ts` — `OrderLogEntry.venue`에 `"OPT"` 추가.
- `app/orders/page.tsx` — 기존 KR/US/HL 탭 옆에 `OPT` 탭 신규. Symbol+"체인 조회" 버튼(`/ib/options/chain` 실시간 IB 체인 조회) → 만기 드롭다운 + strike/C/P 테이블(행 클릭 시 strike/right/limit price(mid) 자동입력) → Paper/Live 토글 → Side/Qty(계약)/Type/Price 공유 폼 재사용 → 주문확인 모달·Order Log·Cancel 전부 기존 KR/US 분기에 OPT 분기 추가하는 방식으로 통합.

### 검증
- 신규 pytest 9건(`test_ib_order_client.py` 2건 + `test_orders_options_api.py` 7건) 포함 `pytest tests/ -q` 668 pass(pre-existing 4개 제외 동일).
- `npx tsc --noEmit` clean, `npm test` 190 pass(회귀 없음).
- 브라우저 실사용: OPT 탭 렌더→체인조회(TWS 미기동이라 "Connection refused" 에러 정상 표시)→필드 검증 에러("Symbol/expiry/strike required.")→주문확인 모달(AAPL 20261218 200C, 1계약, MARKET)→제출→"IB TWS not reachable"(503) 정상 표시까지 end-to-end 확인. 콘솔 에러 없음.

### 다음 할 일
- 실제 IB TWS(paper 7497) 붙여서 진짜 체인 조회·주문 제출 재검증 필요(이번 세션은 TWS 미기동 환경이라 에러 경로까지만 확인).
- 옵션 전용 리스크가드(그릭스/만기 기반 한도) — 아직 주식과 동일한 `max_order_notional`/`max_order_qty`만 적용, 옵션 특유 리스크(감마/베가 익스포저) 미반영.
- Greeks/IV 표시를 주문 폼에 붙일지(현재 `/options/greeks`는 계산기 페이지에만 노출) — 사용자 결정 대기.

---

## Phase 142 — 사용자 6개 버그리포트 일괄 수정 (2026-07-05) ✅ SHIPPED

사용자가 한 번에 6개 문제 제기: HUD 박살남, DART 오토파일럿 예산초과, 카피트레이드 총예산 미설정, 계좌현황 부풀림, 백테스트 싱글전략 잔존, 옵션매매 가능여부.

### 완료된 작업

**1. DART 기업행위 오토파일럿 예산 초과 (버그, 수정)**
- `api_server/dart_autobot.py` — `tick()`이 매 이벤트마다 `budget * weight`(최대 1.5배)를 예산 클램프 없이 반복 매수 → 실제 매수 총액이 설정 예산(100만원)을 훨씬 초과. `cfg["spent"]` 누적 필드 추가, 매수 전 `remaining = budget - spent`로 클램프, 소진 시 매수 중단(다음 tick 재평가 위해 acted 처리 안 함).
- `/dart-auto` 페이지 — 누적 지출/잔여 예산 표시 + "예산 소진" 경고 + "누적 지출 리셋" 버튼.
- **주의**: 이미 쌓인 기존 모의계좌 보유분(₩10M+)은 소급 정리 안 됨 — 이 수정은 향후 신규 초과매수만 차단. 기존 잔고 리셋은 KIS 모의계좌 자체를 초기화해야 함(사용자 결정 필요).

**2. 카피트레이드 총예산 미설정 (버그, 수정)**
- `app/copytrade/page.tsx` — "전체 포트폴리오 팔로우"가 종목당 고정 500 미러였음. `totalBudget`(localStorage 영속) 신규 → 총예산 ÷ 보유종목수로 종목당 배분. 개별 종목 퀵미러(`mirrorOne`)는 기존 "개별 미러 금액" 그대로 유지.

**3. 계좌현황 부풀림 (사용자 가설: 배정/매수해도 돈이 안 사라짐)**
- `/portfolio`, `/agents/accounts/balances`, 멀티에이전트 사이징 로직 전체 확인 — 설계상 정상(각 에이전트 cash = alloc - invested, 실제 브로커 잔고와 별개 추상 배정). 실제 원인은 위 1·2번(DART/카피트레이드가 설정 예산보다 많이 실제 매수)로 결론.
- 추가 안전장치: `/agents` 신규 에이전트 생성 시 "배정 합계가 실제 브로커 잔고 초과" 가드 신규 추가(`app/agents/page.tsx` `venueBucket()` + 사전 체크, 클라이언트 전용 — 이미 30초 주기로 폴링 중인 잔고 데이터 재사용, 추가 네트워크 호출 0). 최초 백엔드(`router_autopilot.py` `create_agent()`)에 넣었다가 라이브 브로커 호출 의존성 때문에 `test_agents_api.py` 3건 회귀 → 리버트 후 프론트로 재배치.

**4. 백테스트 싱글전략 잔존 (버그, 수정)**
- 원인: 모든 백테스트 실행이 `lib/experiment-storage.ts`에 자동저장되지만 유일한 조회/삭제 UI인 `/experiments`가 `redirect("/notebooks")`로 죽어있어 영구 비가시·삭제불가 상태였음(`/notebooks`엔 experiments 기능 자체가 없음).
- `app/experiments/page.tsx` 신규 작성 — 기존에 이미 완성돼 있었지만 어디서도 안 쓰이던 `ExperimentTable`/`ExperimentCompare` 컴포넌트를 연결(조회·정렬·검색·메모수정·삭제·2개 비교·전체삭제).

**5. HUD 홈 UI (Phase 141 WIP 위에서 추가 버그 발견·수정)**
- Phase 141에서 이미 리디자인된 `/hud`를 브라우저로 실사용 검증 중 발견: `components/AccountBalances.tsx`의 `money()`가 `toLocaleString(undefined, ...)`을 사용 → 이 환경 Intl 기본 로케일이 유럽식(마침표=천단위, 쉼표=소수점)으로 해석되어 "₩10.065.931", "$100.034,55"처럼 표시(프로젝트 다른 곳은 전부 `"en-US"`/`"ko-KR"` 명시 — 이 파일만 예외). `"en-US"` 명시로 수정(hud/page.tsx의 유닛로스터 배분 표시도 동일 수정).
- 계좌 카드 미니그리드가 `sm:grid-cols-3`(뷰포트 기준)라서 HUD 3단 레이아웃의 좁은 중앙 컬럼(약 420px) 안에 3열이 끼여 "배정/잔여" 라벨·숫자가 겹쳐 보이는 문제 → `grid-cols-2` 고정 + 배정/잔여를 가로배치에서 세로배치로 변경(어떤 폭에서도 겹침 없음).
- 위 로케일 버그가 사용자가 말한 "박살남"의 실질 원인일 가능성 높음(숫자 포맷이 깨져 보이고 카드 텍스트가 겹쳐 보임). 수정 후 실브라우저 스크린샷으로 확인 — 정상.

**6. 옵션 매매 가능 여부 (조사만, 미구현)**
- 결론: 실행 경로 전무. `options/pricer.py`+`/options/greeks|chain|iv-surface`는 계산 전용, IB `order_client.py`는 `Stock` 계약만 하드코딩(Option 계약 지원 0), risk-governor/exec-gateway(Phase113)도 옵션 자산군 인지 없음, 전략/에이전트 레이어도 옵션 신호 생성 안 함.
- 구현하려면: IB Option 계약빌더+주문클라이언트 확장 / risk-governor 그릭스 기반 한도 / 전략레이어 옵션 신호 — 별도 phase급. 사용자 결정 대기(아직 진행 안 함).

**부수 수정**: `tests/test_event_families_s1.py` — 이전 세션에서 `control_change`의 `pblntf_ty`를 실측 근거로 `"B"→"I"`로 고친 것(families.py, 주석에 근거 기록됨)에 테스트가 안 맞아 회귀 표시 중이던 것을 발견, 테스트를 family별 기대값으로 수정.

### 변경된 파일
- BE: `api_server/dart_autobot.py`, `tests/test_event_families_s1.py`
- FE: `app/dart-auto/page.tsx`, `app/copytrade/page.tsx`, `app/agents/page.tsx`, `app/experiments/page.tsx`(신규 작성), `components/AccountBalances.tsx`, `app/hud/page.tsx`, `lib/api.ts`

### 검증
- `npx tsc --noEmit` clean, `npm test` 190 pass, `pytest tests/ -q` 659 pass(pre-existing 4개 제외: test_auth.py×3, test_backtest_happy_path).
- `/hud` 브라우저 실사용 확인(스크린샷, 수정 전/후) — 계좌카드 포맷/레이아웃 정상, 콘솔 에러 없음.

### 다음 할 일 (미착수, 사용자 결정 대기)
- DART/카피트레이드 기존 모의계좌 잔고를 소급 리셋할지 여부.
- 옵션 매매 실행경로 신규 구축 여부(별도 phase 후보).
- (Phase 141에서 이미 넘어온 항목) 백테스트 싱글모드를 composite 조건식 빌더로 흡수 후 싱글모드 페이지 제거, InstrumentSelect 하드코딩 종목 개선.
- **이전 세션부터 대기 중인 원 요청**: `control_change` 재pull 백그라운드 잡(PID 6782, `pblntf_ty=I` 수정 반영) 완료 확인 → `research.autoresearch.engine.run_batch()` 실행 → LabEngine 큐에서 `real_control_change` 제외 확인. 이번 세션에서 사용자가 6개 버그리포트로 화제 전환하여 미착수 상태 유지.

---

## Phase 141 — 페어트레이딩 큐 재등장 버그 수정 + HUD 홈 리디자인 (2026-07-05) ✅ SHIPPED

### 배경
- "페어트레이딩 stat-arb 예전에 REJECT 했는데 왜 아직 큐에 있나" — `research/lab/pipeline.py`의 `_seed()`가 `data_mode=="blocked"`인 가설을 무조건 큐에 재포함하는데, 이미 REJECT 판정이 난 `pairs_statarb_v1`이 여전히 `blocked`로 태깅되어 있어 영구 재등장.
- "HUD 정보가 실제와 안 맞고 쓸데없는 게 많다. 자비스 이런거 안 보여줘도 되고 포트폴리오/계좌 현황이나 중요 지수를 보여달라" — 홈(`/hud`)의 장식용 아크리액터 오브·헥사곤 인디케이터·로그 티커·정적 "Jarvis 거버넌스" 패널을 정리하고 실제로 매일 볼 정보로 교체.

### 백엔드
- `research/lab/hypotheses.py` — `pairs_statarb_v1`의 `data_mode`를 `"blocked"` → `"real_registry"`로 재태깅(이미 `experiment_registry.jsonl`에 REJECT 판정 존재). `_seed()`가 `blocked`만 필터링하므로 이 변경만으로 큐에서 영구 제외되고, 향후 리플레이 시에도 `evaluate_precomputed()` 경로로 실제 REJECT 판정을 정확히 보여줌.
- 검증: `pairs_statarb_v1`이 `_seed()` 결과에서 빠짐, 관련 21개 테스트 pass.

### 프론트엔드 — 공유 컴포넌트 추출
- `lib/agent-level.ts` (신규) — `displayLevel()`을 `app/agents/page.tsx`에서 분리. 두 페이지(agents/hud)가 동일 레벨 정규화 로직을 쓰도록 통합(드리프트 방지).
- `components/AccountBalances.tsx` (신규) — `BalanceCard`/`Balances`를 `app/agents/page.tsx`에서 분리해 `/hud`에서도 재사용.

### 프론트엔드 — HUD(`app/hud/page.tsx`) 리디자인
- 제거: 헥사곤 인디케이터 행, 듀얼 ArcReactor 오브(AI/BOT), RadialGauge 3종, "Jarvis 거버넌스" 패널(자율레벨/전략레지스트리 — 정적·중복 정보), 하단 로그 티커 마퀴.
- 추가: 중앙 컬럼에 계좌 현황(`Balances`, 실제 브로커 잔액) + 주요 지수(`MarketOverviewWidget` 재사용 — KOSPI/KOSDAQ/S&P500/NASDAQ/USD-KRW/BTC/VIX/Gold). "돈길 — 엣지 생존" 패널에 리스크거버너/live집행 상태를 통합(삭제된 거버넌스 패널의 실질 정보만 이관).
- 버그 수정: 유닛 로스터가 레거시 raw `Lv${a.autonomy}`(1~5) 대신 `displayLevel()` 정규화 값을 표시하도록 수정.
- **실사용 버그 발견·수정**: `getAccountBalances()`를 기존 4초 주기 `Promise.all` 폴링 루프에 그대로 추가했더니 전체 피드가 영구 멈추는 회귀 발생. 원인 — KIS/IB 등 외부 브로커 API 호출이 10~30초+ 걸리는데, `abortRef.current?.abort()` → 새 컨트롤러 생성 → `Promise.all` 대기 → 다음 tick이 같은 컨트롤러를 abort하는 구조라서, balances 호출이 매번 "직전 컨트롤러가 스스로를 abort할 때"에야 settle되고 그 시점엔 이미 `c.signal.aborted===true`라 `setF()`가 영원히 스킵됨(balances뿐 아니라 lab/jarvis 등 다른 필드도 전부 멈춤). 수정: balances를 별도 `useEffect`로 분리, abort 없이 30초 주기 + in-flight 가드로 독립 폴링.
- 브라우저로 `/hud`·`/agents` 실사용 검증(스크린샷) — 피드 정상 갱신, 레벨 배지 정상, 계좌/지수 패널 정상, 콘솔 에러 없음.

### 검증
- `npx tsc --noEmit` clean.
- Chrome으로 `/hud`, `/agents` 실제 렌더링 확인(스크린샷 비교, 수정 전/후).

### 다음 할 일 (사용자 확정, 미착수)
- 백테스트 싱글모드(MACD/RSI/XGB) 로직을 composite 조건식 빌더에 흡수 후 싱글모드 페이지 제거.
- `components/InstrumentSelect.tsx`의 하드코딩 4종목 드롭다운을 검색-즉시표시 방식으로 교체 + 백테스트 실행 시점에 온디맨드 데이터 fetch(로딩바) — 현재 `/bars`는 사전 적재된 `ParquetDataCatalog` 6종목만 서빙, 새 종목은 백엔드에 온디맨드 fetch 경로 필요.

---

## Phase 140 — 에이전트 레벨 재편(1/2/3) + Lv1 조건식 승격 + God Mode 승급 플로우 (2026-07-05) ✅ SHIPPED

### 배경
- 에이전트 자율레벨 체계 재정의: 구Lv2/3/4가 기능상 동일함이 확인되어 통합, God Mode를 "생성 시 토글"에서 "실적 기반 승급 플로우"로 전환.
- 새 레벨: **Lv1**=조건식(백테스트에서 자연어→조건식 검증 후 승격, 그대로 페이퍼 포워드) / **Lv2**=AI 전략가(구Lv2·3·4 통합) / **Lv3**=자가학습(구Lv5). God Mode는 Lv3가 최근 실적 3조건을 통과하면 사람 확인 클릭으로 live 전환하는 별도 승급 플로우.

### 백엔드
- `api_server/god_mode.py` (신규) — God Mode 승급 3조건 심사: ①최근30일 순수익 > 벤치마크(SPY.ARCA/KOSPI.XKRX buy&hold) ②MDD≤15% ③반으로 쪼갠 미니 워크포워드 후반이 전반보다 안 나쁨. `agent_store.read_cycles`+`agent_perf.compute_performance`의 실현손익 이벤트만으로 재구성(별도 mark-to-market 데이터 없음). 데이터 부족 시 전부 fail-safe False.
- `api_server/agent_store.py` — `autonomous`/`kr_macro` 프로필 `autonomy: 5→3`, `create_agent()`에 `condition`/`instrument_id` 파라미터 추가(Lv1 전용) 및 `god_mode` 생성 파라미터 제거, `promote_to_god_mode()` 신규(Lv3만, paper→live 전환).
- `api_server/router_autopilot.py` — `GET/POST /agents/{id}/god-mode/eligibility|promote` 신규(서버가 항상 재검증, 클라이언트 신뢰 안 함), `autonomy_lv>=5`→`>=3` 5곳 renumbering.
- `jarvis/execution/agent_gate.py` — `enforce_paper()`에 God Mode 예외 경로 추가(`god_mode=True and autonomy>=3` → live 허용). 기존 arm_criteria_v1 registry 게이트와는 별개 트랙(대체 아님).
- `tests/test_god_mode.py` (신규, 6개) — 전체 654 passed 확인(기존 known-failure 1개 제외, 회귀 없음).

### 프론트엔드
- `app/agents/page.tsx` — `displayLevel()`로 레거시 autonomy(1~5) 값을 신규 3단계로 정규화(DB 마이그레이션 불필요), 생성 폼에서 God Mode 토글 제거하고 Lv2/Lv3만 선택, `GodModePanel` 컴포넌트 신규(에이전트 상세 대시보드 탭에 Lv3일 때만 노출 — 3조건 표시 + `confirm()` 확인 후 승급 버튼).
- `components/ReactorCore.tsx` — `lvToOrbVariant()` 6단계→3단계(Lv3=red, 구Lv5 계승).
- `lib/api.ts` — `GodModeEligibility`/`getGodModeEligibility`/`promoteToGodMode` 추가, `createAgent()`에 `conditionArgs` 파라미터 추가.
- `app/backtest/page.tsx` — "Lv1 승급" 패널 신규(composite 모드 백테스트 결과 있을 때만 노출) — 검증된 rule을 `buildSpawnRules()`로 그대로 직렬화해 `condition_lv1` 에이전트로 생성, 조건식/EMA 크로스 로직이 백테스트와 100% 동일하게 재사용됨.

### 검증
- 백엔드: `pytest tests/ -q --ignore=tests/test_auth.py` → 654 passed, 1 pre-existing failure(무관).
- 프론트: `npx tsc --noEmit` clean, `godMode`/`isLv5Style`/`isLv5Agent` 잔재 grep 0건.

### 다음 할 일
- (낮은 우선순위, 미착수) 주문 멱등성 + IB 연결 풀링, OMS 레이어, 실시간 PnL 대시보드
- God Mode 실사용 사례 나오면 3조건 임계값(30일/15%/워크포워드 split) 재검토

---

## Phase 139 — LKG 뉴스소스 강화 + 밸류에이션 모듈 + 소형주 엣지 탐색 4연속 REJECT (2026-07-05)

### 배경
- LKG(Living Knowledge Graph) 15/15 AI 업데이트 사이클 전부 "변경없음" — 뉴스가 구조적 신호를 못 줘서 판단 자체가 안 일어남(코드 버그 아님).
- "알림용 스코프다운" 대신 "AI 스스로 파악한 공급망 매매" 유지 결정 → 뉴스소스 강화로 방향 확정.

### LKG 뉴스소스 강화 (`api_server/graph_api.py`)
- `_fetch_8k_headlines()` — SEC EDGAR 8-K 최근 5일 (1.01/2.01/2.03/8.01 item만, 절차적 항목 제외)
- `_fetch_dart_capex_headlines()` — DART 유형자산양수결정 공시 (LKG KR 노드: SK하이닉스/삼성전자/한전/LS일렉트릭/효성중공업/HD현대일렉트릭)
- `_fetch_news_headlines()` — structural(8-K+DART) 뉴스를 40개 캡 앞에 배치, 일반 Finnhub 뉴스에 밀려나지 않게 고정
- `research/data/sec_edgar.py` — `fetch_8k_events()` 신규
- `research/data/kr_dart_events.py` — EVENT_DEFS에 `capex`(유형자산양수결정/비유동자산취득결정) 추가

### 범용 밸류에이션 모듈 (`research/data/kr_valuation.py`, 신규)
- DART 실측 자본총계/당기순이익(CFS우선/OFS폴백) + KRX 공식 시총 → PBR/PER
- PIT 안전: rcept_no 앞 8자리=실공시일 이용, asof_date 이후 공시는 컷(lookahead 없음)
- corp_code 매핑: DART corpCode.xml 벌크 다운로드 캐시(30일), 재무제표는 영구캐시(과거값 불변)
- 검증: 경인전자 2026-06-19 시점 PBR 0.48/PER 10.3 실측 확인

### 소형주 엣지 탐색 — 4개 전부 REJECT (사전등록, registry 기록)
| 가설 | hypothesis_id | 결과 |
|---|---|---|
| capex 공시 후 20일 드리프트 (n=357) | `kr_capex_drift_v1_PIT` | REJECT (pct=29, WF 부호반전) |
| ↳ 저PBR 서브그룹 (n=111) | `kr_capex_pbr_split_v1_PIT` | REJECT (pct=0.8, random보다 못함). 고PBR은 pct=97.4로 튀었으나 사전등록 안 된 사후비교라 폐기 — 새로 사전등록해야 씀 |
| VCP류 변동성수축+거래대금돌파 (n=11871) | `kr_vcp_breakout_v1_PIT` | REJECT (pct=0.0 — 랜덤보다 확실히 나쁨. 돌파시점=이미 늦은 진입일 가능성) |
| 매집구간(OBV+CCI+매집봉) 100일보유 (n=641) | `kr_accumulation_v1_PIT` | REJECT (절대수익 +2.88%지만 random 매칭 중앙값 +5.76%보다 낮음 — 이 필터가 랜덤보다 못한 종목을 고름) |

### DART 인프라 버그 수정 (`research/data/dart_nps.py`)
- 3개월 API 제한 미고려로 연간 pull 시 0건 반환 → 85일 청크로 수정
- 네트워크 재시도 없어서 SSL/connection 에러시 한 해 통째로 유실 → 재시도 루프 추가
- 재실행 결과: **미완료**. 지분공시(pblntf_ty=D) 시장전체 문서 하나하나 다운받아 "국민연금" 텍스트검색하는 구조라 원천적으로 느림(report_nm으로 사전필터 불가). 1시간 반 넘게 실행 중, 다음 세션에 이어서 확인 또는 설계 재검토 필요.

### 다음
- dart_nps 완료 확인 (또는 유니버스 좁혀서 재설계 — 예: 대형주만/특정 종목만 대상)
- 소형주 엣지: capex/VCP/매집 3개 정의 다 막힘 — "대주주 보유율(품절주)" 차원 미검증 남음(DART 최대주주현황 API 신규 필요), 시도할지는 미정
- 고PBR 튐(pct=97.4)은 흥미롭지만 사후관찰이라 새 사전등록+가능하면 새 데이터로 재검정해야 씀

---

## Phase 138 — Lv5 에이전틱 고도화 + Telegram 알림 (2026-07-04) ✅ SHIPPED

### 알파카 할당 버그 수정
- `router_autopilot.py` KR market 에이전트가 `us_alpaca`로 잘못 집계되던 버그 수정
- KR 거시 AI($1M)는 KIS 사용 → Alpaca 실 할당 = $20K

### 홈 대시보드 업데이트
- `PortfolioSnapshotWidget` 재작성 — Alpaca + 페이퍼 + LKG P&L
- `SystemStatusWidget` — LKG Graph 체크 추가
- `StrategyHubWidget` 신규 — LKG AI 업데이트 시각 + Macro Lab 링크
- `dashboard/page.tsx` — Row2 3→4열

### Lv5 단타 에이전틱 자가학습 (5개 파일)

**`lv5_learner.py`** — 빠른 규칙 기반 (<1ms, 매 사이클)
- TP/SL 이력 → 승률 기반 threshold/position_pct 조정
- 연속 SL 3회 → 1사이클 entry 휴식
- Score band Bayesian (Laplace smoothing)

**`lv5_agent.py`** — 3-Phase Claude CLI 루프 (10사이클마다 백그라운드)
- Phase 1 Strategist: 실적+컨텍스트+메모리 → 전략 제안 (산문)
- Phase 2 Critic: 리스크 지적
- Phase 3 Merger: 최종 JSON + DSL 생성
- daemon 스레드 (~90-180초), tick 블로킹 없음
- 완료 시 Telegram 자동 발송

**`lv5_memory.py`** — 에이전트별 누적 메모리
- `data/{agent_id}_memory.md` append-only 로그
- Claude가 매 리뷰 전 읽고, 완료 후 인사이트 기록

**`lv5_context.py`** — 시장 컨텍스트 (30분 캐시)
- VIX / 어닝 캘린더 / 뉴스 헤드라인 (yfinance)

**`lv5_dsl.py`** — Claude 생성 전략 DSL 실행
- time_rules / vix_rules / symbol_overrides / earnings_buffer / banned_symbols
- HL/KR/US 3개 진입점 모두 적용

**`lv6_notify.py`** — Telegram 알림
- certifi SSL 해결 (macOS Python 3.14)
- 이벤트: 리뷰완료 / 실전체결 / 회로차단기 / arm평가 / 일일요약
- Lv5 리뷰 완료 시 자동 발송 연결

### Lv6 설계 확정 (구현은 ~2026-10)
- 전략(Lv5 paper) ↔ 집행(Lv6 live) 분리 원칙
- 필요 모듈: lv6_governor / lv6_whitelist
- 알림 채널: Telegram 이미 연결
- 트리거: arm_criteria_v1 GO 판정 (~2026-10)

### 사이드바 UX 재정립 (2026-07-04 추가)

6그룹으로 재편:
- **집행**: 집행콘솔·Lab Task·총포트폴리오·계좌현황 — 돈이 움직이는 것 한 곳
- **AI 에이전트**: 에이전트·성과·리스크·DART·카피 — 자동화 허브
- **리서치**: AI LAB·Macro Lab·LKG·Buyback진단·인사이더 — 인사이트 탐색
- **검증**: 검증터미널·백테스트·이벤트스터디·시그널·데이터품질·유니버스·페어
- **마켓**: 차트&마켓·뉴스·캘린더·IB
- **교육**: 퀀트·전략만들기·옵션·결과읽기
- `IconAgent` / `IconResearch` 신규 SVG 아이콘 추가

### 로드맵 업데이트
- `roadmap.md` 예정 기능 섹션 신설 — **Groq NL 백테스팅** 등록 (구현 보류, 로드맵만)

### 테스트: 645 pass (pre-existing 4만 실패)

### 다음
- Lv6 구현: 페이퍼 관찰 후 (~2026-10)
- senate_efd / dart_nps 실행 결과 확인
- lending pull 완료 → run_buyback_x_lending.py

---

## Phase 137 — 페어트레이딩 검증 + 새 전략 등록 (2026-07-04)

### 페어트레이딩 검증 최종: REJECT

**v1 (US ETF 섹터 쌍 12개 — 잘못된 선택):**
- MSFT/AAPL 같은 비경쟁 쌍 포함 → 공적분 0/12, BH-FDR 0개 → REJECT

**v2 (경제적 페어 11개 — KO/PEP, MO/PM, HD/LOW 등):**
- IS 3년(2020-22): MO/PM EG p=0.031 공적분 ✓, IS Sharpe 1.23 / OOS 1.26 → 일시 CANDIDATE
- IS 8년(2015-22)으로 확장: MO/PM p=0.191 공적분 소멸, BH-FDR 0개, strong_pass 0개
- KO/PEP: IS p=0.0096 공적분 있으나 OOS Sharpe -0.36 붕괴
- **판정: REJECT 확정** — 공적분 시간가변적(time-varying), IS 단기 결과 = 우연

**근본 원인:** 일별 데이터 페어트레이딩은 공적분 관계가 regime 변화로 붕괴. 실제 stat-arb는 분/시간 단위 고빈도 또는 동일주식 다른 클래스(보통주/우선주) 필요.

**파일:**
- `research/run_pairs_validation.py` — 검증 스크립트 (IS 2015~2022, OOS 2023~)
- experiment_registry: `pairs_statarb_v1` REJECT 등록

### AI LAB 큐/전략 관련 파악
- LAB 큐 소스: `research/scanner/families.py` FAMILIES (11개 이벤트 family) + `hypotheses.py` SEED_QUEUE
- 자동 전략 생성 없음 — 사람이 families.py 또는 SEED_QUEUE에 추가해야 큐 증가
- 오토파일럿: ON 시 큐 전체 연속 처리, 큐 소진 시 자동 정지 (live 매매 없음)

### 새 전략 3개 SEED_QUEUE 등록
- `us_congress_buy_drift_v1` — Senate EFD PTR 데이터 활용, blocked (네트워크 필요)
- `kr_nps_acquisition_drift_v1` — DART 지분공시 국민연금 취득, blocked
- `pairs_statarb_v1` — blocked + REJECT 판정 기록

### 다음
- senate_efd.py / dart_nps.py 실제 실행 후 데이터 확보 → blocked → real_event 전환
- survivorship_check / options_backtest 실행 결과 확인
- LAB 오토파일럿 돌려서 기존 11개 real_* 가설 처리

---

## Phase 136 — 무료 데이터 소스 확장 + 생존자편향 보정 + 옵션 백테스트 (2026-07-04)

### 페어트레이딩/평균회귀 상태 확인
- `pairs_trading/johansen.py` (공적분) + `backtest.py` (z-score) + `/pairs` 프론트엔드 페이지 존재
- `risk_analysis/hurst.py` (허스트 지수) 존재
- **검증 없음** — experiment registry 미등록, BH-FDR/WF/random baseline 미실행
- **결론: 교육/UI 도구 수준. 엣지 미검증.**

### Senate.gov 무료 파싱 (#1)
- `research/data/senate_efd.py` — Senate EFD PTR (Periodic Transaction Reports) 스크래퍼
  - URL: `https://efts.senate.gov/LATEST/search-index` (무료, 키 없음)
  - 연도별 파일링 목록 → 개별 XML/HTML 다운로드 → Purchase 거래 파싱
  - 7일 캐시: `data/congress/senate_efd_{year}.json`
- `research/data/congress_history.py` 업데이트 — Senate EFD 1순위 → Quiver 2순위 → FMP 3순위 폴백 체인

### DART 문서 파싱 — 국민연금 이벤트 (#2)
- `research/data/dart_nps.py` — DART 지분공시(D) 문서 파싱
  - `pblntf_ty=D`: 대량보유상황보고서
  - 각 문서 XML 다운로드 → "국민연금" 신고자 필터 → 취득 이벤트 추출
  - 7일 캐시: `data/institutional/dart_nps_{year}.json`
  - API 키: OPENDART_API_KEY (기존 .env 존재)

### 생존자편향 보정 (#3)
- `research/run_survivorship_check.py` — Stooq.com 대안 로드
  - yfinance 실패 종목 → `stooq.com` `TICKER.US` 재시도
  - surviving vs Stooq-found 수익 비교
  - 편향 크기 = surviving median - combined median

### 옵션 백테스트 (#4)
- `research/run_options_backtest.py` — ATM 콜 vs 직접 주식 비교
  - 전략 A: Form 4 공시 D+1 주식 직접 매수 20일 보유
  - 전략 B: ATM 콜(Black-Scholes 이론가, IV=20일 실현변동성, 만기 30일)
  - $1 자본 기준 레버리지 효과 vs 프리미엄 소멸 리스크 측정

### 다음
- senate_efd.py / dart_nps.py: 실제 네트워크 환경에서 실행 후 결과 확인
- survivorship check / options_backtest: 실행 후 결과 기록
- 페어트레이딩: 검증 파이프라인 통과 시킬지 사용자 결정 (소요: 공적분 검정 + WF)

---

## Phase 135 — US 리서치 파이프라인 + 옵션 교육 (2026-07-04)

### KSD H1/H2/H3 최종 판정 (pull 완료 1371종목)
- H1 buyback×高대차: top +2.14% vs bot +0.77% diff=+1.37% **p=0.055 BH=FAIL** → REJECT (아깝지만 사전등록 기준 미통과)
- H2 Δ대차 낮음→수익: p=0.864 → REJECT
- H3 disposal×高대차: p=0.730 → REJECT
- **결론: KSD 대차잔고는 buyback/disposal 상호작용에 통계적 유의미 엣지 없음. 정직 REJECT.**

### US 리서치 파이프라인 배선 (BE 106e8f9 · FE 2a36c13)
- `research/data/congress_history.py` + `research/paper/congress_forward.py` — Congress 매매 drift 연구 프레임워크
  - **데이터 한계:** FMP 플랜 제한 → 최근 2개월치(200건)만 받아짐. 20일 forward 대부분 미완결. 검증 보류.
  - 대안: Quiver Quantitative도 유료화됨. Senate.gov/House.gov 원본 XML bulk download 검토 필요.
- `research/data/sec_edgar.py` + `research/paper/form4_forward.py` — SEC EDGAR Form 4 내부자 매수 drift
  - **URL 버그 수정:** {acc}.txt → form4.xml
  - **대형주 한계:** AAPL/MSFT 등 S&P500 대형주는 오픈마켓 매수(P) 거의 없음 — 옵션행사(M)만. 미드캡/밸류주 유니버스 필요.
  - 결과 대기 중(미드캡 은행주 테스트 실행중)
- `research/data/nps_holdings.py` — NPS/기관 데이터 스텁 (KRX 기관 순매수 대안 제시)
  - NPS 특정: DART 문서 본문 파싱 필요 → 미구현 TODO
- `backends/ib/client.py` — `get_option_chain()` 추가 (지연 데이터, OPRA 불필요)
- `/ib/options/chain` 엔드포인트 추가
- `app/learn/options/page.tsx` — 옵션 교육 페이지 4탭 (기초/Greeks/전략/시스템활용), 페이오프 차트

### US 내부자 매수 drift 검증 — PASS (단서 있음) (커밋 8c2f3c3)
- **데이터:** OpenInsider.com (무료, 키 없음) Form 4 P-Purchase $10k+ · 2025-10~2026-07 · 4,186건
- **결과:**
  - median +0.95% · stress 50bps +0.50% (살아남음)
  - p_random=0.0000 (1000회 랜덤 베이스라인 중 0회 초과) · p_sign=6e-6
  - IS(2025-10~12): median +2.36% win 60% ✓
  - OOS(2026~): median +0.42% win 51% ✓
  - BH-FDR α=0.1 통과 · WF 일관성 PASS
- **판정: PASS — 단 생존자편향 미보정, live 불가**
  - yfinance = 현존 종목만 → 상장폐지 종목(손실) 누락 → edge 과대평가 가능
  - OOS median IS 대비 크게 약화(+2.36%→+0.42%) — 관세 충격 영향
  - CRSP/Compustat(유료) 없이 PIT-clean 검증 불가
- **추가 파일:** `research/data/openinsider.py` · `research/run_us_insider_drift.py`

### 다음
- **US 내부자:** 생존자편향 보정 방법 검토 (무료 대안: Stooq.com 상장폐지 포함 여부 확인)
- **Congress drift:** 히스토리 소스 확보 필요 (FMP 2개월치 한계, Quiver 유료화)
  - 대안: Senate.gov EFD bulk XML download (연도별 ZIP), House disclosures ZIP
- **NPS/기관:** DART 지분공시 문서 파싱 구현 여부 사용자 결정
- **KSD H1 p=0.055:** 재실험 금지(사전등록 위반). v2 별도 가설 등록만 가능

---

## Phase 134 — S1 부분판정 + 월간 운영의식 + KSD 대차잔고 배선(사전등록) (2026-07-04) ✅ SHIPPED

사용자 "다 해줘" — 대기 항목 3개 일괄.

### S1 부분판정: treasury_disposal = 음의 드리프트 확인
- pull 완료분(3107건) 단독 판정: **n=3000 net −1.91% median −2.93% pct 0.0(bearish 예측대로) WF 양쪽 음수, 레드팀 CLEARED.** buyback 거울상(공급↑=악재) 확증 — CB발행(−0.73%)보다 강함. registry 기록.
- control_change/asset_transfer: 스캐너 pull 아직 진행 중(PID 67306, 완료 시 s1_scan.log에 판정 출력).

### 월간 운영의식 (07월분)
- TSMOM forward: 2026-07 월수익 −0.04bp → **in_envelope** ✓ (as_of 07-02).
- buyback edge: no_oos_yet(동결 직후), 이벤트 레벨 n_oos 0. arm_decision = **WAIT**(need_oos 0<3, need_paper 0.1<6mo) — 사전등록대로.

### KSD 대차잔고 배선 (다음 사냥, 커밋 30d2eaf)
- **ISIN 체크디짓 버그 수정**: `ksd/client.isin_from_code` 'KR7{code}003' 하드코딩 → 표준 Luhn 계산. 소형주 대차 조회 전부 0건 나오던 원인(138040=…001). 수정 후 이벤트 종목 5/5 풀히스토리 확인.
- **데이터 연못**: `research/data/ksd_lending.py` — data.go.kr KSD 대차현황, ISIN당 전 히스토리(2008~) 요청 1~2번, parquet(`data/kr_lending/`), 재개 지원. 유니버스 = buyback∪disposal 1371종목. [백그라운드 pull 중, 수 시간]
- **사전등록 동결(데이터 결합 전)**: `research/ksd_lending_prereg.md` — H1 buyback×高대차(D−2 잔고비율 top tercile 드리프트 강함) / H2 공시후 Δ대차 D0..D+5 하위→D+6..20 수익 높음(보유창 분리=lookahead 없음) / H3 disposal×高대차 더 음수. tercile n≥100, BH-FDR α=0.1, 부트스트랩 1000, stress 100bps, WF. **v1 불변 — 통과해도 v2 별도등록.**
- 러너 `research/run_buyback_x_lending.py` (pull 완료 후 실행). 테스트 4 신규, 전체 632 pass(기존 4만).

### UX 정비 — 집행 전환 반영 (FE 커밋 cd36b44)
사용자 "UXUI 평가·수정" — 진단: HUD가 사냥 시대 화면(파킹된 Auto-Research·스캔 게이지 중심), 돈길(arm 판정·OOS) 부재.
- **HUD**: 상단 ARM 배지(GO/WAIT/KILL, KILL=blink, /lab/execution 링크) + "돈길 — 엣지 생존" 패널(OOS·envelope·이벤트레벨·기대중앙값). 중앙 게이지 진행/스캔 → OOS 월·페이퍼 관찰 교체. 리액터 라벨=arm 판정, sub="money path". Auto-Research 패널 제거(로스터 유지). 마퀴 기본문구 집행 시대로.
- **Sidebar**: 그룹 "AI 연구"→"집행 · 연구", 집행 콘솔(돈길) 첫 항목, AI LAB "(사냥 · 파킹)". 하위항목 활성화 longest-match 수정(기존: /lab/execution에서 /lab 동시 하이라이트).
- **총 포트폴리오**: 연구 트랙(페이퍼) 스트립(buyback 보유/청산/누적+19.27% + ARM 배지 + 집행 콘솔 링크) — 라이브 에이전트만 보이던 구멍.
- **Hud.tsx 버그**: RadialGauge 틱 좌표 풀정밀 float → SSR/클라 hydration mismatch(dev "1 Issue"). 3자리 반올림으로 수정.
- 검증: tsc 0 · vitest 190 pass · 실브라우저(/hud /overview /lab/execution) 스크린샷 확인.

### UX 감사 2차 — 사용자 4질문 후속 (FE 46ce188 · BE 6349760)
1. 손실진단=buyback 전용 확인 → 사이드바 라벨 "Buyback 손실진단".
2. /agents(관리) vs /overview(집계) 역할 구분 확인 — 중복 아님.
3. /portfolio=마코위츠 교과서(교육) — 중복 아님. 페이퍼 트랙이 총 포폴에 안 뜨던 건 agents 원장만 집계해서 → 연구 스트립에 페이퍼 전략 목록 추가.
4. **Lab Task 카드 빈 원인 = `_task_forward()` 죽은 코드**(endpoint가 무겁다고 호출 안 함). `_warm_edge` 패턴으로 6h 배경 워밍 + 캐시 병합 + `stats_warming` 플래그. tsmom×2(Sharpe 0.56·MDD −16.96%·121mo)·buyback(1603건·월별 막대) 카드 채워짐 실확인.
- 보너스: 집행 콘솔 "전체 →" 데드링크(/lab/portfolio는 페이지 아님) → /lab/tasks.

### S1 스캔 최종 (백그라운드 완료)
11 family 중 CLEARED 3 — **전부 음의 드리프트(회피 신호), 새 롱 엣지 0(정직)**: treasury_disposal −1.91% pct0 / turn_to_profit −0.90% pct0 / asset_transfer −3.78% pct2.2(n69). supply_contract·treasury_trust·rights_issue = outlier_dependence REJECT. **control_change = 이벤트 0(UNDERPOWERED — B피드 키워드 미매칭 의심, 재pull 필요하면 I피드 검토).** registry 기록됨.

### AI 업그레이드 5종 (사용자 "하나하나 전부다") — BE 72a2a97 · FE a4ff576
1. **감시견** `jarvis/watchdog.py` — edge/ARM/OOS/이벤트레벨 조기경보/TSMOM envelope 변화만 이벤트 기록(결정적, 스팸 0). service `_warm_tsmom`(24h) 신설 = 월간 의식 관찰 자동화. /status(폰) 감시견 카드 + HUD 마퀴/blink 배지.
2. **에이전트 registry 게이트** `jarvis/execution/agent_gate.py` — 미검증 전략 live 요청 → 페이퍼 강제(+사이클 감사 흔적). PROFILE_TO_STRATEGY 명시 매핑만 인정(현재 빈 매핑 = 전 에이전트 미검증 = live 전부 차단). FE "미검증" 배지(/agents·/overview).
3. **코드 감사자** `jarvis/redteam/code_audit.py` — lookahead/PIT/survivorship 패턴 정적 탐지(음수 shift·swings·미래수익 피처·yfinance/FDR·랜덤 베이스라인 부재). 판정 안 함(finding만). 기존 swings() 2건 정확 지목 확인. CLI `python3 -m jarvis.redteam.code_audit`.
4. **Lv2 가설 생성 크론** — 매주 월 9:12 GENERATOR.md 절차(memory→3~5개→submit→run_pending→기록). job e19ab212. ⚠ 세션 종속·7일 만료(Phase 117과 동일 한계) — 세션 닫히면 재등록 필요.
5. **pull 큐** `research/data/pull_queue.py` — service가 장시간 pull 관리(ksd_lending/dart_events/krx_range, 재개 지원, 1-job 직렬). 세션 babysit 제거. /status에 큐 현황.
- 테스트 13 신규, 백엔드 **645 pass**(기존 4만). tsc 0 · vitest 190.

### 다음
- lending pull 완료(진행 ~493/1371) → `run_buyback_x_lending.py` 실행 → H1/H2/H3 판정 기록.
- control_change 이벤트 0 원인(피드/키워드) 확인 여부 사용자 결정.
- 검증된 전략을 에이전트로 돌리려면 agent_gate.PROFILE_TO_STRATEGY에 명시 등록(등록해도 live는 Lv6+사람 arm 별도).

---

## Phase 133 — 이벤트 레벨 OOS 검정 (6개월 체감 단축, 정직한 방법) (2026-07-04) ✅ SHIPPED

사용자 "6개월 너무 길어" → 편법 아닌 해상도 상향: 월 코호트(월 1개) 대신 이벤트 단위(월 ~70건)로 검정력 조기 축적.
- **먼저 중복 차단:** 규모 조건부(buyback size) 제안했다가 registry 확인 → `kr_buyback_size_decomp`(07-02)가 이미 기각("size effect 약함, 엣지는 분산 팻테일"). 재실험 안 함 = p-해킹 방지.
- `buyback_edge._event_level`: 동결일(07-02) 기준 이벤트 분할 → **Mann-Whitney 단측 p_worse**=P(OOS 분포가 in-sample보다 나쁨). 최소 20건(사전등록) 미만 = 판단 보류. buyback_forward가 raw rows(전체 날짜) 노출.
- **arm 게이트(arm_criteria_v1 월 기준) 불변** — 이벤트 레벨은 보조/조기경보. 콘솔 엣지 카드에 행 추가(p_worse<0.05 = "소멸 조기경보" neg).
- 실측: n_oos 0(동결 직후 이벤트 20일 미완결). **첫 이벤트 레벨 신호 ~2026-08 초 vs 월 게이트 ~2026-10 = 약 2개월 조기.**
- 테스트 5(분포 이동→p 작음/동일 분포→p 큼/저표본 보류/월 게이트 불변). 전체 623 pass(기존 4만). tsc 0.
- 다음 사냥 후보(미착수, 사용자 결정 대기): KSD 공매도/대차 잔고 배선(새 데이터 연못) — buyback×공매도 상호작용 사전등록 2~3개.

---

## Phase 132 — 집행 전환: 집행 콘솔 + 엣지 생존 모니터 + arm/kill 사전등록 (2026-07-04) ✅ SHIPPED

**사용자 방향 확정: 돈 도구, 사냥 졸업 → 집행 전환.** 병목=코드 아니라 시간(페이퍼 관찰). 경계: AI는 콘솔/판단보조까지, 실 arm·주문=사람.

### 집행 콘솔 (/lab/execution, 사이드바 "집행 콘솔(돈길)")
- `/lab/execution`: 동결config + 정직 기대치(중앙값+0.19% vs 팻테일평균+1.73%) + 페이퍼(1611) + 실전제약(수용력46억·1일지연-0.62%) + arm게이트(DISARMED·차단사유). buyback_config에 LIVE_READINESS 동결 사실 추가. registry id(kr_dart_buyback_drift_v1) ≠ CFG.VERSION(kr_buyback_drift_v1) 주의.
- Jarvis HUD 전면(ArcReactor·RadialGauge 5·LivePulse) + 생존자 포트폴리오 카드(getLabPortfolio).

### 엣지 생존 모니터 (decay 감지)
- `research/paper/buyback_edge.py` edge_status: forward(동결후 OOS) 월코호트 vs in-sample envelope(p10 -3.0%~p90 +3.7%, 23개월). status=no_oos_yet/accumulating/drifting/confirmed.
- **정직한 현주소: OOS 0/3** — 동결(07-02) 직후라 카운트다운 시작 전.
- series 로드 90s+ → **service 배경 워밍**(6h 스로틀, `_warm_edge`). endpoint `/lab/execution/edge`=read_only(계산 0, 콜드=warming 즉시). 실측: 첫 틱 ~220s 후 캐시 채워짐, 이후 프론트 즉시.

### arm/kill 기준 사전등록 (핵심 규율)
- `jarvis/execution/arm_criteria.py` **arm_criteria_v1 (동결 2026-07-04)** — 데이터 보기 전 고정, 6개월 뒤 자기합리화 차단. 변경=v2 재등록.
  - **GO**: OOS≥3 AND envelope내≥2/3 AND 페이퍼≥6mo. 첫 arm 상한 1,000만원.
  - **KILL**: OOS≥3 AND 과반 이탈(=엣지 소멸). 1~2개월 이탈은 경고만(성급 금지).
  - **WAIT**: 그 외(부족분 명시).
- 콘솔 arm_decision + service status(arm_decision) 노출 = KILL이 곧 알림(폰 /status). GO여도 실행은 사람 ADMIN+Lv6 이중게이트 그대로.
- 테스트 8(기준값 자체를 테스트로 고정 = 의도적 마찰). 전체 618 pass(기존 4만). tsc 0.

### 운영 의식 (월 1회, 15분)
매월: tsmom 데이터 pull → `tsmom_forward --since` → 집행 콘솔 확인(OOS 카운트·GO/WAIT/KILL). 그 외 기능 추가 금지 — 카운트다운은 코드로 못 당김.

### 파킹
- 사냥 인프라(S1·스캐너·autoresearch) 파킹. S1 pull(treasury_disposal·control_change·asset_transfer)은 백그라운드 진행 중 — 완료 시 결과만 기록.
- 다음 결정 지점: OOS 3개월 시점(±2026-10) arm_criteria가 자동 판정.

---

## Phase 131 — AI LAB ↔ Auto-Research 페이지 통합 (2026-07-03) ✅ SHIPPED

"합쳐졌다면서 왜 페이지 2개?" — 판정 로직(Phase129)·되먹임(Phase130)은 합쳤으나 UI는 2개였음. 이제 화면도 하나.
- **`components/AutoResearchPanel.tsx`** — 배치 뷰를 컴포넌트로 추출(`embedded` prop: true=컴팩트 헤더, false=아크리액터 HUD 독립 헤더). DRY 한 벌.
- **`/auto-research`** → `<AutoResearchPanel/>` 얇은 래퍼(URL·파일 보존).
- **`/lab`** → `<AutoResearchPanel embedded/>` 섹션 흡수. 라이브 루프(pending) → 배치 리더보드(최종 확정)가 한 페이지에 상류→하류로 배치.
- **Sidebar** Auto-Research 링크 은퇴(URL 접근은 유지).
- WATCHLIST verdict 스타일 추가(Phase129 wf게이트 산출), `animate-[blink...]` 임의값 → `animate-blink` 토큰. tsc 0.

---

## Phase 130 — 되먹임 순환 완성(service 배치 → lab reconcile) (2026-07-03) ✅ SHIPPED

Phase 129 미결(lab이 status.json pull만) 해소. 진짜 순환: service가 배치 후 lab 판정을 확정으로 되먹임.
- **`LabEngine.reconcile_from_batch(status)`** — 이미 emit된 `pending_bh` 판정을 배치 결과로 확정. event_study **재계산 없이** classify 재사용(단일 진실원, 배치가 이미 계산한 net/wf/redteam/bh_survivor 사용). id `real_{fam}`↔cid `ev_{fam}` 매칭. stats 버킷 재분류(pending→edges/rejects). idempotent(status≠pending이면 skip).
- **service `_autoresearch_batch`** — `run_batch()` 후 `ENGINE.reconcile_from_batch(s)` 호출. reconcile 실패해도 배치 성공 기록 유지(예외 격리). `status()`에 `autoresearch_reconciled` 노출.
- 순환 완성: pending_bh(잠정) → 24h 배치 → 확정 candidate/reject 자동 반영. lab 화면 판정피드가 배치 후 스스로 갱신.
- 테스트 8 신규(reconcile 6: candidate/reject_bh/watchlist(wf음수)/non-pending skip/family부재/idempotent + service 배선 2). 백엔드 **601 pass**(기존 4만).
- FE: lab 판정피드에 되먹임 시각화 — `reconciled` → **배치확정 ✓**(accent), pending_bh 미확정 → **배치대기**(info, blink). `LabVerdict.reconciled` 필드. tsc 0.

---

## Phase 129 — LAB↔Auto-Research 판정 통합(단일 진실원 + 배치 되먹임) (2026-07-03) ✅ SHIPPED

판정 로직 두 벌 → `classify()` 한 벌. lab이 배치 BH 되먹임. SDD(implementer→reviewer→fix) 7태스크.

### 통합
- **`research/scanner/verdict.py` `classify()`** — lab·autoresearch 유일 진실원. candidate = `bh_survivor True + 레드팀 CLEARED + net>0 + wf 양쪽 양수`(양 시스템 강점 결합). canonical status 6종(candidate/watchlist/pending_bh/reject_bh/reject_redteam/reject_stats) + `DISPLAY` 대문자 매핑(FE 호환).
- **`autoresearch.engine.latest_bh_survivor(fam_id)`** — 최신 배치 status.json 리더보드서 BH 생존 여부(bool|None). lab 되먹임용.
- **autoresearch `run_batch`** → classify 사용. verdict 필드 대문자 유지(FE 무변경). **wf 강건성 게이트 신규**(bh생존+레드팀통과여도 wf 음수면 WATCHLIST로 강등).
- **lab `evaluate_real_event`** → classify + `_lab_bh_survivor` 되먹임(지연 import, 순환 없음). 배치 미확정 = **`pending_bh`**(candidate 도장 보류 = 통계적 정직: BH-FDR은 전체 배치 있어야 계산). 확정 생존 = candidate.
- **lab 파이프라인** `pending` stats 버킷(pending_bh는 reject 아님) + EXECUTE 로그 accent.
- **lab UI** verdictStyle pending_bh → info 톤, StatsBar "배치대기" 카운트.

### 검증
- 신규 테스트: verdict 8 + autoresearch 4 + lab pending/candidate 2 + pipeline pending 1. 백엔드 **591 pass**(기존 4만). dashboard tsc 0.
- classify 스모크: pending_bh/candidate/reject_bh/watchlist(wf음수) 전부 정확.

### 미결
- 진짜 되먹임 순환 완성: service가 배치 후 lab 재평가 트리거(지금은 lab이 배치 status.json pull만).
- 커밋 위생: dashboard page.tsx/api.ts가 pre-task dirty라 Task6 커밋에 이전 Phase 미커밋분 번들(실기여=pending 4줄).

---

## Phase 128 — LAB 루프 죽은 데모 코드 제거 + lab↔autoresearch 관계 정리 (2026-07-03) ✅ SHIPPED

사용자 "AI 랩·어토리서치 벌써 된 거 아니냐 / 하나는 데모 쓴다며" 확인 요청.

### 진단
- **실행 실체:** 둘 다 실데이터(scanner.event_study). Phase 127에서 lab 합성 제거 완료. `service.py`가 24h 스로틀로 autoresearch.engine.run_batch 킥오프(느슨한 배선). 상호 import 0, 판정 코드 두 벌(lab=evaluate_real_event / autoresearch=run_batch).
- **`evaluate_synthetic`는 죽은 게 아니었음** — jarvis 배치 파이프라인(Phase 114-116)이 씀: `jarvis/agents/backtest.py`(호출) + `jarvis/pipeline._demo_specs()`(SEED_QUEUE synthetic 3개 소비). 지우면 jarvis 서브시스템+테스트 깨짐 → 보존.

### 제거한 진짜 죽은 코드 (lab 루프 한정)
- `hypotheses.synth_closes()` — 호출처 0, 완전 삭제 + `import math` 제거.
- `Hypothesis.n_bars` 필드 — synth_closes 전용이었음(무참조) 삭제, public() pop 정리.
- `lab/pipeline.py` synthetic_demo 분기(L182-184) — lab는 real_event만 seed라 도달 불가, 삭제.
- `evaluator.evaluate()` synthetic 폴백 → **명시적 raise**("LAB 루프는 실데이터 경로만"). lab 루프가 합성 못 돎을 코드로 증명.
- 문서화: evaluator/hypotheses 독스트링에 "synthetic=jarvis 배치 전용, lab 루프 아님" 명시.

### 테스트
- lab 플럼빙 3개(합성 주입→evaluate raise로 깨짐) → 빠른 `blocked` 경로(`_hb` 헬퍼)로 교체. 플럼빙은 데이터-무관이라 정당.
- evaluator 수학 테스트 5개(evaluate_synthetic 직접 호출)는 그대로 통과.
- **576 pass**(기존 4만). jarvis 데모 배치 스모크 OK(4 specs, synth 3).

### 미결(그대로)
- lab↔autoresearch **판정 코드 병합**은 여전히 안 됨(느슨한 배선만). 렌즈 다르니 co-locate 유지도 정당 — 사용자 결정 대기.

---

## Phase 127 — 캔버스 오브 + AI LAB 실엔진 교체(합성 데모 제거) (2026-07-03) ✅ SHIPPED

### 1. ReactorCore 캔버스 파티클 구체
- `components/ReactorCore.tsx` — 460 입자 피보나치 구면 + 궤도 링 3개, Y축 회전 3D 투영, perspective 깊이(앞 밝고 큼), additive('lighter') 블룸, 앰버. requestAnimationFrame. DPR 대응. 사이즈=클래스맵(no style{{}}).
- `Hud.ArcReactor` 내부 = SVG 필라멘트(조잡) → ReactorCore 캔버스 + 얇은 HUD 링 오버레이. 전 호출부(hud/lab/auto-research/buyback-doctor) 자동 업그레이드.

### 2. AI LAB 실엔진 교체 — 합성 데모 제거 (사용자 "진짜 엔진으로")
- **문제 인지:** AI LAB 루프 = `evaluate_synthetic`(합성 데이터, `_demo` 배지). 검정 수학만 진짜, 데이터 가짜.
- **교체:** `evaluator.evaluate_real_event(h)` 추가 — 실 event family → `event_study`(실 KRX PIT) + `review_strategy`(레드팀). data_mode="real_event". 판정 candidate_real/watchlist_real/reject_real/underpowered.
- `hypotheses.real_event_queue()` — FAMILIES 7개 → data_mode=real_event Hypothesis(precomputed_id=fam_id).
- `pipeline._seed` = real_event_queue() + blocked 1개. **합성 seed 제거.**
- 검증: real_buyback→reject_real(레드팀 outlier), real_capital_reduction→reject_real(net+7%지만 레드팀), buyback_cancel→underpowered. **`_demo` 사라짐, 전부 실데이터.**
- 성능: load_series 캐시(1회 ~50s, 이후 캐시). 배경 루프 OK. 첫 수동 run은 series warm 안됐으면 ~50s(autoresearch/스캐너가 서버서 워밍).
- lab 페이지 modeBadge "real_event"→"실 KRX 검증".
- **테스트 수정:** test_lab_pipeline 3개(루프 플럼빙)가 삭제된 합성 seed id 참조 + 실 family 처리로 느려짐 → `_seed_synth` 헬퍼로 합성 주입(플럼빙 테스트는 데이터 무관, 빠른 fixture 정당). 576 pass(기존 4 실패만).
- /auto-research = 같은 실엔진의 배치/리더보드 뷰(중복 아님, 다른 렌즈). "AI 연구" 그룹에 라이브 루프 + 배치 공존.

---

## Phase 126 — 정보구조 과감 재편 (혼선 정리) (2026-07-03) ✅ SHIPPED

기능 누적으로 사이드바 혼선 → 사용자 "과감 재편" 선택.
**진단(중복 3축):** ①홈 화면 4개(dashboard/hud/overview/status) ②"AI 연구" 4곳 분산(lab/auto-research/lab-tasks/freeform) ③트레이딩 그룹=잡동사니 10개(연구+봇+메타 혼재). 근본원인=요청마다 새 페이지 추가.
**재편:** 4홈+6그룹 → 홈(HUD) + 5 코헌트 그룹. 관측(HUD)·AI연구(lab/auto-research/lab-tasks)·검증(validation/backtest/compare/event-study/signal/data-quality/universe/pairs)·운용(overview/손실진단/dart/copytrade/agents/성과/리스크)·교육(quant/notebooks/report/마코위츠)·정보차트(insider/news/calendar/market/ib).
- 루트 `/` redirect → `/hud`(홈).
- **은퇴(사이드바만, 파일 보존=되돌리기 가능):** dashboard, status, freeform.
- **미완(후속):** AI LAB ↔ Auto-Research 실제 코드 병합(지금은 co-locate만, 백엔드 별개). freeform은 LLM 예산 필요라 은퇴.
- tsc 0, 재편 전 페이지 200, 은퇴 페이지도 URL 접근 유지.

---

## Phase 125 — Jarvis 하이테크 UI + Auto-Research 엔진 + 스캐너 피드 수정 (2026-07-03) ✅ SHIPPED

사용자 알바 중 자율 배치. 3파트.

### 1. Futuristic Jarvis UI
- **globals.css 모션 시스템** — `--animate-*` 토큰(pulse-glow/radar/scanline/flicker/shimmer/rise/orb/ring/blink) + 키프레임. HUD 유틸(`.hud-frame` 코너브래킷, `.scan-skeleton`, `.scanline-host`, `.tech-grid`). `prefers-reduced-motion` 존중. transform/opacity/box-shadow만(GPU).
- **components/Jarvis.tsx** — `<JarvisOrb>`(아크리액터, size/active), `<LivePulse>`(확장링 상태점), `<AnimatedNumber>`(easeOutCubic 카운트업), `<ThinkingLine>`(타이핑 커서). 디자인토큰 + no style{{}} 준수(size는 enum→클래스맵).
- 적용: **/lab**(헤더 HUD+오브+ThinkingLine, statusColor 제거→LivePulse), **/overview**(오브+AnimatedNumber 총계+LivePulse per-AI), **/freeform**(오브+ThinkingLine), **Sidebar**(NAUTILUS 브랜드 라이브 펄스).

### 2. Auto-Research 엔진 (karpathy/autoresearch 정직 이식)
- **핵심 통찰:** autoresearch("지표 개선되면 유지 ~100회/밤")를 마켓에 순진 이식 = p-해킹 기계. 정직한 버전 = "유지" 기준을 **배치 BH-FDR 통과 + 레드팀 전통제 통과**로.
- **research/autoresearch/engine.py** — Candidate 모델 + event_family 엔진(실 KRX/DART 재사용) + 배치 `benjamini_hochberg` + `review_strategy` 게이트. verdict=CANDIDATE(BH생존+레드팀)/REJECT_BH/REJECT_REDTEAM. status.json+results.jsonl 저장, log_experiment 축적. factor/tsmom/regime = 훅만("engine_pending", 가짜결과 금지).
- **API** `/lab/autoresearch`(status), `/lab/autoresearch/run`(POST, 락). **lib/api.ts** getAutoResearch/runAutoResearch. **app/auto-research/page.tsx**(리더보드+배치요약+대기엔진, Jarvis 미학). 사이드바 추가.
- **service.py** 24h 스로틀 `_autoresearch_batch()` 틱 편입 → 밤새 자동. status에 last_autoresearch/candidates 노출.
- **첫 배치 결과(실데이터):** 검증 4·저파워 3·**CANDIDATE 0**. BH가 spinoff(p=0.25) 정확히 탈락, 나머지 전부 레드팀 outlier_dependence로 REJECT. = 정직한 "밤새 돌려도 진짜 없음" 데모.
- 테스트 576 pass(기존 실패 4 = test_auth×3+backtest_happy만).

### 3. 스캐너 데이터 없던 3 family 피드/키워드 수정
- 근원: `kr_dart_events._fetch_window` L48 `pblntf_ty:"B"` 하드코딩. → `d.get("pblntf_ty","B")` + run_scanner가 family에서 전달.
- **families.py:** supply_contract→I피드(`공급계약`, 확인 305/월), turn_to_profit→I피드 `손익구조`(흑전 report_nm 없음→손익구조30%변동 대체, direction=research 양방향), buyback_cancel→키워드 `소각`+`이익소각`(B피드 프로브 8p 전체 0 = 소각공시 부재 확인 → 재pull해도 UNDERPOWERED 예상).
- **research/run_scanner_refill.py** — 3 family 집중 재pull(PID 33663, supply_contract I피드 24k pull 중, 메모리버퍼 끝에저장). 완료 시 Auto-Research가 자동 편입.

### 다음
- refill 완료 확인(`/tmp/scanner_refill.log`) → supply_contract/turn_to_profit event_study 결과. 팻테일 복권 가능성 높음.
- Auto-Research 추가 엔진(factor/tsmom/regime) 배선 시 candidate space 확장.

---

## Phase 124 — UX 정리 + 교육 페이지 + 총 포트폴리오 + 자유형 AI (2026-07-03) ✅ SHIPPED

밤샘 후속(자율 배치, 사용자 취침 중).

### UX
- **장식 이모지 전체 제거** (📱🔬🧠 등), 기능 글리프(→ ● ✓ ›)만 유지. 84파일. (정리 스크립트가 event-study 1줄 깨뜨린 거 즉시 복구.)
- 사이드바: **workflow·spawner·bots 숨김**(사장). **총 포트폴리오·자유형 AI 추가.** 교육 그룹(퀀트·연습·결과읽기) 신설. market/ib(차트)·news·calendar 유지(요청).

### 교육 페이지 3개 (초보 눈높이, 우리 실제 사례로)
- **/quant 퀀트 배우기** — 7모듈(왜 퀀트·알파vs베타vs랜덤·백테스트·함정6개·살아남은전략·리스크·용어). 접이식 + "직접 해보기" 링크.
- **/notebooks 전략 만들기 연습** — 가설→규칙→데이터→백테스트→검증→강건성→레드팀→페이퍼 8단계.
- **/report 결과 읽는 법** — 지표별(net·pct·p·WF·Sharpe·MDD·승률·top-tail) 뜻/좋은값/함정 + 판정규칙(CLEARED/WATCHLIST/REJECT/BLOCKED).

### 기능
- **/overview 총 포트폴리오** — listAgents+getAgentPerformance: 총배분·총손익·수익률·가동수 + AI별 배분막대 + 카드(배분·수익률·보유포지션·매매기록, 종목→차트링크).
- **/freeform 자유형 AI 에이전트(v1)** — 자연어 mandate → advisor 분석 + 레드팀 통제 요구(controls 논리) + 파이프 시각화. ⚠️ 완전 자율 LLM 추론은 API 예산 필요=다음 레이어. 정직 명시.
- **의회 카드 → 차트 점프** — copytrade holdings ticker → `/market?symbol=X&date=Y`(매수 타이밍 차트).

### 검증
tsc 0. 백엔드 무변경(기존 agent API 재사용).

---

## Phase 123 — Red-team 통제층 + buyback 봇 페이퍼 연결 + 자동갱신 (2026-07-03) ✅ SHIPPED

### buyback 봇 페이퍼 연결
`jarvis/paper/buyback_bot.py` + `/lab/buyback-bot` + Lab Task 카드: 검증된 v1 엣지(next_open·20d·40bps)로 페이퍼 포지션 추적(open/closed·P&L). 실주문 없음(Jarvis 차단). 실측 1611포지션(open 123/closed 1488) 평균+1.30% 승률49.4%. **봇이 노이즈 아닌 검증된 엣지 실행.**
`kr_dart_events.refresh_events()` + 서비스 24h 자동갱신 → 새 buyback 공시 → 봇 sync + v2 forward 축적.

### Red-team 통제층 (LLM MD 요구 → 결정적 실행)
`jarvis/redteam/` — 오늘 교훈(SMT confound·무상증자 ex-date·swings lookahead)을 통제 카탈로그로 encode. `REDTEAM.md`(회의주의 페르소나)가 전략별 필요통제 요구 → `controls.py` 매핑 → `review.py` 결정적 verdict(CLEARED/BLOCKED/REJECTED). LLM 합의는 verdict 아님.
- **감사 결과: 사람(AI) 판단 7/7 일치.** SMT→REJECTED(entry_confound·lookahead 자동포착), 무상증자→BLOCKED(ex_date 미완), ICT→REJECTED(lookahead·BH-FDR), turn-of-month→REJECTED(WF, 나보다 엄격).
- `/lab/redteam` + `run_redteam_audit.py`. **핵심: 통제층이 오늘 잡은 함정을 자동으로 요구 = 미래 전략 게이트.**
- **파이프 게이트 연결** (`pipeline._redteam_gate`): critic+BH 통과해도 레드팀 통제 미실행이면 paper 차단 → watchlist. **합성/자동생성은 실통제(survivorship·cost_stress·lookahead) 없어 페이퍼 못 감(정직).** 테스트 갱신.

### 설계 원칙 확정
LLM = 판단·검증요구 (연구·설계·회의주의), 결정적 코드 = 판정. "LLM 여럿 대화"는 합의된 노이즈(AutoHedge 함정) → 다른 MD(레드팀)로 검증요구는 유효하나 verdict는 결정적.

### 검증
`tests/test_redteam.py` 9 pass. 전체 **576 pass**(기존 4만). tsc 0.

---

## Phase 122 — 밤샘 마라톤: 포트폴리오·v2·인프라·ICT 졸업·폰 (2026-07-03) ✅ SHIPPED

가격패턴 사냥 졸업 후 "있는 엣지 조합·개선 + 억지 안 하는 정직한 확장" 세션. 연속 크론루프 정지(self-firing 중단).

### 리서치 — 살아있는 엣지 조합/개선
- **A 멀티엣지 북** `run_portfolio_book.py` + `/lab/portfolio` + Lab Task UI: TSMOM+buyback, **상관 -0.07(무상관)** → 등가중 **Sharpe 1.20·MDD -6%(개별 반토막)**. CB=회피 오버레이. 누적곡선·live-readiness 제약 표시.
- **B 약신호 바스켓** `run_weak_basket.py`: turn-of-month·gap-fill·crypto-mom 무상관인데 바스켓 Sharpe 0.16 < 개별 0.21 = **실패. "분산≠연금술, 약신호는 묶어도 약함"** 실증.
- **buyback v2 레짐 shadow** `run_buyback_v2.py`+`buyback_v2_forward.py`+`/lab/v2shadow` UI: 상승장 이벤트 제외 → net +1.72%→+2.52%, 승률 50.9%→54.8%, p 0.032→0.01, WF 강화. **경제가설(하락장=신뢰신호) 확인.** v1 동결·shadow·forward 검증 전 live 금지. in-sample vs forward(OOS) 분리 모니터.
- **TSMOM×레짐** = 역효과(추세강한 월이 더 나쁨) → 미채택(억지 안 함).
- **② 실행/수용력** `run_buyback_capacity.py`: 월 70건·집중도 6.7% / 유동성 이벤트당 0.7억→월수용력 ~46억(소자본) / 타이밍 1일지연 -0.62%(즉시체결). = live-readiness 관문(제약 명확).

### 리서치 — 정직한 REJECT
- **수정주가 인프라** `kr_adjustments.py`(DART 배정비율→권리락 back-adjust, 검증됨). **무상증자 = inconclusive**(커버리지 65/909 + 투기소형주 하락 엉킴, raw -26%는 권리락 아티팩트).
- **CB 조기상환**(④) = REJECT(net -3.17% pct0.8 = distress 신호, 오버행 해소 아님). **CB 양방향(발행·상환) 다 종목에 부정적.**
- **US 내부자 매수**(①) = UNDERPOWERED(대형주 매수 12건).
- **ICT 졸업 🎓** — `research/ict/models_2024.py`+`run_ict_2024/final.py`: 8모델(Model A·2024·silver bullet·OTE·unicorn·iFVG·CISD·SMT) 실 15m 당일청산 **통합 BH-FDR 전멸.** SMT만 통과했으나 confound 통제(`run_smt_control.py`)로 사망(=인트라데이 딥매수 기저, 다이버전스 0기여). ⚠️ swings() lookahead 있음(reject는 안전, 딥매수 리드는 무효).

### 시스템 — 폰/서버사이드
- **📱 상태보드** `/status` + `/lab/status`: 서버·DART봇·AI루프·리서치서비스 한눈, 5초 갱신. 사이드바 모바일 숨김(반응형). 서버 0.0.0.0 바인딩 + CORS LAN regex + api.ts 동적 호스트 → **폰(192.168.0.7:3000/status) 접근.**
- **D 서버사이드 리서치 서비스** `research/lab/service.py` + `/lab/service`: 백그라운드 스레드가 pending 큐 상시 처리(180s), 아이디어 생성 없음, live 불가, $0. 크론 self-firing 대체.

### 검증
전체 567 pass(기존 4만). tsc 0. 회귀 0.

### 정직한 순수익
새 알파 ≈ 0. **있는 엣지 3개(TSMOM·buyback·CB음드리프트)를 조합(책 Sharpe1.2)·개선(v2)·현실화(수용력)** + ICT/단타/CB해소/무상증자/약신호 **끝까지 공정검증 후 정직히 기각**(통과한 SMT도 confound로 사망). 인프라(수정주가·상태보드·서비스) 확장. 레버리지 미적용(TSMOM만 선물 내재) — 레버리지≠알파.

---

## Phase 113 — Jarvis Quant OS 안전 뼈대 (2026-07-02) ✅ SHIPPED

에이전틱 리서치·페이퍼·제한적 집행 OS. **핵심 규칙: AI는 자기 집행권한 확장 불가.** 연구=자율, 검증=결정적, 집행=제한, 전부 감사가능.

### `jarvis/` 패키지 (25 .py, 기존 research/ 하네스 래핑)
- `config.py` — AUTONOMY_LEVEL=4(사람만 변경), MIN_LIVE_LEVEL=6, live_execution_enabled().
- `audit/` — append-only 블랙박스(삭제/수정 함수 없음).
- `permissions/` — Level enum(READ_ONLY..ADMIN_HUMAN_ONLY) + ACTION_PERMISSIONS + FORBIDDEN set. ADMIN=사람만. 모든 시도 감사.
- `registry/lifecycle.py` — 16상태 FSM, 불법전이 거부(draft→live·rejected→paper·sanity→paper 차단), config_hash 동결, live전이=사람 approver 필수. experiment_registry 시드(20건).
- `memory/` — Market Memory(실 교훈 6건 시드: 유동성웨이브 생존편향·모멘텀 REJECT·buyback right-tail 등). Research Agent가 제안 전 consult.
- `agents/` — research(RESEARCH_ONLY)·datagate(PIT/survivorship→상태)·backtest(하네스 래핑, 불변 provenance)·critic(결정적 red-team).
- `paper/` — 내부 원장(브로커 무관, PAPER_ONLY, paper 상태만). monitor 스켈레톤.
- `risk/governor.py` — 결정적(LLM 아님). live_candidate+·config_hash·유니버스·notional·킬스위치. dry-run.
- `execution/gateway.py` — live는 레벨<6이면 무조건 BLOCK. mock/paper만.

### CLI (스펙대로)
`python -m jarvis`(배너) · `jarvis.agents.research propose` · `jarvis.agents.datagate check` · `jarvis.registry show --status` · `jarvis.paper.monitor` · `jarvis.risk.check` · `jarvis.execution.live`→BLOCKED(exit 3).

### UI 연결
`/lab/jarvis` 엔드포인트 + AI LAB 페이지 상단 거버넌스 스트립(Level 4·live disabled·registry 20·risk governor dry-run).

### 테스트
`tests/test_jarvis.py` **19 pass**(live 권한거부·리스크한도 사람만·감사삭제 금지·rejected/sanity 승격불가·불법전이·데이터게이트·거버너·config_hash·원장·append-only·부트). 전체 529 pass(기존 4 실패만: auth×3, backtest_happy). tsc 0.

### 안 지음
실브로커 실행·자동 live·리스크한도 변경·자동승격·자가수정. Lv2(LLM 실시간 생성)=스케줄 Claude Code(CLI, API키 0).

---

## Phase 121 — 멀티엣지 포트폴리오(A) + 약신호 바스켓(B) + 이벤트 pull(C) (2026-07-03)

가격패턴 사냥 졸업(6루프 전멸) → 생존자 조합 + 바 낮추는 대신 똑똑하게. 연속 크론루프 정지(self-firing 중단, 대화 우선).

### A — 멀티엣지 포트폴리오 (`run_portfolio_book.py`) ✅
TSMOM(선물)+buyback(KR) 월수익 조합. **상관 -0.07(무상관).** 개별 MDD -12~15% → **등가중 조합 Sharpe 1.20·MDD -6%(반토막).** 분산이득 = drawdown에서. CB는 음드리프트라 회피오버레이. = "실제 굴릴 책".

### B — 약신호 바스켓 (`run_weak_basket.py`) ❌
turn-of-month·gap-fill·crypto-mom(개별 WEAK) 무상관(0.28/-0.06/0.02)인데 **바스켓 Sharpe 0.16 < 최고개별 0.21.** **결론: 분산은 연금술 아님 — 약신호는 묶어도 약함.** = "검증 바 낮추지 마라"의 실증. A(진짜엣지)는 되고 B(약신호)는 안 됨.

### C — 무상증자 실검증 (`run_bonus_issue_pit.py`, `kr_dart_events` bonus_issue 추가)
새 이벤트 연못. DART 무상증자 pull → PIT survivorship-free 양드리프트 검증. [백그라운드 진행중]

### 결론
답답함의 답 = 바 낮추기(B가 반증) 아니라 **생존자 조합(A 성공) + 새 진짜 엣지(C)**.

---

## Phase 120 — Lab Task 페이지 + 연속루프 5분 (2026-07-03) ✅ SHIPPED

### Lab Task 모니터 (`app/lab/tasks/page.tsx` + `/lab/tasks`)
AI LAB 승격 페이퍼 전략 모니터: 진입/청산 규칙 · 통계(거래수·평균·중앙값·승률/Sharpe·MDD) · **월별 수익 막대**(매매 타이밍·손익 시계열). 실 forward 러너(tsmom/buyback) 데이터, 120초 캐시, 15초 폴링. Sidebar 📋 Lab Task.
- 실측: kr_dart_buyback_drift_v1 = 진입 공시익일시가/청산 20일종가, 1603건, mean+1.42% 승률49.7%, 24개월 코호트.

### 연속루프 5분 (job 2a7f3fc4)
11분 → 5분(3,8,..,58). 병목은 데이터라 대부분 dedup-skip 예상.

### 검증
전체 **567 pass**(기존 4만). tsc 0.

### 다음 후보 (미결) — 복합 전략(#3)
플랫폼 미사용 기능 = condition_engine(지표조합)·regime_filter·FRED/ECOS(매크로)·KSD(대차/공매도가능)·correlation(페어/SMT). → **signal-block 조합 레이어** 제안(기존모듈 = 블록, 전략 = 조합). 미착수.

---

## Phase 119 — CB/BW 발행 실 DART 검증 = 음의드리프트 확인 (2026-07-03) ✅ SHIPPED

첫 신규 이벤트 family를 **실데이터**로 검증(위시리스트→pull→PIT 판정 사이클 첫 완주).

### 데이터 + 결과
- DART 전환사채 발행 **7954 이벤트** pull(6.5년), KRX PIT survivorship-free 매칭 6947.
- 20일 롱 net **-0.73%(base) / -1.33%(stress)**, **percentile 0.0**(500 랜덤 전부보다 나쁨), WF 양쪽 음수 안정.
- 대조 buyback(호재) +1.73%.
- **VERDICT: NEGATIVE_DRIFT 확인.**

### 의미 — 자본구조 공급 논지 양방향 확증
| 이벤트 | 공급 | 드리프트 | |
|---|---|---|---|
| buyback | ↓ | +1.73% | 호재(paper_candidate) |
| CB/BW 발행 | ↑희석 | -0.73% pct0 | 악재(음드리프트 확인) |
둘 다 survivorship-free·cost-robust·WF안정. KR 공급이벤트 방향성 실재.

### 정직한 거래가능성
음드리프트 = 롱 손실. 숏=KR 제약(대차·업틱). → live 롱 아님. 가치 = 회피신호 + 희석 메커니즘 확증 + buyback 보강.

### 파일/버그
`research/run_cb_issuance_pit.py`(신규), `research/data/kr_dart_events.py` cb_issue pull. `0.0 or 50.0` falsy 버그 수정. registry에 kr_cb_issuance_negdrift_v1_PIT=research_negative_drift 기록.

---

## Phase 118 — ICT 프리미티브 라이브러리 + 실 15분봉 검증 (2026-07-03) ✅ SHIPPED

"order block/FVG가 끝이 아니다" — ICT를 **기계적으로 조합·검증**하는 툴킷 + 첫 실데이터 판정.

### `research/ict/` (객관 프리미티브만, 주관 개념 제외)
- `primitives.py` — FVG · order block · liquidity sweep · swings · market structure(BOS/CHoCH) · kill zone(시간) · OTE(피보). 7개 탐지기, 전부 명시적 정의.
- `strategy.py` — Model A: NY 킬존 + bullish sweep + bullish FVG → 롱. 조합 규칙, 고정파라미터.
- `backtest.py` + `run_ict.py` — 실 15분봉(US 12종목, 2년) 풀링, 매칭 random(킬존 eligible) 대비.
- `tests/test_ict_primitives.py` **9 pass** — 심은 패턴 정확 탐지 검증.

### 판정 (실데이터)
```
ICT Model A: 총 진입 113 | 평균수익 -0.09%
vs random: percentile 52.4 p=0.477 (rand_med -0.10%)
VERDICT: REJECT — random과 구분 불가 (엣지 없음)
```
**킬존+sweep+FVG 컨플루언스가 "랜덤 킬존 진입"보다 나을 게 없음.** registry에 rejected 기록.

### 의미
- ICT Model A 1개 판정일 뿐 — 라이브러리로 OTE·OB·BOS/CHoCH·SMT·다른 킬존/보유 무한 조합 가능. 단 각 조합 = BH-FDR 예산 소모.
- ICT는 유명하나 첫 객관 검증서 엣지 0. 입증 책임은 ICT에 있고 Model A는 실패.

### 검증
전체 **567 pass**(기존 4 실패만). 회귀 0.

---

## Phase 117 — Lv4 arm 골격 + Jarvis UI + 실 스케줄 잡 (2026-07-02) ✅ SHIPPED

"다 해줘" — 4개 동시 진행.

### ① Lv4 micro-live ARM 골격 (`jarvis/execution/arm.py`)
사람만 arm(ADMIN). **이중 게이트: ①사람 arm ②autonomy≥6.** level 4에선 무장해도 실행 BLOCK(안전). 최소 6개월 페이퍼 강제. gateway에 micro_live 모드 추가(무장 안 되면 REJECTED, 레벨 미달이면 BLOCKED). `tests/test_jarvis_arm.py` 7 pass.

### ② Jarvis UI 시각화 (`app/lab/page.tsx` JarvisPanel)
생애주기 퍼널(draft→…→micro_live + blocked/rejected/retired 카운트) + Forward 배포 목록 + 감사 로그 tail(색상). `/lab/jarvis/detail` 엔드포인트 + `getJarvisDetail`. 5초 갱신. tsc 0.

### ③ 실 스케줄 잡 (CronCreate)
매일 3:13am Research Agent 자율 실행(job 17474487). ⚠️ session-only(세션 닫으면 정지)·7일 만료. 프롬프트에 정직성(합성=파이프연습)·live 금지 박음.

### ④ 스케줄 루프 수동 시연 (실측)
submit 2건(지수편입·락업해제) → 지수편입 paper_candidate+auto paper_active, 락업 rejected → buyback 실 forward 모니터(buyback_forward available). live 0.

### ⑤ CB/BW 발행 실 DART 검증 (`research/run_cb_issuance_pit.py`)
전환사채 발행 이벤트(DART cvbdIsDecsn) PIT survivorship-free 음드리프트 연구. 익일진입 20일보유 vs 매칭 random, buyback(호재) 대조. [결과는 별도 로그 — 진행 중]

### 검증
전체 **558 pass**(기존 4 실패만). tsc 0. 회귀 0.

---

## Phase 116 — Lv2 리서치 큐 + 스케줄 Claude Code 가설생성 (2026-07-02) ✅ SHIPPED

스케줄 Claude Code(구독, **API키 0**)가 가설을 큐에 기록 → 결정적 파이프라인이 주기 검증.

### `jarvis/research_queue.py`
- `submit(spec)` — ingest 가드: ①dedup(registry 중복 거부) ②Market Memory consult(거부 family 유사+differentiation 없으면 거부) ③명시 keywords로만 매칭.
- `run_pending(alpha, cap)` — pending을 run_batch(BH-FDR)로 검증 → processed 이동. rate cap(기본 25).
- `generate_stub(topic)` — LLM 없는 더미(스케줄 Claude Code가 대체).
- CLI: `submit --spec` / `list` / `run --alpha`.

### `jarvis/GENERATOR.md`
스케줄 Claude Code 5단계 절차(memory 조회→3~5개 제안→submit→run→결과기록) + 스펙 스키마 + 가드레일.

### 실측 (CLI 엔드투엔드)
submit 3건(엣지·노이즈·유동성웨이브 재탕) → wave 재탕 **거부**(similar_rejected, differentiation 없음) → run(BH-FDR) → PEAD paper_candidate, noise rejected → **자동 paper_active**.

### 테스트
`tests/test_jarvis_research_queue.py` **9 pass** (accept·missing·dup·registry중복·memory차단·differentiation허용·run검증+clear·rate cap·엣지 auto-deploy). 전체 **551 pass**(기존 4 실패만).

### 스케줄 설정 = opt-in
반복 Claude Code 잡 = 표준 시간 소모 → 사람 승인 후 CronCreate로 설정(미설정). 큐 인프라는 완성.

---

## Phase 115 — Lv3 paper_candidate 자동 forward 배선 (2026-07-02) ✅ SHIPPED

paper_candidate 도달 → **자동으로 forward-test 배포(paper_candidate→paper_active)** + 기존 forward 모듈 배선.

### `jarvis/paper/deploy.py`
- `deploy(sid)` — 전제조건(paper_candidate·config 동결) → paper_active 전이 + 배포기록. 권한 PAPER_ONLY.
- `auto_deploy_all()` — registry 모든 paper_candidate 일괄 배포.
- `run_forward(sid)` — 배포된 러너 실행(실데이터 실패 우아하게).
- **RUNNER_REGISTRY:** futures_tsmom(_32mkt)→`tsmom_forward:generate`, kr_dart_buyback_drift_v1→`buyback_forward:generate`, 그외→generic 내부원장.
- CLI: `python -m jarvis.paper.deploy [--strategy X]`.

### 파이프라인 통합
`run_batch(auto_deploy=True)` — 승격된 paper_candidate 즉시 자동 forward 배선. `monitor()`는 paper_active면 배포 러너 실행 + 원장 요약.

### 실측 (CLI)
- run-batch → PEAD paper_candidate → **자동 paper_active**(generic) → monitor forward available, live_orders disabled.
- 시드 후 auto-deploy → 실 paper_candidate 3건이 실 러너 배선(tsmom_forward×2, buyback_forward×1).

### 테스트
`tests/test_jarvis_deploy.py` **8 pass** (전이·러너배선·generic·비-candidate 차단·idempotent·일괄·monitor forward·실데이터 우아실패) + pipeline auto-deploy 1. 전체 **542 pass**(기존 4 실패만). live 자본 0 유지.

### 다음
Lv2 = 스케줄 Claude Code 가설생성 → run_batch 주기실행. paper_active 실 forward = 데이터/TWS 필요(tsmom=IB, buyback=DART).

---

## Phase 114 — Jarvis 파이프라인 오케스트레이터 + BH-FDR 예산 (2026-07-02) ✅ SHIPPED

9모듈을 하나로 체이닝: **research→datagate→backtest→critic→registry.** 결정적, LLM 0.

### `jarvis/pipeline.py`
- `run_hypothesis(spec)` — propose→data gate(commit)→(pass면)backtest→critic. registry 전이 자동.
- `run_batch(specs, alpha)` — **BH-FDR 다중검정 예산.** paper_candidate 승격 = critic 추천 AND BH 생존 **둘 다**. 자동검정 false-discovery 방지(핵심 가드).
- CLI: `python -m jarvis.pipeline run-batch [--alpha 0.1] [--specs f.json]`.

### 데모 배치 결과 (AI LAB 시드 4가설)
| 가설 | 결과 |
|---|---|
| CB/BW 해소 | blocked_by_data (데이터 게이트) |
| CB/BW 발행 음드리프트 | rejected (p 0.33) |
| PEAD | **paper_candidate** (critic + BH-FDR 생존, p 0.004) |
| 오버나잇 | rejected (p 0.37) |

BH-FDR: 3 tested → 1 survivor(threshold 0.004). 실엣지만 게이트 통과, 노이즈 기각.

### 테스트
`tests/test_jarvis_pipeline.py` **4 pass** (실엣지 승격 α0.1 / **α0.01로 조이면 PEAD도 승격 차단**(BH 예산) / 차단가설 tested 제외 / survivor 카운트). 전체 **533 pass**(기존 4 실패만). tsc 0.

### 다음
Lv2 = 스케줄 Claude Code가 가설 스펙 큐에 기록 → run_batch 주기 실행. Lv3 = paper_candidate 자동 forward 배선(tsmom/buyback_forward 연결).

---

## Phase 112 — AI LAB 자율 리서치 루프 (2026-07-02) ✅ SHIPPED

자비스 플로우: **자체생각(THINK) → 검토(REVIEW) → 집행(EXECUTE) → 학습(LEARN).** 트레이딩 카테고리, 살아있는 UI.

### 정직성 설계
- LEARN 지식패널 = **실제 experiment_registry**(20건: tsmom paper_candidate, buyback, momentum/wave/funding REJECT).
- 검토 = **진짜 empirical p-value** (per-event iid: 전략=edge+noise vs 매칭 random=edge0). 데이터 합성이면 `합성 데모` 배지. 합성 결과는 공식 registry 미기록.
- CB/BW 오버행 해소 = 큐에 넣되 audit이 **BLOCKED_BY_DATA**(linkage/잔액 파이프 미구축) — 실제 데이터 게이트 노출.
- **가드레일:** EXECUTE는 판정+장부까지만. live 매매 자동 실행 없음(live_guard=disarmed). paper→live는 사람.

### 변경 파일
- 백엔드: `research/lab/{__init__,hypotheses,evaluator,pipeline}.py`, `api_server/lab_api.py`(/lab/state·/run·/autopilot), main.py 라우터 include.
- 프론트: `app/lab/page.tsx`(4스테이지 플로우+펄스+스트리밍 로그+메트릭 채워짐+판정피드+큐+지식), `lib/api.ts`(LabState 등 3함수), Sidebar 트레이딩에 🧠 AI LAB.
- 큐 데모: CB/BW 해소(BLOCKED)·CB/BW 발행 음드리프트(REJECT)·PEAD(PASS)·오버나잇(REJECT) = 전 스펙트럼.

### 테스트
`tests/test_lab_pipeline.py` 10 pass (blocked/무엣지≈50pct/음엣지 reject/비용스트레스/underpowered/snapshot/live가드/오토파일럿 소진). tsc 0.

### 다음
Lv2 = LLM 실시간 가설 생성(API키), BH-FDR 예산. Lv3 = 통과분 자동 forward 배선. Lv4 = live(사람 arm).

---

## Phase 111 — KR buyback 로버스트니스(N=1000·아웃라이어·forward모듈) (2026-07-02) ✅ SHIPPED

paper_candidate 확정 후 로버스트니스. next_open만 판정근거(ann/next_close는 lookahead/아웃라이어).

### #1 N=1000 + #2 아웃라이어/중앙값
```
평균 +1.73%(상위5% 기여 114%=팻테일) | 중앙값 +0.19% | trimmed +0.77% | 승률 51%
N=1000 평균 p=0.028 | N=1000 중앙값 p=0.001(랜덤중앙 −0.94% 크게 이김)
```
- 평균은 아웃라이어 왜곡, but 중앙값도 랜덤 이김 = 엣지는 진짜(착시 아님)

### #4 forward-test 모듈(완결필터=더 정직)
- `research/paper/buyback_forward` + `buyback_config`(FROZEN): 월 코호트 중앙값 + envelope
- 완결(20일)만: mean +1.42%(팻테일), **median −0.086%(breakeven)**, 승률 49.7%. 앞 median +0.19%는 부분보유 부풀림
- **정직한 그림: 엣지는 median 아닌 팻테일 의존, 절대 median 본전이나 랜덤(−0.94%)보다 나음.** 기대치 하향

### 로버스트니스 분해
- 진입타이밍: next_open +1.73%(frozen) / **delayed_open p=0.156 소멸(타이밍 민감=핵심리스크)**
- 공시유형(직접+1.97/신탁+1.61)·시장(KOSPI+1.35/KOSDAQ+2.02)·시총(대형+3.3 최강)·issuer 674개 = 다 양수·분산

### 판정: paper_candidate 유지 (노란불)
- 랜덤 이김 + 경제적근거 진짜 = REJECT 아님. 근데 절대수익 modest(테일의존)·타이밍 민감 = forward-test로 검증
- config 동결, 분해로 튜닝 금지. 커밋 4b2ea22·90ca267

### 다음: #3 취득금액(OpenDART tsstkAqDcsn) size/marcap/ADV 분해

---

## Phase 110 — 자사주 PIT/survivorship-free 검증 → PAPER 후보 (2번째 생존 엣지) (2026-07-02) ✅ SHIPPED

Phase 109 자사주 WATCHLIST를 KRX PIT로 제대로 검증. KOSPI 스냅샷도 pull(486일).

### PIT buyback (전체 코스피+코스닥, survivorship-free)
- `run_kr_dart_buyback_pit`: KRX 시계열(폐지종목 활동기간 포함)로 포워드수익 재계산, 매칭 random·비용·WF·유상증자 대조
```
2906종목 | buyback n=1735 net +1.73% random 97.0pct p=0.032 | 50bps p=0.036
WF 전반 +1.31/후반 +2.15(양쪽) | 대조 유상증자 +0.10(base)/−0.50(stress)
```
- 편향 제거로 FDR p0.002→0.032 약해졌으나 **95pct+p<0.05+WF양쪽+비용스트레스 다 통과**
- **급등주를 죽인 같은 PIT 테스트에서 자사주는 생존 = 편향 착시 아닌 진짜 엣지.** 전세계 buyback anomaly와 일치

### 결과: 2번째 생존 엣지 (TSMOM 다음)
- 검증 통과 = TSMOM(선물) + **자사주(KR 공시 이벤트)**. "차트 파동 죽고 공시 이벤트 살아남음" 증명
- 현황 15가설: REJECT 11 / BLOCKED 1 / 후보 3(TSMOM paper·candidate·**자사주 PIT watchlist→paper**)

### 다음 (paper 전 로버스트니스, TSMOM처럼)
- holding 민감도(20d 임의?) · N=1000 random · 기간/섹터 집중도 · 관리종목 필터 · 소형주 실비용
- 통과 지속 시 → paper forward-test 후보 등록

### 검증
- 백엔드 테스트 유지. 커밋 633aca6

---

## Phase 109 — KRX 공식 API 통합: 급등주 PIT REJECT 확정 + buyback WATCHLIST (2026-07-02) ✅ SHIPPED

사용자가 `.env`에 KRX_API_KEY 제공했었음(내가 pykrx/FDR 오용, 안 씀). KRX 공식 OpenAPI(data-dbg.krx.co.kr)로 전환.

### KRX API 데이터 레이어
- `research/data/krx_api.py`: 날짜별 전종목 스냅샷(OHLC·**실거래대금**·시총·부서). 486 거래일(2년) KOSDAQ pull → `build_series`로 종목별 시계열 재구성 = **PIT universe + survivorship-free by construction**(폐지종목 활동기간에만 존재)

### 급등주 PIT 재검 → REJECT 확정
- `run_kr_liquidity_wave_pit`: 1923 KOSDAQ(생존+폐지), 관리종목 제외, 실거래대금 게이트
```
gross −1.26%(비용전 음수) | net −1.66% random 0.2pct p=0.998(랜덤보다 나쁨) | WF 양쪽 음수
```
- **survivor-only +2.28%(90pct)는 100% 편향 착시.** FDR로는 계속 WEAK 애매였으나 KRX 공식 PIT로 명백 REJECT. 실돈이면 잃었을 것

### 보너스 — DART 자사주 이벤트 스터디 = WATCHLIST
- `kr_dart_events`(OpenDART 주요사항보고) + `run_kr_dart_event_study`: 공시 다음날 진입 20일 보유
```
buyback net +1.85% random 100pct p=0.002 | WF 양쪽 양수(+1.58/+2.04)
대조 유상증자(약세) −2.65% ← 반대=경제적 coherent | 50bps p=0.006
```
- **지금까지 KR 최강 신호**(buyback anomaly, 전세계 검증). WATCHLIST. 단 PIT/생존편향 미검토 + n카운트 캐시버그(방향 유효)

### 현황: 15가설 → REJECT 11 / BLOCKED 1 / 후보 3(TSMOM paper + TSMOM candidate + KR buyback watchlist)
### 검증
- KR detector/이벤트 테스트 유지. 커밋 0f748e7·6d79b4e

---

## Phase 108 — KR 이벤트윈도우 게이트 → survivorship 편향 폭로, 사실상 REJECT (2026-07-02) ✅ SHIPPED

Phase 107의 delisted 통제 무효(전체평균 게이트가 펌프주 제외) → 게이트를 **20일 롤링평균 최대치**로 교체 → delisted 1→39개 제대로 포함.

### 결과 (survivorship 통제 제대로 작동)
| | survivor만(편향) | 이벤트윈도우(통제) |
|---|---|---|
| 트레이드 | 211 | 250(211+39 delisted) |
| net base | +2.28% | +1.42% ↓ |
| vs random | 90.8pct p=0.094 | 86.6pct **p=0.136** ↓ |
| severe 100bps | +0.68% | **−0.18%(음수)** |
| delisted net | +13%(n=1) | **−2.99%(n=39)** |

- **폐지종목이 그 순간 유동성 기준으로 들어오니 결과 하락.** delisted 평균 −2.99%(펌프후 죽은 종목 손실) = survivor-only 양수는 상방편향 확증
- 통제 후 **p=0.136 = 매칭 random과 구분 안 됨.** severe 비용 음수

### 판정: 사실상 REJECT
- 러너는 86.6pct→"WEAK"이나 정직하겐 REJECT — p=0.136 유의X, 극단비용 음수, delisted −3%가 편향 확증. **KR Liquidity Wave는 제대로 된 survivorship 통제 후 매칭 random 못 이김**
- 방법론 성공: 편향 잡고→게이트 고치고→정직한 답. survivor-only였으면 WEAK 후보로 착각했을 것

### 검증
- KR detector 5 유지. 커밋 51bfbf2

---

## Phase 107 — KR Liquidity Wave survivorship 통제 재검증 (WEAK 유지, 통제 불완전) (2026-07-02) ✅ SHIPPED

survivorship 통제 = 상장폐지 KOSDAQ(2022+) 포함(펌프→폭락→상폐 이벤트로 상방편향 제거).

### 결과
- `kr_data.list_delisted` + run_kr에 delisted universe 추가 + survivor/delisted 분해
- **진단:** 폐지종목 215개 데이터 다 있으나 **유동성게이트(전체평균 거래대금) 통과 12%**, 그중 wave 이벤트 1건뿐(212 vs 211)
- **왜:** ① 전략이 선택적(펌프주=통제된 눌림 없이 직행폭락→패턴 미발생, 최악종목 자연회피) ② 게이트 함정(잠깐펌프=평균 낮아 제외 → survivorship 제대로 스트레스 못함)
- **결과 불변:** net +2.28%(base)·100bps까지 양수 / random 90.8pct p=0.094(유의X) / WF 후반쏠림 / survivor +2.23%(211) vs delisted +13%(1, 무의미)

### 판정: WEAK 유지, sanity-only, 승격 불가
- 편향이 뒤집지도(delisted 무의미) 제대로 통제되지도 않음. **통계적 유의성 부재가 핵심** — 희미한 발자국 있으나 매칭random과 구분 안 됨
- 전략 선택성(펌프주 회피)은 약한 positive지만 미검증

### 다음 (방법론, 튜닝 아님)
- 유동성게이트 전체평균→이벤트윈도우(펌프주가 그 순간 자격 얻게) / 실 거래대금(Amount 히스토리) / 장기데이터. 근데 WEAK/유의X라 우선순위 낮음

### 검증
- KR detector 5 테스트 유지. 커밋 8f789ba

---

## Phase 106 — KR Liquidity Wave 트랙 (audit→detector→검증, WEAK sanity) (2026-07-02) ✅ SHIPPED

새 리서치 트랙: 한국 소형주 유동성 파동. 조작탐지/세력 아님 — 공개데이터 발자국 검증. 스펙대로 데이터 audit 먼저.

### 데이터 게이트 (audit)
- pykrx = KRX 로그인 요구(universe/시총/플로우 블록). **FDR로 우회**: `research/data/kr_data.py`(SSL 로컬우회, 공개데이터) StockListing = universe 2766(KOSPI 945+KOSDAQ 1821) + 시총(Marcap) + 거래대금(Amount) + Dept(관리종목), DataReader = 티커 일봉
- ✅ 일봉·시총·거래대금·상장상태·상장폐지 / ❌ **PIT universe·intraday·투자자플로우·공매도** → **RESEARCH_SANITY_CHECK_ONLY**

### 전략 (KR Liquidity Wave Pullback v1)
- `research/strategies/kr_liquidity_wave.py`: impulse(+10% & 거래대금 5×avg20) → pullback(거래대금 수축·저점유지) → rebreakout(거래대금 2×avg5) → **다음날 시가 진입**, 눌림저점 이탈/10일 타임스탑 청산. '세력' 코드 안 씀(liquidity_impulse 등)
- `research/run_kr_liquidity_wave.py`: matched random(같은 bucket·보유·비용) + 비용스트레스 40/100/200bps 왕복 + WF. detector synthetic 5 테스트

### 판정: WEAK — sanity only
```
211 트레이드 | gross +2.63% | net(base) +2.23% | 100bps까지 양수
vs random 90.8pct p=0.094(유의X) | WF 전반 −0.30%/후반 +4.74%(쏠림)
```
- **죽은 주식 TA보다 살아있음**(극단비용까지 net+, 랜덤중앙 초과, KOSDAQ 리테일=덜 효율적 그럴듯). **근데 승격 불가:** 유의성 부족(90pct<95, p0.09)·WF 후반쏠림·**survivorship 상방편향**(현재상장만=승자편향)
- 진짜 엣지는 보이는 것보다 약함. WEAK도 관대

### 다음 (편향 통제 = 진짜 검증)
- PIT universe + 상장폐지 포함(FDR delisting 됨)으로 survivorship 제거 → 결과 낮아질 것. 통과하면 watchlist, 아니면 reject. 실 거래대금(Amount 히스토리)으로 프록시 교체

### 검증
- 백엔드 495 passed / 4 pre-existing. KR detector 5 신규. 13가설(10 REJECT/1 BLOCKED/TSMOM paper_candidate/KR WEAK). 커밋 7128614

---

## Phase 105 — Nav 재배치: 검증 터미널 중심, 차트 강등 (2026-07-02) ✅ SHIPPED

방향: 재량적 차트 분석은 TradingView(+MCP)가 빠름 → 경쟁 안 함. 플랫폼 moat = 엣지 검증(random 분포·WF·BH·cost stress, TV 불가). 차트/마켓은 강등, 검증 중심 재배치.

### 변경 (`components/Sidebar.tsx`, NavBar 없음=Sidebar 단일)
- **🔬 검증 그룹 신설** — 대시보드 바로 다음(최상단권): 검증 터미널(/validation) + 백테스트 도구(backtest/compare/universe/pairs/portfolio 흡수)
- 분석 그룹에서 validation 이동 / 기존 backtest-group 해체(검증 그룹으로)
- **📉 차트(TV 권장) 그룹 = 맨 아래 강등**: /market, /ib
- 방문검증(read_page): 대시보드 다음 첫 그룹=검증(검증터미널 최상단), 차트 최하단

### 검증
- FE tsc/빌드 OK. 커밋 3a9d1c6

### 포지셔닝 확정
- TV로 차트 보고(상류) → 여기서 엣지 판정(하류). 차트 속도로 TV 이기려는 경쟁 폐기

---

## Phase 104 — 검증 터미널 UI (2026-07-02) ✅ SHIPPED

로드맵 제품트랙 Week2. research 산출물을 UI로. "돈 버는 봇" 아니라 "전략 검증 터미널" 포지셔닝 실체화.

### 백엔드
- `api_server/research_api.py`: `/research/experiments`(registry 최신상태별) + `/research/tsmom`(forward 요약, 60초 캐시). main.py 라우터 등록
- `tsmom_forward.generate(write=False)` 옵션(엔드포인트용 부작용 없이)

### 프론트
- `app/validation/page.tsx`: 실험표(12가설, 상태뱃지 rejected/blocked/candidate/paper·지표·판정) + **TSMOM paper_candidate 상세**(Backtest Sharpe·MaxDD·월수익 P10/P90·Trend Regime·cost base/20bps·turnover·자산군 기여 바·forward 월 이탈)
- `lib/api.ts`: getExperiments/getTsmomForward + 타입. Sidebar 분석그룹 "검증 터미널" 링크

### 검증
- FE tsc/빌드/190 tests. 백엔드 490 passed/4 pre-existing. 방문검증(read_page): 실험표 12·상태칩·TSMOM 패널 전부 정상 렌더. 커밋 4915e76/a836fd0

### 후속 — 월간 forward 리포트 첫 실행 + 원장 커밋 전환 (커밋 83b8ba2)
- `tsmom_forward.py --since` 첫 실행: 최근월 2026-06 −1.46%/2026-07 −0.04% 둘 다 **in_envelope**(P10 −1.9%~P90 +3.3% 안), regime 0.774(트렌딩). ※ 아직 진짜 forward 아님(데이터 오늘까지=백테스트 꼬리), 진짜 forward는 다음 달 pull부터
- **`tsmom_forward_ledger.jsonl`을 git 추적 대상으로 전환**(`.gitignore`에서 제거) → 월간 리포트 append가 git 히스토리로 forward 증거 영속화. 리포트md는 계속 ignore(재생성물). 원장 = 관찰 시작점 baseline 1줄로 정리
- 원장 2개 분리: `experiment_registry`(가설 상태) / `tsmom_forward_ledger`(월간 forward 관찰) — 둘 다 추적

---

## Phase 103 — TSMOM 로버스트니스 통과 → paper_candidate 확정 + forward-test 인프라 (2026-07-02) ✅ SHIPPED

첫 EDGE 후보 로버스트니스 3종 + paper 확정(사용자 A). live 금지, config 동결.

### 로버스트니스 3종 (paper 전 관문)
- **N=1000 random: p=0.03** (0.0498→더 강해짐) ✅
- **lookback 민감도: 3mo 0.14 / 6mo 0.48 / 12mo 0.55 전부 양수** ✅ (6-12mo 견고, 3mo 약)
- **WF 0.44/0.39 양쪽 양수** ✅
- **집중도:** 최고해(2020) 제외해도 +43%(단일해 아님), sleeve 6/7 양수 ✅ / 연도승률 5/11(2019-22강·2023-26약)=TSMOM lumpy 본질(reject 아님)
- 비용 20bps 스트레스에서도 sharpe 0.47/99pct

### paper_candidate 확정 (사용자 결정 A)
- 상태 `paper_candidate_forward_test_required` registry 등록. **live capital 금지.**
- 레짐 의존성 = reject 사유 아니라 TSMOM 본질 → forward-test에서 관찰

### forward-test 인프라 (모니터링/리포팅 자동화만, Lv3 full 아님)
- `research/paper/tsmom_config.py`: **FROZEN 스펙**(32시장/params/rebal/cost). universe·lookback·risk·sleeve·레짐필터 변경 금지, 결과 후 튜닝 금지
- `research/paper/tsmom_forward.py`: shadow forward-test — trend_regime_score(현 0.774), backtest envelope(월수익 P10/P90), sleeve contribution, 턴오버/cost drag, 월간 리포트 md + 원장. envelope 이탈 체크. `--since YYYY-MM`로 forward 월 비교
- `portfolio_backtester`: 턴오버/cost_drag 추적. 월마다 최신 데이터 pull 후 재실행 → 신규 월 vs envelope

### 검증
- 백엔드 490 passed / 4 pre-existing. forward 4 신규. 커밋 3123180 등

### 다음
- **월간 운영:** 최신 선물 데이터 pull → `tsmom_forward.py --since 2026-07` → 리포트. 3~6개월 관찰
- Lv3 full 진입은 paper_candidate 확정(forward 생존) 후에만. 지금은 모니터링/리포팅만 허용
- (선택) 유료 장기데이터(Norgate)로 20년 재검, 코인 시장구조/이벤트 트랙

---

## Phase 102 — TSMOM 13→32 시장 확장 → 🎯 첫 EDGE 후보 (2026-07-02) ✅ SHIPPED

사용자 판단: TSMOM 트랙 폐기 말고 **데이터 확장**(튜닝 아님). TSMOM 핵심=넓은 분산, 13시장은 작음.

### 데이터 확장 (audit→pull)
- futures_audit 넓은 후보 32개 → **전부 IB 구독없이 반환**(소프트 KC/SB/CT/CC·축산 LE/HE 포함, NYBOT/ICE도 됨)
- futures_loader BASKET 32시장(7 자산군) + ASSET_CLASS 맵. 깊이 2.5~5년. ⚠️ **20년은 IB 불가**(유료 데이터 필요=별도결정)
- run_tsmom에 자산군 분해 추가

### 판정: 첫 EDGE 후보 (파라미터 고정, 13→32 확장만)
```
TSMOM(32)  SHARPE 0.562  ann_ret 5.1%  maxDD −17%
buyhold    SHARPE 0.124  ← 압도    cash 0
vs random  95.5pct  p=0.0498  ← 처음으로 통과
walk-forward 전반 0.453 / 후반 0.423  ← 둘 다 양수·안정(13시장땐 후반 −0.053)
비용 스트레스: 2→20bps에서도 sharpe 0.47/99pct = 저비용 아티팩트 아님
```
- **11개 만에 첫 사전등록 기준 통과 + 비용 robust.** 13→32 분산이 노이즈 평균내 엣지 안정화
- 자산군: **softs 1.10 / equity 0.69 / energy 0.38 견인**, metals/livestock 약, grains 0, **rates −0.05(죽음)**

### 상태: paper_candidate (registry). live 금지·paper 배포도 아직
- 남은 경계: 히스토리 얇음(2.5~5년, WF반쪽 ~1.25년) / p=0.05 딱걸침(보수비용선 더 나음) / softs·equity 집중 / N=200
- **agentic-roadmap Lv3 진입조건 처음 충족** — 근데 바로 Lv3 아니라 **로버스트니스 먼저**(원본 OOS 성역)

### 다음 (paper 전 로버스트니스, 튜닝 아님)
1. N=1000 random(p 조이기) 2. lookback 민감도(3/6/12mo 엣지 유지되나) 3. 서브피리어드 안정성 4. (선택)유료 장기데이터
- 통과 지속 시 → paper forward-test → 그다음에야 Lv3 주변탐색 논의(과적합 가드)

### 검증
- 백엔드 486 passed / 4 pre-existing. 커밋 c649d45

---

## Phase 101 — 선물 TSMOM 트랙 (audit→로더→판정, REJECT 최고근접) (2026-07-02) ✅ SHIPPED

로드맵 "다음 알파 #1 선물 TSMOM" 실행. 15m 단타보다 그럴듯한 트랙.

### 데이터 게이트 (audit)
- `research/data/futures_audit.py`: **IB 일봉 선물 = 구독 불필요로 됨**(ContFuture). 지수·마이크로·채권·원자재 반환. FX선물(6E/6J)만 실패→IDEALPRO 스팟 대체
- `research/data/futures_loader.py`: ContFuture 일봉 13시장(ES/NQ/RTY/YM·ZN/ZB/ZF/ZT·CL/GC/NG/SI/HG) → intraday_store. 롤점프 0~4=스티칭 양호. 깊이 2.5~10년

### 인프라 + 판정
- `research/backtest/portfolio_backtester.py`: 수익률 기반 멀티에셋 + **vol targeting** + 턴오버 비용 (이산거래 아닌 포트폴리오)
- `research/hypotheses/tsmom.py`: 12개월 모멘텀 signal + vol target, buyhold(항상롱 vol매칭)/random 베이스라인
- `research/run_tsmom.py`: random 분포 + buyhold + cash + walk-forward 판정. tests 5

### 판정: REJECT (근데 지금까지 최고)
```
TSMOM  SHARPE 0.444  ann_ret 4.48%  maxDD −24% (13시장, 10년)
buyhold SHARPE 0.211  ← TSMOM이 초과 ✅
vs random 91.5pct p=0.09  |  WF 전반 0.449 / 후반 −0.053
```
- Sharpe+·buyhold초과·랜덤 91.5pct = **11개 중 제일 살아있는 신호.** 학술 견고성 반영
- **근데 기준 미달:** 95pct(91.5)·p<.05(0.09)·**WF후반 붕괴(−0.053)=TSMOM 감쇠**(문헌 일치, 2010후+2024~25 반전레짐). REJECT, 튜닝 안 함
- **메타(11개째):** 가장 견고한 문서화 아노말리조차 리테일·최근·엄밀기준 미달 = 검증 엣지 0개 결론 강화

### 검증
- 백엔드 486 passed / 4 pre-existing. TSMOM 5 신규. VALIDATION_SUMMARY 재생성(11가설). 커밋 fce6ad6

### 다음 (선택, 로드맵대로)
- 코인 시장구조(funding+OI/basis/liquidation) / 이벤트 저빈도(정식 캘린더 데이터) — 각 데이터 게이트 먼저
- 또는 검증 터미널 UI(Week 2). 급한 것 없음 — 알파 사냥은 규율적으로 소진 중

---

## Phase 100 — 전략 전환: 알파 사냥 중단 → Strategy Validation Terminal (2026-07-02) ✅ SHIPPED

10개 가설 전부 REJECT(검증 엣지 0). 사용자 결정: **1+3 혼합** — 알파 사냥 중단, 검증 프레임워크를 자산으로, 실투자는 패시브/저빈도, 고급 알파원은 학습/제품 한정.

### 완료된 작업 (Week 1: 정리)
- `research/summarize_registry.py` → `research/reports/VALIDATION_SUMMARY.md`: 10가설 판정 테이블 + 실패기전 분류(signal_dead / cost_killed / indistinguishable_from_random / blocked_by_data) + "검증 엣지 0개" 명시
- 포지셔닝 전환: research/README "Alpha Validation Framework" → **"Strategy Validation Terminal"** (❌봇 ⭕전략 죽이는 검증터미널)
- `docs/agentic-roadmap.md` 현재위치 갱신: 알파사냥 중단, Lv3/4/5 보류(엣지 0개), Lv2 검증플랫폼이 핵심 자산

### 실패 기전 (10가설)
- signal_dead(gross도 음수): ORB, ATR압축
- cost_killed(gross+, 거래당 엣지<비용): VWAP-MR, 실패돌파, 갭, 섹터, cross-sectional daily
- indistinguishable_from_random(net+ but <95pct): funding reversal, weekly funding
- blocked_by_data: delta-neutral carry(메이저 spot 부재)

### 결론
- **핵심 자산 = 알파 아니라 "알파 없음을 싸게 증명하는 검증 프레임워크".** 대부분 단순 전략은 비용 후 사망 = 엄밀검증의 정상 결과
- 다음(선택, Week 2): 검증 터미널 UI(기존 /backtest·/performance 대시보드와 연결) — 개인 도구 우선, 제품화는 그다음

### 미커밋 주의
- multi-venue: summarize_registry + VALIDATION_SUMMARY + README (이번 커밋 예정)
- dashboard docs: Phase 99·100 + agentic-roadmap 갱신 (미커밋)

---

## Phase 99 — HL funding 트랙: audit + 회계엔진 + 가설 2종 판정 (2026-07-02) ✅ SHIPPED

크립토 전환 — 차트 재탕 아니라 perp funding 구조적 알파. audit 먼저 → 데이터 게이트로 축소.

### 데이터 게이트 (audit)
- `research/data/hl_audit.py`: 캔들 15m=52일(얇음)/1h=7개월/1d=4년(깊음), fundingHistory=페이지네이션(500/21일), spot=밈코인 위주(메이저 부재)
- **delta-neutral carry BLOCKED** (메이저 spot 부재) → perp-only funding으로 축소. registry 기록

### 인프라
- `funding_store` + `hl_funding_loader`(시간당 페이지네이션·재개) → 24코인 2년 funding(각 17501, clean)
- `hl_candle_loader` → 일봉 4년 24코인
- `funding_backtester`: funding-aware 롱숏 회계 — **funding_pnl=−side·notional·Σrate**, price/funding/cost **분리**, 시점별 tradable universe(survivorship 방지)
- `funding_strategies`: extreme_reversal(z>±2/3d) + cross_sectional(하위롱/상위숏 20%/1d) + funding-aware random
- `cost_model.hl_effective_cost_bps`(taker4.5/maker1.5+유동성버킷). 회계 synthetic 12 테스트(부호 검증)

### 판정 (24코인 2년, HL taker cost, 고정 파라미터)
| 가설 | price | funding | cost | **net** | vs random | |
|---|---|---|---|---|---|---|
| H1 extreme reversal | +2128 | +9356 | 10440 | **+1045** | 61.2pct BH0 | REJECT(구분불가) |
| H2 cross-sectional | +7309 | +19678 | 69792 | **−42804** | 86.8pct | REJECT(비용압살) |

- **둘 다 REJECT. 근데 주식의 "신호 사망"과 다름:** 분해가 **funding이 진짜 구조적 기여자**임을 보임(H1 net+ funding 견인, H2 랜덤 86.8pct 초과=랭킹 신호 존재)
- **살인자 = HL 비용 + 빈도.** H2 cost(69792)가 gross(26987) 2.6배 = 일 리밸런스 과잉거래
- **lead(튜닝 아닌 별도 실험 후보):** 저빈도(주간) 리밸런스 + maker 체결 → H2 신호가 비용 넘을지. 이게 마지막 시도, 실패 시 HL funding 트랙 폐기

### 검증
- 백엔드 481 passed / 4 pre-existing. funding 회계 12 신규. 커밋 5ab6adf

### B(사전등록 weekly) 실행 → REJECT, 트랙 폐기 (커밋 73b21ab)
- weekly 리밸런스로 net −42804→**+13622 대반전**(빈도 진단 정확, cost 7배↓, funding 견인). **근데 사전등록 기준 미달:** random 82.6pct(<95)·p=0.18·WF후반 −3315. 골포스트 안 옮기고 REJECT. maker도 95pct 미달
- **HL funding 트랙 폐기.** funding_strategies에 rebalance_days/cost_bps 파라미터화

### 메타 결론 — 9개 가설 전부 REJECT, 검증엣지 0
- ORB + 주식5(VWAP-MR·실패돌파·갭·ATR압축·섹터상대) + funding2 + weekly funding = **9/9 REJECT**
- **Lv3 진입 안 함**(탐색할 엣지 0). 교과서 알파공간(주식 인트라데이 + 크립토 funding)은 리테일·현실비용에서 척박 = 엄밀검증의 예상된 결과
- 정직한 다음 갈림길(사용자 결정): (1) 엣지 사냥 중단·기존 시스템 활용 (2) 더 큰 인프라 알파원(옵션 vol/온체인/이벤트-실적 정식데이터/크로스거래소) — 큰 투자·불확실 (3) 리테일 현실 수용, 검증 프레임워크 자체를 성과물로

### 미커밋 주의
- Phase 92~99 코드: multi-venue는 커밋됨(620ae38/1901e10/8ae8fbc/5ab6adf), dashboard docs는 이번 갱신 미커밋

---

## Phase 98 — 수동 가설 5종 일괄 검증 (전부 REJECT) + 커밋 (2026-07-02) ✅ SHIPPED

agentic-roadmap Phase 2. ORB 이후 엣지 공간 탐색. 제네릭 러너 + 가설 5개, 전부 고정 파라미터.

### 완료된 작업
- `research/features/indicators.py`: 공용 EMA/RSI
- `research/hypotheses/runner.py`: **제네릭 유니버스 러너** — signal 함수 받아 event 백테스트 + 동일 opportunity set random + pooled + BH-FDR + OOS 2분할 + 판정. `common_features`(sids/mso/vwap/atr_abs) 재사용
- `research/hypotheses/strategies.py`: 5종 signal — ①VWAP평균회귀 ②ORB실패돌파반전 ③갭업지속 ④ATR압축돌파 ⑤섹터상대모멘텀(SECTOR_MAP + SPY/ETF ts정렬 aux)
- `research/run_all_hypotheses.py`: 일괄 드라이버
- `tests/test_hypotheses.py`: synthetic 5

### 판정: 5종 전부 REJECT (ORB 포함 6/6)
| 가설 | pooled pnl | pct | 95x | BH |
|---|---|---|---|---|
| vwap_mean_reversion | −50,316 | 88.2 | 5/29 | 0 |
| orb_failed_reversal | −47,360 | 35.8 | 0 | 0 |
| gap_continuation | −7,647 | 61.0 | 1/29 | 0 |
| atr_compression | −1,642 | 27.6 | 0 | 0 |
| sector_relative | −19,315 | 21.8 | 0/19 | 0 |

- **전부 pooled 비용 후 음수, BH 생존 0.** VWAP-MR만 88.2pct/5종목 깜빡이나 pooled −50k = 종목 과적합, 다중검정 통과 0
- **6개 교과서 인트라데이 가설 = 15m 유동성 대형주 롱온리에서 엣지 없음.** 효율적/차익거래된 공간

### 결정 (agentic-roadmap 정책)
- **Lv3 자율루프 진입 안 함** (탐색할 생존 엣지 0개). "다 REJECT면 데이터/자산군/타임프레임/실행 재검"
- **되살리기 튜닝 금지**(pooled −50k를 파라미터로 살리는 건 커브피팅)
- **다음 방향(재검):** 다른 자산군(크립토 HL 보유·선물), 다른 타임프레임(1h/일봉 스윙), 다른 알파원(이벤트/펀딩/베이시스), 또는 숏 허용. 15m 대형주 모멘텀·반전은 사망

### 커밋
- multi-venue + dashboard 각각 main 직접 커밋 (Phase 92~98 일괄)

### 검증
- 백엔드 469 passed / 4 pre-existing. 가설 synthetic 5 신규

---

## Phase 97 — ORB 전체 유니버스 판정(REJECT) + agentic 로드맵 (2026-07-02) ✅ SHIPPED

### 데이터 수집 완료 (A 실행)
- IB 15m 30종목 백그라운드 수집 완료. **29/30 클린**(각 19456봉 = 3년 RTH, 중복0, 갭583 구조적). XOM만 빈파일(수집오류, 재수집 선택). IB_PORT=7496

### universe-level 집계 machinery
- `research/validation/multiple_testing.py`: **BH-FDR** 보정 + 우연 거짓양성 확률
- `research/run_orb_universe.py`: QA → 전체 고정파라미터 → **pooled(전체 거래풀) + pooled random null(런별 종목합)** → 95pct 초과수 → BH-FDR → OOS 2분할 → 판정. md/json 리포트
- ORB 모듈에 `evaluate_ohlc`(슬라이스) + keep_random 추가. 테스트 BH 5 신규

### 공식 판정: ORB+RVOL+VWAP = REJECT (확정)
```
29종목·3년·15m·2004거래 | POOLED pnl=−5402 exp=−2.70 PF=0.64 win=37%
vs random 24.8pct p=0.75 (랜덤중앙값보다 나쁨) | 95pct초과 2/29(TSLA,XLP, 우연기대0.77)
BH-FDR 생존 0 | OOS 전반−1.67/후반−3.61
```
- **엣지 없음.** pooled 비용후 손실, 랜덤보다 나쁨, 다중검정 생존 0, OOS 악화. TSLA=노이즈 확정
- **정책대로 폐기.** 레짐/ablation/ML/LLM으로 되살리기 금지(스누핑). 프레임워크가 "엣지없음"을 몇시간에 확정 = 목적 달성

### agentic 로드맵 (사용자+ChatGPT+Claude 융합)
- `docs/agentic-roadmap.md` (신규): Lv1 룰봇→Lv2 검증플랫폼(현재)→Lv3 자율리서치→Lv4/5. 안전모델(연구자유≫실행자유, live 하드경계)·검증표준·단계게이팅. **Lv3 진입 하드조건=최소1개 전략 생존**. LLM=DSL채우기(자유코드X). 생존자 주변탐색 과적합 가드. 지금 짓지말것 명시
- roadmap.md에 포인터

### 검증
- 백엔드 464 passed / 4 pre-existing. BH 5 신규

### 다음 (agentic-roadmap Phase 2)
- **수동 가설 3~5개**: VWAP평균회귀 / ORB실패돌파반전 / 섹터상대모멘텀 / 갭페이드·지속 / ATR압축돌파. 기존 하네스로, 고정파라미터. 전부 REJECT면 데이터/자산군/타임프레임 재검
- 엣지 깜빡이면 → Phase 3 안전뼈대(퍼미션가드·스키마·registry) → Phase 4 제한 Lv3
- (선택) XOM 재수집: `IB_PORT=7496 ... pull_intraday.py --symbols XOM --resume`

### 미커밋 주의
- Phase 92~97 코드 아직 **커밋 안 됨**

---

## Phase 96 — ORB+RVOL+VWAP dormant 모듈 + 첫 실판정 (2026-07-02) ✅ SHIPPED

알파검증 트랙 ORB. data-aware **dormant** 모듈(알파주장X·최적화X·일봉차단). 분봉 도착 즉시 판정.

### 완료된 작업
- `research/features/`: session(ET 거래일·개장후경과분), opening_range(세션 OR 고/저·OR구간 플래그), vwap(세션리셋), rvol(같은 슬롯 과거 N세션 대비)
- `research/backtest/event_backtester.py`: 롱온리 이벤트 백테스트 — ATR 1R 스탑/2R 타겟/8봉 타임스탑/VWAP이탈. 한 포지션·중첩금지·왕복비용
- `research/strategies/orb_rvol_vwap.py`: 고정임계값(OR30분·RVOL>1.5·VWAP위·EMA상승) 진입, **IntradayDataRequiredError**(일봉 차단), 데이터없음→BLOCKED 리포트. **random 베이스라인=동일 opportunity set(eligible=진입창 봉)** + empirical p-value
- `tests/test_orb_rvol_vwap.py`: synthetic 15m fixture 8 테스트(세션/OR/VWAP/RVOL/이벤트 stop·target·timestop/가드/BLOCKED/풀런)

### 첫 실판정 (3년 15m, 통계 유효 53~81거래)
| 종목 | pnl | PF | win | vs random | |
|---|---|---|---|---|---|
| AAPL | −203 | 0.64 | 38% | 40.8pct p=.59 | 랜덤보다 나쁨 |
| MSFT | −517 | 0.40 | 33% | 6.6pct p=.93 | REJECT |
| NVDA | −228 | 0.40 | 25% | 1.4pct p=.99 | REJECT |
| TSLA | +277 | 1.25 | 52% | 95.4pct p=.048 | EDGE후보(약함) |

**해석(정직):** ORB 고정임계값 = **광범위 엣지 아님.** 3/4가 비용 후 손실, 대형주에서 stop이 exit 지배(돌파 대부분 실패=효율적 시장). TSLA만 95.4pct 걸치나 **4종목 테스트 중 1개 p<0.05는 우연 확률 ~19%(다중검정)** → 확정 아님, 의심 positive. 전체 유니버스+워크포워드로 재검해야. **하네스가 "일반 ORB 엣지 없음"을 실데이터로 빠르고 정직하게 폭로 = 목적 달성**

### 검증
- 백엔드 459 passed / 4 pre-existing. ORB synthetic 8 신규

### 다음
- 수집 완료 후 **ORB를 전체 30종목에 돌려** 95pct 넘는 비율 확인(1~2/30=노이즈, 다수=진짜). 워크포워드 OOS 일관성. TSLA는 축하 금물

### 미커밋 주의
- Phase 92~96 코드 아직 **커밋 안 됨**

---

## Phase 95 — 인트라데이 데이터저장소 (A) (2026-07-02) ✅ SHIPPED (코드) / ⏳ 수집대기

알파검증 트랙 순서 B→A→ORB 중 A. 분봉이 진짜 블로커(하네스는 완료, 테스트할 데이터가 없음).

### 완료된 작업 (코드)
- `research/data/intraday_store.py`: 평범한 parquet 저장소(`data/intraday/{SYM}_{tf}.parquet`, Nautilus 카탈로그와 분리). save 병합·중복제거·정렬, `latest_ts`(재개), `quality_report`(봉수/중복/세션내갭/기간), `load_ohlc_lists`(하네스용)
- `research/data/ib_downloader.py`: `download_symbol` — IB reqHistoricalData 백워드 청킹(endDateTime 과거이동), useRTH=True(정규장), whatToShow=TRADES, formatDate=2(epoch), **페이싱 대기(기본 11s)**, 무진행 감지 중단
- `research/data/pull_intraday.py`: 수집 CLI(argparse). 기본 유니버스=유동성 20 + SPY + 섹터 SPDR 9. `--tf/--years/--pace/--chunk/--symbols/--test`. 연결 1회 재사용, **심볼별 재개**(기존 latest_ts 이후만), 심볼별 품질리포트
- `research/README.md`: 실행법·순서·ORB 붙이는 법(신규)

### 상태
- 저장소 로직 단위테스트 6 passed. 다운로더/CLI는 연결까지 정상 동작 확인
- **실제 수집 = TWS 필요.** 스모크(`--test`)는 7497 연결거부(TWS 꺼짐)로 깔끔히 실패 → TWS 켜고 재실행 필요
- 재개가능 → 중단해도 재실행하면 이어받음. IB 페이싱 ~6req/min → 20종목 2년이면 수십분~시간

### 검증
- 백엔드 451 passed / 4 pre-existing. 저장소 6 테스트 신규

### 다음
- **사용자: TWS 켜고** `PYTHONPATH=. python3 research/data/pull_intraday.py --tf 15m --years 2` (또는 `--test` 먼저) → 분봉 채우기
- 그 다음 **ORB+RVOL+VWAP** 가설 구현 → `run_validation.py` signal_fn 교체 → random same-freq 95퍼센타일 못 넘으면 폐기

### 미커밋 주의
- Phase 92·93·94·95 코드 아직 **커밋 안 됨**

---

## Phase 94 — 알파 검증 하네스 (B) + Triple Barrier 라벨링 (2026-07-02) ✅ SHIPPED

방향 전환: "기능 추가" 멈추고 **엣지 검증 도구**부터. 근거 = 구조≠알파. 순서 결정: B(검증 하네스, 데이터 무관) → A(IB 15m 데이터저장소) → 단일 ORB 가설. B 먼저 완료.

### Triple Barrier 라벨링 (블루프린트 최고 아이디어 볼트온)
- `xgb_strategy/labeling.py` (신규): `atr_pct` + `triple_barrier_labels`(위/아래 ATR 배리어 중 먼저 닿는 쪽 = 1/0, horizon 타임배리어, 롱온리). "다음 봉 오름?"(노이즈) → "익절/손절 어느 쪽 먼저?"(매매가능)로 ML 타깃 교체
- `xgb_strategy/model.py`/`runner.py`: `labeling` 파라미터(기본 next_bar → 기존 테스트 유지, triple_barrier 옵션). highs/lows 전달
- **실험 결과(일봉 250)**: TB가 next_bar 못 이김(3종목 중 2 손해). **근데 표본 무의미(OOS 75봉/거래 7~17) = 판정 불가.** 교훈: 일봉으론 엣지 질문 답 못 함 → 분봉 필요. TB는 마법 아님

### 알파 검증 하네스 (B — 최소 코어, 데이터 무관)
- `research/validation/cost_model.py`: `effective_cost_bps` = cost+slippage+spread/2 (체결당)
- `research/validation/engine.py`: 인덱스 기반 롱숏/고정보유 시뮬(왕복 비용, simple_runner 규약 동일)
- `research/validation/metrics.py`: 거래기반 expectancy/PF/per-trade Sharpe/MDD + **underpowered 가드**(거래<30). ※기존 simple_runner Sharpe는 종목 봉수익률 기반이라 전략비교 부적합 → 여기서 대체
- `research/validation/baselines.py`: **random_same_frequency**(같은 opportunity set/거래수/holding분포/비용, N=500 시드고정 → net PnL 분포) + naive buy&hold + **empirical_p_value**(=(1+beating)/(N+1), North 2002). eligible_indices 파라미터로 ORB 대비 설계
- `research/validation/walk_forward.py`: 순수 롤링 윈도우 러너 + consistency
- `research/reports/alpha_report.py`: md+json, "HARNESS VALIDATION, NOT ALPHA" 배너, 퍼센타일 판정
- `research/run_validation.py`: 일봉 ema_cross 기니피그로 전 파이프 드라이런

### 드라이런 결과 (하네스 sanity, 알파 아님)
- ema_cross 일봉 3종목 전부 **UNDERPOWERED**(4~6거래) → 가드 발동 판정보류. AAPL 39퍼센타일(랜덤보다 나쁨)/SPY 26퍼센타일, naive B&H가 2/3 이김, walk-forward consistency 0~0.2. **하네스가 "엣지 아님"을 정확히 폭로 = B 성공**

### 검증
- 백엔드 445 passed / 4 pre-existing. 하네스 9 + 라벨링 6 테스트 신규. 리포트 md/json 렌더 확인

### 다음 (합의된 순서)
- **A: IB 15m 분봉 데이터저장소** — 20 유동성 US + SPY + 섹터ETF, 2~3년, parquet. RTH통일/타임존/중복·누락/split/pacing resume. "많이"보다 "깨끗이"
- 그 다음 **단일 ORB+RVOL+VWAP** → 비용 후 random same-freq 못 이기면 즉시 폐기
- LLM risk_score(0~100) 만들지 말 것(연극). 이진 플래그만

### 미커밋 주의
- Phase 92·93·94 코드 아직 **커밋 안 됨**

---

## Phase 93 — 크립토 워크스페이스를 주식과 통일 (2026-07-02) ✅ SHIPPED

사용자 지적: 가상화폐 페이지가 주식과 타임프레임/매매/알림/지표 UI가 다름 → 통일 요청. 크립토는 자체 lightweight-charts + interval 버튼(다른 스타일), 지표·매매·알림 없음, 차트+오더북 레이아웃이었음.

### 완료된 작업
- **심볼 규약**: 크립토 = `${coin}.HL` → 공유 컴포넌트가 suffix로 라우팅(주식 `.NASDAQ`/`.XKRX`와 동일 방식). 크립토 워치리스트는 여전히 bare coin, 전달 시 `.HL` 부착
- `ChartTab.tsx`: **크립토(HL) 분기** — `getCryptoCandles(code, tfId, CRYPTO_DAYS)` → BarOut 매핑(volume 포함). 6개 타임프레임 전부 지원(주식 pill과 동일). 실시간=`getCryptoBook` mid 5초 폴링(24/7). catch의 IB/TWS 안내는 HL 제외
- `TradeTab.tsx`: **크립토 분기** — `placeHLOrder`, 소수 수량(0.01~1 프리셋·step 0.1·decimal 입력), 통화 $, 테스트넷/메인넷 토글(paper), 북 mid 실시간가
- `AlertTab.tsx`: 크립토 가격 소스 `getCryptoBook` mid
- `app/crypto/page.tsx`: 워크스페이스를 **주식과 동일 shell**로 재작성 — 좌 ChartTab + 우측 패널(💵매매/🔔알림/📊지표/**📖호가**(크립토 전용) + 활성 지표 뱃지 + 접기/펴기). 기존 CoinChartPanel/INTERVALS 제거. 크립토 전용 사이드바(펀딩/OI/24h%)·검색·통계는 유지, 오더북은 우측 호가 탭으로 이동

### 검증
- tsc/빌드/190 tests OK. 방문검증(BTC): 타임프레임 pill·181봉 캔들·실시간 뱃지(북폴링, 59852→59873 갱신)·매매(테스트넷/메인넷·소수 프리셋·예상금액)·MACD 서브차트 렌더·지표 뱃지

### 미커밋 주의
- Phase 92·93 코드 아직 **커밋 안 됨** (main 직접 커밋 컨벤션, 사용자 요청 시)

---

## Phase 75 — 계좌 잔액 연동 버그 진단·수정 (2026-07-01) ✅ SHIPPED

잔액 패널에서 자산이 안 뜬다는 사용자 지적 → 라이브 진단으로 원인별 분리.

### 완료된 작업 (코드 버그)
- `hyperliquid/trader.py get_positions` — spot USDC 조회가 `if not paper`로 **테스트넷에선 스킵**됨 → 파우셋(spot) 998 USDC가 0으로 표시. 가드 제거(양 네트워크 spot 포함, try/except). **검증: 테스트넷 998.97 USDC 정상 표시**
- `backends/ib/client.py get_account_summary` — `reqAccountSummaryAsync()`가 간헐적 **0행 반환**(→$0) 확인. 비면 `reqAccountUpdatesAsync`+`accountValues(acct)` 폴백 추가 (라이브 검증은 샌드박스 IB 연결 행으로 미완, 코드/테스트는 통과)

### 진단 결과 (계좌/설정 이슈 — 코드 아님)
- **HL 테스트넷**: 파우셋 spot USDC가 0x71DC에 있었음(998) → 위 spot 버그였음 ✅ 수정
- **HL 메인넷**: 127.2 USDC 정상. 패널 "—"는 서버 stale → 재시작 필요
- **IB**: managed account U20595794 인식, reqAccountSummaryAsync 0행 → 폴백. 입금 정산/TWS 확인 병행
- **KIS 모의**: `INVALID_CHECK_ACNO` 지속. 토큰은 통과(키 유효) → 계좌번호만 거부 = CANO가 이 모의 앱에 미등록/비활성(KIS 포털 측). CANO 형식은 정상(8자리+PRDT 01)

### 검증
- IB+HL 테스트 18 passed. HL 테스트넷 잔액 라이브 998 확인

### 후속 (라이브 디버깅으로 6/6 계좌 전부 연동 완료)
- **KIS 실계좌 CANO 오류**: `.env` KIS_CANO=50098567(엉뚱) → 실제 69095206으로 교정 → 41,596원 조회됨
- **IB €100 연동**: `reqAccountSummaryAsync`=0행, 명시 `reqAccountUpdatesAsync`=행 → **ib_async 자동구독 `accountValues` 읽기**로 교체(`get_account_summary` 재작성). 통화(EUR) 반환→패널 반영, money()에 € 심볼, ib_live ccy 동적
- **IB 엔드포인트 무한행 방지**: account_balances IB 호출 `asyncio.wait_for(6s)` 가드 (패널 블랭크 방지)
- **KIS 간헐 오류**: rt_cd=2(빈msg)/RemoteDisconnected 잦음 → get_balance 최대 4회 재시도, 모의·실전 독립 처리
- 최종: Alpaca $100k / KIS모의 1천만원 / KIS실계좌 41,596원 / IB €100 / HL테스트넷 998.97 / HL메인넷 127.2 USDC — **6/6 표시**

---

## Phase 92 — 차트 패널 접기 + 지표 우측패널 통합 (2026-07-02) ✅ SHIPPED

### 완료 (✅ 커밋됨)
- 오른쪽 **매매/알림 패널 접기/펴기**(rightOpen). 접힘 시 세로 "◀ 💵 매매·알림" 버튼으로 다시 열기 (c6e5213, 4c65533)
- **1분/15분 IB 오류** → 친절 안내("미국 분봉은 IB(TWS) 연결 필요, TWS 켜고 재선택. 하루봉은 TWS 없이도 됨"). 원인: TWS 꺼지면 Connection refused. 미국 분봉 무료 대체 없음(IB 필수), 하루봉은 catalog

### #3 지표를 오른쪽 패널로 통합 ✅
- `lib/indicators.ts` (신규): `IndicatorState`(12지표 단일 객체) + `DEFAULT_INDICATORS` + `activeIndicatorChips`/`activeIndicatorCount` 헬퍼
- `components/market/IndicatorTab.tsx` (신규): 우측 관리 UI — 섹션별(오버레이/오실레이터/추세·변동성/거래량) 토글+파라미터, "N개 활성"+**모두 끄기** 버튼
- `ChartTab.tsx`: 지표 useState 26개 **전부 제거** → `indicators`/`setIndicators` prop 수신(렌더 전용). "+지표추가" 드롭다운·panelOpen·IndicatorRow/ParamInput 삭제. Row2는 **활성 칩(✕ 삭제)** 만 유지, 없으면 "우측 📊 지표 탭에서 추가" 안내. 백테스트 EMA 참조도 prop로. 미사용 ApiError import 제거
- `MarketWorkspace.tsx`: `indicators` 상태 소유(DEFAULT_INDICATORS) → ChartTab+IndicatorTab 공유. 우측 패널 3번째 탭 **📊 지표**(활성 개수 뱃지) 추가. side 타입 `trade|alert|indicators`

### 검증
- tsc/빌드/190 tests OK. 방문검증: 지표탭 전 섹션 렌더, SMA 오버레이+RSI(14)/MACD(12,26,9) 서브차트 정상, **심볼 전환(KR↔US)에도 지표 상태 유지**(리프트 확인), 탭뱃지/칩/체크박스 동기화

### 미커밋 주의
- Phase 92 #3 코드는 아직 **커밋 안 됨** (main 직접 커밋 컨벤션, 사용자 요청 시)

---

## Phase 91 — 차트 타임프레임 + 워치리스트 접기 (2026-07-02) ✅ SHIPPED

시장(주식·암호화폐) 차트 UX 3건.

### 완료된 작업
1. **워치리스트 접기**: MarketWorkspace 좌측 워치리스트 사이드바 ◀/▶ 토글(sideOpen). 탭바 좌측 버튼
2. **주식 차트 타임프레임**: ChartTab의 기간 프리셋(1M/3M/6M/1Y/3Y/5Y/ALL) → **바 간격 [1분/15분/1시간/4시간/하루/1달]**로 교체. 3달/6달/3년/5년 제거, 수동 Load 버튼 제거(선택 시 자동로드). US=IB(분봉/일/월), 하루는 catalog 우선. KR=하루/1달만(KIS), 인트라데이는 안내. loadBars(tf) 재작성
3. **암호화폐 인터벌**: `/crypto/candles` interval Literal 확장(1m/15m/1h/4h/1d/1M, HL 지원). 프론트 크립토 페이지 동일 세트 + 한글 라벨 + 인터벌별 days(1m=1일~1M=365일)

### 검증
- 백엔드 crypto 1m(1441)/1M(13)/4h 라이브. FE tsc/빌드. 방문확인: 워치리스트 토글·타임프레임·하루 차트 245봉 로드 정상

---

## Phase 90 — 스윙 페이퍼 검증 시작 + 잠금(protected) 에이전트 (2026-07-02) ✅ SHIPPED

스윙 전략 페이퍼 검증 개시 + 검증봇 실수삭제 방지.

### 완료된 작업
- **스윙 페이퍼 봇 가동**: `스윙검증-US`(id 7591f352, swing/US/paper/Lv2/$10k) 생성+start. tmux+claude 루프 정상. 첫 틱 #1 = WATCH MSFT(18/40, 2/3 신호 미충족 → 관망, 억지매매 안 함). 8h 주기
- **잠금(protected) 에이전트**:
  - `agent_store`: protected 컬럼(migration) + set_protected
  - DELETE `/agents/{id}` — protected면 `confirm=<이름>` 일치해야 삭제(서버측 403 가드). `/agents/{id}/protect` 토글
  - 검증봇 7591f352 잠금 처리
  - 프론트: 카드에 🔒잠금 뱃지 + "🔒 삭제" → **이름 타이핑 확인 모달**(일치해야 활성). 일반 봇은 원클릭 유지
  - `lib/api`: deleteAgent(confirm) + protectAgent

### 검증 프로세스 (진행 중)
- 스윙봇 8h마다 자동 틱 → 며칠~몇 주 → 성과페이지 SPY 초과수익 확인 → 이기면 유지
- ⚠️ 노트북 꺼지면 tmux 멈춤(재시작 필요). 24/7은 나중 클라우드(인증 선행 필요)

### 검증
- 첫 틱 라이브 정상(WATCH). 잠금 모달 방문확인. FE tsc/빌드 OK

---

## Phase 89 — 페어 트레이딩(시장중립) + 검증 프로세스 (2026-07-02) ✅ SHIPPED

전략 다양성 = 개수 아닌 "저상관 수익원". 방향성 과잉 → **시장중립(페어)** 추가. 검증(#2)은 기존 인프라 활용.

### 완료된 작업 (#1 페어)
- `pairs_trading/backtest.py` `backtest_pairs`: 스프레드 z-score 매매(±2 진입/0.5 청산) **비용 반영** PnL/Sharpe/MDD/승률
- `/pairs/backtest?a=&b=`: Engle-Granger/Johansen 공적분 + 스프레드 백테스트. **tradeable 게이트**(p<0.05 & 반감기 1~60일). 대부분 페어는 부적합으로 정직하게 걸러냄(럭키 백테스트에 안 속게)
- `lib/api.ts`: PairsResult + getPairsBacktest
- `app/pairs/page.tsx` (신규): 적합/부적합 뱃지 + 공적분p/반감기/헤지비율 + 비용반영 지표 + z-score 차트. 나브 백테스트 그룹 "페어(공적분)"
- 라이브: AAPL/MSFT 공적분 X(p=0.45)→부적합(백테스트 20% 나와도 게이트), SPY/QQQ catalog 없음 에러처리

### #2 검증 프로세스 (기존 인프라)
- 성과추적(#1 Phase84, SPY 초과수익) + 비용백테스트(#2 Phase85) + 페어 공적분 게이트 = **뭐가 실제로 먹히는지 거르는 도구 완비**. 프로세스: 페이퍼로 돌려 → 성과페이지 excess_pct(vs 벤치마크) 확인 → 이기는 것만 유지

### 전략 카테고리 (다양성 완성)
- 방향성: 단타·스윙·장투·스마트시그널 / 이벤트: DART·카피트레이드 / **시장중립: 페어**(신규)

### 검증
- 백엔드 라이브(공적분 게이트). FE tsc/빌드(/pairs)/방문확인(부적합 판정·z-score 차트)

---

## Phase 88 — 스마트 시그널 사이징에 CVaR + 리스크패리티 결합 (2026-07-02) ✅ SHIPPED

퀀트 기능 평가 후 실전 유용한 것(CVaR·리스크패리티)을 사이징에 실제 결합.

### 완료된 작업
- `/signal/smart` 사이징: BUY 비중 = **min(Kelly½×레짐 × 변동성타게팅, CVaR캡, 25%)**
  - **변동성 타게팅(리스크패리티)**: 목표 연변동성 15% / 실현변동성 → 스칼라(0.25~1.5). 고변동 종목 자동 축소
  - **CVaR 캡**: 비중 × |일간 CVaR95| ≤ 일간 예산 1.5% → 꼬리손실 제한
  - 반환에 vol_annual_pct/cvar_95_pct/sizing_constraint(어느 제약이 결정) 추가
- `app/signal/page.tsx`: 연변동성·CVaR95 메트릭 카드 + 제안비중에 "제약(Kelly·vol/CVaR/상한)" 표시
- 라이브: AAPL 연변동성 22.7% CVaR95 -2.88%, 삼성 33.4%/-4.2% (BUY 아니라 제약은 BUY 때만 표시)

### 퀀트 기능 평가 (사용자 질의)
- 실전 유용: Kelly·CVaR·리스크패리티·스트레스·HMM (리스크·사이징·국면) → 이제 CVaR·리스크패리티도 사이징에 결합
- 참고/분석: 블랙-리터만·팩터·공적분·Hurst·VWAP / 학술: 몬테카를로 GBM

### 검증
- 백엔드 라이브(vol/cvar 계산). FE tsc/빌드 OK

---

## Phase 87 — 리스크 강화: 킬스위치 + MDD 자동차단 (발전 #4/4) (2026-07-02) ✅ SHIPPED

발전 로드맵 마지막. 기존 risk_guard(RiskConfig 주문한도)에 **런타임 킬스위치 + drawdown 자동차단** 추가.

### 완료된 작업
- `api_server/risk_state.py` (신규): 파일 영속 킬스위치(`data/risk_kill.json`, 재시작·브라우저 무관) + `is_killed()` + **MDD 자동킬**(Alpaca equity peak 대비 낙폭 > `MAX_DRAWDOWN_PCT`(기본15%) → 자동 engage). `/risk/status`(한도+낙폭+킬), `/risk/kill`
- `main.py`: risk 라우터 등록
- `dart_autobot.tick`: **killed면 매수 중단** (수동/자동 킬 존중)
- `lib/api.ts`: RiskStatus + getRiskStatus/setKillSwitch
- `app/risk-guard/page.tsx` (신규): 킬스위치 토글(긴급정지/해제, 확인모달) + **MDD 게이지**(현재 vs 한도, 초과 시 자동킬 경고) + 주문한도 표
- 나브: Sidebar+NavBar 트레이딩에 "리스크 관리"

### 발전 로드맵 — 전부 완료 ✅
- [x] #1 성과 추적 / [x] #2 현실 백테스트 / [x] #3 스마트 시그널 / [x] #4 리스크 강화

### 검증
- 백엔드 라이브(status: kill off, dd 0%, 한도 15%, 주문한도). FE tsc/빌드(/risk-guard)/방문확인(킬토글·게이지·한도표)

---

## Phase 86 — 스마트 시그널: 레짐+모멘텀+Kelly (발전 #3/4) (2026-07-02) ✅ SHIPPED

기존 분석 모듈(HMM 레짐, Kelly, 팩터)이 개별 엔드포인트로만 존재 → **매매 판단으로 결합**.

### 완료된 작업
- `/signal/smart?instrument_id=`: catalog 일봉 → 레짐(detect_regime_hmm) 게이트(bear_high_vol=회피) + 모멘텀(60일 + SMA50 대비) + Kelly½ 사이징(상한 25%, 레짐배율). → BUY/HOLD/AVOID + 제안 비중% + 근거. 라이브(AAPL 관망: 모멘텀+18% but 약세레짐 게이트)
- `lib/api.ts`: SmartSignal + getSmartSignal
- `app/signal/page.tsx` (신규): 판정 카드(매수/관망/회피) + 레짐/모멘텀/SMA50/Kelly½ 메트릭 + 근거 리스트, 심볼 입력·프리셋
- 나브: 분석 그룹에 "스마트 시그널" (Sidebar+NavBar)

### 발전 로드맵
- [x] #1 성과 추적 / [x] #2 현실 백테스트 / [x] #3 스마트 시그널(이 Phase) / [ ] #4 리스크 강화

### 검증
- 백엔드 라이브(AAPL/삼성 판정). FE tsc/빌드(/signal)/방문확인

---

## Phase 85 — 현실 백테스트: 거래비용 (발전 #2/4) (2026-07-02) ✅ SHIPPED

"백테스트 좋은데 실전 마이너스" 함정 방지 = 현실 비용 반영.

### 완료된 작업
- `backtest_runner/simple_runner.py` `_simulate_trades(..., cost_bps=0.0)`: 체결 1회당 슬리피지+수수료(bps), **왕복 진입+청산 2회 차감**. `run_simple_backtest` params.cost_bps(기본 5bps)
- `/backtest` `cost_bps` 쿼리파라미터(0~100) → simple_params 주입. single/optimize/portfolio/**walk-forward** 전부 통과(모두 run_simple_backtest 경유)
- 검증: AAPL MACD 0/5/20bps → total_pnl $441/$402/$284 (비용 정확 차감)
- `app/backtest/page.tsx`: macd/rsi/xgb에 **거래비용(bps) 입력**(기본 5), cost_bps 주입 → 결과가 비용 순(net)
- 워크포워드는 기존 `/backtest/walk-forward`(롤링 OOS 윈도우 + 일관성 요약) 존재 → 이제 비용 반영

### 발전 로드맵
- [x] #1 성과 추적 (Phase 84)
- [x] #2 현실 백테스트 (이 Phase — 거래비용 + 기존 워크포워드)
- [ ] #3 더 똑똑한 시그널 (팩터·레짐·Kelly)
- [ ] #4 리스크 강화

### 검증
- 백엔드 import OK, 비용 차감 라이브. 백테스트 관련 31 passed(+ pre-existing 1). FE tsc/빌드 OK

---

## Phase 84 — 성과 추적 대시보드 (발전 #1/4) (2026-07-02) ✅ SHIPPED

"매매 에이전트 발전" — 모델교체 아닌 시스템. 사용자 "전부 다" → 순차. **#1 성과추적**(나머지 판단 근거) 먼저.

### 완료된 작업
- `/performance/portfolio`: Alpaca 페이퍼 portfolio history → 수익률·MDD·Sharpe(일간 연율화) + **SPY 매수보유 벤치마크**(정규화) + 초과수익. 라이브 확인(SPY +0.64%, 계좌 매매 전이라 전략 0%)
- `lib/api.ts`: PerfPoint/PerfSummary + getPerformance
- `app/performance/page.tsx` (신규): 메트릭 카드(수익률/MDD/Sharpe/vs SPY 초과) + **의존성 없는 SVG equity 곡선**(전략 vs SPY 점선) + 기간 토글(1주/1개월/3개월/1년)
- 나브: Sidebar+NavBar 트레이딩에 "성과 추적"

### 발전 로드맵 ("전부 다" 순차 진행)
- [x] #1 성과 추적 (이 Phase)
- [ ] #2 현실 백테스트 (슬리피지·수수료·워크포워드) — backtest 강화
- [ ] #3 더 똑똑한 시그널 (팩터 결합·레짐 HMM·Kelly 사이징) — risk_analysis/regime 모듈 활용
- [ ] #4 리스크 강화 (drawdown 킬스위치·분산·한도)

### 검증
- 백엔드 /performance 라이브. FE tsc/빌드(/performance)/방문확인(메트릭·곡선·나브)

---

## Phase 83 — 시장>주식 차트에서 매매/알림 직접 + Events/KR 탭 제거 (2026-07-02) ✅ SHIPPED

사용자: 차트에서 바로 매매·알림 하고 싶음. Events/KR 탭 의미없음.

### 완료된 작업
- `components/market/MarketWorkspace.tsx`: Chart 뷰를 **차트(좌) + 우측 매매/알림 패널**로. 우측 `💵 매매`/`🔔 알림` 서브토글 → TradeTab/AlertTab 인라인 (차트 안 떠나고 매매·알림)
- 탭 축소: 검색 | Chart | Compare (기존 매매·알림·Events·KR 탭 제거). EventsTab/KRMarketsTab import 제거(컴포넌트는 보존)

### 검증
- tsc/빌드 OK. 방문확인: 차트+매매(모의/실계좌·매수매도·수량·예상금액), 알림(이상/이하·목표가) 인라인 정상

---

## Phase 82 — DART 봇 비중 조절 (시그널 강도) (2026-07-02) ✅ SHIPPED

"취득/소각 규모에 따라 비중" 요청. 정확한 금액은 공시유형별 상세 OpenDART API 필요+직접취득 희소·취약 → **시그널 강도 배율**로 실용 구현.

### 완료된 작업
- `insider/dart_client.py` `action_weight(trade_type, report_nm)`: **소각 1.5× / 직접취득 1.0× / 신탁계약 0.6×** (소각=주식수 영구감소 최강, 신탁=실매입 불확실 약함)
- `/dart/signals`: BUY에 `weight` 필드
- `dart_autobot.tick`: 매수금액 = budget × weight (기본 budget ₩1,000,000)
- `app/dart-auto/page.tsx`: BUY 행에 `n.n× · ₩예상금액` 표시, 수동/자동 매수 모두 비중 반영

### 참고
- 정확한 취득/소각 **금액** 기반은 미구현(공시유형별 API 파편·직접취득 드묾). 원하면 후속(취약성 감수)
- 기본 예산 100만원 (페이지 입력에서 조절)

### 검증
- 백엔드 weight 라이브(신원 자사주취득 1.0×). FE tsc/빌드 OK

---

## Phase 81 — 서버측 DART 자동봇 (브라우저 무관) (2026-07-02) ✅ SHIPPED

Phase 80 자동추종은 클라(탭 열어야 돎) → **서버측 봇**으로. 로컬 uvicorn 프로세스 안 asyncio 루프라 브라우저 꺼도 실행.

### 완료된 작업
- `api_server/dart_autobot.py` (신규): asyncio `_loop`(startup 등록), `tick()`(신규 자사주 취득·소각 → KIS 모의 매수, **KR 장중만**, 장외 공시는 다음 개장 때 매수, 7일 추적), 파일 영속 config(`data/dart_autobot.json`)+로그(`data/dart_autobot_log.jsonl`), 중복키 방지, 사이클당 ≤5
- `main.py`: 라우터 등록 + `@app.on_event("startup")` 루프 시작
- 엔드포인트 `/dart/auto/status|config|run-now`
- `lib/api.ts`: DartBotStatus/DartBotLog + getDartBotStatus/setDartBotConfig
- `app/dart-auto/page.tsx`: 클라 자동 제거 → **서버봇 ON/OFF 토글**(브라우저 꺼도 실행), 예산, 장상태·마지막실행·주기, **봇 실행 로그 패널**(매수/실패/설정 이력)

### 서버·가시성 (사용자 질의)
- "서버" = **로컬 uvicorn**(맥, :8000). 맥+uvicorn 켜져 있으면 탭 꺼도 돎. 맥 끄면 멈춤(24/7은 launchd/클라우드 후속)
- 진행과정 = DART 자동매매 페이지 봇 로그 패널 + 터미널 uvicorn 로그

### 검증
- 백엔드 import OK, status 정상(enabled/market_open/log). FE tsc/빌드/190 tests OK

---

## Phase 80 — DART 기업행위 오토파일럿 (페이퍼/KIS 모의) (2026-07-02) ✅ SHIPPED

"기업행위만" 자동매매. 개인 내부자 매매는 **법정 5영업일 지연**이라 엣지 없어 제외(사용자 확정). 장외 공시가 개인에 유리(장중은 알고 경쟁).

### 완료된 작업
- 백엔드 `api_server/main.py`:
  - `/dart/signals`: `_dart_corp_actions` 분류 → **BUYBACK/CANCELLATION=매수(호재)**, **PAID_IN(유상증자)=회피(악재)**, DISPOSAL=회피, RIGHTS_ISSUE(무상)=중립. 최신순. 라이브 12건 확인
  - `/dart/mirror`: KIS **모의** 시장가 매수 (원화예산÷현재가(yfinance .KS)=주식수)
  - `/dart/positions`: KIS 모의 보유 + 수익률
- `lib/api.ts`: DartSignal/DartPosition + getDartSignals/mirrorDart/getDartPositions
- `app/dart-auto/page.tsx` (신규): 공시 테이블(기업/종목/공시/**판정 태그**(매수 green/회피 red/중립)/접수일/DART링크), BUY 신호에 모의매수 버튼, **자동매수 토글**(신규 자사주 취득·소각만, 사이클당 ≤5), KIS 모의 보유 P&L
- 나브: Sidebar + NavBar 트레이딩에 "DART 자동매매"

### 정보 속도 정리 (사용자 질의)
- 개인 내부자(소유상황보고) = 거래 후 5영업일 신고 → DART엔 이미 늦음. 미국 Form4도 2영업일. **속도 엣지 없음**
- 기업행위 = 공시=이벤트 당일. 우리 폴링은 접수 후 초~분. **장중은 알고가 밀리초 반영**(뒷북), **장 마감후/개장전 공시가 개인 기회**

### 검증
- 백엔드 import OK, /dart/signals 라이브 12건 분류 정확. FE tsc/빌드(/dart-auto)/방문확인(판정태그·나브 정상)

---

## Phase 79 — 카피트레이드 트레이더 카드 UI (Autopilot 스타일) (2026-07-02) ✅ SHIPPED

신호 리스트 → **매수자별 카드 + 수익률**로 재설계 (Autopilot 앱처럼). 왼쪽 나브에 카피트레이드 노출.

### 완료된 작업
- 백엔드 `/copytrade/traders`: 의회·내부자 매수를 **인물별 그룹핑**, 각 매수를 **거래일 종가(yfinance 배치)로 진입** 가정 → 현재가 대비 종목별·평균 수익률. 최근 120일, 30분 캐시. 라이브 13명(McConnell WFC +11.36%, Pelosi UBER/INTC +6.98% 등)
- `lib/api.ts`: TraderCard/TraderHolding + getCopyTraders
- `app/copytrade/page.tsx` 재작성: 트레이더 카드(이니셜 아바타·색상, 이름, 🏛의회/👤내부자, chamber/role, 평균 수익률 크게, 종목별 진입일·수익률·미러버튼), **팔로우**(보유 종목 전체 페이퍼 복제), 우측 내 페이퍼 포트폴리오 P&L
- **나브 수정**: 왼쪽 `Sidebar.tsx` 트레이딩에 카피트레이드 추가 (전엔 상단 NavBar에만 넣어 왼쪽 안 보였음)

### 미구현(선택)
- 얼굴 사진: 현재 이니셜 아바타. 실사진은 의원 bioguide 매핑 필요(내부자는 사진 없음) → 후속
- 서버측 자동추종(탭 안 열어도): 현재 미러는 수동/페이지 내. Phase 78 노트대로 스케줄러 후속

### 검증
- 백엔드 import OK, /traders 라이브 13명. FE tsc/빌드(/copytrade)/방문확인(카드+나브 정상)

---

## Phase 78 — 카피트레이드 오토파일럿 (페이퍼) + 크립토 입력 버그 (2026-07-01) ✅ SHIPPED

"AI가 알아서 돈 벌어줌" 논의 → autopilot류 앱 실체(=스마트머니 복제/패시브 자동화, AI예측 아님) 설명 후, **정직한 버전**으로 의회·내부자 copy-trade 오토파일럿 구축. 페이퍼 전용, AI 메뉴 아닌 트레이딩 하단.

### 완료된 작업
- 백엔드 `api_server/main.py`: `/copytrade/signals`(의회 FMP + 미국 내부자 EDGAR **매수**만, US 티커, 최신순), `/copytrade/mirror`(Alpaca **페이퍼** notional 시장가 매수), `/copytrade/positions`(페이퍼 보유). 라이브 36건 확인(NVDA/WFC/UBS 등)
- `lib/api.ts`: CopySignal/CopyPosition + getCopySignals/mirrorCopyTrade/getCopyPositions
- `app/copytrade/page.tsx` (신규): 신호 테이블(🏛의회/👤내부자·이름·종목·거래일·금액·미러버튼), 미러 금액($) 설정, **자동 추종 토글**(localStorage, 신규 신고 사이클당 최대 5건 페이퍼 미러, 중복키 방지), 페이퍼 보유 실시간 P&L
- `NavBar.tsx`: 트레이딩 그룹 하단에 "카피트레이드"
- **크립토 배정 입력 버그**: USDC는 심볼 없어 좌측 프리픽스에 "USDC"가 숫자와 겹침 → 심볼(₩/$)만 좌측, 통화코드 우측 라벨 (`app/agents/page.tsx`)

### 정직한 기대치 (사용자에게 명시)
- copy-trade는 공시 지연(의원 최대 45일)으로 엣지 제한적. AI 알파 아님. 페이퍼 검증용. 보장 수익 없음

### 검증
- FE tsc/빌드(/copytrade 라우트)/방문확인. 백엔드 import OK, signals 라이브 36건. (미러 주문=실 페이퍼 체결이라 자동 실행 안 함, 배선만)

---

## Phase 77 — 스윙-KR 실행 라우팅/통화 사이징 수정 ($20k 근본) (2026-07-01) ✅ SHIPPED

$20k 근본 원인 규명: 스윙(LLM)은 `autopilot/agent_loop.sh`에서 실행되고 **주문 사이징을 "계좌 equity×10%"(공유 Alpaca USD equity) 기준**으로 함 → KR봇에 ₩1,000,000 배정해도 Alpaca 계좌 $100k의 10% ≈ $20k USD 주문. 라우팅(kr_order.sh=KIS)은 됐으나 금액 기준이 USD·계좌전체.

### 완료된 작업
- `autopilot/agent_loop.sh` (별도 repo, 커밋 113a3c4):
  - `ALLOC`(5번째 인자) + `CCY`(KR→KRW/₩, US→USD/$) 도입
  - 사이징 지시 "계좌 equity×10%" → **"배정자본×10%"** (시장 통화 기준), 프롬프트 헤더에 배정자본 명시, "통화·시장 교차 금지"
- `api_server/router_autopilot.py` (multi-venue, ed7ad27):
  - `start_agent`이 tmux 루프에 `account_alloc` 전달
  - `daytrade_tick` venue를 agent.market으로 유추(profile.venue 없을 때) — 스윙·장투 KR이 US로 새던 것 방어 + 회귀 테스트

### 검증
- zsh 문법 OK. 백엔드 daytrade_tick/agents_api 11 passed (swing_kr_routes_to_kr 포함)

---

## Phase 76 — AI 에이전트 폼 재설계 + 통화 인지 배정 (2026-07-01) ✅ SHIPPED

문제: 배정에 통화 개념 없어 KR 스윙봇에 1,000,000(원 의도)이 USD로 취급돼 $20k 주문. 폼 혼란(단타(한국)/단타(HL) 등 혼합 4버튼). 카드 UI 정리 요청.

### 완료된 작업
- **폼 재설계** `app/agents/page.tsx`: **투자 스타일(단타/스윙/장투) × 시장(한국/미국/가상화폐)** 2축. `toBackend(style,mkt)`로 백엔드 type+market 매핑(단타+KR→kr_daytrade, +CRYPTO→hl_daytrade, +US→daytrade / 스윙·장투→swing·longterm). 스윙·장투 크립토 미지원 게이팅
- **통화 자동**: `ccyOfMkt`(KR→₩KRW/US→$USD/CRYPTO→USDC). 배정 입력 라벨·프리픽스·플레이스홀더 통화별. `agentCcy(a)`로 카드 자본 통화 표시(더는 전부 $ 아님), `moneyCcy` 헬퍼
- **카드 정리**: 이름 truncate + 상태, 스타일·시장 뱃지(전 타입), PAPER/LIVE, Lv, flex-wrap
- **장투(longterm)** 백엔드 프로필 추가(agent_store, 스윙 계열 주 단위 cadence). lib/api AgentType에 longterm
- 라이브 확인: 한국주식 선택 시 "배정 금액·KRW ₩" 전환됨

### 미해결/주의 (실돈)
- **$20k 근본 = 스윙(LLM) 실행 라우팅**: 스윙 자동주문은 FastAPI 아닌 **CLI 봇/스포너 루프**에서 → market=KR이어도 Alpaca(USD)로 갈 수 있음. 폼 입력 통화는 고쳤으나 **스윙-KR 실행이 KIS(KRW)로 가는지 미검증**. 권장: KR은 **단타(한국)** 사용(KIS 통화 일관 확인됨). 스윙-KR 라우팅은 후속
- Overview 총계는 혼합통화 합산($ 표기) — FX 미변환(사용자 선택), 개별 카드는 정확

### 검증
- FE tsc/빌드/방문확인 OK. 백엔드 26 passed(agent_store/agents_api)

---

## Phase 74 — 뉴스 요약 정확도: summary 블러브 AI 전달 (2026-07-01) ✅ SHIPPED

사용자 지적: AI가 **헤드라인만** 받아 요약 → 실내용과 다르게 해석 위험. Finnhub는 본문 없음(URL 링크), yahoo도 본문 없음.

### 완료된 작업
- `components/news/NewsPanel.tsx` — `onHeadlinesLoaded`가 헤드라인만 보내던 것 → **`헤드라인 — summary` 블러브 결합** 전달 (Finnhub summary 필드 활용, 화면엔 이미 표시하던 것)
- `api_server/main.py` groq 뉴스 프롬프트 — "헤드라인과 요약을 보고 … 제목만으로 속단 금지" 문구 추가

### 미해결(선택) — 본문 전문
- Finnhub/yahoo 둘 다 본문 안 줌. 진짜 본문 원하면 Jina Reader(`r.jina.ai`) 등 스크레이핑 필요 → 지연·파싱 리스크로 보류. 매크로 요약엔 headline+summary로 충분

### 검증
- FE tsc OK / 백엔드 import OK

---

## Phase 73 — 외환 페이지 IB IDEALPRO 실데이터 (2026-07-01) ✅ SHIPPED

외환 페이지가 계산기(forward/carry/curve)+yfinance 그리드였음 → **IB IDEALPRO 실시간 캔들** 추가. 사용자 IDEALPRO FX 구독 보유(무료).

### 완료된 작업
- `app/forex/page.tsx` LiveRatesTab에 `ForexChart` 추가:
  - `getIBBars({asset_type:"forex"})` — 기존 `/ib/bars` forex 라우팅 재사용(`get_daily_bars_forex`, IDEALPRO)
  - bar-size 선택(5m/15m/1h/4h/1d), 페어별 duration 매핑
  - `toIbForexSymbol` "EUR/USD"→"EURUSD", `ibBarToBarOut` 매핑
  - 그리드 카드 클릭 → 차트 페어 선택(선택 카드 border-accent)
  - 공용 `EmptyState`/`LoadingState` 사용 (미연결 시 "IB TWS 연결 필요")

### 검증
- FE tsc/빌드/190 tests OK. 백엔드 변경 없음(기존 엔드포인트 재사용)

---

## Phase 72 — US 라이브 단타 IB 데이터 통일 + 실체결가 (2026-07-01) ✅ SHIPPED

문제: US 라이브 단타가 **Alpaca(IEX) 데이터로 판단 → IB로 실행**, 기록 체결가는 Alpaca 신호가(추정). 슬리피지·실 P&L 부정확. 사용자 IB 주식 구독 보유 → **라이브는 IB 데이터+실행 통일**.

### 완료된 작업
- `backends/ib/order_client.py`:
  - `place_order(..., wait_fill=False)` — wait_fill 시 체결 대기(`_await_fill`, 6초 폴링) 후 실 avg 반환
  - `_to_dict`에 **`avg_fill_price`** 추가 (UNSET_DOUBLE/0 → None)
  - `get_intraday_bars(symbol, "5 mins", "2 D")` — 같은 IB 연결 재사용, intraday_score 형태 dict 반환
- `api_server/router_autopilot.py` US 분기 리팩터:
  - **paper=Alpaca**(5분봉 데이터+실행, 무료 IEX) / **live=IB**(5분봉 데이터+실행)
  - live: IB 분봉으로 채점 → 판단 소스=체결 브로커 일치(괴리 제거)
  - 진입/청산 `wait_fill=True`, **실 avg_fill_price로 fill 기록** (없으면 신호가 폴백 "IB est" 표기)
- 테스트: `test_ib_order_client.py` +2 (wait_fill 체결가 캡처, get_intraday_bars 형태). FakeOrderStatus avgFillPrice/FillingIB/FakeBar stub 추가

### 데이터 경로 최종 정리
- paper US = Alpaca IEX 5분봉 (무료, 대형주 OK / 소형주 거래량 왜곡)
- live US = IB 5분봉 + 실행 + 실체결가 (구독 필요, 정확)
- KR = yfinance 5분봉 + KIS / 크립토 = HL 5분봉

### 검증
- 백엔드 429 passed / 4 pre-existing. import OK

---

## Phase 71 — quote 캐시 + 장중 게이팅 (2026-07-01) ✅ SHIPPED

Finnhub 무료 60 calls/분 한도 보호. 폴링 5초 유지(분봉엔 충분).

### 완료된 작업
- **#2 백엔드 캐시:** `/quote` 3초 TTL 캐시(`_quote_cache`) — 여러 컴포넌트/클라가 같은 심볼 요청해도 Finnhub 호출 1회로 dedup
- **#3 장중 게이팅:** `lib/market-hours.ts` `isUSMarketOpen()`(평일 09:30–16:00 ET, Intl로 DST 자동). ChartTab·TradeTab 폴링이 마감+최신가 확보 후엔 fetch 스킵 → 개장 시 자동 재개
- `tests/lib/market-hours.test.ts` (신규, 6 케이스: EDT/EST/주말/경계)

### Finnhub 무료 한계 (사용자 확인)
- `/quote` US 실시간 무료 ✅ / 과거 intraday 캔들 유료 ❌ (안 씀)
- **진짜 실시간 분봉/옵션/선물 원하면 IB 필요** — reqHistoricalData 1분봉+keepUpToDate, 옵션체인·그릭스·OPRA, 선물 term structure. 데이터+실행 통합 이득. → IB 마켓데이터 구독은 유지가 맞음

### 검증
- 백엔드 427 passed / 4 pre-existing. FE tsc/빌드/190 tests OK

---

## Phase 70 — UI 일관성: 로딩/색상 토큰화 (2026-07-01) ✅ SHIPPED

사용자 요청 "전반적 UI 구린 포인트 수정" 중 택2: 빈상태/로딩 통일 + 하드코딩 색상 토큰화.

### 완료된 작업
- **공용 로딩:** `components/ui/LoadingState.tsx` 신규 — `LoadingState`(스피너+문구, EmptyState 레이아웃 일치) + `Spinner`(인라인). index.ts export
- **로딩 문구 통일:** 독립 로딩 패널 "Loading…"/"로딩 중..." → **"로딩 중…"** 9개 파일 (bots/crypto×3/PortfolioSnapshot/EventsTab×2/FearGreed/TodayEvents×2/KRMarkets). 버튼 라벨(`loading?"Loading…":"Run"`)은 영문 동사와 짝이라 유지
- **색상 토큰화(정확 일치만):** `bg-[#FF9F1C]`→`bg-accent`, `bg-[#3B82F6]`→`bg-info`, `text-[#000]`→`text-black` — event-study/ChartPanel/EfficientFrontierChart/quant. 토큰 없는 viz 팔레트(#8B5CF6/#06B6D4/퍼센타일 ramp)는 유지

### 검증
- FE tsc/빌드/184 tests OK

---

## Phase 69 — 매매 UI 업그레이드 (2026-07-01) ✅ SHIPPED

TradeTab 기본형 → 실사용 개선. 기존 토큰만 사용.

### 완료된 작업
- `components/market/TradeTab.tsx` 재작성:
  - 헤더 실시간 현재가(US=getQuote 5초 폴링, 상승/하락 색상)
  - 매수/매도 풀폭 세그먼트
  - 수량 스테퍼(−/+) + 프리셋(1/5/10/50/100)
  - **예상 주문금액**(수량×현재가/지정가, ₩/$ 통화)
  - 지정가 "현재가" 채우기 버튼
  - 확인 모달: 계좌·예상금액 추가, 실계좌 시 ⚠️ 경고

### 검증
- FE tsc/빌드 OK

---

## Phase 68 — 차트 실시간 갱신 (무료) (2026-07-01) ✅ SHIPPED

주식 차트가 정적 일봉이었음 → 마지막 봉을 실시간 최신가로 갱신. **IB 마켓데이터 구독 불필요** (Finnhub 무료 quote 재사용).

### 완료된 작업
- `api_server/main.py` — `GET /quote?symbol=` (Finnhub `/quote` 무료 실시간, QuoteResponse{symbol,price,ts}). 라이브 검증 AAPL $289
- `lib/api.ts` — `Quote` 인터페이스 + `getQuote()`
- `components/market/ChartTab.tsx` — 실시간 배선: **US=Finnhub 5초 폴링, KR=기존 KIS `/ws/live/{code}` ws**. `applyLivePrice`로 마지막 봉 close/high/low 갱신. 헤더에 현재가 + 실시간/대기 뱃지(pos dot pulse)

### 소싱 정리 (사용자 질문)
- 시장 차트 = catalog(파케이) 우선 → 없으면 US=IB / KR=KIS 폴백 (평소 IB 안 씀)
- IB 페이지 = IB reqHistoricalData 단독 (분봉, TRADES). IB 마켓데이터 구독은 차트엔 불필요; IB 계좌는 **US 실전 주문 실행**용으로만 필요 (paper=Alpaca)
- 옵션/외환/선물 페이지 = 현재 계산기(BS/carry). 암호화폐만 라이브(HL)

### 검증
- 백엔드 427 passed / 4 pre-existing. FE tsc/빌드 OK

---

## Phase 67 — 미국 연방 정부계약/지출 (USASpending) 추가 (2026-07-01) ✅ SHIPPED

"트럼프 정부계약/지출" 프록시 — 대형 연방계약 낙찰(방산·테크 상장사) = 주가 시그널. USASpending.gov 무료 API(키 불필요).

### 완료된 작업
- `insider/gov_spending_client.py` (신규) — `get_recent_contracts(days, limit)`, USASpending `spending_by_award` POST, 계약(A~D)만 금액순. 정규화(수주기업/금액/발주기관/내용/시작일/계약ID)
- `api_server/main.py` — `GET /insider/gov-contracts` (days 1~180, limit 10~100), GovContract 모델
- `lib/api.ts` — GovContract + getGovContracts
- `app/insider/page.tsx` — 🏦 정부계약 마켓 탭 + GovTable(시작일/수주기업/발주기관/내용/계약금액, fmtB). gov/congress 시 회사검색행·us/kr결과 숨김, govCtrl abort cleanup

### 검증 (라이브)
- `/insider/gov-contracts?limit=10` 정상: UT-Battelle DOE $42B 등 대형 계약
- 백엔드 427 passed / 4 pre-existing. FE tsc/빌드 OK

---

## Phase 66 — 미국 의회 매매 (Congress trading) 추가 (2026-07-01) ✅ SHIPPED

의원(펠로시/매코널 등) 주식 매매 = STOCK Act 공시. FMP stable API로 가져옴. (트럼프 개인/정부기관은 체계적 피드 없어 미지원)

### 완료된 작업
- 데이터소스 조사: senate-stock-watcher S3(403 죽음), FMP 레거시(차단) → **FMP `stable/senate-latest`·`house-latest` 무료 키로 작동**
- `.env` — FINANCIAL_MODELING_PREP_API_KEY 메인 .env에 추가
- `insider/congress_client.py` (신규) — 상·하원 최근 신고 병합, 정규화(의원/원/티커/매수매도/금액범위/원문링크)
- `api_server/main.py` — `GET /insider/congress`, CongressTrade 모델
- `lib/api.ts` — CongressTrade + getInsiderCongress
- `app/insider/page.tsx` — 🏛 의회 마켓 탭 + CongressTable(신고일/거래일/의원/상하원/티커/매수매도/금액/원문). 의회 시 회사검색행 숨김

### 검증 (라이브)
- `/insider/congress` 정상: McConnell WFC 매수, McCormick GS 매수, Cleo Fields MSFT 매수 등 상·하원 100+건
- 백엔드 427 passed / 4 pre-existing. FE tsc/184/빌드 OK

---

## Phase 65 — UX 정리: 뉴스 버그·insider·네비·요약패널 (2026-07-01) ✅ SHIPPED

사용자 5개 지적 처리.

### #4 뉴스 안 뜸 🐞
- `/news/market`이 빈값 캐시 오염으로 [] 반환 (finnhub 직접은 100건). **빈 결과는 캐시 안 하도록** 수정 → 30건 정상. GroqSummaryPanel: **28h 초과 캐시 자동삭제**(어제 것까지만), sticky 유지(스크롤 따라옴)
### #1 insider 페이지 정리
- 기간(days) 필터 제거(의미없음, 30일 고정), KR 테이블 중복/빈 컬럼 제거
### #2 KR insider 컬럼 적응
- 기업행위 전용이므로 보고자·증감주식수·보유비율(전부 —) 제거 → 접수일/종목/회사명/구분/공시명/원문. BUYBACK(자사주매수)/DISPOSAL(자사주처분) 뱃지 추가
### #3 발굴>종목검색 제거
- /search 네비 제거 (시장 페이지 검색 탭과 중복). 페이지는 보존
### #5 시장 vs IB 정리
- 네비 market 그룹에서 crypto/forex/options/futures 제거 (이미 시장 페이지 탭에 통합됨). market(자산군 탭 통합) + ib(IB 히스토리컬 바, 별도 데이터소스)만

### 검증
- 백엔드 427 passed / 4 pre-existing. FE tsc/184/빌드 OK
- 라이브: 뉴스 30건 복구, KR insider 기업행위만

---

## Phase 64 — US 모의=Alpaca / 실전=IB 라우팅 (2026-07-01) ✅ SHIPPED

TWS는 페이퍼/실전 동시로그인 불가 → US 모의는 Alpaca(무제한·무TWS), 실전은 IB(TWS 실계좌).

### 완료된 작업
- `backends/ib/order_client.py` — `get_positions()` (IB 보유), connectAsync timeout=4
- `api_server/router_autopilot.py daytrade-tick US 분기` — 데이터는 항상 Alpaca(무료), **실행/포지션: paper→Alpaca, live→IB(7496, asyncio 단일세션으로 포지션+청산+진입)**
- `api_server/main.py /orders/us` — `USOrderRequest.paper`: paper→Alpaca(place_order 재사용), live→IB(7496). 실전 IB_PORT 하드코딩 7496
- `lib/api.ts` — US/KROrderRequest.paper
- `components/market/TradeTab.tsx` — 모의/실계좌 토글(venue별 라벨: Alpaca페이퍼/IB실계좌, KIS모의/실계좌)

### 검증
- 백엔드 427 passed / 4 pre-existing. 회귀 2건 수정(FakeIB connectAsync timeout, us order test paper=false)
- FE tsc/184/빌드 OK

### 구조 정리
- **US**: 모의=Alpaca, 실전=IB(TWS 7496). **KR**: 모의/실전=KIS(mock 플래그). **HL**: testnet/mainnet
- 데이터(스코어)는 US 항상 Alpaca IEX(무료), 실행만 venue 전환

---

## Phase 63 — 매매·알림 시장 페이지 통합 (2026-07-01) ✅ SHIPPED

### #5 매매 → 시장 페이지
- `components/market/TradeTab.tsx` (신규) — 선택 종목 매매(매수/매도, 시장/지정가, 확인모달). 심볼 접미사로 라우팅(.XKRX→KIS, else→Alpaca/US). placeKROrder/placeUSOrder 재사용
### #4 알림 → 시장 페이지
- `lib/price-alert-storage.ts` (신규) — 심볼 가격알림 localStorage CRUD
- `components/market/AlertTab.tsx` (신규) — 종목 가격알림(이상/이하) 추가·삭제, 30초 폴링(getBars/getKRBars 최근가)→크로스 시 toast. 봇기반 /alerts와 달리 심볼-가격 기반
- `MarketWorkspace.tsx` — 💵매매 / 🔔알림 탭 추가 (activeSymbol 대상)
- `NavBar.tsx`·`Sidebar.tsx` — /orders·/alerts 메뉴 제거 (페이지는 보존: HL 수동거래·봇 P&L·봇알림 기능 유지)

### 검증
- FE tsc clean, 184/184, 빌드 OK

### 참고
- /orders(HL·봇P&L)·/alerts(봇알림) 페이지는 URL로 접근 가능하게 보존(기능 손실 방지). 네비만 정리
- 시장 매매 확인모달 있으나 서버 리스크가드는 주문 엔드포인트에서 강제됨

---

## Phase 62 — 잔액정리·포트폴리오원그래프·내부자거래 수정 (2026-07-01) ✅ SHIPPED

사용자 7개 요청 중 5개 처리 (#4·#5 시장페이지 통합은 다음 청크).

### #2 잔액패널 정리
- IB 페이퍼 제거(US 모의=Alpaca) + **한투 실계좌(kis_live)** 추가. KISOrderClient(mock=False)로 실계좌 잔액. IB는 실계좌만 표시
### #3 단타 레벨 미설정 (확인 완료)
- daytrade/kr_daytrade/hl_daytrade는 isDeterministic → 자율성 레벨 선택기 숨김("규칙 기반" 안내). 이미 구현됨
### #6 US 내부자 거래 수정 🐞
- EDGAR FTS 응답 필드 `accession_no`→**`adsh`** + 아카이브 경로 `{acc}-index.json`→**`index.json`** 두 버그. 이제 실데이터(HALLADOR BUY 5000@16.9 등 20건)
### #7 DART 기업행위만 (보유자보고 제외)
- `dart_client.get_recent_kr_corporate_actions` — list.json을 report_nm으로 필터: 유상증자(PAID_IN)/무상증자(RIGHTS_ISSUE)/자기주식취득(BUYBACK)/소각(CANCELLATION)/처분·해지(DISPOSAL). `/insider/kr/recent`가 이걸 사용 (소유상황보고 제거). 라이브 확인(유상증자결정·자기주식취득신탁 등)
### #1 포트폴리오 원그래프
- `/agents` 대시보드에 도넛(conic-gradient): 포지션별 시가+현금 비중 + 범례. 보유 포지션 테이블(포지션별 미실현 PnL)은 유지

### 검증
- 백엔드 427 passed / 4 pre-existing. FE tsc/184/빌드 OK
- 라이브: US insider 20건, KR 기업행위 4건, 한투 실계좌 잔액 연동

### 남은 요청 (다음 청크 — 큰 작업)
- **#4 알림설정 → 시장 페이지 통합** (별도 /alerts 제거, 시장 섹션별 알림)
- **#5 주문 → 시장 페이지 통합** (별도 /orders 제거, 시장 섹션별 매매)

---

## Phase 61 — KR 단타 + daytrade-tick 버그 수정 (2026-07-01) ✅ SHIPPED

### KR 단타 (한국주식 데이트레이딩)
- `intraday_score.py` — `market` 파라미터(US/KR): KST 세션 필터(`session_bars(tz)`), KR은 ToD 감점 없음
- `backends/kis/order_client.py` — `get_holdings()` (inquire-balance output1: 코드/수량/평단/현재가)
- `router_autopilot.py` — `_fetch_kr_intraday_bars`(yfinance .KS 5분봉), daytrade-tick **KR venue 브랜치**: yfinance 분봉→score(market=KR, 롱온리)→stop_exits/decide_exits→KIS 매수/청산. 보유·평단·현재가는 KIS inquire-balance
- `agent_store.py` — `kr_daytrade` 프로파일(venue KR, KIS 모의, tp3%/sl2%, EOD청산), `_DAYTRADE_UNIVERSE["KR"]`(KOSPI 대형주 10 .KS)
- `agent_loop.sh` — kr_daytrade 결정론 분기(5분)
- 프론트 — 단타(한국) 타입 + 뱃지

### 🐞 중대 버그 수정
- **daytrade-tick의 `budget = ...compute_performance(cycles)` — `cycles` 미정의(NameError)** → Phase 55(자본분배)부터 **모든 daytrade tick(US/HL/KR)이 500 에러로 깨져있었음**. `_cycles` fetch 추가로 복구. 회귀 테스트 `test_daytrade_tick.py` 추가
- ⚠️ 실행 중이던 HL 단타 에이전트도 이 버그로 매 사이클 실패 중이었음 → **재시작 필요**

### 검증 (라이브)
- KR daytrade-tick 200: yfinance 10개 KR 종목 분봉+KST 세션 스코어링 정상(삼성 005930 등), SKIP(롱온리+전부 SELL/WATCH)
- 백엔드 426 passed / 4 pre-existing (+KR session, daytrade-tick regression). FE tsc/184/빌드 OK

---

## Phase 60 — 자동 익절/손절 + KR 실투자 지원 (2026-07-01) ✅ SHIPPED

### #2 자동 익절/손절 (하드룰)
- `api_server/daytrade_logic.py` — `stop_exits(positions, tp_pct, sl_pct)`: 보유 포지션 진입가 대비 실현 움직임이 TP/SL 넘으면 청산(롱/숏 대응). AI 재량 아닌 강제
- `agent_store.py` 프로파일 — daytrade tp4%/sl2%, hl_daytrade tp5%/sl3%
- `router_autopilot.py daytrade-tick` — 양 venue(HL/US)에서 **stop_exits 먼저(하드 TP/SL) → decide_exits(신호 반전)** 순으로 청산. HL은 entryPx+현재가(스코어), Alpaca는 avg_entry+current_price
- 테스트 +5 (stop_exits 롱익절/손절/숏/밴드내/무가격)

### #3 KR 실투자 지원 (왜 미구현이었나 → 해결)
- 원인: KISOrderClient가 모의 전용 하드코딩(base_url=openapivts, TR=V*)
- `backends/kis/order_client.py` — `mock` 플래그: base_url(모의/실) + TR prefix(V→T) 자동. get_balance도 real 대응
- `api_server/main.py /orders/kr` — `KROrderRequest.paper`로 모의(KIS_MOCK)/실전(KIS) 키·서버 라우팅
- 안전: kr_order.sh(AI)는 모의 기본. 실전 KR은 `paper=false`+실키로 활성(엔드포인트 지원)

### #1 KR 단타 — 데이터 확인, 다음 청크
- yfinance KR 5분봉 됨(삼성 311 bars) → 가능. 단 intraday 엔진이 ET 세션 기준 → **KST 세션 처리 추가 필요**. 별도 작업으로 안전하게 (신규 venue: yfinance 분봉 + KIS 실행 + kr_daytrade 프로파일)

### 검증
- 백엔드 425 passed / 4 pre-existing (+5 stop_exits). FE tsc/184/빌드 OK

---

## Phase 59 — 스윙 KR/US/혼합 시장 스코프 (2026-07-01) ✅ SHIPPED

스윙 에이전트가 미국만 → 한국/미국/혼합 선택. 혼합 = 한 에이전트가 Alpaca(US)+KIS(KR) 둘 다.

### 완료된 작업
- `api_server/agent_store.py` — `agents.market` 컬럼(US/KR/MIXED, 마이그레이션+검증), create_agent(market)
- `api_server/router_autopilot.py` — AgentCreate.market, create 전달, start_agent가 `agent_loop.sh <id> <type> <autonomy> <market>` 전달
- `autopilot/tools/kr_order.sh` (신규) — KIS 주문(buy/sell/limit, 6자리 코드) via `/orders/kr`
- `autopilot/agent_loop.sh` — `MARKET=$4`, 스윙 유니버스 분기: US=screen_stocks, KR=KOSPI 대형주 12(.KS), MIXED=둘 다 score_stock. 실행 라우팅: US→order.sh, KR→kr_order.sh(코드), MIXED=티커로 구분
- `lib/api.ts` — TradingAgent.market, createAgent(market)
- `app/agents/page.tsx` — 스윙 생성 시 시장 범위 선택(미국/한국/혼합) + 리스트 시장 뱃지

### 동작
- **US**: Alpaca 미국주식 (기존)
- **KR**: KIS 모의, KOSPI 대형주(삼성전자/SK하이닉스/현대차…) 스크리닝, kr_order.sh 실행
- **MIXED**: US+KR 후보 동시 스코어, AI가 각 장 시간에 해당 시장 거래 (티커로 라우팅)

### 검증
- 백엔드 420 passed / 4 pre-existing (+2 market). yfinance KR(.KS) 스코어링 확인(삼성전자 ₩317k)
- 쉘 zsh -n 통과, FE tsc clean, 184/184, 빌드 OK

### 한계
- KR 포지션 익절/손절 자동감지 미완(POSITION_CHECK는 Alpaca만) — KR은 AI 메모리 기반
- KR 실계좌(실투자) 미구현 — KIS 모의만. 단타 KR은 분봉 데이터 별도 필요(스윙만 KR 지원)

---

## Phase 58 — IB·KIS 잔액 추가 (전 계좌 통합) (2026-07-01) ✅ SHIPPED

잔액 패널에 IB(페이퍼/실), 한투(모의) 추가 → 6개 계좌 통합 표시.

### 완료된 작업
- `backends/kis/order_client.py` — `get_balance()` (inquire-balance VTTC8434R): 예수금/총평가/순자산
- `backends/ib/client.py` — `get_account_summary()` (reqAccountSummaryAsync, connect timeout): net_liq/cash/BP
- `api_server/router_autopilot.py` `/agents/accounts/balances` — KIS 모의 + IB 페이퍼(7497)/실(7496) 폴트-톨러런트 추가, **정규화 `accounts` 리스트**(venue/label/ccy/mode/balance/allocated/error) 반환
- `lib/api.ts` — AccountRow/AccountBalances(accounts)
- `app/agents/page.tsx` — Balances 제네릭 렌더(통화별 ₩/$/USDC 포맷), 계좌별 잔액/배정/잔여/에러

### 검증 (라이브)
- Alpaca $100k · **한투 모의 ₩10,000,000** · IB 페이퍼 연결($0) · IB 실계좌 미연결(정상) · HL testnet $0 · HL mainnet $127.2
- FE tsc clean, 184/184, 빌드 OK

### 남은 것 (다음)
- **KR/US/혼합 마켓 스코프** — 에이전트가 아직 미국(Alpaca)만. 한국장(KIS 실행 + KR 유니버스/스코어링) 추가 + 생성 시 스코프 선택. **별도 큰 작업**(설계 확정 후)
- KIS 실계좌 잔액(TTTC8434R + 실 base_url) 미구현

---

## Phase 57 — 실계좌 잔액 표시 (배정 참고) (2026-07-01) ✅ SHIPPED

에이전트 0개면 오버뷰가 사라져 실계좌 잔액을 못 봄 → 배정액 정하기 어려움. 잔액 패널 상시 표시.

### 완료된 작업
- `api_server/router_autopilot.py` — `GET /agents/accounts/balances`: 폴트-톨러런트 집계. Alpaca(equity/cash/BP), HL 테스트넷/메인넷 account_value, 그리고 **에이전트 배정 합계를 venue별 분리**(us_alpaca / hl_testnet / hl_mainnet)
- `lib/api.ts` — AccountBalances + `getAccountBalances()`
- `app/agents/page.tsx` — **상단 상시 잔액 패널**(에이전트 0개여도 표시): Alpaca/HL테스트넷/HL메인넷별 잔액 + 배정액 + 잔여(초과 시 ⚠️경고), 30초 폴링

### 검증
- 라이브: Alpaca 페이퍼 $100k, HL 메인넷 실USDC $127.2, HL testnet $0 확인
- FE tsc clean, 184/184, 빌드 OK

---

## Phase 56 — 사이트 기능 감사 + 네비 정리 (2026-07-01) ✅ SHIPPED

전체 사이트 중복/dead 기능 감사 → 리다이렉트 스텁이 네비에 남아있던 문제 정리.

### 감사 결과
- **리다이렉트 스텁 7개가 NavBar에 중복 노출**: factor/correlation/rolling→quant, experiments/strategies→notebooks, screener→search, replay→backtest. 통합 후 옛 메뉴가 안 지워짐
- quant(2412줄)=팩터+상관관계+롤링 흡수, notebooks=실험+전략 흡수 (정상)
- 자산군 페이지(market/crypto/forex/futures/options/ib) 중복 아님

### 완료된 작업
- `components/NavBar.tsx` — 리다이렉트 7개 메뉴 제거 (발굴:스크리너 / 분석:상관관계·롤링·팩터 / 전략:전략·실험 / 백테스트:리플레이). 리다이렉트 페이지 자체는 보존(옛 URL 대응)
- `app/workflow/page.tsx` — 스텝 링크 더블리다이렉트 수정: factor→`/quant`, strategies→`/notebooks`

### 검증
- 네비/워크플로우 잔여 리다이렉트 참조 0, tsc clean, 184/184, 빌드 OK

### 남은 판단거리 (사용자 결정)
- `spawner`(전략 검증기) — 백테스트/에이전트와 역할 겹칠 소지. 실사용 여부 확인 후 정리 가능
- 리다이렉트 스텁 페이지 파일들(factor/correlation/rolling/replay/experiments/screener/strategies) — 옛 북마크 없으면 삭제 가능

---

## Phase 55 — 에이전트별 자본 분배 + 전체 오버뷰 대시보드 (2026-07-01) ✅ SHIPPED

Alpaca 단일 계좌를 AI별로 나누고, 여러 에이전트를 한눈에.

### 자본 분배 (실질 적용)
- 기존 `account_alloc`은 저장만 되고 사이징은 실계좌 전체 equity를 씀 → 분배 안 지켜짐
- `daytrade-tick` 사이징을 **에이전트 예산 기준**으로: `budget = account_alloc − 자기 invested`(자기 원장). 여러 에이전트가 한 계좌에서 각자 슬라이스 안에서만 거래 (US/HL 양쪽)

### 전체 오버뷰
- `GET /agents/overview/all` — 전 에이전트 집계(실현손익 기준, 가격조회 없이 빠름): 에이전트별 alloc/realized/return/invested/cash/포지션수/거래수 + 총합(count/alloc/realized/return/running)
- `lib/api.ts` — AgentsOverview + `getAgentsOverview()`
- `app/agents/page.tsx` — 상단 **오버뷰 섹션**: 총합 카드(에이전트수·총배정·총실현손익·종합수익률) + **에이전트별 실현손익 가로 바 그래프**(클릭 시 해당 에이전트 선택), 10초 폴링

### 검증
- 백엔드 418 passed / 4 pre-existing (+3). overview 집계 정확(총 alloc 1500, realized 100, return 10%)
- FE tsc clean, 184/184, 빌드 OK
- 라이브: overview가 실제 다중 에이전트 집계 확인

---

## Phase 54 — 전략 증류 (Lv3 자유탐색 → 검증된 규칙 전략) (2026-07-01) ✅ SHIPPED

"Lv3가 잘 나오면 그 전략 라이브로?" → Lv3는 고정 전략 없음(즉흥). 그래서 거래로그를 **백테스트 가능한 규칙 전략으로 증류**하는 브릿지.

### 완료된 작업
- `api_server/router_autopilot.py` — `POST /agents/{id}/distill`: 에이전트 체결로그(agent_perf.trades) → claude로 macd/rsi/ema_cross 규칙+파라미터 증류 → `/backtest`로 1년 검증 → {proposal, backtest(sharpe/pnl/승률), validated(Sharpe≥1), verdict} 반환. json/urllib import 누락 버그 수정
- `lib/api.ts` — DistillResult + `distillAgent()`
- `app/agents/page.tsx` — 대시보드에 "🧪 전략 증류" 버튼 + 결과(전략/파라미터/Sharpe/수익/승률/근거/검증판정)

### 흐름
```
Lv3 자유 탐색 → 거래로그 → AI 증류(규칙+파라미터) → 백테스트 검증 → Sharpe≥1이면 라이브 후보
```

### 검증 (라이브 e2e)
- 4건 체결 주입 → distill → **MACD(AAPL, 12/26/9) 증류 → 백테스트 Sharpe 1.69 → validated=true** 확인
- 체결<3 → 422, 없는 에이전트 → 404
- 백엔드 415 passed / 4 pre-existing (+2 distill). FE tsc clean, 184/184, 빌드 OK

### 의미
- Lv3 = 아이디어 발굴기, 증류 = 검증 가능한 전략으로 굳힘. "AI vibes로 번 것"을 재현·검증 가능한 엣지로 전환

---

## Phase 53 — 에이전트 자율성 레벨 선택 (2026-07-01) ✅ SHIPPED

생성 시 AI 자율성 레벨(1/2/3) 선택. "AI가 알아서 매매" 요청 → 안전하게 단계화.

### 레벨
- **1 고정 규칙**: 정해진 임계값(macro≥5 AND score≥threshold)대로만
- **2 AI 전략가 (기본·추천)**: 지표·뉴스로 가설 → **backtest.sh로 검증** → 엣지 확인 시만 매매
- **3 완전 자율**: AI 재량(고정 임계값 없음). 엣지 검증 약함 경고. **하드 리스크가드는 항상 강제**

### 완료된 작업
- `api_server/agent_store.py` — `agents.autonomy` 컬럼(+마이그레이션, 1~3 검증), `create_agent(..., autonomy=2)`
- `api_server/router_autopilot.py` — `AgentCreate.autonomy`, create 전달, start_agent가 `agent_loop.sh <id> <type> <autonomy>` 전달
- `autopilot/agent_loop.sh` — `AUTONOMY=$3`, 스윙 STRATEGY_RULES를 레벨별 분기(1 고정 / 2 백테스트검증 / 3 자율). 공통 실행규칙 + "리스크 한도는 서버 강제"
- `lib/api.ts` — TradingAgent.autonomy, createAgent(autonomy)
- `app/agents/page.tsx` — 자율성 레벨 선택기(스윙만; 단타는 레벨1 고정 안내), 레벨3 경고, 리스트 Lv 뱃지

### 안전
- 단타(결정론)는 레벨1 고정 (LLM 없음)
- 레벨 무관 **하드 리스크가드(주문크기·일일손실·킬스위치, Phase 43)는 코드 강제** — AI가 못 끔

### 검증
- 백엔드 415 passed / 4 pre-existing (+2 autonomy)
- FE tsc clean, 184/184, 빌드 OK

---

## Phase 52 — AI에게 백테스트+사이트 도구 쥐어주기 (2026-07-01) ✅ SHIPPED

퀀트 수동 흐름(짜기→백테스트→페이퍼/실매매)은 유지. AI(스윙, LLM)가 사이트 기능을 도구로 사용:

### 완료된 작업
- `autopilot/tools/backtest.sh` (신규) — `backtest.sh INSTRUMENT STRATEGY [DAYS]` → `/backtest` 호출, Sharpe/Sortino/수익률/승률/MDD 반환. **AI가 진입 전 전략 검증**
- `autopilot/agent_loop.sh` 스윙 프롬프트 — **도구 카탈로그** 주입: backtest.sh(전략검증), quant.sh(지표), news.sh(뉴스), portfolio.sh(계좌), screen_stocks.py(스크리닝), 사이트 API 직접 curl(risk/factor/portfolio/insider/calendar 등). "판단 애매하면 backtest.sh로 검증 후 결정"

### 동작
- 스윙 AI(LLM, bypassPermissions로 Bash 가능)가 매 사이클 필요시 백테스트·퀀트·뉴스·리스크 등 사이트 기능 호출해 근거 보강 후 매매
- 결정론 단타는 LLM 없어 도구판단 불가 → 스윙 전용 (의도된 것)

### 검증
- 라이브: `backtest.sh AAPL.NASDAQ macd/rsi` 정상 (Sharpe 0.71, 승률 0.6)
- 쉘 zsh -n 통과

### 참고
- 퀀트 수동 파이프라인(/backtest·/strategies·/bots)은 그대로 유지 (사용자 요청)

---

## Phase 51 — 에이전트 페이퍼/라이브 선택 (2026-07-01) ✅ SHIPPED

AI 생성 시 모의(paper)/실거래(live) 선택. TradFi는 페이퍼 제외(테스트넷 무거래) → 크립토만.

### 완료된 작업
- `api_server/agent_store.py` — `agents.paper` 컬럼(+기존 DB 마이그레이션 ALTER), `create_agent(..., paper=True)`, bool 정규화
- `api_server/router_autopilot.py` — `AgentCreate.paper`, create 엔드포인트 전달, daytrade-tick이 `agent.paper` 사용(프로파일 아님). **HL+paper → xyz(TradFi) 제외 크립토만** 필터
- `lib/api.ts` — TradingAgent.paper, createAgent(paper)
- `app/agents/page.tsx` — PAPER/LIVE 토글(라이브 적색+confirm 경고), hl_daytrade+paper 안내(TradFi는 LIVE 필요), 리스트 PAPER/LIVE 뱃지

### 동작
- **PAPER**: 테스트넷/모의. HL 단타는 크립토만(BTC/ETH/SOL/HYPE/DOGE)
- **LIVE**: 메인넷 실USDC. HL 단타는 크립토+xyz TradFi 전체(주식/금/원유/지수/외환). 생성 시 confirm 경고

### 검증
- 백엔드 413 passed / 4 pre-existing. 신규 +5 (paper flag, dex routing)
- FE tsc clean, 184/184, 빌드 OK

---

## Phase 50 — HL 멀티에셋 (주식·원자재·지수·외환) 유니버스 (2026-07-01) ✅ SHIPPED

"수익 최우선 + 넓은 유니버스" — HL 빌더 perp DEX로 코인 외 자산까지. **담보 화폐(USDC) 필터가 핵심**.

### 조사 결과 (라이브 확인)
- HL 표준 perp = 230개 전부 크립토(+PAXG). 미국주식/한국주식/지수/원자재는 **HIP-3 빌더 DEX**에 있음
- **USDC 담보로 거래 가능한 건 딱 2곳**: 표준 크립토 DEX(USDC) + **xyz DEX(USDC, 84 라이브)**. cash=USDT0, hyna=USDE, flx/vntl=USDH, mkts=delisted → USDC로 불가
- xyz(메인넷): TSLA $416, GOLD $3999, SP500 등 실가격+거래량 ✅. 테스트넷 xyz는 마켓만 있고 **캔들 0(무거래)** → TradFi 데모 불가, 실거래는 메인넷 실USDC

### 완료된 작업
- `hyperliquid/trader.py` — **dex 인식**: `_dex_of`/`_perp_dexs`, `xyz:TSLA` → `Info/Exchange(perp_dexs=["xyz"])` 라우팅. get_candles/place_order/set_leverage/close_position 전부 dex-prefixed 이름 처리
- `api_server/router_autopilot.py` `_DAYTRADE_UNIVERSE["HL"]` — 사용자 워치리스트 기반: 크립토 5개(BTC/ETH/SOL/HYPE/DOGE, 사용자 지정만) + xyz TradFi 42개(SKHX/XYZ100/SP500/SPCX/SILVER/CL/BRENTOIL/GOLD/NVDA/SMSN/TSLA/… + 유동성 추가 MU/SNDK/INTC/MSTR/AMD/EWY/AMZN/COIN/PLTR/TSM/COPPER/PLATINUM/JP225/KR200/BABA…)

### 검증
- 백엔드 411 passed / 4 pre-existing. 신규 +3 (hl_dex_routing)
- 라이브: dex-aware 캔들 mainnet 정상 (xyz:TSLA/GOLD + BTC), 파싱 테스트 통과

### 남은 것 (실거래 관련)
- **TradFi 실거래 = 메인넷 실USDC 필요** (테스트넷 무거래). hl_daytrade 프로파일은 paper=true → TradFi는 SKIP만. 실매매하려면 mainnet 프로파일 + 실USDC (사용자 결정)
- **크로스-DEX 포지션 조회**: get_positions는 표준 DEX user_state → xyz 포지션은 별도 조회 필요 (진입은 되나 xyz 보유 자동청산 감지 미완)
- xyz 주문 라우팅은 데이터/구조 검증됨, 실주문은 메인넷에서 최종 확인 필요

---

## Phase 49 — 단타 결정론적 전환 + 스윙 뉴스 강화 (2026-07-01) ✅ SHIPPED

토큰 비용 문제: 단타가 5분마다 claude 호출(SKIP만 해도) → 낭비. 단타=규칙기반이어야, 스윙=뉴스/LLM 값어치.

### 단타 결정론적 (LLM 제거, 토큰 0)
- `api_server/daytrade_logic.py` (신규) — 순수 규칙: `decide_entry`(최고 conviction 액션 시그널, US는 롱만/HL은 롱숏), `decide_exits`(신호 반전/AVOID·WATCH 소멸 시 청산), `position_size`(equity×pct×leverage/entry)
- `api_server/router_autopilot.py` — `POST /agents/{id}/daytrade-tick`: 스코어→청산→진입→사이클기록 전부 서버측 결정론(LLM 없음). US(Alpaca)/HL 양 venue
- `autopilot/agent_loop.sh` — daytrade/hl_daytrade는 claude 대신 `daytrade-tick` curl (스윙만 LLM 유지)
- `autopilot/tools/post_cycle.py` (신규) — heredoc+파이프 stdin 충돌 버그 수정 (JSON이 파이썬코드로 파싱되던 문제)

### 스윙 뉴스 심층 분석 (TradingAgents-lite)
- `agent_loop.sh` 스윙 브랜치 — 상위 3후보 `tools/news.sh`로 실뉴스 프리페치 → 프롬프트 주입, bull/bear를 뉴스+펀더+기술로 저울질하는 규칙. 8h 주기라 단일 LLM콜 감당됨

### 검증 (라이브)
- 백엔드 408 passed / 4 pre-existing. 신규 +10 (daytrade_logic)
- HL 단타 에이전트 결정론 루프 실가동: `결정론적 틱 (LLM 없음)` → SKIP 기록 (BTC/ETH/SOL AVOID, testnet 저유동성) → **claude 호출 0, <1초**
- `daytrade-tick` 직접호출 정상, 스윙 뉴스 word-split/엔드포인트 OK

### 비용 구조 정리
- 단타(5분): 토큰 0 (결정론) — 24/7 무료 가동
- 스윙(8h): 뉴스+LLM, 저빈도라 저비용

---

## Phase 48 — Mac 24/7 운영 + Hyperliquid 레버리지 단타 에이전트 (2026-07-01) ✅ SHIPPED

### Mac 24/7 (deploy/mac/)
- `com.seokminal.backend.plist` — launchd 유저 에이전트 (RunAtLoad + KeepAlive 자동재시작)
- `start-backend.sh` — `caffeinate -i -s`로 잠자기 방지 + uvicorn :8000, 부팅 후 에이전트 재개 트리거
- `resume-agents.sh` — status=running인데 tmux 세션 죽은 에이전트 자동 재시작 (urllib, idempotent)
- `install.sh` (설치/제거), `README.md` (한계 고지: 맥 상시 켜둬야, claude CLI 사용량 주의)

### Hyperliquid 레버리지 단타 에이전트
- `hyperliquid/trader.py` — `set_leverage(coin,leverage,is_cross,paper)`, `get_candles(coin,interval,lookback_min,paper)` (HL candles_snapshot → intraday 바)
- `api_server/intraday_score.py` — `crypto=True` 모드: 24/7(세션/ToD 리셋 없음, 롤링 VWAP)
- `api_server/main.py` — `POST /hl/leverage`(Field ge1 le50), `GET /hl/intraday/scores?coins=&paper=` (HL 분봉 → crypto 스코어링)
- `api_server/agent_store.py` — `hl_daytrade` 프로파일 (venue HL, leverage 3, position_pct 10%, paper testnet, 24/7)
- `autopilot/agent_loop.sh` — `hl_daytrade` 분기: HL 분봉 스코어, 레버리지 설정, 비중×레버리지 사이징, ATR 손절, 24/7(시장시간 무시), `tools/hl_order.sh`(leverage/buy/sell/close/positions, testnet)
- `app/agents/page.tsx` + `lib/api.ts` — 생성폼 3타입(스윙/단타(주식)/단타(HL)), 리스트 뱃지

### 검증
- 백엔드 398 passed / 4 pre-existing. 신규 +14
- 쉘 zsh -n 통과, plist plutil OK / FE tsc clean, 184/184, 빌드 OK

### HL testnet 양방향 라이브 검증 완료 (2026-07-01) ✅
- **testnet/mainnet 키 분리** 구현: `trader.py` `_private_key(paper)`/`_account_address(paper)` — paper면 `HL_TESTNET_*` 우선, 없으면 mainnet 폴백
- **롱/숏 실체결 확인**: ETH 롱(0.01@1575.6, 0.02@1575.7) + 숏(0.01@1576.2, 0.02@1576.2) 전부 filled (oid 반환). 청산(market_close) 정상
- **핵심 발견 — API 지갑 패턴**: `HL_TESTNET_PRIVATE_KEY`(agent 0xea88, 서명) ≠ `HL_TESTNET_ACCOUNT_ADDRESS`. 자금·포지션은 **마스터 계좌(메타마스크 0x71DC)**에 있음 → ACCOUNT_ADDRESS는 agent가 아니라 **마스터 주소**여야 조회됨. .env 수정 완료 (0xea88→0x71DC)
- 마스터 0x71DC testnet: 파우셋 10.5 USDC, 숏 -0.02 포지션 정상 조회됨
- 참고: 체결 직후 accountValue/positions 조회가 간헐적으로 빈값 → HL 테스트넷 eventual-consistency(코드 아님). 최종 flat 확인(잔여 포지션 없음)

### (초기 진단 로그)
- ✅ 읽기전용: `/hl/intraday/scores` testnet 캔들 → VWAP/ORB/EMA/ATR/방향 정상 (testnet 저유동성이라 RVOL~0 → AVOID = 올바른 거름)
- ✅ `/hl/positions` 정상 (accountValue $0)
- 🐞 **버그 수정**: `market_open()`에 `reduce_only` 인자 없음 → 롱/숏 주문 크래시. trader.py에서 market 주문 시 reduce_only 제거(청산은 market_close가 담당), limit은 유지
- ✅ 수정 후 롱/숏 **양방향 동일하게 HL 도달** 확인 (서명·제출 경로 정상)
- ⛔ **블로커(사용자 작업)**: testnet 지갑 미온보딩/무자금 → `wallet 0x0d8c… does not exist`. 또 `.env` **주소 불일치**: HL_ACCOUNT_ADDRESS=0x71DC… vs 개인키 파생 0x0d8c…
  - 필요: testnet 파우셋 입금 + 키/주소 일치(또는 API 지갑 승인) 후 실주문 가능

---

## Phase 47 — 데이트레이딩 분봉 전략 분리 (프로급) (2026-07-01) ✅ SHIPPED

swing/daytrade가 동일 일봉 멀티팩터 쓰던 문제 → daytrade 전용 **분봉 일중 전략** 분리.

### 완료된 작업
- `api_server/intraday_score.py` (신규) — 프로급 일중 스코어링 순수함수(0~100 + 방향 + ATR 손절/익절):
  - **VWAP**(기관 앵커) + EMA9/20 스택 → regime/방향 (25점)
  - **ORB**(개장 30분 레인지 돌파) → 진입 트리거 (25점)
  - **RVOL**(상대거래량) → 가짜돌파 거름 (20점)
  - 미세 모멘텀 정렬 (15점), **ATR 변동성 게이트**(죽은종목 AVOID, 15점)
  - **RSI(7) 과열 추격 패널티**(-20), **time-of-day**(점심 횡보 ×0.7)
  - signal: STRONG_BUY/SELL≥70, BUY/SELL≥55, WATCH≥40, AVOID. entry/stop/target = ATR 1.5R
- `api_server/router_autopilot.py` — `GET /alpaca/intraday/score/{symbol}`, `GET /alpaca/intraday/scores?symbols=` (Alpaca 5분봉 → 스코어링)
- `autopilot/agent_loop.sh` — **프로파일 분기**: daytrade는 분봉 엔드포인트 호출 + 고유동성 고정 유니버스(SPY/QQQ/NVDA/TSLA…) + conviction≥55 + ATR 손절 준수 + EOD 강제청산 프롬프트. swing은 기존 일봉 멀티팩터 유지

### 검증
- 백엔드 394 passed / 4 pre-existing. 신규 +11 (intraday_score 9, intraday_endpoint 2)
- 실서버 스모크: `/alpaca/intraday/score/AAPL` 정상 응답 (장마감이라 insufficient data→AVOID, 올바른 동작)

### 남은 작업
- 장중 5분 사이클 실가동 e2e (실제 시장 시간에 분봉 흐름 확인) — Task 7 최종

---

## Phase 46 — ai-trader 제거 (채팅 불필요) (2026-07-01) ✅ SHIPPED

자율 에이전트면 채팅 입력 불필요(긴급개입은 시작/정지+킬스위치+리스크가드로 커버) → ai-trader 중복 제거, `/agents`가 정식 AI 트레이딩 허브.

### 삭제/정리
- `app/ai-trader/page.tsx` 삭제 (610줄 tmux 덤프 페이지)
- `components/NavBar.tsx`, `components/Sidebar.tsx` — `/ai-trader` 링크 제거, Sidebar는 `/agents`로 교체
- `lib/i18n-utils.ts` — nav.ai-trader, page.ai-trader.title/desc 제거
- `lib/api.ts` — 미사용(0 소비처) 함수 제거: sendChatMessage/getChatPane/ChatPaneResult, startAutopilotTerminal/getTerminalStatus, getClaudeUsage/ClaudeUsage*
- `api_server/router_autopilot.py` — chat 브리지 제거: `POST /alpaca/chat/send`, `GET /alpaca/chat/pane`, ChatMessage, _pane_baseline (`_tmux_capture`는 shutdown/status가 써서 유지)
- 보존: autopilot 루프/tmux, shutdown 엔드포인트(1곳 사용)

### 검증
- 백엔드 383 passed / 4 pre-existing, import OK
- 프론트 tsc clean(.next/types 재생성), 184/184, 빌드 OK(ai-trader 라우트 제거, /agents 유지)
- 잔여 ai-trader 참조 0

---

## Phase 45 — 에이전트 대시보드 (포트폴리오·매매기록·실시간 PnL) (2026-07-01) ✅ SHIPPED

`/agents` 페이지 우측 공간에 per-agent 대시보드. "기존 ai-trader는 중복" → /agents가 정식 허브, ai-trader는 추후 제거 검토(현재 유지).

### 완료된 작업
- `api_server/agent_perf.py` (신규) — 사이클 fill 기반 **FIFO 원장 순수함수** `compute_performance(cycles)` → 매매기록(이유 포함)/실현손익/보유포지션(평단). per-agent 격리 (Alpaca 1계좌여도 에이전트 자기 fill만 집계)
- `api_server/router_autopilot.py` — `GET /agents/{id}/performance`: 원장 + 현재가(`_latest_price`)로 미실현손익 보강 → {alloc, cash, invested, realized/unrealized/total_pnl, return_pct, open_positions[], trades[]}. `CyclePayload.fill` 필드 추가
- `autopilot/agent_loop.sh` — JSON 출력에 `fill:{side,qty,price}`(주문 집행 시) + note=매매이유
- `lib/api.ts` — AgentPerformance/AgentTrade/AgentOpenPosition + `getAgentPerformance()`
- `app/agents/page.tsx` — 우측 **대시보드/사이클 탭**. 대시보드: 총손익·수익률·실현·미실현 카드, 배정자본·현금·투자중, 보유포지션 테이블(실시간 미실현), 매매기록(매수/매도 이유 💡 + 실현손익). **5초 폴링 실시간 PnL**

### 검증
- 백엔드: 383 passed / 4 pre-existing. 신규 +10 (agent_perf 7, agent_performance_api 3)
- 프론트: tsc clean, 184/184, 빌드 OK
- ⚠️ 실행 중 서버는 재시작해야 신규 엔드포인트 반영됨

### 참고
- 기존 Task 5(client_order_id 태깅) 대신 **사이클 fill 원장**으로 per-agent 격리 달성 (더 단순·견고). Alpaca 실주문 태깅은 불필요해짐
- 데이트레이딩 5분 e2e 실가동 검증은 여전히 남음(Task 7)

---

## Phase 44 — 멀티 AI 트레이딩 에이전트 + UX 구조화 (2026-07-01) ✅ SHIPPED (Task 1~4,6)

계획: `docs/superpowers/plans/2026-07-01-multi-agent-trading.md`

### 진단 (확정)
- 매매 경로(order.sh→`/alpaca/order`) **정상**: 실서버에서 AAPL 1주 place→accept→cancel 검증 완료. Alpaca 안 변한 이유 = 에이전트 게이트(`macro≥5 AND STRONG_BUY`)가 한 번도 안 열림 + 유니버스 AAPL만.
- UX 문제 = `claude --print` 원본 stdout을 tmux 페인 통째 폴링/덤프. "한 문장만" 무시됨.

### 완료된 작업
- `api_server/agent_store.py` (신규) — SQLite 에이전트 레지스트리 + 구조화 사이클 스토어. `AGENT_PROFILES`(swing 8h/score≥18, daytrade 5m/score≥22/EOD청산), CRUD, `record_cycle`(decision enum 검증)/`read_cycles`. AGENT_DB_PATH env(기본 data/agents.db)
- `api_server/router_autopilot.py` — `agents_router`: `GET/POST /agents`, `GET/DELETE /agents/{id}`, `POST /agents/{id}/start|stop`(tmux 세션 `seokminal-agent-{id}` 생성/킬), `GET/POST /agents/{id}/cycles`
- `api_server/main.py` — agents_router 등록
- `autopilot/agent_loop.sh` — **파라미터화**(`agent_loop.sh <id> <profile>`), 프로파일별 cadence/유니버스/게이트, Claude가 **JSON 한 줄** 출력→파싱→`POST /agents/{id}/cycles` 기록, 유니버스 확장(top 8~15), 게이트 재조정(score≥threshold)
- `lib/api.ts` — TradingAgent/AgentCycle 인터페이스 + listAgents/createAgent/start/stop/delete/getAgentCycles
- `app/agents/page.tsx` (신규) — 에이전트 목록(생성폼/타입뱃지/시작·정지·삭제) + 선택 에이전트의 **구조화 사이클 카드**(decision 색상뱃지, score/40 바, action, 트리거, 현금%). 원본 stdout 덤프 없음
- `components/NavBar.tsx` + `lib/i18n-utils.ts` — "AI 에이전트" 메뉴 + page.agents i18n

### 검증
- 백엔드: 373 passed / 4 pre-existing. 신규 +17 (agent_store 11, agents_api 6)
- 실서버 e2e: 에이전트 생성→BUY 사이클 기록→구조화 조회→삭제 전부 정상
- 프론트: tsc clean, 184/184, 빌드 성공 (`/agents` 라우트 생성)

### 남은 작업 (다음 세션)
- **Task 5 가상 계좌 분리**: 주문에 `client_order_id=agent_{id}_{cycle}` 태깅 → agent별 주문/포지션 필터, `GET /agents/{id}/account`. (현재 order.sh는 태깅 안 함 — agent_loop.sh order 호출에 태그 전달 + alpaca place_order에 client_order_id 지원 필요)
- **Task 7 데이트레이딩 e2e 검증**: 5분 사이클 실제 가동 + EOD 청산 로직 확인
- ai-trader 기존 페이지(610줄, tmux 덤프)는 유지됨 — 추후 /agents로 완전 대체 검토

---

## Phase 43 — 실매매 안전화 (Live Trading Hardening) (2026-07-01) ✅ SHIPPED

계획: `docs/superpowers/plans/2026-07-01-live-trading-hardening.md`. 감사에서 나온 CRITICAL 4 + IMPORTANT + UPGRADE 구현.

### 완료된 작업 (Backend)
- `live_engine/risk_guard.py` (신규) — 공통 pre-trade 리스크 가드: `RiskConfig`(env: MAX_ORDER_QTY/MAX_ORDER_NOTIONAL/MAX_POSITION_QTY/DAILY_LOSS_LIMIT/TRADING_KILL_SWITCH), `validate_order()`(수량>0·최대수량·notional·일일손실·킬스위치, 포지션 축소는 캡 면제), `DailyPnLTracker`
- `api_server/main.py` — `_check_risk()` 헬퍼를 US/KR/HL 주문 전 호출(위반 시 422), `quantity/size: Field(gt=0)`, `GET /trading/mode`(paper/live + 리스크 스냅샷), `GET /orders/audit`
- `api_server/order_audit.py` (신규) — append-only JSONL 주문 감사 로그(`record_order`/`read_recent`), 모든 주문 경로에서 기록
- `live_engine/engine.py` — **포지션 desync 버그 수정(#1):** `_target_units`/`_order_for_target` 순수 헬퍼 — 반전 시 2×trade_size 주문(청산+신규)으로 엔진 포지션이 실제와 일치, 체결가(`avg_fill_price`) 우선 PnL(#4), 시작 시 `_reconcile_position`으로 브로커 실포지션 시드(#6)
- `live_engine/broker_interface.py` — `OrderResult.avg_fill_price`, `BrokerInterface.get_position`(기본 None)
- `live_engine/ib_broker.py` — `get_position` IB `positions()` 기반 구현

### 완료된 작업 (Frontend)
- `lib/api.ts` — `TradingMode` 인터페이스 + `getTradingMode()`
- `app/orders/page.tsx` — paper/live 모드 배지 + 킬스위치 표시, **KR/US 주문 확인 모달(#5)** (live는 적색 경고), `requestPlaceOrder`(검증→모달)→`handlePlaceOrder`(실행)

### 검증
- 백엔드: 356 passed / 4 pre-existing (test_auth ×3, test_backtest_happy_path). 신규 테스트 +33 (risk_guard 12, order_risk 5, order_audit 4, trading_mode 3, live_engine_orders 9)
- 실서버 스모크: `/trading/mode` 정상, 과대 주문 → HTTP 422 "risk check failed" (브로커 도달 전 차단)
- 프론트: tsc clean, 184/184, 빌드 성공

### 남은 한계 (정직 고지)
- `avg_fill_price`: 브로커가 아직 체결 미포착 → None 반환, 엔진은 tick.price로 폴백 (실 체결가 반영하려면 IBOrderClient에 fill 대기 로직 추가 필요)
- KIS `get_position` 미구현(기본 None) → KR 봇은 reconciliation 없이 flat 시작
- IB 주문 매 요청 connect→disconnect(#8) 미해결 — 레이턴시/멱등성(#7)은 후속

---

## Phase 42 — IB WebSocket 실시간 (2026-07-01) ✅ SHIPPED

### 완료된 작업
- `backends/ib/client.py` — `stream_trades(symbol, connect_timeout=4.0)`: connectAsync에 timeout 전달 (TWS 미연결 시 무한 대기 방지)
- `api_server/main.py` — `@app.websocket("/ws/ib/live/{symbol}")`: KIS WS 패턴 미러, `_serialize_ib_tick()` (TickByTickAllLast → JSON), 랜덤 client_id(900~999)로 동시 구독, `errorEvent` 후킹하여 fatal IB 코드(354/162/200/504/10167/10168/10197)를 클라이언트로 릴레이 (시세 구독 없으면 틱 안 와서 무한 대기하던 문제 해결), asyncio.wait로 tick/error 레이스
- `lib/api.ts` — `IBTick` 인터페이스 + `WS_URL` export (API_URL → ws:// 변환)
- `lib/i18n-utils.ts` — `ib.live.connected/connecting/offline/waiting_tick` 키 추가
- `components/live/IbRealtimeWidget.tsx` — 플레이스홀더 → 실제 WS: AAPL/SPY/QQQ 종목별 WS 연결, 가격 ▲/▼ 색상, 체결량 표시, 동적 상태 배지(실시간/연결 중/오프라인), unmount 시 소켓 정리
- `tests/test_ib_client.py` — FakeIB.connectAsync에 timeout kwarg 추가
- `tests/lib/i18n.test.ts` — stale `nav.research` → `nav.market` (pre-existing 실패 수정)

### 검증
- 실제 TWS(127.0.0.1:7497) 연결 확인 → 0.6초 만에 Error 354(시세 미구독) 릴레이 후 close (무한 대기 없음)
- 백엔드: 323 passed / 4 pre-existing 실패 (test_auth ×3, test_backtest_happy_path)
- 프론트: tsc clean, 184/184 통과, 프로덕션 빌드 성공

### 참고 (별개 작업)
- `TradingAgents/` — Groq/Gemini 무료 전환 시도 → Groq 무료 TPM 6000 한도로 멀티에이전트 불가 확인 → OpenRouter(deepseek)로 원복. 로드맵 "미해결 이슈" 3개(CorrelationNetwork D3, ai-trader 플레이스홀더, quant 레거시 스타일)는 검증 결과 전부 stale(이미 해결/위반없음)

---

## Phase 41 — Groq 요약 + UX 정비 (2026-06-30) ✅ SHIPPED

### 완료된 작업
- `api_server/main.py` — `POST /groq/summarize` (mode=news|calendar), 매크로 전략가 프롬프트(· 항목 형식, 마크다운 금지), `STOCKS: TICKER↑/↓` 라인 파싱 → `picks[]` 반환
- `components/GroqSummaryPanel.tsx` (신규) — AI 분석 버튼, 상승/하락 키워드 색상, localStorage 캐시(mode별, 페이지 이동해도 유지), 종목 카드(차트 바로가기 `/market?symbol=X.NASDAQ`)
- `lib/api.ts` — `getGroqSummary()`, GroqStockPick/GroqSummaryResult
- `app/news/page.tsx` + `app/calendar/page.tsx` — 2컬럼 레이아웃 + 우측 요약 패널
- `components/news/NewsPanel.tsx` — `onHeadlinesLoaded` 콜백
- `app/forex/page.tsx` — Live Rates 탭(12쌍 히트맵, 60초 갱신, `/forex/overview`)
- `app/crypto/page.tsx` — 주식 페이지식 재구성: 검색/워크스페이스(차트+북)/통계 탭, 워치리스트 사이드바(localStorage), Markets/Chart/Book 탭 제거
- `app/insider/page.tsx` — US 자동 Recent 로드, KR 기업행위(무상/유상/소각) 분류 + DART 원문 링크
- `app/market/page.tsx` + `MarketWorkspace.tsx` — p-6 제거, 높이 100vh-96px (꽉 찬 레이아웃)
- `app/workflow/page.tsx` — 가로 진행 스테퍼 + 진행률 바 + 세로 타임라인 커넥터
- `autopilot/agent_loop.sh` — sleep 30분→4시간(장중)/2시간(장외), Claude 출력 한 문장 강제(헤더/표/이모지 금지)

### 미완료 (외부 의존성/거대 범위)
- IB WebSocket 실시간 (TWS 게이트웨이 필요)
- LangGraph 멀티에이전트 자율주문 (새 백엔드 인프라)

---

## Phase 40 — Hyperliquid Trading UI (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `seokminal-multi-venue/hyperliquid/trader.py` — importlib 기반 SDK 로딩 (로컬 패키지 섀도 우회), get_positions/place_order/cancel_order/close_position
- `api_server/main.py` — `GET /hl/positions`, `POST /hl/order`, `POST /hl/order/cancel`, `POST /hl/order/close` 엔드포인트
- `lib/api.ts` — HLAssetPosition/HLMarginSummary/HLOpenOrder/HLPositionsResponse 인터페이스 + 4개 API 함수
- `app/orders/page.tsx` — HL 탭 추가 (Venue="KR"|"US"|"HL"), HL 주문 폼 (코인/매수·매도/수량/시장·지정가/감소전용), 포지션 테이블 (크기/진입가/미실현PnL/청산가/Close 버튼), 미체결 주문 테이블 (Cancel 버튼)
- `.env` — `HL_PRIVATE_KEY=` placeholder 추가

### 변경된 파일
- `seokminal-multi-venue/hyperliquid/trader.py` (신규)
- `seokminal-multi-venue/api_server/main.py`
- `seokminal-multi-venue/.env`
- `seokminal-dashboard/lib/api.ts`
- `seokminal-dashboard/app/orders/page.tsx`

### 다음 할 일
- `.env`에 `HL_PRIVATE_KEY=<실제 키>` 설정 후 Hyperliquid 거래 테스트
- 필요시 거래소 페이지 별도 분리 (`/hl` 페이지)

---

## Phase 39 — Economic Calendar (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `api_server/main.py` — `GET /calendar/economic?week=this|next` (ForexFactory JSON 파싱, 10분 인메모리 캐시)
- `lib/api.ts` — `EconomicEvent` 인터페이스 + `getEconomicCalendar()` 함수
- `app/calendar/page.tsx` — 날짜별 그룹화, Impact/통화 필터, 실제값 색상 코딩 (예측 대비 good/bad)
- `components/dashboard/TodayEventsWidget.tsx` — Economic Calendar 섹션 실데이터 연결 (High/Medium upcoming)
- `lib/i18n-utils.ts` + `components/NavBar.tsx` — "경제 캘린더" 메뉴 추가

---

## Phase 38 — Toast + Alert Poller (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `lib/toast.ts` — 모듈 수준 pub/sub 토스트 스토어 (show/dismiss/subscribe)
- `components/ui/ToastContainer.tsx` — 우하단 고정 토스트 스택 (info/success/warn/error 색상)
- `components/AlertPoller.tsx` — 30초 폴링, 신규 alert 발생 시 `toast.show()` 트리거 (최초 로드 무시)
- `app/layout.tsx` — `<AlertPoller />` + `<ToastContainer />` 전역 추가

---

## Phase 37 — Insider Trading UI (openinsider 스타일) (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `insider/edgar_client.py` — `get_recent_form4_feed()` (EDGAR 전문 검색 + ThreadPoolExecutor XML 파싱)
- `insider/dart_client.py` — `get_recent_kr_insider_feed()` (OpenDART list.json + 병렬 elestock)
- `insider/__init__.py` — exports 업데이트
- `api_server/main.py` — `GET /insider/us/recent`, `GET /insider/kr/recent` 엔드포인트
- `lib/api.ts` — `getInsiderUSRecent()`, `getInsiderKRRecent()` 추가
- `app/insider/page.tsx` — 완전 재작성: 필터 바(기간/구분/최소금액/텍스트), US/KR 컬러코딩 테이블, 요약 바

---

## Phase 36 — Monte Carlo + Trade Analytics + Position Sizing (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `components/backtest/MonteCarloPanel.tsx` — SVG fan chart (P5/P25/P50/P75/P95), 5개 통계 카드
- `components/backtest/PositionSizingPanel.tsx` — Kelly/Half-Kelly/Fixed 사이즈 비교 테이블
- `components/backtest/TradeAnalyticsPanel.tsx` — PnL 히스토그램, 연속 승/패, 월별 PnL
- `app/backtest/page.tsx` — 3개 패널 single 모드 결과 후 렌더링

---

## Phase 35 — Walk-Forward Backtest (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `api_server/main.py` — `ns_to_date()` 헬퍼, `WalkForwardWindow/Summary/Response` 모델, `GET /backtest/walk-forward` (macd/rsi/xgb/ema_cross 지원)
- `tests/test_walk_forward.py` — 6개 테스트
- `lib/api.ts` — `WalkForwardWindow/Summary/Response` 인터페이스 + `getWalkForward()` 함수
- `components/backtest/WalkForwardPanel.tsx` — 윈도우 수 선택, 요약 통계, 최고 Sharpe 행 하이라이트

---

## Phase 34 — AI Advisor XGBoost Support (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `ai_strategy/advisor.py` — XGBoost 추천 전략 추가; trend_strength, volatility_pct 분석
- `app/ai-trader/page.tsx` — `STRATEGY_LABELS["xgb"]`, `STRATEGY_PARAMS_LABELS["xgb"]` 추가

---

## Phase 33 — Multi-Strategy Compare Panel (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `components/backtest/StrategyComparePanel.tsx` — 4전략 동시 실행 (Promise.allSettled), Sharpe 정렬
- `app/backtest/page.tsx` — single 모드 비교 패널 렌더링

---

## Phase 32 — KRX Market Tab + Build Fix (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `components/market/KRMarketsTab.tsx` — KOSPI/KOSDAQ/KRX 지수 일별 데이터 테이블
- `components/market/MarketWorkspace.tsx` — "KR" 탭 추가
- `app/backtest/page.tsx` — `useSearchParams()` Suspense 래핑 (프로덕션 빌드 fix)

---

## Phase 31 — Workflow Pipeline Connection (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `app/ai-trader/page.tsx` — `buildBacktestUrl()` 헬퍼, "Open Backtest →" URL 파라미터 전달
- `app/backtest/page.tsx` — URL 쿼리 파라미터로 폼 자동 채움, 백테스트 후 `updateWorkflow()` 호출

---

## Phase 30 — XGBoost ML Strategy (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `xgb_strategy/features.py` — RSI14, MACD diff, EMA12/26 ratio, mom5/10 피처 엔지니어링
- `xgb_strategy/model.py` — XGBClassifier 학습 (train_ratio 분할)
- `xgb_strategy/runner.py` — `generate_xgb_signals()`, 학습 구간은 HOLD
- `backtest_runner/simple_runner.py` — xgb 전략 dispatch 추가
- `api_server/main.py` — xgb 전략 + 파라미터 4개 추가
- `tests/test_xgb_strategy.py` — 8개 테스트

---

## Phase 29 — i18n + PageBanner + IB Placeholder (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `lib/i18n-utils.ts` — KO/EN/DE 번역 (nav 34개 + page 21개 title/desc)
- `lib/i18n.tsx` — LanguageProvider, useLanguage() 훅
- `components/LanguageSwitcher.tsx` — 한/EN/DE 버튼
- `components/PageBanner.tsx` — 페이지별 교육용 설명 배너 (21개 페이지)
- `components/live/IbRealtimeWidget.tsx` — IB 실시간 플레이스홀더

---

## Phase 28 — AI Trader MVP (2026-06-29) ✅ SHIPPED

### 완료된 작업
- `ai_strategy/advisor.py` — Claude Haiku 기반 `recommend_strategy()`
- `api_server/main.py` — `GET /ai/strategy-recommend`
- `app/ai-trader/page.tsx` — AI Strategy Advisor UI

---

## [이전 Phase 27~1 — progress.md 이전 버전 참조]

Phase 27 이전 내용: 위에 있던 progress.md 하단 참조 (Portfolio Backtest, Backtest v3, Live Strategy Monitor, Orders, Alerts, Risk, Backtesting v2 등 Phase 20~27 모두 완료됨)

---

## 다음 할 일

- IB WebSocket 실시간 연결 (IbRealtimeWidget 실제 구현)
- 워크플로우 페이지 시각적 개선
- progress.md 주기적 업데이트
