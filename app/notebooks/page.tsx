"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NotebookEditor } from "@/components/notebooks/NotebookEditor";
import {
  createNotebook, getNotebooks, deleteNotebook,
  type Notebook,
} from "@/lib/notebook-storage";
import { StrategyCard } from "@/components/strategies/StrategyCard";
import { StrategyCompare } from "@/components/strategies/StrategyCompare";
import {
  getStrategies, updateStrategyMeta, cloneStrategy,
  rollbackStrategy, deleteStrategy,
  type Strategy,
} from "@/lib/strategy-storage";
import { updateWorkflow } from "@/lib/workflow-storage";
import { ExperimentTable } from "@/components/experiments/ExperimentTable";
import { ExperimentCompare } from "@/components/experiments/ExperimentCompare";
import {
  getExperiments, deleteExperiment, updateExperimentNotes, clearExperiments,
  type Experiment,
} from "@/lib/experiment-storage";

type Tab = "notebooks" | "strategies" | "experiments";
type Filter = "all" | "favorites" | "archived";

const TABS: { id: Tab; label: string }[] = [
  { id: "notebooks", label: "노트북" },
  { id: "strategies", label: "전략" },
  { id: "experiments", label: "실험" },
];

export default function ResearchPage() {
  const [tab, setTab] = useState<Tab>("notebooks");

  // ── Notebooks state ─────────────────────────────────────────────────────────
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    const all = getNotebooks();
    setNotebooks(all);
    if (all.length > 0 && !activeId) setActiveId(all[0].id);
  }, []);

  function refreshNotebooks() {
    const all = getNotebooks();
    setNotebooks(all);
  }

  function handleCreate() {
    const nb = createNotebook("Untitled Notebook");
    setNotebooks(prev => [nb, ...prev]);
    setActiveId(nb.id);
  }

  function handleDeleteNotebook(id: string) {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    deleteNotebook(id);
    const remaining = getNotebooks();
    setNotebooks(remaining);
    setActiveId(remaining.length > 0 ? remaining[0].id : null);
    setConfirmDelete(null);
  }

  const activeNotebook = notebooks.find(nb => nb.id === activeId) ?? null;

  // ── Strategies state ─────────────────────────────────────────────────────────
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [showVersions, setShowVersions] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setStrategies(getStrategies());
  }, []);

  function refreshStrategies() {
    setStrategies(getStrategies());
  }

  function handleSelect(id: string) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  function handleFavorite(id: string, v: boolean) {
    updateStrategyMeta(id, { favorite: v });
    refreshStrategies();
  }

  function handleArchive(id: string, v: boolean) {
    updateStrategyMeta(id, { archived: v });
    refreshStrategies();
  }

  function handleClone(id: string) {
    const original = strategies.find(s => s.id === id);
    if (!original) return;
    cloneStrategy(id, `Clone of ${original.name}`);
    refreshStrategies();
  }

  function handleDeleteStrategy(id: string) {
    deleteStrategy(id);
    setSelected(prev => prev.filter(s => s !== id));
    refreshStrategies();
  }

  function handleRun(_strategy: Strategy) {
    updateWorkflow({ strategyId: _strategy.id });
    router.push("/backtest");
  }

  function handleRollback(strategyId: string, versionIdx: number) {
    rollbackStrategy(strategyId, versionIdx);
    refreshStrategies();
  }

  const visible = strategies.filter(s => {
    if (filter === "favorites" && !s.favorite) return false;
    if (filter === "archived" && !s.archived) return false;
    if (filter === "all" && s.archived) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) &&
        !s.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const compareStrategies: [Strategy, Strategy] | null = (() => {
    if (selected.length !== 2) return null;
    const a = strategies.find(s => s.id === selected[0]);
    const b = strategies.find(s => s.id === selected[1]);
    return a && b ? [a, b] : null;
  })();

  const versionStrategy = showVersions ? strategies.find(s => s.id === showVersions) : null;

  // ── Experiments state ─────────────────────────────────────────────────────────
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedExp, setSelectedExp] = useState<string[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setExperiments(getExperiments());
  }, []);

  function handleDeleteExperiment(id: string) {
    deleteExperiment(id);
    setExperiments(getExperiments());
    setSelectedExp(prev => prev.filter(s => s !== id));
  }

  function handleNotesUpdate(id: string, notes: string) {
    updateExperimentNotes(id, notes);
    setExperiments(getExperiments());
  }

  function handleSelectExp(id: string) {
    setSelectedExp(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  function handleClearAll() {
    if (!confirmClear) { setConfirmClear(true); return; }
    clearExperiments();
    setExperiments([]);
    setSelectedExp([]);
    setConfirmClear(false);
  }

  const compareExperiments: [Experiment, Experiment] | null = (() => {
    if (selectedExp.length !== 2) return null;
    const a = experiments.find(e => e.id === selectedExp[0]);
    const b = experiments.find(e => e.id === selectedExp[1]);
    return a && b ? [a, b] : null;
  })();

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Tab bar */}
      <div className="border-b border-border bg-panel flex px-6 gap-0 shrink-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? "border-0 border-b-2 border-accent text-accent bg-transparent px-5 py-2.5 text-sm font-medium cursor-pointer"
                : "text-text-3 hover:text-text-1 bg-transparent border-0 px-5 py-2.5 text-sm cursor-pointer"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Notebooks tab ─────────────────────────────────────────────────────── */}
      {tab === "notebooks" && (
        <div className="flex h-[calc(100vh-100px)] overflow-hidden">
          {/* Left sidebar: notebook list */}
          <div className="w-64 shrink-0 border-r border-border bg-panel flex flex-col">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <span className="text-text-3 text-[11px] uppercase tracking-wider">Notebooks</span>
              <button
                onClick={handleCreate}
                className="h-6 px-2.5 bg-accent text-black text-[10px] font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0"
              >
                + New
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-1">
              {notebooks.length === 0 ? (
                <div className="text-center py-8 text-text-3 text-xs">No notebooks yet</div>
              ) : (
                notebooks.map(nb => (
                  <div
                    key={nb.id}
                    className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${
                      activeId === nb.id
                        ? "bg-panel-2 border-l-2 border-l-accent"
                        : "hover:bg-panel-2/50 border-l-2 border-l-transparent"
                    }`}
                    onClick={() => { setActiveId(nb.id); setConfirmDelete(null); }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-text-2 text-xs font-medium truncate">{nb.title}</div>
                      <div className="text-text-3 text-[9px] font-data">
                        {nb.entries.length} block{nb.entries.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteNotebook(nb.id); }}
                      className={`text-[10px] bg-transparent border-0 cursor-pointer transition-colors opacity-0 group-hover:opacity-100 ${
                        confirmDelete === nb.id ? "text-neg" : "text-text-3 hover:text-neg"
                      }`}
                      title={confirmDelete === nb.id ? "Click again to confirm delete" : "Delete notebook"}
                    >
                      {confirmDelete === nb.id ? "Confirm" : "x"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: notebook editor */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeNotebook ? (
              <NotebookEditor
                key={activeNotebook.id}
                notebook={activeNotebook}
                onUpdate={refreshNotebooks}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-text-3 text-sm">
                Create or select a notebook to start.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Strategies tab ────────────────────────────────────────────────────── */}
      {tab === "strategies" && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4 max-w-[1400px]">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-text-1 text-lg font-semibold tracking-tight">Strategy Repository</h1>
                <p className="text-text-3 text-sm mt-0.5">
                  Saved strategies. Select two to compare. Click history to rollback.
                </p>
              </div>
            </div>

            {/* Compare panel */}
            {compareStrategies && (
              <StrategyCompare
                strategies={compareStrategies}
                onClose={() => setSelected([])}
              />
            )}

            {/* Version history panel */}
            {versionStrategy && versionStrategy.versions.length > 0 && (
              <div className="bg-panel border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center justify-between">
                  <span className="text-text-3 text-[11px] uppercase tracking-wider">
                    Version History — {versionStrategy.name}
                  </span>
                  <button
                    onClick={() => setShowVersions(null)}
                    className="text-text-3 hover:text-text-1 text-xs bg-transparent border-0 cursor-pointer"
                  >
                    Close x
                  </button>
                </div>
                <div className="p-4 space-y-2">
                  {versionStrategy.versions.map((v, i) => (
                    <div key={i} className="flex items-center gap-4 text-xs">
                      <span className="text-text-3 font-data w-20 shrink-0">
                        {new Date(v.savedAt).toLocaleDateString()}
                      </span>
                      <span className="text-text-2 flex-1 font-data">
                        {v.params.type === "ema_cross"
                          ? `EMA ${v.params.fast}/${v.params.slow}`
                          : `Gated ${v.params.rules.length} rules`}
                      </span>
                      <span className="text-text-3 flex-1 italic">{v.note}</span>
                      <button
                        onClick={() => { handleRollback(versionStrategy.id, i); setShowVersions(null); }}
                        className="text-info text-[10px] bg-transparent border-0 cursor-pointer hover:underline"
                      >
                        Rollback
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search + filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or tag..."
                className="h-8 w-64 px-3 text-xs bg-panel-2 border border-border rounded-md text-text-1 placeholder:text-text-3 outline-none focus:border-accent"
              />
              <div className="flex gap-1">
                {(["all", "favorites", "archived"] as Filter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 h-8 text-xs rounded transition-colors cursor-pointer capitalize ${
                      filter === f
                        ? "border-0 border-b-2 border-accent text-accent bg-panel-2"
                        : "border border-border text-text-3 hover:text-text-1 bg-panel-2"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <span className="text-text-3 text-xs font-data ml-auto">{visible.length} / {strategies.filter(s =>
                filter === "favorites" ? s.favorite :
                filter === "archived"  ? s.archived : !s.archived
              ).length}</span>
            </div>

            {/* Strategy grid */}
            {strategies.length === 0 ? (
              <div className="text-center py-12 text-text-3 text-sm">
                No strategies saved yet. Run a backtest and click &quot;Save Strategy&quot; to get started.
              </div>
            ) : visible.length === 0 ? (
              <div className="text-center py-8 text-text-3 text-sm">No strategies match this filter.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visible.map(s => (
                  <div key={s.id} className="relative">
                    <StrategyCard
                      strategy={s}
                      selected={selected.includes(s.id)}
                      onSelect={handleSelect}
                      onFavorite={handleFavorite}
                      onArchive={handleArchive}
                      onClone={handleClone}
                      onDelete={handleDeleteStrategy}
                      onRun={handleRun}
                    />
                    {s.versions.length > 0 && (
                      <button
                        onClick={e => { e.stopPropagation(); setShowVersions(prev => prev === s.id ? null : s.id); }}
                        className="absolute top-3 right-3 text-[9px] text-text-3 hover:text-info bg-transparent border-0 cursor-pointer transition-colors"
                      >
                        {s.versions.length}v
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {selected.length === 1 && (
              <div className="bg-accent/5 border border-accent/20 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-text-3 text-[10px] uppercase tracking-wider">Workflow</div>
                  <p className="text-text-1 text-sm font-medium mt-0.5">Strategy selected — run a backtest to continue the workflow</p>
                </div>
                <button
                  onClick={() => { const s = strategies.find(st => st.id === selected[0]); if (s) handleRun(s); }}
                  className="px-4 py-1.5 text-xs font-semibold bg-accent text-black rounded cursor-pointer hover:brightness-110 transition-all border-0 whitespace-nowrap flex-shrink-0"
                >
                  Run Backtest
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Experiments tab ───────────────────────────────────────────────────── */}
      {tab === "experiments" && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4 max-w-[1400px]">
            {/* Header */}
            <div className="flex justify-end items-center gap-3">
              {experiments.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className={`text-xs px-3 h-7 rounded border cursor-pointer transition-colors bg-transparent ${
                    confirmClear
                      ? "text-neg border-neg hover:bg-neg/10"
                      : "text-text-3 border-border hover:text-neg"
                  }`}
                >
                  {confirmClear ? "Confirm clear all" : "Clear all"}
                </button>
              )}
              {confirmClear && (
                <button
                  onClick={() => setConfirmClear(false)}
                  className="text-xs text-text-3 hover:text-text-1 cursor-pointer bg-transparent border-0 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>

            {/* Compare panel */}
            {compareExperiments && (
              <ExperimentCompare
                experiments={compareExperiments}
                onClose={() => setSelectedExp([])}
              />
            )}

            {/* Experiment table */}
            <ExperimentTable
              experiments={experiments}
              selected={selectedExp}
              onSelect={handleSelectExp}
              onDelete={handleDeleteExperiment}
              onNotesUpdate={handleNotesUpdate}
            />
          </div>
        </div>
      )}
    </div>
  );
}
