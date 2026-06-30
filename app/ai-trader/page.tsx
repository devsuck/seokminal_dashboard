"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import {
  getAlpacaAccount, getAlpacaPositions, getAlpacaOrders,
  startAutopilotTerminal, sendChatMessage, getChatPane, getClaudeUsage,
  type AlpacaAccount, type AlpacaPosition, type AlpacaOrder, type ClaudeUsageResponse,
} from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = "user" | "assistant";
interface ChatMsg { id: string; role: Role; content: string; }

// ── Progress detection ────────────────────────────────────────────────────────

function detectProgress(content: string): number {
  if (content.includes("HANDOFF_COMPLETE")) return 100;
  if (content.includes("STEP 7") || content.includes("reflect")) return 95;
  if (content.includes("STEP 6") || content.includes("order.sh")) return 82;
  if (content.includes("STEP 5") || content.includes("3가지 관점")) return 68;
  if (content.includes("STEP 4") || content.includes("screen_stocks")) return 52;
  if (content.includes("STEP 3") || content.includes("market-overview")) return 38;
  if (content.includes("STEP 2") || content.includes("portfolio.sh")) return 25;
  if (content.includes("STEP 1") || content.includes("memory.py read")) return 14;
  if (content.includes("Cycle #") || content.includes("SEOKMINAL AGENT")) return 5;
  return 2;
}

