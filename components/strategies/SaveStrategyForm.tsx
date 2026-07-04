"use client";

import { useState } from "react";
import type { StrategyParams } from "@/lib/strategy-storage";
import { createStrategy } from "@/lib/strategy-storage";

interface SaveStrategyFormProps {
  params: StrategyParams;
  onSaved: () => void;
  onCancel: () => void;
}

export function SaveStrategyForm({ params, onSaved, onCancel }: SaveStrategyFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    createStrategy({
      name: trimmed,
      description: description.trim(),
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      params,
    });
    onSaved();
  }

  return (
    <div className="bg-panel-2 border border-border rounded-lg p-4 space-y-3">
      <div className="text-text-3 text-[11px] uppercase tracking-wider">Save as Strategy</div>

      <div className="space-y-2">
        <input
          autoFocus
          type="text"value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
          placeholder="Strategy name (required)"className="w-full h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent"/>
        <input
          type="text"value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description (optional)"className="w-full h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent"/>
        <input
          type="text"value={tags}
          onChange={e => setTags(e.target.value)}
          placeholder="Tags (comma-separated)"className="w-full h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent"/>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="px-4 h-8 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-40 disabled:cursor-not-allowed">
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-4 h-8 bg-panel border border-border text-text-2 text-xs rounded cursor-pointer hover:text-text-1 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
