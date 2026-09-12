import React, { useState } from "react";
import { Sparkles, Loader2, Plus, LogOut } from "lucide-react";
import type { ChildSummary } from "../api/client";
import { VerifyEmailBanner } from "./VerifyEmailBanner";

interface ChildGateProps {
  childProfiles: ChildSummary[];
  onSelect: (childId: string) => Promise<void>;
  onAdd: (params: { displayName: string; ageBand?: "4-5" | "6-7" | "8-9"; buddyRole?: "owl" | "dragon" }) => Promise<void>;
  onLogout: () => Promise<void>;
  emailVerified?: boolean;
}

const AGE_BANDS: Array<{ value: "4-5" | "6-7" | "8-9"; label: string }> = [
  { value: "4-5", label: "4–5 years" },
  { value: "6-7", label: "6–7 years" },
  { value: "8-9", label: "8–9 years" },
];

export const ChildGate: React.FC<ChildGateProps> = ({ childProfiles, onSelect, onAdd, onLogout, emailVerified = true }) => {
  const [isAdding, setIsAdding] = useState(childProfiles.length === 0);
  const [displayName, setDisplayName] = useState("");
  const [ageBand, setAgeBand] = useState<"4-5" | "6-7" | "8-9">("6-7");
  const [buddyRole, setBuddyRole] = useState<"owl" | "dragon">("owl");
  const [busyChildId, setBusyChildId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSelect = async (childId: string) => {
    setErrorMessage(null);
    setBusyChildId(childId);
    try {
      await onSelect(childId);
    } catch (err: any) {
      setErrorMessage(err?.message || "Could not switch profiles. Please try again.");
    } finally {
      setBusyChildId(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await onAdd({ displayName: displayName.trim(), ageBand, buddyRole });
    } catch (err: any) {
      setErrorMessage(err?.message || "Could not create the profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-amber-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border-4 border-sky-200 p-8">
        {!emailVerified && <VerifyEmailBanner />}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-sky-500" />
            <h1 className="text-xl font-bold text-gray-800">Who's reading today?</h1>
          </div>
          <button
            type="button"
            onClick={() => onLogout()}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
          >
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </div>

        {childProfiles.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {childProfiles.map((child) => (
              <button
                key={child.id}
                type="button"
                disabled={busyChildId !== null}
                onClick={() => handleSelect(child.id)}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-gray-200 hover:border-sky-400 hover:bg-sky-50 disabled:opacity-60 py-4 px-2 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-sky-200 flex items-center justify-center text-2xl">
                  {child.buddyRole === "dragon" ? "🐉" : "🦉"}
                </div>
                <span className="font-semibold text-gray-700 text-sm text-center">
                  {busyChildId === child.id ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : child.displayName}
                </span>
              </button>
            ))}
            {!isAdding && (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 hover:border-sky-400 hover:bg-sky-50 py-4 px-2 transition-colors text-gray-400 hover:text-sky-500"
              >
                <Plus className="w-6 h-6" />
                <span className="text-sm font-medium">Add child</span>
              </button>
            )}
          </div>
        )}

        {isAdding && (
          <form onSubmit={handleAdd} className="space-y-4 border-t border-gray-100 pt-5">
            <h2 className="text-sm font-semibold text-gray-600">Add a child profile</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="childName">
                Child's name
              </label>
              <input
                id="childName"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-400"
                placeholder="e.g. Alex"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
              <div className="flex gap-2">
                {AGE_BANDS.map((band) => (
                  <button
                    key={band.value}
                    type="button"
                    onClick={() => setAgeBand(band.value)}
                    className={`flex-1 rounded-xl py-2 text-sm font-medium border-2 transition-colors ${
                      ageBand === band.value
                        ? "border-sky-400 bg-sky-50 text-sky-700"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {band.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reading buddy</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBuddyRole("owl")}
                  className={`flex-1 rounded-xl py-2 text-sm font-medium border-2 transition-colors ${
                    buddyRole === "owl" ? "border-sky-400 bg-sky-50 text-sky-700" : "border-gray-200 text-gray-500"
                  }`}
                >
                  🦉 Owl
                </button>
                <button
                  type="button"
                  onClick={() => setBuddyRole("dragon")}
                  className={`flex-1 rounded-xl py-2 text-sm font-medium border-2 transition-colors ${
                    buddyRole === "dragon" ? "border-sky-400 bg-sky-50 text-sky-700" : "border-gray-200 text-gray-500"
                  }`}
                >
                  🐉 Dragon
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {errorMessage}
              </div>
            )}

            <div className="flex gap-2">
              {childProfiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="flex-1 rounded-xl py-2.5 text-sm font-medium border-2 border-gray-200 text-gray-500 hover:border-gray-300"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white transition-colors"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Start reading
              </button>
            </div>
          </form>
        )}

        {errorMessage && !isAdding && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mt-4">
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
};
