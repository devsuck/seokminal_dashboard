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

**정정 (2026-08-23, 플랜 작성 중 발견):** 초안은 `app/portfolio/page.tsx`를 그렙만으로 훑고 "홈에 흡수 후 삭제"로 잘못 판단했음. 전체 745줄 정독 결과 이 페이지는 계좌현황 탭 외에 **주문(OMS 실주문 추적) / 손익(실현PnL 차트) / 최적화(서브라우트 링크)** 3개 탭을 더 갖고 있고, 이건 유저가 말한 불만("국내/해외/코인/폴리마켓 별로 안 나뉨")과 무관한 진짜 기능임. 삭제하면 관련 없는 기능을 날리는 것 → **`/portfolio` 라우트는 유지**, 계좌현황 탭만 통화축 → 자산군축으로 재편. 아래 §1~§3, §6은 정정된 버전.

## 변경 사항

### 1. `app/portfolio/page.tsx` 계좌현황(`AccountsTab`) 탭만 재편
현재 `CcySection`(USD/KRW/EUR/USDC 통화별)으로 묶는 걸 국내주식(KIS)/해외주식(Alpaca)/코인(HL)/폴리마켓(신규 카드) 4섹션으로 바꾼다. 국내주식·해외주식·코인 3섹션은 기존 `KISHoldings`/`AlpacaPositions`/`HLPositions` 인라인 컴포넌트를 그대로 재사용(통화 그룹 대신 자산군 그룹으로 배치만 변경 — 데이터 fetch 로직은 안 건드림). 폴리마켓 섹션은 신규: `getBuybackBot`(whale, `BuybackBot`), `getSharpWalletBotStatus`(`SharpWalletBotStatus`) 두 봇의 `realized_pnl` 합산 카드 + "`/polymarket`에서 자세히" 링크. 주문/손익/최적화 3개 탭은 무변경.

### 2. `/hud` PORTFOLIO 탭 → 요약 카드로 축소(전면교체 아님)
`components/hud/PortfolioTab.tsx`를 에이전트 중심(`listAgents`/`getAgentPerformance`) → 자산군 4타일 요약으로 재작성. 각 타일: 자산군명 + 합계 평가액 + 수익률, 클릭 시 국내/해외/코인은 `/portfolio`(계좌현황 탭)로, 폴리마켓은 `/polymarket`으로 이동. 상세 종목 리스트는 여기 안 넣음(그건 `/portfolio`가 이미 함) — 중복 데이터 fetch 로직 피하려고 §1에서 쓰는 것과 같은 API 재사용, 타일은 합계만 계산.

### 3. (삭제됨 — `/portfolio` 유지로 리다이렉트 불필요)

### 4. `/agents` 라우트 삭제
콘텐츠가 이미 죽어있고(에이전트 미가동), 자산별 AI 에이전틱 트레이딩이 향후 대체 예정이라 완전 삭제.

**정정 (2026-08-23, 플랜 작성 중 재발견):** "외부 진입 링크 없음"은 `PortfolioTab.tsx`만 grep한 결과였고 틀렸음. 전체 grep 결과 `/agents`를 가리키는 곳이 4곳 더 있음:
- `lib/researchOsRedirects.ts`의 `/calendar`, `/insider`, `/macro`, `/news` 4개 키 — 이미 죽은 구 라우트들의 리다이렉트 타겟이 `/agents`. `/agents` 삭제하면 이 4개 스텁이 404로 감.
- `components/AlertPoller.tsx:13`의 `linkFor()` 기본 분기(알 수 없는 botId → 에이전트 목록).
- `app/hud/page.tsx:165`의 `violationHref()` — `entity.startsWith("agent:")` 케이스.

처리: 위 4개 리다이렉트 타겟을 `/agents` → `/hud`로 교체. `AlertPoller.tsx` 기본 분기도 `/hud`로. `violationHref()`의 `agent:` 특수 케이스는 그냥 삭제(원래도 있던 default `return "/lab"`로 자연스럽게 떨어짐 — 코드 한 줄 삭제로 끝). 리다이렉트 스텁 자체는 여전히 불필요(`/agents`로 들어오는 북마크가 없다는 원래 판단은 유효 — 문제는 `/agents`가 다른 것들의 리다이렉트 *타겟*이었다는 점).

