"use client";

import { useState } from "react";
import { NoteBlockRenderer } from "@/components/notebooks/NoteBlockRenderer";
import { NoteBlockEditor } from "@/components/notebooks/NoteBlockEditor";
import {
  addBlock, updateBlock, removeBlock, moveBlock, updateNotebookMeta,
  type Notebook, type NotebookBlock,
} from "@/lib/notebook-storage";

interface NotebookEditorProps {
  notebook: Notebook;
  onUpdate: () => void;
}

export function NotebookEditor({ notebook, onUpdate }: NotebookEditorProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(notebook.title);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [addingBlock, setAddingBlock] = useState(false);
  const [tagsDraft, setTagsDraft] = useState(notebook.tags.join(", "));
  const [editingTags, setEditingTags] = useState(false);
  const [experimentIdDraft, setExperimentIdDraft] = useState("");

  function saveTitle() {
    const t = titleDraft.trim();
    if (t) updateNotebookMeta(notebook.id, { title: t });
    setEditingTitle(false);
    onUpdate();
  }

  function saveTags() {
    const tags = tagsDraft.split(",").map(t => t.trim()).filter(Boolean);
    updateNotebookMeta(notebook.id, { tags });
    setEditingTags(false);
    onUpdate();
  }

  function addExperimentLink() {
    const id = experimentIdDraft.trim();
    if (!id || notebook.experimentIds.includes(id)) return;
    updateNotebookMeta(notebook.id, { experimentIds: [...notebook.experimentIds, id] });
    setExperimentIdDraft("");
    onUpdate();
  }

  function removeExperimentLink(id: string) {
    updateNotebookMeta(notebook.id, { experimentIds: notebook.experimentIds.filter(e => e !== id) });
    onUpdate();
  }

  function handleAddBlock(block: NotebookBlock) {
    addBlock(notebook.id, block);
    setAddingBlock(false);
    onUpdate();
  }

  function handleUpdateBlock(entryId: string, block: NotebookBlock) {
    updateBlock(notebook.id, entryId, block);
    setEditingEntryId(null);
    onUpdate();
  }

  function handleRemoveBlock(entryId: string) {
    removeBlock(notebook.id, entryId);
    onUpdate();
  }

  function handleMoveBlock(entryId: string, direction: "up" | "down") {
    moveBlock(notebook.id, entryId, direction);
    onUpdate();
  }

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => {
              if (e.key === "Enter") saveTitle();
              if (e.key === "Escape") { setTitleDraft(notebook.title); setEditingTitle(false); }
            }}
            className="text-text-1 text-lg font-semibold bg-transparent border-b border-accent outline-none w-full"/>
        ) : (
          <h2
            className="text-text-1 text-lg font-semibold cursor-text hover:text-text-1/80 transition-colors"onClick={() => setEditingTitle(true)}
          >
            {notebook.title}
          </h2>
        )}
        <div className="text-text-3 text-[10px] mt-0.5">
          {notebook.entries.length} block{notebook.entries.length !== 1 ? "s" : ""} · {new Date(notebook.updatedAt).toLocaleDateString()}
        </div>
      </div>

      {/* Tags */}
      <div className="flex items-center gap-2 flex-wrap">
        {editingTags ? (
          <input
            autoFocus
            value={tagsDraft}
            onChange={e => setTagsDraft(e.target.value)}
            onBlur={saveTags}
            onKeyDown={e => {
              if (e.key === "Enter") saveTags();
              if (e.key === "Escape") { setTagsDraft(notebook.tags.join(", ")); setEditingTags(false); }
            }}
            placeholder="tag1, tag2, tag3"className="h-6 px-2 text-xs bg-panel border border-accent rounded text-text-1 outline-none"/>
        ) : (
          <>
            {notebook.tags.map(tag => (
              <span key={tag} className="text-[9px] px-2 py-0.5 bg-panel-2 border border-border rounded text-text-3">
                {tag}
              </span>
            ))}
            <button
              onClick={() => setEditingTags(true)}
              className="text-[9px] text-text-3 hover:text-text-2 bg-transparent border-0 cursor-pointer transition-colors">
              {notebook.tags.length > 0 ? "edit tags" : "+ tags"}
            </button>
          </>
        )}
      </div>

      {/* Experiment links */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-text-3 text-[10px] uppercase tracking-wider shrink-0">Experiments</span>
        {notebook.experimentIds.map(id => (
          <span key={id} className="flex items-center gap-1 text-[9px] px-2 py-0.5 bg-panel-2 border border-border rounded text-info">
            {id.slice(0, 12)}…
            <button
              onClick={() => removeExperimentLink(id)}
              className="text-text-3 hover:text-neg bg-transparent border-0 cursor-pointer p-0 ml-0.5">
              ×
            </button>
          </span>
        ))}
        <div className="flex gap-1">
          <input
            type="text"value={experimentIdDraft}
            onChange={e => setExperimentIdDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addExperimentLink(); }}
            placeholder="exp_… id"className="h-6 w-40 px-2 text-[10px] bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent font-data"/>
          <button
            onClick={addExperimentLink}
            className="h-6 px-2 text-[10px] bg-panel-2 border border-border rounded text-text-3 hover:text-text-1 cursor-pointer transition-colors">
            Link
          </button>
        </div>
      </div>

      {/* Blocks */}
      <div className="space-y-3">
        {notebook.entries.map((entry, idx) => (
          <div key={entry.id}>
            {editingEntryId === entry.id ? (
              <NoteBlockEditor
                initial={entry.block}
                onSave={block => handleUpdateBlock(entry.id, block)}
                onCancel={() => setEditingEntryId(null)}
              />
            ) : (
              <NoteBlockRenderer
                entry={entry}
                onEdit={() => setEditingEntryId(entry.id)}
                onDelete={() => handleRemoveBlock(entry.id)}
                onMoveUp={idx > 0 ? () => handleMoveBlock(entry.id, "up") : undefined}
                onMoveDown={idx < notebook.entries.length - 1 ? () => handleMoveBlock(entry.id, "down") : undefined}
              />
            )}
          </div>
        ))}
      </div>

      {/* Add block */}
      {addingBlock ? (
        <NoteBlockEditor
          onSave={handleAddBlock}
          onCancel={() => setAddingBlock(false)}
        />
      ) : (
        <button
          onClick={() => setAddingBlock(true)}
          className="w-full h-10 border border-dashed border-border rounded-lg text-text-3 text-sm hover:text-text-2 hover:border-border/60 transition-colors cursor-pointer bg-transparent">
          + Add block
        </button>
      )}
    </div>
  );
}