// Strip terminal chrome, keep only Claude's real prose
const CRUFT_RE = /[│─━╰╭╯╮├└┘┐┌▐▌▛▜▝▘▟▙▗▖❯⏺◆·←→▞▟]/;
const NOISE_RE = /^\s*(❯|⏺|✓|✗|Read|Write|Bash|Tool|\?|\(ctrl|new message|Sonnet|Claude Pro|Organization|What|Fixed|Added|release|for shortcuts|~\/)/i;
const SEP_RE = /^[-─━═─*]{4,}$|^\[Cycle\s*#/;

function filterLines(lines: string[]): string[] {
  return lines.filter(l => {
    const t = l.trim();
    if (!t || t.length < 4) return false;
    if (CRUFT_RE.test(t)) return false;
    if (NOISE_RE.test(t)) return false;
    return true;
  });
}

function splitIntoBubbles(lines: string[]): string[] {
  const clean = filterLines(lines);
  const bubbles: string[] = [];
  let current: string[] = [];

  for (const line of clean) {
    if (SEP_RE.test(line.trim())) {
      const t = current.join("\n").trim();
      if (t) bubbles.push(t);
      current = [];
      continue; // don't include separator in content
    }
    current.push(line);
  }
  const t = current.join("\n").trim();
  if (t) bubbles.push(t);
  return bubbles.filter(b => b.trim().length > 0);
}

// ── Progress Arc ──────────────────────────────────────────────────────────────

function ProgressArc({ pct }: { pct: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
      {/* Track */}
      <circle cx="28" cy="28" r={r} fill="none" stroke="#242A35" strokeWidth="4" />
      {/* Arc */}
      <circle
        cx="28" cy="28" r={r}
        fill="none" stroke="#FF9F1C" strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 28 28)"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
      {/* Percentage text */}
      <text x="28" y="32" textAnchor="middle" fill="#FF9F1C" fontSize="10"
        fontFamily="'IBM Plex Mono', monospace" fontWeight="600">
        {pct}%
      </text>
    </svg>
  );
}

// ── Token Usage Bars ─────────────────────────────────────────────────────────

function TokenBar({ label, used, cap }: { label: string; used: number; cap: number }) {
  const pct = Math.min(100, (used / cap) * 100);
  const barColor = pct > 80 ? "#ef4444" : pct > 50 ? "#f59e0b" : "#22c55e";
  return (
    <div className="w-full">
      <div className="flex justify-between mb-0.5">
        <span className="text-[9px] text-text-3">{label}</span>
        <span className="text-[9px] text-text-3 font-data">{used >= 1000 ? `${(used / 1000).toFixed(0)}K` : used}</span>
      </div>
      <div className="w-full h-1.5 bg-panel-2 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor, transition: "width 1s ease" }} />
      </div>
    </div>
  );
}

function ClaudeTokenBars({ usage }: { usage: ClaudeUsageResponse | null }) {
  if (!usage) return (
    <div className="w-full px-3 space-y-2">
      <div className="text-[9px] text-text-3 uppercase tracking-wider text-center">Claude 토큰 사용량</div>
      <div className="text-[9px] text-text-3 text-center">—</div>
    </div>
  );
  return (
    <div className="w-full px-3 space-y-2">
      <div className="text-[9px] text-text-3 uppercase tracking-wider text-center mb-1">Claude 토큰 사용량</div>
      <TokenBar label="일간" used={usage.daily.total} cap={usage.daily_cap} />
      <TokenBar label="주간" used={usage.weekly.total} cap={usage.weekly_cap} />
    </div>
  );
}

// ── SVG Character ─────────────────────────────────────────────────────────────

function SeokminalCharacter({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 180 340" width="160" height="300" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="90" cy="336" rx="48" ry="6" fill="#000" opacity="0.3" />
      <path d="M 42 195 L 32 328 L 148 328 L 138 195 Q 90 208 42 195 Z" fill="#1a2340" />
      <path d="M 73 200 L 63 242 L 90 252 Z" fill="#242A35" />
      <path d="M 107 200 L 117 242 L 90 252 Z" fill="#242A35" />
      <path d="M 78 200 L 74 218 L 90 224 L 106 218 L 102 200 Z" fill="#E6EAF0" />
      <path d="M 84 202 L 82 260 L 90 266 L 98 260 L 96 202 Z" fill="#FF9F1C" />
      <polygon points="84,199 96,199 93,203 87,203" fill="#E08010" />
      <path d="M 42 200 L 14 268 Q 8 280 16 284 L 48 230 Z" fill="#1a2340" />
      <ellipse cx="14" cy="287" rx="11" ry="9" fill="#FBBF93" />
      <path d="M 138 200 L 165 264 Q 171 276 163 280 L 132 230 Z" fill="#1a2340" />
      <ellipse cx="165" cy="283" rx="11" ry="9" fill="#FBBF93" />
      <rect x="148" y="268" width="38" height="28" rx="3" fill="#0F131A" stroke="#FF9F1C" strokeWidth="1.5" />
      <polyline points="152,291 157,282 163,286 168,276 174,279 180,272"
        stroke="#22C55E" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="80" y="175" width="20" height="24" rx="5" fill="#FBBF93" />
      <ellipse cx="90" cy="126" rx="54" ry="57" fill="#FBBF93" />
      <path d="M 36 106 Q 36 56 90 54 Q 144 56 144 106 Q 126 76 90 78 Q 54 76 36 106 Z" fill="#2D1B00" />
      <ellipse cx="36" cy="134" rx="8" ry="13" fill="#F5A87A" />
      <ellipse cx="144" cy="134" rx="8" ry="13" fill="#F5A87A" />
      <circle cx="72" cy="130" r="19" stroke="#1A1A2E" strokeWidth="4.5" fill="rgba(100,180,255,0.07)" />
      <circle cx="108" cy="130" r="19" stroke="#1A1A2E" strokeWidth="4.5" fill="rgba(100,180,255,0.07)" />
      <line x1="91" y1="130" x2="89" y2="130" stroke="#1A1A2E" strokeWidth="3.5" />
      <line x1="53" y1="126" x2="36" y2="118" stroke="#1A1A2E" strokeWidth="3" strokeLinecap="round" />
      <line x1="127" y1="126" x2="144" y2="118" stroke="#1A1A2E" strokeWidth="3" strokeLinecap="round" />
      <circle cx="72" cy="130" r="9" fill="#1A1A2E" />
      <circle cx="75" cy="127" r="3" fill="white" />
      <circle cx="108" cy="130" r="9" fill="#1A1A2E" />
      <circle cx="111" cy="127" r="3" fill="white" />
      <path d="M 56 112 Q 72 107 87 112" stroke="#2D1B00" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M 93 112 Q 108 107 124 112" stroke="#2D1B00" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M 90 146 Q 86 156 90 160 Q 94 156 90 146" fill="#F5A87A" />
      <path d="M 78 172 Q 90 183 102 172" stroke="#C0785A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <ellipse cx="58" cy="152" rx="9" ry="7" fill="#FF8080" opacity="0.35" />
      <ellipse cx="122" cy="152" rx="9" ry="7" fill="#FF8080" opacity="0.35" />
      {active && (
        <g>
          <circle cx="152" cy="88" r="4" fill="#FF9F1C" opacity="0.5">
            <animate attributeName="opacity" values="0.5;1;0.5" dur="1.2s" repeatCount="indefinite" />
          </circle>
          <circle cx="162" cy="72" r="6" fill="#FF9F1C" opacity="0.65">
            <animate attributeName="opacity" values="0.65;1;0.65" dur="1.2s" begin="0.2s" repeatCount="indefinite" />
          </circle>
          <circle cx="174" cy="54" r="9" fill="#FF9F1C" opacity="0.8">
            <animate attributeName="opacity" values="0.8;1;0.8" dur="1.2s" begin="0.4s" repeatCount="indefinite" />
          </circle>
        </g>
      )}
    </svg>
  );
}

// ── Chat Bubbles ──────────────────────────────────────────────────────────────

const mdComponents = {
  p: ({ children }: { children: React.ReactNode }) => (
    <p className="text-text-1 text-sm leading-relaxed mb-1.5 last:mb-0">{children}</p>
  ),
  strong: ({ children }: { children: React.ReactNode }) => (
    <strong className="text-accent font-semibold">{children}</strong>
  ),
  em: ({ children }: { children: React.ReactNode }) => (
    <em className="text-text-2 italic">{children}</em>
  ),
  ul: ({ children }: { children: React.ReactNode }) => (
    <ul className="list-none space-y-0.5 my-1">{children}</ul>
  ),
  ol: ({ children }: { children: React.ReactNode }) => (
    <ol className="list-decimal list-inside space-y-0.5 my-1 text-text-1 text-sm">{children}</ol>
  ),
  li: ({ children }: { children: React.ReactNode }) => (
    <li className="text-text-1 text-sm flex gap-1.5 items-start before:content-['·'] before:text-accent before:shrink-0 before:mt-px">{children}</li>
  ),
  code: ({ children }: { children: React.ReactNode }) => (
    <code className="bg-panel-2 text-accent text-[11px] px-1 py-0.5 rounded font-data">{children}</code>
  ),
  h1: ({ children }: { children: React.ReactNode }) => (
    <p className="text-text-1 text-sm font-semibold mb-1">{children}</p>
  ),
  h2: ({ children }: { children: React.ReactNode }) => (
    <p className="text-text-1 text-sm font-semibold mb-1">{children}</p>
  ),
  h3: ({ children }: { children: React.ReactNode }) => (
    <p className="text-text-2 text-xs font-semibold uppercase tracking-wider mb-0.5">{children}</p>
  ),
  hr: () => null,
};

function AssistantBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[78%] bg-panel border-l-2 border-accent rounded-2xl rounded-bl-sm px-4 py-2.5">
        <span className="text-accent text-[10px] font-semibold block mb-1.5 uppercase tracking-wider">Mr. Seokminal</span>
        <ReactMarkdown components={mdComponents as never}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[78%] bg-panel-2 border border-border rounded-2xl rounded-br-sm px-4 py-2.5 text-sm text-text-1 leading-relaxed whitespace-pre-wrap break-words">
        {content}
      </div>
    </div>
  );
}

