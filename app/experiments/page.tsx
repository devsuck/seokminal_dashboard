"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getExperiments,
  deleteExperiment,
  updateExperimentNotes,
  clearExperiments,
  type Experiment,
} from "@/lib/experiment-storage";
import { ExperimentTable } from "@/components/experiments/ExperimentTable";
import { ExperimentCompare } from "@/components/experiments/ExperimentCompare";

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    setExperiments(getExperiments());
  }, []);

  function handleSelect(id: string) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  function handleDelete(id: string) {
    deleteExperiment(id);
    setExperiments(prev => prev.filter(e => e.id !== id));
    setSelected(prev => prev.filter(x => x !== id));
  }

  function handleNotesUpdate(id: string, notes: string) {
    updateExperimentNotes(id, notes);
    setExperiments(prev => prev.map(e => (e.id === id ? { ...e, notes } : e)));
  }

  function handleClearAll() {
    if (!confirm(`Delete all ${experiments.length} experiments? This cannot be undone.`)) return;
    clearExperiments();
    setExperiments([]);
    setSelected([]);
  }

  const compareExps = selected
    .map(id => experiments.find(e => e.id === id))
    .filter((e): e is Experiment => e !== undefined);

  return (
    <div className="min-h-screen bg-bg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-text-1 text-lg font-semibold tracking-tight">Experiments</h1>
          <p className="text-text-3 text-sm mt-0.5">
            Every backtest run is auto-saved here. Select two to compare.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/backtest"
            className="text-text-3 hover:text-accent text-sm transition-colors no-underline"
          >
            ← Backtest
          </Link>
          {experiments.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-text-3 hover:text-neg text-xs border border-border rounded px-2 py-1 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {compareExps.length === 2 && (
        <div className="mb-4">
          <ExperimentCompare
            experiments={[compareExps[0], compareExps[1]]}
            onClose={() => setSelected([])}
          />
        </div>
      )}

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
