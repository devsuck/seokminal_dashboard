# 자산군 홈 재구조 (Project A) — 설계 문서

**배경:** 대시보드 나브가 도구/전략 단위 flat 라우트 14개로 쪼개져 있어 미니멀함이 없고, `/hud`의 PORTFOLIO 탭은 에이전트(`listAgents`) 중심인데 에이전트들이 현재 전부 안 돌아가고 있어 죽은 데이터를 보여준다. 유저는 Autopilot류 앱처럼 자산군(국내주식/해외주식/코인/폴리마켓) 단위로 보유종목·수익률을 보여주는 홈을 원한다. Research OS는 별도 메뉴로 유지(내부 플로우 단순화는 Project B, 별도 스펙). 죽은 `/agents`는 삭제. `/risk-guard`는 독립 페이지 없애고 설정으로 축소.

**스코프:** 나브 구조 + 홈(포트폴리오) 뷰 재구성. Research OS 내부 플로우, 백엔드 데이터 소스 자체는 변경 없음(기존 API 재사용만).

## 자산군 매핑 (가정 — 코드에 명시적 라벨 없어 API 엔드포인트/코멘트로 추정)

| 자산군 | 보유종목 소스 | 연결 전략봇 |
|---|---|---|
| 국내주식 | KIS 보유종목(mock/live) — `app/portfolio/page.tsx`의 `KISHoldings` | dart-auto (`/dart/auto/*`, 한국 공시 기반) |
| 해외주식 | Alpaca 보유종목 — `app/portfolio/page.tsx`의 `AlpacaPosition` | copytrade(`/copytrade/*`, ticker 기반), vrp(`/vrp/*`, 아이언콘도어 옵션) |
| 코인 | Hyperliquid 포지션 — `app/portfolio/page.tsx`의 `HLAssetPosition` | (없음 — HL은 수동/봇 없음) |
| 폴리마켓 | whale/sharp-wallet 봇 realized_pnl — `app/polymarket/page.tsx`의 `bot`/`swBot` | mlb(`mlb_specialist_consensus`, polymarket 위 스포츠 예측) |

이 매핑이 틀렸으면(특히 copytrade/vrp가 해외주식이 아니면) 구현 전 정정 필요.

## 변경 사항

### 1. `/hud` PORTFOLIO 탭 전면 교체
`components/hud/PortfolioTab.tsx`를 에이전트 중심 → 자산군 4섹션으로 재작성. 각 섹션: 헤더(합계 평가액 + 수익률, 접힘 기본) → 펼치면 종목별 상세 + 연결 전략봹 상태 한 줄(예: "dart-auto: 가동중, 오늘 +1.2%"). 데이터 fetch는 기존 `app/portfolio/page.tsx`가 이미 하던 것(KIS/HL/Alpaca 잔고 API) + `app/polymarket/page.tsx`가 하던 봇 상태 API를 그대로 재사용.

### 2. 보유종목 컴포넌트 공용화
`app/portfolio/page.tsx`의 `KISHoldings`, Hyperliquid 포지션 인라인, Alpaca 포지션 인라인을 `components/portfolio/`(신규 디렉토리)로 옮겨 `PortfolioTab.tsx`와 (삭제 전까지는) `app/portfolio/page.tsx` 양쪽에서 재사용 가능하게 한다. 최종적으로 `app/portfolio/page.tsx`는 삭제되므로 이 컴포넌트들의 유일한 소비자는 `PortfolioTab.tsx`가 된다.

### 3. `/portfolio` 라우트 삭제 → 리다이렉트 스텁
기존 컨벤션(`lib/researchOsRedirects.ts`의 `OLD_TO_NEW` 맵 + `redirect()` 스텁 페이지) 그대로 따른다. `OLD_TO_NEW["/portfolio"] = "/hud?tab=portfolio"` 추가.

### 4. `/agents` 라우트 삭제
콘텐츠가 이미 죽어있고(에이전트 미가동), 자산별 AI 에이전틱 트레이딩이 향후 대체 예정이라 완전 삭제. 외부 진입 링크 없음(grep 확인 완료, 유일한 참조는 `PortfolioTab.tsx:150`이며 이 파일 자체가 이번 재작성 대상이라 자동 제거됨). 리다이렉트 스텁 불필요.

### 5. `/risk-guard` 라우트 삭제 → 설정 드로어로 축소
새 컴포넌트 `components/console/SettingsDrawer.tsx` 신설. `app/risk-guard/page.tsx`의 로직(킬스위치 토글, `RiskStatus` 표시, 30초 폴링)을 그대로 이식하되 페이지가 아닌 우측 슬라이드 드로어로. CommandRail(데스크탑)과 BottomTabBar(모바일) 양쪽에 ⚙ 아이콘 트리거 추가. URL 라우트 없음(모달성 UI라 북마크 대상 아님) — 리다이렉트 스텁도 불필요, 그냥 라우트 제거.

### 6. 나브 정리
**CommandRail** — "트레이딩 데스크" 그룹에서 포트폴리오 항목 제거(홈에 흡수). "봇·에이전트" 그룹에서 에이전트/리스크가드 항목 제거, 남는 항목(성과/DART오토파일럿/카피트레이딩/Polymarket)은 전략 상세 딥링크로 유지 — 홈 섹션의 "자세히 보기" 링크가 여기로 연결.

**BottomTabBar** — `PRIMARY_TABS`를 `[홈, 오더플로우, Research OS(→/research-os/pipeline), 더보기]`로 교체(기존 `[홈, 오더플로우, 포트폴리오, 에이전트]`에서 포트폴리오·에이전트 자리를 Research OS + 설정 아이콘으로 대체 — 유저가 리서치를 primary 노출로 원함).

## 터치 파일

- 재작성: `components/hud/PortfolioTab.tsx`
- 신규: `components/portfolio/KISHoldings.tsx`, `components/portfolio/HLPositions.tsx`, `components/portfolio/AlpacaPositions.tsx` (기존 `app/portfolio/page.tsx`에서 추출)
- 신규: `components/console/SettingsDrawer.tsx`
- 삭제 후 리다이렉트 스텁: `app/portfolio/page.tsx`
- 완전 삭제: `app/agents/page.tsx`, `app/risk-guard/page.tsx`
- 수정: `lib/researchOsRedirects.ts`(`/portfolio` 항목 추가), `components/console/CommandRail.tsx`, `components/console/BottomTabBar.tsx`

## 에러 처리 / 테스트

기존 패턴 그대로: AbortController abort→create→assign ref→fetch→catch AbortError→finally guard→unmount cleanup (CLAUDE.md 컨벤션). 각 자산군 섹션은 독립적으로 로딩/에러 상태 가짐 — 한 벤더(예: KIS) API 실패해도 다른 섹션은 정상 렌더. `npx tsc --noEmit` + `npm test` 통과 필수. 브라우저로 `/hud`, `/hud?tab=portfolio`, 삭제된 `/portfolio`(리다이렉트 확인), `/agents`(404 또는 존재 안 함 확인) 스팟체크.

## 스코프 밖 (Project B로 분리)

Research OS의 pipeline/validation/governance/chat 4페이지 플로우를 "승인 1회 → 자동 백테스트 → 자동 페이퍼" 단일 플로우로 재설계하는 작업은 별도 스펙/플랜으로 진행.
