# research-os 그룹 4개 셸 통합 — Design Spec

**Status:** 사용자 승인 완료(범위: "기능,UX끼리 묶어서 최소 페이지로" → 4개로 합쳐서 확정, 스펙 작성 지시).

## Goal

`app/(console)/research-os/*` 하위 16개 독립 page.tsx(그중 3개는 CommandRail 나브에서 빠진 고아 라우트) → investment-os 5탭 셸 패턴을 그대로 재사용해 **4개 nav 항목**으로 축소. 백엔드 변경 없음, 기존 API 100% 재사용, 기존 라우트는 리다이렉트로 보존(딥링크 안 깨짐).

## 그룹 매핑

| 신규 nav | 라우트 | 편입 페이지(구 라우트) | 성격 |
|---|---|---|---|
| **1. 연구 파이프라인** | `/research-os/pipeline` | workflow, discovery, strategy-generation, strategy-lab, agents, brain, cockpit, console (8) | 아이디어 생성→후보화 흐름 + 시스템 상태. `workflow`(세션 생성/일시정지/재개/보관)가 유일한 write 서브탭. |
| **2. 검증·실전준비** | `/research-os/validation` | validation, production, intelligence-plus (3, 전부 고아 라우트였음) | 배포 전 게이트류, read-only. |
| **3. 거버넌스·설명가능성** | `/research-os/governance` | committee, explain, graph, timeline (4) | 의사결정 리뷰/설명/지식그래프/이력, read-only. |
| **4. 어시스턴트** | `/research-os/chat` | chat (1, 라우트 불변) | 대화형 UX라 탭 패널 구조 부적합, 독립 유지. |

시스템 상태 4페이지(agents/brain/cockpit/console)를 별도 "모니터링" 셸로 안 빼고 파이프라인에 합친 이유: nav 항목 4개 제약을 맞추기 위한 명시적 선택(사용자 확정). 교차축 성격은 남지만, 탭 하나 안에서 언제든 전환 가능하므로 실사용 임팩트는 없음.

## 아키텍처

핵심 결정: **백엔드/데이터훅 변경 없음.** 각 신규 셸은 investment-os(`app/(console)/investment-os/page.tsx`)가 이미 쓰는 패턴 그대로 이식:

```ts
type TabKey = "workflow" | "discovery" | "strategy-generation" | "strategy-lab" | "agents" | "brain" | "cockpit" | "console";
const TABS: { key: TabKey; label: string }[] = [...];
const searchParams = useSearchParams();
const [tab, setTab] = useState<TabKey>(TABS.some(t => t.key === searchParams.get("tab")) ? ... : "workflow");
useEffect(() => { const t = searchParams.get("tab"); if (TABS.some(x => x.key === t)) setTab(t as TabKey); }, [searchParams]);

const workflow = useTabFetch(tab === "workflow", (sig) => getResearchWorkflow(sig));
const discovery = useTabFetch(tab === "discovery", (sig) => getAutonomousResearch(sig));
// ... 이하 동일 패턴, 기존 8개 page.tsx의 fetch 호출을 그대로 옮김
```

각 서브탭의 JSX 본문(Panel/StatTile/Badge 구성)은 기존 page.tsx에서 **그대로 이동** — 로직 재작성 없음, 컴포넌트 트리만 탭 조건부 렌더로 감쌈. `workflow` 서브탭의 `sessionAction` 호출부(유일한 mutation)도 동일하게 이식.

각 셸 파일:
- `app/(console)/research-os/pipeline/page.tsx` (신규, 8탭)
- `app/(console)/research-os/validation/page.tsx` (신규, 3탭)
- `app/(console)/research-os/governance/page.tsx` (신규, 4탭)
- `app/(console)/research-os/chat/page.tsx` (기존 유지, 무변경)

## 구 라우트 리다이렉트

기존 16개 라우트 중 13개(chat 제외)는 `page.tsx`를 `redirect()` 한 줄로 교체 — Next.js App Router `redirect` (next/navigation), 서버 컴포넌트로 전환:

```ts
// app/(console)/research-os/workflow/page.tsx
import { redirect } from "next/navigation";
export default function Redirect() { redirect("/research-os/pipeline?tab=workflow"); }
```

매핑표(구→신):

