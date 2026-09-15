# 모바일 전용 핀테크 리디자인 — 설계 문서

## 배경

유저는 대시보드를 거의 데스크톱에서 안 보고 모바일로만 쓴다. "사이트를 다시
만드는 느낌으로" 요청 — 토스/로빈후드 같은 소비자 핀테크 앱 톤을 원함(다크
터미널이 아니라 라이트, 카드형, 여백 많은 UI). 홈 화면 최우선순위는 전체 계좌
성과 요약(그래프).

코드 조사 결과 두 가지가 이미 확보돼 있음:

1. **라이트 카드 토큰 시스템(`--color-ap-*`)이 이미 존재.** `2026-08-22-autopilot-light-redesign-design.md`에서 만들어짐 — 흰 배경(`#FAFAFB`/`#FFFFFF`), ink 텍스트, 브랜드 오렌지, up/down 시맨틱 색, `radius-ap-sm~xl`, `shadow-ap-sm/md`. `components/ui/Card.tsx`(`Card`/`CardHeader`)도 이 토큰으로 이미 구현됨. `/hud`, `/agents`(현재 삭제됨) 대상으로 시작했고, 이후 `2026-08-23-asset-class-home-design.md` 작업에서 `/portfolio`의 `AccountsTab`, `/hud`의 `PortfolioTab`(자산군별 3타일 요약 + 자산군별 수익률 차트)도 이 토큰으로 전환됨. `/performance`도 이미 ap- 토큰 사용.
2. **홈 후보 `/hud/summary`는 의도적으로 다크 유지 중.** 파일 자체 주석: `"ap-* 라이트 카드 계열은 이 앱 전역 다크쉘 위에서 흰 섬처럼 떠 보여(=오류로 오인) 쓰지 않음"`. 즉 지금 구조는 "다크 배경 위에 카드만 부분적으로 라이트"라 페이지 전체를 라이트로 못 바꿈.

**중요:** `--color-ap-*`는 `app/globals.css`의 최상위 `@theme` 블록에 직접
선언된 전역 토큰이라 `bg-ap-surface` 등 유틸리티 클래스는 뷰포트/스코프 무관하게
항상 라이트 값으로 렌더된다. `/hud`, `/portfolio`(AccountsTab), `/performance`가
이미 이 클래스를 쓴다는 건 **그 부분들은 데스크톱에서도 이미 라이트라는 뜻** —
"데스크톱은 다크 터미널 현상유지"는 현재 다크 토큰(`--color-bg/panel/...`,
`.console-shell`의 `--c-*`)을 쓰는 나머지 부분에만 해당한다. 이번 작업은 기존
라이트 컴포넌트를 어둡게 되돌리지 않는다 — 그대로 둔다.

## 스코프

**대상 라우트 (`CommandRail.tsx`의 `ALL_GROUPS` 기준 실제 네비게이션에 걸린 6개
+ 홈):**

| 라우트 | 현재 토큰 | 이번 작업 |
|---|---|---|
| `/hud/summary` (홈) | 다크 (`--color-*`) | **신규 모바일 홈 IA** — 전체 라이트 전환 |
| `/portfolio` | 혼재 (AccountsTab만 ap-, `OrdersTab`/`PnlTab`은 미확인) | 모바일 터치/레이아웃 감사 후 필요한 곳만 보정 |
| `/investment-os` | 다크 | 모바일 카드 마크업 신규 |
| `/performance` | ap- (이미 라이트) | 모바일 레이아웃 감사만 |
| `/research-os/validation` | 다크 | 모바일 카드 마크업 신규 |
| `/research-os/governance` | 다크 | 모바일 카드 마크업 신규 |
| `/research-os/chat` | 다크 | 모바일 카드 마크업 신규 |

**스코프 밖 (변경 안 함):**
- 데스크톱(`md:` 이상, `≥768px`) 렌더링 전부 — 다크든 이미 라이트든 그대로.
- `app/(console)/*` 아래 나머지 파일들(`council/`, `portfolio-os/`,
  `investment-os/ai-portfolio`, `investment-os/capital-claims`,
  `intel/research-os`, `quant/validation`, `exec/*`, `research-os/{committee,
  explain,intelligence-plus,graph,production,timeline}`) — 2026-08-21
  Research OS 4-shell 통합 이후 남은 307 리다이렉트 스텁. 실제 화면 아님,
  CommandRail에도 노출 안 됨.
- `app/overview`, `app/calendar`, `app/insider`, `app/auto-research`,
  `app/login` — 나브에 없는 라우트. 이번 패스 대상 아님.
- 백엔드 API, `lib/api.ts`의 데이터 페칭 로직 — 무변경, 그대로 재사용만.
- 다크→라이트 전면 통일이나 다크모드 토글 — 별도 후속 과제.

