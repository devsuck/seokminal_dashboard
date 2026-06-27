import { describe, it, expect, beforeEach } from "vitest";
import {
  createNotebook, getNotebooks, updateNotebookMeta,
  addBlock, updateBlock, removeBlock, moveBlock,
  deleteNotebook, clearNotebooks,
  type CommentBlock, type MetricBlock,
} from "../../lib/notebook-storage";

const COMMENT: CommentBlock = { type: "comment", markdown: "Hello" };
const METRIC: MetricBlock   = { type: "metric", label: "Sharpe", value: 1.5, unit: "" };

describe("notebook-storage", () => {
  beforeEach(() => { localStorage.clear(); });

  it("getNotebooks returns [] when empty", () => {
    expect(getNotebooks()).toEqual([]);
  });

  it("getNotebooks returns [] on corrupt JSON", () => {
    localStorage.setItem("nautilus:notebooks", "BAD");
    expect(getNotebooks()).toEqual([]);
  });

  it("createNotebook persists and returns notebook with id/timestamps/empty entries", () => {
    const nb = createNotebook("My Research");
    expect(nb.id).toMatch(/^nb_\d+_[a-z0-9]{5}$/);
    expect(nb.title).toBe("My Research");
    expect(nb.entries).toHaveLength(0);
    expect(nb.tags).toHaveLength(0);
    expect(nb.experimentIds).toHaveLength(0);
    expect(getNotebooks()).toHaveLength(1);
  });

  it("createNotebook prepends (newest first)", () => {
    createNotebook("A");
    createNotebook("B");
    expect(getNotebooks()[0].title).toBe("B");
  });

  it("updateNotebookMeta updates title and tags", () => {
    const nb = createNotebook("Old");
    updateNotebookMeta(nb.id, { title: "New", tags: ["research", "equity"] });
    const updated = getNotebooks().find(x => x.id === nb.id)!;
    expect(updated.title).toBe("New");
    expect(updated.tags).toEqual(["research", "equity"]);
  });

  it("addBlock appends entry with blk_ id", () => {
    const nb = createNotebook("NB");
    const entry = addBlock(nb.id, COMMENT);
    expect(entry.id).toMatch(/^blk_\d+_[a-z0-9]{5}$/);
    expect(entry.block).toEqual(COMMENT);
    expect(getNotebooks().find(x => x.id === nb.id)!.entries).toHaveLength(1);
  });

  it("addBlock appends (not prepends)", () => {
    const nb = createNotebook("NB");
    addBlock(nb.id, COMMENT);
    addBlock(nb.id, METRIC);
    const entries = getNotebooks().find(x => x.id === nb.id)!.entries;
    expect(entries[0].block.type).toBe("comment");
    expect(entries[1].block.type).toBe("metric");
  });

  it("updateBlock replaces block content by entry id", () => {
    const nb = createNotebook("NB");
    const entry = addBlock(nb.id, COMMENT);
    const updated: CommentBlock = { type: "comment", markdown: "Updated" };
    updateBlock(nb.id, entry.id, updated);
    const entries = getNotebooks().find(x => x.id === nb.id)!.entries;
    expect(entries[0].block).toEqual(updated);
  });

  it("removeBlock removes entry by id", () => {
    const nb = createNotebook("NB");
    const e1 = addBlock(nb.id, COMMENT);
    addBlock(nb.id, METRIC);
    removeBlock(nb.id, e1.id);
    const entries = getNotebooks().find(x => x.id === nb.id)!.entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].block.type).toBe("metric");
  });

  it("moveBlock up swaps with previous entry", () => {
    const nb = createNotebook("NB");
    addBlock(nb.id, COMMENT);
    const e2 = addBlock(nb.id, METRIC);
    moveBlock(nb.id, e2.id, "up");
    const entries = getNotebooks().find(x => x.id === nb.id)!.entries;
    expect(entries[0].block.type).toBe("metric");
    expect(entries[1].block.type).toBe("comment");
  });

  it("moveBlock up on first entry is a no-op", () => {
    const nb = createNotebook("NB");
    const e1 = addBlock(nb.id, COMMENT);
    addBlock(nb.id, METRIC);
    moveBlock(nb.id, e1.id, "up");
    const entries = getNotebooks().find(x => x.id === nb.id)!.entries;
    expect(entries[0].block.type).toBe("comment");
  });

  it("deleteNotebook removes by id", () => {
    const nb = createNotebook("del");
    deleteNotebook(nb.id);
    expect(getNotebooks()).toHaveLength(0);
  });

  it("clearNotebooks empties storage", () => {
    createNotebook("A");
    clearNotebooks();
    expect(getNotebooks()).toHaveLength(0);
  });
});