| 구 라우트 | 신 라우트 |
|---|---|
| `/research-os/workflow` | `/research-os/pipeline?tab=workflow` |
| `/research-os/discovery` | `/research-os/pipeline?tab=discovery` |
| `/research-os/strategy-generation` | `/research-os/pipeline?tab=strategy-generation` |
| `/research-os/strategy-lab` | `/research-os/pipeline?tab=strategy-lab` |
| `/research-os/agents` | `/research-os/pipeline?tab=agents` |
| `/research-os/brain` | `/research-os/pipeline?tab=brain` |
| `/research-os/cockpit` | `/research-os/pipeline?tab=cockpit` |
| `/research-os/console` | `/research-os/pipeline?tab=console` |
| `/research-os/validation` | `/research-os/validation?tab=validation` |
| `/research-os/production` | `/research-os/validation?tab=production` |
| `/research-os/intelligence-plus` | `/research-os/validation?tab=intelligence-plus` |
| `/research-os/committee` | `/research-os/governance?tab=committee` |
| `/research-os/explain` | `/research-os/governance?tab=explain` |
| `/research-os/graph` | `/research-os/governance?tab=graph` |
| `/research-os/timeline` | `/research-os/governance?tab=timeline` |

`/research-os/chat`은 변경 없음(그대로 존속, 리다이렉트 대상 아님).

## CommandRail.tsx 변경

기존 `CONSOLE_GROUPS`의 "Research · 모니터링" / "Research · 파이프라인" / "Research · 거버넌스" / "Research · 랩" 4개 그룹에 흩어진 13개 항목(+고아 3개 미노출)을 단일 그룹 "Research OS"의 4개 항목으로 교체:

```ts
{ title: "Research OS", items: [
  { href: "/research-os/pipeline", label: "파이프라인" },
  { href: "/research-os/validation", label: "검증·실전준비" },
  { href: "/research-os/governance", label: "거버넌스" },
  { href: "/research-os/chat", label: "어시스턴트" },
]}
```

## 데이터 흐름·에러 처리

- 각 셸은 investment-os와 동일하게 `useTabFetch(enabled, fetcher)` 훅으로 활성 탭만 fetch — 비활성 탭은 요청 자체가 안 나감(투자OS에서 검증된 패턴 그대로).
- AbortController 컨벤션(abort→create→assign ref→fetch→catch AbortError→finally guard→unmount cleanup) 100% 승계, 신규 로직 없음.
- 탭 전환 시 `router.push`로 `?tab=` 갱신(investment-os와 동일), 브라우저 뒤로가기로 탭 복원 가능.

## 경계 확인

`jarvis/investment_os/separation.py::validate_separation()` — 이번 작업은 프론트 라우팅/nav 재구성만, Research OS 원장을 Investment OS가 읽거나 쓰는 코드 경로 추가 없음. 백엔드 무변경이므로 경계 위반 리스크 없음.

## 테스트

- `npx tsc --noEmit` — 신규/삭제 페이지 타입 체크.
- 리다이렉트 매핑은 상수 객체(`OLD_TO_NEW: Record<string,string>`)로 뽑아 `__tests__/researchOsRedirects.test.ts`에서 15개 항목 전수 assert(순수 데이터 검증, 유닛테스트로 충분 — 실제 `redirect()` 호출은 Next.js 런타임이라 유닛테스트 대상 아님).
- 각 셸 4개 + chat, 총 5개 페이지를 브라우저로 직접 열어 탭 전환·데이터 렌더·`workflow` 탭의 세션 액션 버튼 동작 수동 확인(GIF 불필요, 스크린샷 1~2장으로 충분).
- 백엔드 변경 없음 → `pytest` 영향 없음.

## Out of Scope

- 지난 대화에서 확인한 백엔드 라우트 58개(프론트 fetcher 자체 없음) 노출 확대 — 의도적으로 API-only 유지, 이번 스펙 대상 아님.
- `lib/console-api.ts`의 죽은 fetcher 11개(`getConsoleStatus` 등) 정리 — 별도 후속 작업.
- investment-os 쪽 5탭 구조 자체 변경 — 이번엔 research-os만.
- `chat` 페이지 내부 로직/UI 변경 — 라우트·내용 그대로, nav 라벨만 변경.