## 구현 패턴

각 대상 페이지의 최상위 컨테이너를 두 갈래로 분기한다:

```tsx
<>
  <div className="hidden md:block">{/* 기존 다크 마크업, 무변경 */}</div>
  <div className="md:hidden rail-ap min-h-screen bg-ap-bg">
    {/* 신규 모바일 마크업 */}
  </div>
</>
```

`.rail-ap`는 `CommandRail`이 이미 쓰는 기존 클래스(`app/globals.css:88-107`) —
`--c-*` 네임스페이스를 `--color-ap-*` 값으로 로컬 리맵한다. 새 스코프 클래스를
만들 필요 없음. 이미 `--color-ap-*` 유틸(`bg-ap-surface` 등)만 쓰는 페이지
(`/performance`, `/portfolio`의 AccountsTab)는 `.rail-ap` 래핑이 필수는
아니지만(이미 라이트 유틸만 써서 다크 잔여물 없음), 일관성을 위해 모바일
브랜치는 전부 이 패턴을 따른다.

데이터: 각 페이지 기존 훅/`lib/api.ts` 함수를 데스크톱·모바일 브랜치가
공유한다 — fetch 로직 복제 없음, JSX만 두 벌.

## 라우트별 상세

### `/hud/summary` (홈) — 신규 IA

우선순위 재배치. 현재는 "실거래 가동여부 배지 → 주의항목 리스트" 순.
새 구조(위→아래):

1. **계좌 성과 카드** (신규) — `Card`/`CardHeader` 재사용. 일/주/월 토글 +
   `lightweight-charts`(기존 의존성, 신규 설치 없음)로 누적 수익률 라인차트.
   데이터 소스: `components/hud/PortfolioTab.tsx`가 이미 계산하는 자산군별
   수익률 집계 로직을 재사용(그 컴포넌트를 그대로 렌더하거나, 그 파일이 쓰는
   fetch 함수를 홈에서도 호출 — 구현 계획 단계에서 `PortfolioTab.tsx` 전체를
   읽고 둘 중 마찰 적은 쪽 선택).
2. **자산군 요약 타일** (신규, 선택적으로 1과 통합) — `PortfolioTab`의 3타일
   (국내주식/해외주식/코인) 패턴 재사용.
3. **실거래 상태 배지** (기존 로직 이식) — `liveOn`/`liveLabel` 계산 그대로,
   시각만 라이트 카드로.
4. **주의 항목 리스트** (기존 `deriveAttentionItems` 결과 그대로) — 카드
   리스트로.

`useHudFeed` 훅은 그대로 재사용 — 새 데이터 페칭 없음.

### `/portfolio`, `/performance` — 감사 우선

이미 ap- 토큰이라 전면 재작성 대상 아님. 구현 계획 단계에서
`OrdersTab`/`PnlTab`(portfolio 나머지 2탭)이 다크 토큰인지 실제로 확인하고,
다크면 위와 같은 `md:hidden` 분기로 라이트 전환. 라이트인 부분은 터치 타겟
크기(버튼/탭 44px 최소)와 카드 간격만 모바일 기준으로 점검.

### `/investment-os`, `/research-os/{validation,governance,chat}` — 신규 카드화

각 페이지 현재 다크 마크업 구조를 파악한 뒤(구현 계획 단계), 동일 데이터를
`Card`/`CardHeader` 기반 카드 리스트로 재구성. 이 4개는 페이지별로 내용
성격이 다르므로(검증 파이프라인 상태, 거버넌스 로그, 챗) 공통 컴포넌트로
묶으려 하지 말고 각자 필요한 카드 형태로 개별 작성 — 억지 추상화 금지.

## 테스트/검증

- `npx tsc --noEmit` — 타입 에러 없음.
- `npm run build` — 빌드 통과.
- 자동화 시각 회귀 테스트 없음 — 레이아웃 산출물은 브라우저 devtools 모바일
  뷰포트(iPhone 12/SE 기준)로 각 라우트 직접 확인. 데스크톱(`md:` 이상)은
  분기 전후로 마크업이 동일해야 하므로 스크린샷 비교 없이 diff만으로 무변경
  확인 가능.
- 기존 백엔드/데이터 로직 무변경이므로 `pytest` 등 백엔드 테스트 영향 없음.

## Out of scope

- 다크모드 토글, 데스크톱 라이트 전환.
- 새 디자인 토큰 추가(기존 `--color-ap-*` 재사용으로 충분).
- PWA/오프라인 동작 변경(`PwaRegister`는 무변경).
- `/portfolio`의 주문/손익 탭 기능 변경(레이아웃 점검만, 기능 로직 무변경).
