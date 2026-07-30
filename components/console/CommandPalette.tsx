"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";

interface PaletteItem { href: string; label: string; group: string; }
interface RailGroupLike { label: string; items: { href: string; label: string }[]; }

function flatten(groups: RailGroupLike[]): PaletteItem[] {
  const out: PaletteItem[] = [];
  for (const g of groups) {
    for (const item of g.items) out.push({ href: item.href, label: item.label, group: g.label });
  }
  return out;
}

// 콘솔(신규 OS) 12그룹 + 레거시 터미널 5그룹 합쳐 70개 가까운 페이지가 레일 하나에
// 쌓여 있어, 목적지를 아는 상태에서도 그룹을 펼쳐 찾아야 했음 — Cmd/Ctrl+K로
// 라벨/그룹명 검색해서 바로 이동하는 팔레트.
export function CommandPalette({ groups, iconOnly = false }: { groups: RailGroupLike[]; iconOnly?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => flatten(groups), [groups]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      i => i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q) || i.href.toLowerCase().includes(q)
    );
  }, [items, query]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(o => !o);
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filtered[activeIndex];
      if (target) go(target.href);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 h-8 border-0 bg-transparent cursor-pointer transition-colors text-[var(--c-text-3)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-panel-2)] ${
          iconOnly ? "w-full justify-center" : "w-full px-3.5 text-left"}`}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <circle cx="7" cy="7" r="5" /><line x1="11" y1="11" x2="14.5" y2="14.5" />
        </svg>
        {!iconOnly && <span className="text-[12px] tracking-wide flex-1">검색</span>}
        {!iconOnly && <span className="text-[9px] font-data">⌘K</span>}
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center pt-[15vh]"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-md mx-4 bg-[var(--c-panel)] border border-[var(--c-border)] rounded shadow-lg overflow-hidden">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="페이지 검색…"
              className="w-full px-3 h-11 bg-transparent border-0 border-b border-[var(--c-border)] text-sm text-[var(--c-text-1)] outline-none placeholder:text-[var(--c-text-3)]"
            />
            <div className="max-h-80 overflow-y-auto py-1">
              {filtered.length === 0 && (
                <div className="px-3 py-4 text-sm text-[var(--c-text-3)]">결과 없음</div>
              )}
              {filtered.map((item, idx) => (
                <button
                  key={item.href}
                  onMouseDown={() => go(item.href)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-left border-0 cursor-pointer transition-colors ${
                    idx === activeIndex ? "text-[var(--c-hud)] bg-[color-mix(in_srgb,var(--c-hud)_8%,transparent)]" : "bg-transparent text-[var(--c-text-2)]"}`}
                >
                  <span className="truncate">{item.label}</span>
                  <span className="text-[10px] text-[var(--c-text-3)] shrink-0">{item.group}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
