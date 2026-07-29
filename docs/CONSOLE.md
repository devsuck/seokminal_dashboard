# SEOKMIN·AI — Operations Console

트레이딩 앱을 **AI 헤지펀드 운영 콘솔**로 재구성한 프론트엔드. Bloomberg Terminal +
Palantir Foundry + JARVIS 톤의 Dark Institutional UI.

## 실행

```bash
# 1) 백엔드 (jarvis 거버넌스 + P8 집행 파이프라인 API)
cd ../seokminal_multi_venue
PYTHONPATH=. uvicorn api_server.main:app --host 0.0.0.0 --port 8000

# 2) 프론트엔드
cd seokminal_dashboard
npm install
npm run dev          # http://localhost:3010 (또는 3000)
```

프론트는 `NEXT_PUBLIC_API_URL`(없으면 `http://<hostname>:8000`)로 백엔드에 연결한다.

## 셸 구조

전 페이지가 **좌측 커맨드 레일** + institutional 팔레트를 공유한다 (`components/console/CommandRail.tsx`).
루트 레이아웃(`app/layout.tsx`)이 `console-shell` + 레일 + 스크롤 콘텐츠를 담당.

- **콘솔(거버넌스 OS) 5그룹** — 신규 라우트, `/console/*` 실데이터 연결
- **TERMINAL(레거시) 5그룹** — 기존 45개 트레이딩 페이지(기능 유지, 팔레트만 통일)

## 콘솔 라우트 맵 (신규)

| 그룹 | 라우트 | 데이터(`/console/*`) |
|---|---|---|
| — | `/command` | status · pipeline · regime · council |
| Intelligence | `/intel/research` · `/intel/market` · `/intel/knowledge` | research · market · knowledge |
| Quant Lab | `/quant/hypothesis` · `/quant/experiments`(Strategy DNA) · `/quant/backtests` · `/quant/validation` | experiments · strategies · validation |
| Portfolio OS | `/portfolio-os/allocation` · `/portfolio-os/risk` · `/portfolio-os/positions` | allocation · risk · positions |
| Execution | `/exec/orders` · `/exec/broker` · `/exec/monitor` | orders · broker · monitor |
| AI Council | `/council/agents` · `/council/decisions` · `/council/logs` | agents · council · logs |

## 백엔드 표면 (`api_server/console_api.py`, read-only)

`GET /console/{status,pipeline,regime,council,strategies,strategies/{id},experiments,
validation,agents,logs,knowledge,research,market,allocation,positions,risk,orders,broker,monitor}`

**모두 읽기전용 — 집행/주문/상태변경 없음.** jarvis 거버넌스 + P8 파이프라인 원장 집계.
데이터가 없으면 정직한 empty/CLOSED 반환(가짜 데이터 없음).

## 디자인 토큰

- 콘솔 스코프: `.console-shell { --c-bg #05070A · --c-panel #0A0F16 · --c-hud #22D3EE ... }`
- 전역 뉴트럴도 institutional로 이동(레거시 45페이지 일괄 재도색)
- 공용 위젯: `components/console/{primitives,widgets,GraphView}.tsx`
  (Panel · StatTile · StatusPill · DataTable · AgentTree · GraphView · useConsole 훅)

## 정직성 원칙

실데이터 전용. 값이 없으면 UNKNOWN/CLOSED로 정직하게 표시하고 절대 가짜로 채우지 않는다.
예) 라이브 자본 경계 CLOSED(autonomy<MIN_LIVE), 오픈 포지션 0, 시장 레짐 UNKNOWN
(대신 레지스트리 활성 전략에서 **Portfolio Posture**를 정직하게 파생).
