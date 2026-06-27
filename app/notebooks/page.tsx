"use client";

import { useEffect, useState } from "react";
import { NotebookEditor } from "@/components/notebooks/NotebookEditor";
import {
  createNotebook, getNotebooks, deleteNotebook,
  type Notebook,
} from "@/lib/notebook-storage";

export default function NotebooksPage() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    const all = getNotebooks();
    setNotebooks(all);
    if (all.length > 0 && !activeId) setActiveId(all[0].id);
  }, []);

  function refresh() {
    const all = getNotebooks();
    setNotebooks(all);
  }

  function handleCreate() {
    const nb = createNotebook("Untitled Notebook");
    setNotebooks(prev => [nb, ...prev]);
    setActiveId(nb.id);
  }

  function handleDelete(id: string) {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    deleteNotebook(id);
    const remaining = getNotebooks();
    setNotebooks(remaining);
    setActiveId(remaining.length > 0 ? remaining[0].id : null);
    setConfirmDelete(null);
  }

  const activeNotebook = notebooks.find(nb => nb.id === activeId) ?? null;

  return (
    <div className="flex h-[calc(100vh-48px)] overflow-hidden">
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
                  onClick={e => { e.stopPropagation(); handleDelete(nb.id); }}
                  className={`text-[10px] bg-transparent border-0 cursor-pointer transition-colors opacity-0 group-hover:opacity-100 ${
                    confirmDelete === nb.id ? "text-neg" : "text-text-3 hover:text-neg"
                  }`}
                  title={confirmDelete === nb.id ? "Click again to confirm delete" : "Delete notebook"}
                >
                  {confirmDelete === nb.id ? "Confirm" : "×"}
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
            onUpdate={refresh}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-text-3 text-sm">
            Create or select a notebook to start.
          </div>
        )}
      </div>
    </div>
  );
}