function StreamingBubbles({ bubbles }: { bubbles: string[] }) {
  if (bubbles.length === 0) {
    return (
      <div className="flex justify-start">
        <div className="bg-panel border-l-2 border-accent rounded-2xl rounded-bl-sm px-4 py-3">
          <span className="text-accent text-[10px] font-semibold block mb-1.5 uppercase tracking-wider">Mr. Seokminal</span>
          <div className="flex gap-1.5 items-center h-4">
            {[0, 150, 300].map(d => (
              <span key={d} className="w-2 h-2 rounded-full bg-accent inline-block"
                style={{ animation: `bounce 1s ${d}ms infinite` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {bubbles.map((b, i) => (
        <div key={i} className="flex justify-start">
          <div className="max-w-[78%] bg-panel border-l-2 border-accent rounded-2xl rounded-bl-sm px-4 py-2.5">
            <span className="text-accent text-[10px] font-semibold block mb-1.5 uppercase tracking-wider">Mr. Seokminal</span>
            <ReactMarkdown components={mdComponents as never}>{b}</ReactMarkdown>
          </div>
        </div>
      ))}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const GREETING: ChatMsg = {
  id: "greeting",
  role: "assistant",
  content: "안녕하세요 석훈님! 오늘도 출근했습니다.\n\n자율 에이전트 가동 중입니다. 시황 확인 → 포트폴리오 → 종목 스크리닝 → 분석 → 매매 순으로 자동 진행합니다.\n\n아래에서 에이전트 진행 상황을 실시간으로 확인하세요. 직접 지시가 필요하면 언제든 입력하세요.",
};

export default function AITraderPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [streamBubbles, setStreamBubbles] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  const [account, setAccount] = useState<AlpacaAccount | null>(null);
  const [positions, setPositions] = useState<AlpacaPosition[]>([]);
  const [orders, setOrders] = useState<AlpacaOrder[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tokenUsage, setTokenUsage] = useState<ClaudeUsageResponse | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const logPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLinesRef = useRef<string>("");
  const stableRef = useRef<number>(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamBubbles, isActive]);

  const loadData = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const [acc, pos, ord] = await Promise.all([
        getAlpacaAccount(ctrl.signal),
        getAlpacaPositions(ctrl.signal),
        getAlpacaOrders(ctrl.signal),
      ]);
      setAccount(acc); setPositions(pos); setOrders(ord); setLoadError(null);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // Passive log poll — shows agent output automatically
  const startLogPoll = useCallback(() => {
    lastLinesRef.current = "";

    async function poll() {
      try {
        const data = await getChatPane();
        const content = data.lines.join("\n");
        if (content && content !== lastLinesRef.current) {
          lastLinesRef.current = content;
          const bubbles = splitIntoBubbles(data.lines);
          setStreamBubbles(bubbles);
          setProgress(detectProgress(content));
          setIsActive(true);
        }
      } catch { /* ignore */ }
      logPollRef.current = setTimeout(poll, 1500);
    }
    logPollRef.current = setTimeout(poll, 3000);
  }, []);

  useEffect(() => {
    startAutopilotTerminal().catch(() => {});
    loadData();
    startLogPoll();
    getClaudeUsage().then(setTokenUsage).catch(() => {});
    const iv = setInterval(loadData, 30_000);
    const usageIv = setInterval(() => getClaudeUsage().then(setTokenUsage).catch(() => {}), 300_000);
    return () => {
      clearInterval(iv);
      clearInterval(usageIv);
      abortRef.current?.abort();
      if (logPollRef.current) clearTimeout(logPollRef.current);
      if (userPollRef.current) clearTimeout(userPollRef.current);
    };
  }, [loadData, startLogPoll]);

  // User sends message → tmux send-keys → poll response
  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");

    setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", content: text }]);
    setIsActive(true);
    setStreamBubbles([]);
    setProgress(2);

    if (userPollRef.current) clearTimeout(userPollRef.current);
    stableRef.current = 0;
    lastLinesRef.current = "";

    try {
      await sendChatMessage(text);

      async function pollUser() {
        try {
          const data = await getChatPane();
          const content = data.lines.join("\n");

          if (content === lastLinesRef.current) {
            stableRef.current++;
            if (stableRef.current >= 4) {
              // stable 2s → commit as message
              const bubbles = splitIntoBubbles(data.lines);
              for (const b of bubbles) {
                if (b.trim()) {
                  setMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, role: "assistant", content: b }]);
                }
              }
              setStreamBubbles([]);
              setIsActive(false);
              return;
            }
          } else {
            stableRef.current = 0;
            lastLinesRef.current = content;
            const bubbles = splitIntoBubbles(data.lines);
            setStreamBubbles(bubbles);
            setProgress(detectProgress(content));
          }

          userPollRef.current = setTimeout(pollUser, 500);
        } catch {
          setIsActive(false);
        }
      }

      userPollRef.current = setTimeout(pollUser, 800);
    } catch {
      setIsActive(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-48px)] overflow-hidden">

      {/* ── Left: Character + Chat ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-bg">
        {/* Header */}
        <div className="shrink-0 px-4 py-2.5 border-b border-border bg-panel flex items-center gap-3">
          <span className="text-accent font-semibold text-sm">Mr. Seokminal</span>
          <span className="text-text-3 text-xs">자율 트레이딩 에이전트</span>
          <div className="ml-auto flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isActive ? "bg-accent animate-pulse" : "bg-pos"}`} />
            <span className="text-[11px] text-text-3">{isActive ? "에이전트 작업 중" : "대기 중"}</span>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Character panel */}
          <div className="w-52 shrink-0 flex flex-col items-center border-r border-border/30 bg-panel/40 py-4 gap-2">
            {/* Progress arc — top */}
            <div className="flex flex-col items-center">
              {isActive
                ? <ProgressArc pct={progress} />
                : <div className="w-14 h-14 flex items-center justify-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-pos" />
                  </div>
              }
              <div className="text-[10px] text-text-3 mt-0.5">{isActive ? "분석 중" : "대기"}</div>
            </div>

            {/* Character */}
            <SeokminalCharacter active={isActive} />
            <div className="text-accent text-xs font-semibold tracking-wide">Mr. Seokminal</div>
            <div className="text-text-3 text-[10px]">증권 분석 에이전트</div>

            {/* Token bars — bottom */}
            <div className="mt-auto w-full pt-3 border-t border-border/30">
              <ClaudeTokenBars usage={tokenUsage} />
            </div>
          </div>

          {/* Chat bubbles */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {messages.map(m =>
                m.role === "user"
                  ? <UserBubble key={m.id} content={m.content} />
                  : <AssistantBubble key={m.id} content={m.content} />
              )}
              {isActive && <StreamingBubbles bubbles={streamBubbles} />}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 px-4 py-3 border-t border-border bg-panel">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="에이전트에게 직접 지시하거나 질문하세요..."
                  className="flex-1 bg-panel-2 border border-border rounded-lg px-3 py-2 text-text-1 text-sm outline-none focus:border-accent placeholder:text-text-3"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="bg-accent text-black px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  전송
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: Alpaca panel ── */}
      <div className="w-80 shrink-0 flex flex-col bg-panel overflow-y-auto border-l border-border">
        <div className="px-4 py-2.5 border-b border-border shrink-0 flex items-center justify-between">
          <span className="text-sm font-semibold text-text-1">Alpaca</span>
          <div className="flex items-center gap-2">
            {account && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${account.paper ? "border-warn text-warn" : "border-pos text-pos"}`}>
                {account.paper ? "PAPER" : "LIVE"}
              </span>
            )}
            <button onClick={loadData} className="text-[11px] text-text-3 hover:text-text-1 bg-transparent border-0 cursor-pointer px-1">↻</button>
          </div>
        </div>

        {loadError && (
          <div className="mx-4 mt-3 p-2 bg-neg/10 border border-neg/30 rounded text-[11px] text-neg">
            {loadError.includes("503") ? "ALPACA_API_KEY 미설정 — .env에 키 추가 필요" : loadError}
          </div>
        )}

        {account && (
          <div className="px-4 py-3 border-b border-border">
            <div className="text-[10px] text-text-3 uppercase tracking-wider mb-2">계좌</div>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["포트폴리오", `$${account.portfolio_value.toLocaleString("en", { maximumFractionDigits: 2 })}`],
                ["자산", `$${account.equity.toLocaleString("en", { maximumFractionDigits: 2 })}`],
                ["현금", `$${account.cash.toLocaleString("en", { maximumFractionDigits: 2 })}`],
                ["매수여력", `$${account.buying_power.toLocaleString("en", { maximumFractionDigits: 2 })}`],
              ] as [string, string][]).map(([label, val]) => (
                <div key={label} className="bg-panel-2 rounded p-2">
                  <div className="text-[9px] text-text-3">{label}</div>
                  <div className="text-xs font-data text-text-1 font-semibold">{val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 py-3 border-b border-border">
          <div className="text-[10px] text-text-3 uppercase tracking-wider mb-2">포지션 ({positions.length})</div>
          {positions.length === 0 && !loadError && <p className="text-[11px] text-text-3">보유 포지션 없음</p>}
          <div className="flex flex-col gap-1.5">
            {positions.map(p => {
              const pos = p.unrealized_plpc >= 0;
              return (
                <div key={p.symbol} className="bg-panel-2 rounded p-2.5">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-semibold text-text-1">{p.symbol}</span>
                    <span className={`text-xs font-data font-semibold ${pos ? "text-pos" : "text-neg"}`}>
                      {pos ? "+" : ""}{(p.unrealized_plpc * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] text-text-3">{p.qty}주 · 평균 ${p.avg_entry_price.toFixed(2)}</span>
                    <span className={`text-[10px] font-data ${pos ? "text-pos" : "text-neg"}`}>
                      {pos ? "+" : ""}${p.unrealized_pl.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-text-3">현재 ${p.current_price.toFixed(2)} · MV ${p.market_value.toFixed(0)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trade Log Table */}
        <div className="px-4 py-3 border-t border-border">
          <div className="text-[10px] text-text-3 uppercase tracking-wider mb-2">AI 매매 기록</div>
          {orders.filter(o => o.status === "filled").length === 0 ? (
            <p className="text-[11px] text-text-3 italic">아직 체결된 주문 없음</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-text-3 py-1 pr-2 font-medium">시간</th>
                    <th className="text-left text-text-3 py-1 pr-2 font-medium">종목</th>
                    <th className="text-left text-text-3 py-1 pr-2 font-medium">매매</th>
                    <th className="text-right text-text-3 py-1 pr-2 font-medium">수량</th>
                    <th className="text-right text-text-3 py-1 font-medium">가격</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.filter(o => o.status === "filled").slice(0, 15).map(o => {
                    const isBuy = o.side === "buy";
                    const filledAt = o.created_at ? new Date(o.created_at) : null;
                    const timeStr = filledAt
                      ? filledAt.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
                      : "—";
                    return (
                      <tr key={o.id} className="border-b border-border/30 hover:bg-panel-2/50">
                        <td className="py-1.5 pr-2 text-text-3 font-data whitespace-nowrap">{timeStr}</td>
                        <td className="py-1.5 pr-2 text-text-1 font-semibold">{o.symbol}</td>
                        <td className="py-1.5 pr-2">
                          <span className={`px-1 py-0.5 rounded text-[9px] font-semibold ${isBuy ? "bg-pos/15 text-pos" : "bg-neg/15 text-neg"}`}>
                            {isBuy ? "매수" : "매도"}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2 text-right text-text-2 font-data">{o.qty}</td>
                        <td className="py-1.5 text-right font-data text-text-1">
                          {o.filled_avg_price !== null ? `$${o.filled_avg_price.toFixed(2)}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mx-4 mb-4 mt-2 p-3 bg-accent/5 border border-accent/20 rounded">
          <div className="text-[10px] text-accent font-semibold mb-1">예시 명령</div>
          <div className="text-[10px] text-text-3 leading-relaxed">
            &ldquo;AAPL 분석해줘&rdquo; / &ldquo;포트폴리오 현황&rdquo; / &ldquo;저평가 주식 찾아줘&rdquo;
          </div>
        </div>
      </div>
    </div>
  );
}
