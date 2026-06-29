"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageBanner } from "@/components/PageBanner";
import { ExperimentTable } from "@/components/experiments/ExperimentTable";
import { ExperimentCompare } from "@/components/experiments/ExperimentCompare";
import {
  getExperiments, deleteExperiment, updateExperimentNotes, clearExperiments,
  type Experiment,
} from "@/lib/experiment-storage";

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setExperiments(getExperiments());
  }, []);

  function handleDelete(id: string) {
    deleteExperiment(id);
    setExperiments(getExperiments());
    setSelected(prev => prev.filter(s => s !== id));
  }

  function handleNotesUpdate(id: string, notes: string) {
    updateExperimentNotes(id, notes);
    setExperiments(getExperiments());
  }

  function handleSelect(id: string) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  function handleClearAll() {
    if (!confirmClear) { setConfirmClear(true); return; }
    clearExperiments();
    setExperiments([]);
    setSelected([]);
    setConfirmClear(false);
  }

  const compareExperiments: [Experiment, Experiment] | null = (() => {
    if (selected.length !== 2) return null;
    const a = experiments.find(e => e.id === selected[0]);
    const b = experiments.find(e => e.id === selected[1]);
    return a && b ? [a, b] : null;
  })();

  return (
    <div className="p-6 space-y-4 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <PageBanner pageKey="experiments" />
        <div className="flex items-center gap-3">
          <Link href="/backtest" className="text-text-3 hover:text-accent text-xs no-underline transition-colors">
            ← Backtest
          </Link>
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
      </div>

      {/* Compare panel */}
      {compareExperiments && (
        <ExperimentCompare
          experiments={compareExperiments}
          onClose={() => setSelected([])}
        />
      )}

      {/* Experiment table */}
      <ExperimentTable
        experiments={experiments}
        selected={selected}
        onSelect={handleSelect}
        onDelete={handleDelete}
        onNotesUpdate={handleNotesUpdate}
      />
    </div>
  );
}
