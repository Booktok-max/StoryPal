import React, { useState } from "react";
import { X, GraduationCap, CheckCircle2 } from "lucide-react";
import { Book } from "../types";

interface LevelOverrideModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  onSave: (bookId: string, level: Book["levelShort"]) => Promise<void>;
}

const LEVELS: { value: Book["levelShort"]; label: string; description: string }[] = [
  { value: "Level 1", label: "Level 1 — Early Reader", description: "Short sentences, simple words, lots of repetition" },
  { value: "Level 2", label: "Level 2 — Developing", description: "Longer sentences, richer vocabulary, some chapters" },
  { value: "Level 3", label: "Level 3 — Confident", description: "Full chapters, complex vocabulary, longer texts" },
];

export const LevelOverrideModal: React.FC<LevelOverrideModalProps> = ({
  book,
  isOpen,
  onClose,
  onSave,
}) => {
  const [selected, setSelected] = useState<Book["levelShort"]>(book.levelShort);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSave = async () => {
    if (selected === book.levelShort) { onClose(); return; }
    setSaving(true);
    setError("");
    try {
      await onSave(book.id, selected);
      setSaved(true);
      setTimeout(onClose, 900);
    } catch (err: any) {
      setError(err?.message || "Could not save override. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-amber-200 overflow-hidden">

        {/* Header */}
        <div className="p-5 border-b border-stone-100 flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold mb-2">
              <GraduationCap className="w-3.5 h-3.5" />
              Reading Level Override
            </div>
            <h3 className="font-display font-extrabold text-stone-900 leading-tight">
              {book.title}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Current: <span className="font-bold text-amber-700">{book.levelShort}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-stone-100">
            <X className="w-4 h-4 text-stone-500" />
          </button>
        </div>

        {/* Level options */}
        <div className="p-5 space-y-2.5">
          <p className="text-xs text-stone-500 mb-3">
            The classifier is conservative by design. Override if you know your child reads above or below the auto-detected level.
          </p>

          {LEVELS.map((lvl) => (
            <button
              key={lvl.value}
              onClick={() => setSelected(lvl.value)}
              className={`w-full text-left p-3.5 rounded-2xl border transition-all ${
                selected === lvl.value
                  ? "border-amber-400 bg-amber-50 shadow-sm"
                  : "border-stone-200 hover:border-amber-200 hover:bg-amber-50/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm text-stone-900">{lvl.label}</span>
                {selected === lvl.value && (
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                )}
              </div>
              <p className="text-xs text-stone-500 mt-0.5">{lvl.description}</p>
            </button>
          ))}

          {error && (
            <p className="text-xs text-red-600 pt-1">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-2xl border border-stone-200 text-stone-700 font-bold text-sm hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm disabled:opacity-60"
          >
            {saved ? "✓ Saved!" : saving ? "Saving…" : "Save Override"}
          </button>
        </div>
      </div>
    </div>
  );
};
