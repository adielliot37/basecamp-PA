"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export function AddTaskModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [basecampLink, setBasecampLink] = useState("");
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!basecampLink.trim() || !note.trim()) {
      setError("Basecamp link and note are both required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createPersonalTask({
        basecamp_link: basecampLink.trim(),
        note: note.trim(),
        due_date: dueDate || null
      });
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="panel-title">Pin something down</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <form className="board-form" onSubmit={handleSubmit}>
          <div className="board-form-row">
            <label className="board-label" htmlFor="basecamp-link">
              Basecamp link <span className="req">*</span>
            </label>
            <input
              id="basecamp-link"
              className="board-input"
              type="url"
              autoFocus
              placeholder="https://3.basecamp.com/..."
              value={basecampLink}
              onChange={(e) => setBasecampLink(e.target.value)}
            />
          </div>
          <div className="board-form-row">
            <label className="board-label" htmlFor="board-note">
              Note <span className="req">*</span>
            </label>
            <textarea
              id="board-note"
              className="board-textarea"
              placeholder="What do you need to remember about this?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
          <div className="board-form-row">
            <label className="board-label" htmlFor="board-due">
              Due date <span className="opt">(optional)</span>
            </label>
            <input
              id="board-due"
              className="board-input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          {error && <p className="board-error">{error}</p>}
          <div className="modal-foot">
            <button type="button" className="act" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add to board"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