### 5. `/risk-guard` 라우트 삭제 → 설정 드로어로 축소
새 컴포넌트 `components/console/SettingsDrawer.tsx` 신설. `app/risk-guard/page.tsx`의 로직(킬스위치 토글, `RiskStatus` 표시, 30초 폴링)을 그대로 이식하되 페이지가 아닌 우측 슬라이드 드로어로. `app/layout.tsx`에 전역 마운트(CommandRail/BottomTabBar와 같은 레벨) — 페이지 상관없이 어디서든 열 수 있게. CommandRail 푸터와 BottomTabBar "더보기" 시트 양쪽에 ⚙ 트리거 추가. URL 라우트 없음(모달성 UI라 북마크 대상 아님) — 리다이렉트 스텁 불필요, 그냥 라우트 제거.

**정정(같은 grep에서 발견):** `lib/attention.ts`가 "리스크 차단 이벤트" 알림 카드의 href로 `/risk-guard`를 씀(`tests/lib/attention.test.ts`도 이 값 검증). 라우트 사라지면 이 링크도 죽음 — href를 `/hud`로 바꾼다(설정 드로어가 전역 마운트라 어느 페이지서든 ⚙로 접근 가능하니 홈으로 보내는 걸로 충분, 쿼리파라미터로 드로어 자동 오픈까지는 이번 스코프에서 안 함 — YAGNI).

### 6. 나브 정리
**CommandRail** — "트레이딩 데스크" 그룹의 포트폴리오 항목은 유지(라우트 안 죽으므로). "봇·에이전트" 그룹에서 에이전트/리스크가드 항목만 제거, 남는 항목(성과/DART오토파일럿/카피트레이딩/Polymarket)은 전략 상세 딥링크로 유지.

**BottomTabBar** — `PRIMARY_TABS`를 `[홈, 오더플로우, 포트폴리오, Research OS(→/research-os/pipeline)]`로 교체(기존 `[홈, 오더플로우, 포트폴리오, 에이전트]`에서 에이전트 자리만 Research OS로 대체 — 포트폴리오는 유지, 유저가 리서치를 primary 노출로 원함). 설정(⚙, 리스크가드 이식)은 "더보기" 시트에 추가.

## 터치 파일

- 재작성: `components/hud/PortfolioTab.tsx` (에이전트 중심 → 자산군 4타일 요약)
- 수정: `app/portfolio/page.tsx`의 `AccountsTab()`만 (통화축 → 자산군축, 폴리마켓 카드 추가) — 주문/손익/최적화 탭 무변경
- 신규: `components/console/SettingsDrawer.tsx` (`app/risk-guard/page.tsx` 로직 이식)
- 완전 삭제: `app/agents/page.tsx`, `app/risk-guard/page.tsx`
- 수정: `components/console/CommandRail.tsx`(에이전트/리스크가드 항목 제거 + ⚙ 트리거 추가), `components/console/BottomTabBar.tsx`(에이전트→Research OS 교체, 더보기 시트에 ⚙ 트리거 추가)
- 수정: `app/layout.tsx` (`SettingsDrawer` 전역 마운트)
- 수정(죽는 `/agents` 링크 정리): `lib/researchOsRedirects.ts`(calendar/insider/macro/news 4개 키의 타겟을 `/agents`→`/hud`), `components/AlertPoller.tsx`(기본 분기 href `/agents`→`/hud`), `app/hud/page.tsx`(`violationHref()`의 `agent:` 특수 케이스 삭제), `lib/attention.ts`(리스크 알림 href `/risk-guard`→`/hud`)
- 수정(테스트, 위 변경 따라감): `__tests__/researchOsRedirects.test.ts`, `tests/lib/commandRailGroups.test.ts`, `tests/lib/attention.test.ts`

## 에러 처리 / 테스트

기존 패턴 그대로: AbortController abort→create→assign ref→fetch→catch AbortError→finally guard→unmount cleanup (CLAUDE.md 컨벤션). 각 자산군 섹션은 독립적으로 로딩/에러 상태 가짐 — 한 벤더(예: KIS) API 실패해도 다른 섹션은 정상 렌더. `npx tsc --noEmit` + `npm test` 통과 필수. 브라우저로 `/hud`(4타일 요약), `/portfolio`(계좌현황 자산군 재편 + 주문/손익/최적화 탭 정상 동작 확인), `/agents`(존재 안 함 확인) 스팟체크.

## 스코프 밖 (Project B로 분리)

Research OS의 pipeline/validation/governance/chat 4페이지 플로우를 "승인 1회 → 자동 백테스트 → 자동 페이퍼" 단일 플로우로 재설계하는 작업은 별도 스펙/플랜으로 진행.
