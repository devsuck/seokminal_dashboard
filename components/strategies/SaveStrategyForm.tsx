"use client";

import { useState } from "react";
import type { StrategyParams } from "@/lib/strategy-storage";
import { createStrategy } from "@/lib/strategy-storage";
import { Button } from "@/components/ui";

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
      <div className="text-text-3 text-[11px] uppercase tracking-wider">전략으로 저장</div>

      <div className="space-y-2">
        <input
          autoFocus
          type="text"value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
          placeholder="전략 이름 (필수)"className="w-full h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent"/>
        <input
          type="text"value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="설명 (선택)"className="w-full h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent"/>
        <input
          type="text"value={tags}
          onChange={e => setTags(e.target.value)}
          placeholder="태그 (쉼표로 구분)"className="w-full h-8 px-3 text-xs bg-panel border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent"/>
      </div>

      <div className="flex gap-2">
        <Button variant="primary" size="md" onClick={handleSave} disabled={!name.trim()}>
          저장
        </Button>
        <button
          onClick={onCancel}
          className="px-4 h-8 bg-panel border border-border text-text-2 text-xs rounded cursor-pointer hover:text-text-1 transition-colors">
          취소
        </button>
      </div>
    </div>
  );
}
