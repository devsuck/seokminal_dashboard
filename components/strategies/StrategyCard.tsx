"use client";

import type { Strategy } from "@/lib/strategy-storage";

interface StrategyCardProps {
  strategy: Strategy;
  selected: boolean;
  onSelect: (id: string) => void;
  onFavorite: (id: string, v: boolean) => void;
  onArchive: (id: string, v: boolean) => void;
  onClone: (id: string) => void;
  onDelete: (id: string) => void;
  onRun: (strategy: Strategy) => void;
}

function paramsLabel(strategy: Strategy): string {
  const p = strategy.params;
  if (p.type === "ema_cross") return `EMA ${p.fast}/${p.slow}`;
  return `Gated · ${p.rules.length} rule${p.rules.length !== 1 ? "s" : ""}`;
}

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function StrategyCard({
  strategy, selected, onSelect, onFavorite, onArchive, onClone, onDelete, onRun,
}: StrategyCardProps) {
  return (
    <div
      className={`bg-panel border rounded-lg p-4 space-y-3 cursor-pointer transition-colors ${
        selected ? "border-accent" : "border-border hover:border-border/80"
      }`}
      onClick={() => onSelect(strategy.id)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-text-1 font-medium truncate">{strategy.name}</span>
            <button
              onClick={e => { e.stopPropagation(); onFavorite(strategy.id, !strategy.favorite); }}
              className={`text-sm bg-transparent border-0 cursor-pointer p-0 transition-colors shrink-0 ${
                strategy.favorite ? "text-warn" : "text-text-3 hover:text-warn"
              }`}
              title={strategy.favorite ? "Remove from favorites" : "Add to favorites"}
            >
              {strategy.favorite ? "★" : "☆"}
            </button>
          </div>
          <div className="text-text-3 text-[10px] font-data mt-0.5">{timeAgo(strategy.updatedAt)}</div>
        </div>
        <span className={`text-[9px] px-2 py-0.5 rounded-full shrink-0 font-medium ${
          strategy.params.type === "ema_cross"
            ? "bg-info/10 text-info"
            : "bg-warn/10 text-warn"
        }`}>
          {strategy.params.type === "ema_cross" ? "EMA Cross" : "Gated"}
        </span>
      </div>

      {/* Params */}
      <div className="text-text-2 text-xs font-data">{paramsLabel(strategy)}</div>

      {/* Description */}
      {strategy.description && (
        <p className="text-text-3 text-xs truncate">{strategy.description}</p>
      )}

      {/* Tags */}
      {strategy.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {strategy.tags.map(tag => (
            <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-panel-2 border border-border rounded text-text-3">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer: version count + actions */}
      <div className="flex items-center justify-between pt-1 border-t border-border/40">
        <span className="text-text-3 text-[9px] font-data">
          {strategy.versions.length > 0 ? `${strategy.versions.length} version${strategy.versions.length !== 1 ? "s" : ""}` : "No history"}
        </span>
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onRun(strategy)}
            className="text-xs px-2.5 h-6 bg-accent text-black font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0"
          >
            Run
          </button>
          <button
            onClick={() => onClone(strategy.id)}
            className="text-[10px] px-2 h-6 bg-panel-2 border border-border rounded text-text-2 cursor-pointer hover:text-text-1 transition-colors"
          >
            Clone
          </button>
          <button
            onClick={() => onArchive(strategy.id, !strategy.archived)}
            className="text-[10px] px-2 h-6 bg-panel-2 border border-border rounded text-text-2 cursor-pointer hover:text-text-1 transition-colors"
            title={strategy.archived ? "Unarchive" : "Archive"}
          >
            {strategy.archived ? "Unarchive" : "Archive"}
          </button>
          <button
            onClick={() => onDelete(strategy.id)}
            className="text-[10px] h-6 px-1.5 bg-transparent border-0 text-text-3 hover:text-neg cursor-pointer transition-colors"
            title="Delete"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
