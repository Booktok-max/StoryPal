import React, { useEffect, useState } from "react";
import { BookOpen, ExternalLink, Loader2, Search, X, Sparkles } from "lucide-react";
import { Book } from "../types";
import { SafeStoryImage } from "./SafeStoryImage";

interface BookDiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_SEARCHES = [
  "fairy tales",
  "animals",
  "friendship",
  "adventure",
  "magic",
  "nature",
];

export const BookDiscoveryModal: React.FC<BookDiscoveryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setError("");
      setHasSearched(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const searchBooks = async (searchQuery?: string) => {
    const q = (searchQuery ?? query).trim();
    if (!q) return;

    setLoading(true);
    setError("");
    setHasSearched(true);

    try {
      const response = await fetch(
        `/api/books/search?q=${encodeURIComponent(q)}&source=openlibrary`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not find books right now.");
      setResults(Array.isArray(data.books) ? data.books : []);
    } catch (err: any) {
      setResults([]);
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchBooks();
  };

  const openSource = (book: Book) => {
    if (book.source?.sourceUrl)
      window.open(book.source.sourceUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-sm">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl bg-[#fdfbf7] shadow-2xl border border-amber-200 flex flex-col">

        {/* ── Header ── */}
        <div className="p-5 sm:p-6 border-b border-amber-100 flex items-start justify-between gap-4 bg-white">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-extrabold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Find New Books
            </div>
            <h2 className="text-2xl font-display font-extrabold text-stone-900">
              Discover More Stories
            </h2>
            <p className="text-sm text-stone-500 mt-1 max-w-2xl">
              Search for children's books by topic, title, or author. Tap a
              result to see it on Open Library, where you can read more about
              the book.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-stone-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Search bar ── */}
        <form
          onSubmit={handleSubmit}
          className="p-5 border-b border-stone-100 bg-amber-50/50"
        >
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={'Try "fairy tales", "animals", "friendship"…'}
                className="w-full rounded-2xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-5 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-extrabold text-sm"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Search"
              )}
            </button>
          </div>

          {/* Quick-search chips */}
          <div className="flex flex-wrap gap-2 mt-3">
            {QUICK_SEARCHES.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => {
                  setQuery(topic);
                  searchBooks(topic);
                }}
                className="px-3 py-1 rounded-full bg-white border border-amber-200 text-amber-700 text-xs font-bold hover:bg-amber-50 capitalize"
              >
                {topic}
              </button>
            ))}
          </div>
        </form>

        {/* ── Results ── */}
        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-4 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !results.length && !hasSearched && (
            <div className="py-16 text-center text-stone-500">
              <div className="text-5xl mb-4">📚</div>
              <p className="font-bold text-stone-700 text-lg">
                What kind of story are you looking for?
              </p>
              <p className="text-sm mt-1">
                Search above or tap one of the quick topics to get started.
              </p>
            </div>
          )}

          {!loading && hasSearched && !results.length && !error && (
            <div className="py-16 text-center text-stone-500">
              <div className="text-4xl mb-3">🔍</div>
              <p className="font-bold text-stone-700">No books found for "{query}".</p>
              <p className="text-sm mt-1">Try a different word — like "animals" or "fairy tales".</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((book) => (
              <div
                key={book.id}
                className="bg-white rounded-2xl border border-amber-100 overflow-hidden shadow-sm flex flex-col"
              >
                <div className="aspect-[4/3] bg-amber-50">
                  <SafeStoryImage
                    src={book.coverImage}
                    alt={book.title}
                    title={book.title}
                    author={book.author}
                    category={book.category}
                    className="w-full h-full"
                  />
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-bold text-stone-900 leading-tight">
                    {book.title}
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">{book.author}</p>
                  {book.levelShort && (
                    <span className="mt-2 inline-block self-start px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                      {book.levelShort}
                    </span>
                  )}
                  <p className="text-xs text-stone-600 mt-2 line-clamp-3 flex-1">
                    {book.summary}
                  </p>
                  <button
                    onClick={() => openSource(book)}
                    disabled={!book.source?.sourceUrl}
                    className="mt-4 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-50 text-amber-800 hover:bg-amber-100 font-extrabold text-xs disabled:opacity-40"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    View on Open Library
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 bg-white border-t border-stone-100 text-[11px] text-stone-400">
          Book information and covers from Open Library (openlibrary.org). Results
          are filtered for children's content — not all books are available to read
          inside StoryPals yet.
        </div>
      </div>
    </div>
  );
};
