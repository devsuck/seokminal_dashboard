"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getSavedRuns,
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
    setExperiments(getSavedRuns());
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
    if (!confirm(`실험 ${experiments.length}개를 모두 삭제하시겠습니까? 되돌릴 수 없습니다.`)) return;
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
          <h1 className="text-text-1 text-lg font-semibold tracking-tight">실험</h1>
          <p className="text-text-3 text-sm mt-0.5">
            모든 백테스트 실행 결과가 여기 자동 저장됩니다. 두 개를 선택하면 비교할 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/backtest"
            className="text-text-3 hover:text-accent text-sm transition-colors no-underline"
          >
            ← 백테스트
          </Link>
          {experiments.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-text-3 hover:text-neg text-xs border border-border rounded px-2 py-1 transition-colors"
            >
              전체 삭제
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
