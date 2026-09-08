import React, { useState } from "react";
import { X, Sparkles, Wand2, Loader2, BookOpen, WifiOff } from "lucide-react";
import { Book } from "../types";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

interface StoryCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoryCreated: (newBook: Book) => void;
}

const PRESET_THEMES = [
  "A treehouse laboratory where squirrels bake cloud cookies",
  "A rocket ship that explores planets made of shiny musical crystals",
  "A gentle sea turtle who delivers letters to underwater mermaid friends",
  "A dinosaur safari where baby stegosauruses play hide-and-seek",
  "An enchanted garden where night flowers glow like colorful lanterns",
];

const COMPANIONS = [
  "a playful baby dragon",
  "a fluffy golden puppy",
  "a wise little owl with silver glasses",
  "an astronaut kitten with a bubble helmet",
  "a friendly clockwork fox who loves puzzles",
];

export const StoryCreatorModal: React.FC<StoryCreatorModalProps> = ({
  isOpen,
  onClose,
  onStoryCreated,
}) => {
  const [childName, setChildName] = useState("Alex");
  const [readingLevel, setReadingLevel] = useState<"Level 1" | "Level 2" | "Level 3">("Level 1");
  const [theme, setTheme] = useState(PRESET_THEMES[0]);
  const [companion, setCompanion] = useState(COMPANIONS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { isOnline } = useOnlineStatus();

  if (!isOpen) return null;

  const handleGenerateStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setErrorMessage("Wi-Fi connection is required to create new AI stories. Connect to the internet and try again.");
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/create-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childName: childName.trim() || "Young Explorer",
          readingLevel,
          theme,
          favoriteCompanion: companion,
        }),
      });

      const data = await response.json();

      if (response.ok && data.story && data.story.pages) {
        const story = data.story;
        const newBookId = `custom-${Date.now()}`;

        const newBook: Book = {
          id: newBookId,
          title: story.title || `${childName}'s Magical Adventure`,
          author: `Created for ${childName}`,
          coverImage:
            "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80",
          level:
            readingLevel === "Level 1"
              ? "Level 1 (Early Reader)"
              : readingLevel === "Level 2"
              ? "Level 2 (Developing)"
              : "Level 3 (Confident)",
          levelShort: readingLevel,
          colorTheme: story.colorTheme || "emerald",
          summary: story.summary || `A special AI-crafted story starring ${childName}.`,
          pages: story.pages.map((p: any, idx: number) => ({
            pageNumber: idx + 1,
            text: p.text,
            illustrationPrompt: p.illustrationPrompt,
            currentImageUrl:
              idx === 0
                ? "https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?auto=format&fit=crop&w=1000&q=80"
                : idx === 1
                ? "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=1000&q=80"
                : idx === 2
                ? "https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=1000&q=80"
                : "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1000&q=80",
            imageSize: "1K",
            keyWords: p.keyWords || [],
            phonicsFocus: `Phonics for ${readingLevel}`,
          })),
        };

        onStoryCreated(newBook);
        onClose();
      } else {
        setErrorMessage(
          data.error || "Could not generate story. Please try again or check API settings."
        );
      }
    } catch (err: any) {
      console.error("Story creation error:", err);
      setErrorMessage(err?.message || "Failed to connect to story maker.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      id="story-creator-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-amber-200 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl">
              🪄
            </div>
            <div>
              <h3 className="font-display font-extrabold text-lg text-amber-950">
                AI Story Maker
              </h3>
              <p className="text-[11px] text-stone-500 font-medium">
                Create a customized, illustrated book for young readers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleGenerateStory} className="space-y-4">
          {/* Child Name */}
          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">
              Young Reader&apos;s Name:
            </label>
            <input
              type="text"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="e.g. Leo, Sophia, Maya..."
              className="w-full text-xs sm:text-sm p-3 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-stone-50"
              required
            />
          </div>

          {/* Reading Level */}
          <div>
            <label className="text-xs font-bold text-stone-700 mb-1.5 block">
              Target Reading Level:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "Level 1", label: "Level 1 (Early)", desc: "Simple words, short rhymes" },
                { id: "Level 2", label: "Level 2 (Developing)", desc: "Compound sentences" },
                { id: "Level 3", label: "Level 3 (Confident)", desc: "Rich vocabulary & mystery" },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setReadingLevel(lvl.id as any)}
                  className={`p-2.5 rounded-2xl border text-left transition-all ${
                    readingLevel === lvl.id
                      ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                      : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <div className="text-xs font-bold">{lvl.label}</div>
                  <div className="text-[10px] opacity-80">{lvl.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Story Theme */}
          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">
              Story Theme & Adventure:
            </label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-stone-50 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 mb-2"
            >
              {PRESET_THEMES.map((th) => (
                <option key={th} value={th}>
                  {th}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Or type a custom theme..."
              className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-white text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Companion Animal */}
          <div>
            <label className="text-xs font-bold text-stone-700 mb-1 block">
              Favorite Companion:
            </label>
            <select
              value={companion}
              onChange={(e) => setCompanion(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-stone-50 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {COMPANIONS.map((comp) => (
                <option key={comp} value={comp}>
                  {comp}
                </option>
              ))}
            </select>
          </div>

          {/* Offline notice */}
          {!isOnline && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-start gap-2">
              <WifiOff className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-bold">Offline:</span> Connect to Wi-Fi to create new AI stories. All stories already in your library are ready to read!
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isGenerating || !isOnline}
              className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-extrabold text-sm transition-all shadow-md active:scale-98 ${
                !isOnline
                  ? "bg-stone-200 text-stone-400 cursor-not-allowed shadow-none border border-stone-300"
                  : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-200 disabled:opacity-50"
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Writing your 4-page illustrated story...</span>
                </>
              ) : !isOnline ? (
                <>
                  <WifiOff className="w-4 h-4 text-stone-400" />
                  <span>Connect Wi-Fi to Create Stories</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate New Illustrated Book</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
