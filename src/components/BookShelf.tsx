import React, { useState } from "react";
import {
  BookOpen,
  Sparkles,
  CheckCircle2,
  Play,
  PlusCircle,
  Star,
  Award,
  ChevronRight,
  SlidersHorizontal,
  Bookmark,
  Scroll,
  GraduationCap,
} from "lucide-react";
import { Book, UserProgress, ShelfItem } from "../types";
import { SafeStoryImage } from "./SafeStoryImage";
import { LevelOverrideModal } from "./LevelOverrideModal";
import { updateBookStatus } from "../api/client";
import { SHELF_STATUS_LABELS, SHELF_STATUS_EMOJI } from "../hooks/useShelf";

const ADMIN_MODE = import.meta.env.VITE_ADMIN_MODE === "true";
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY ?? "";

const IMPORTED_SOURCES = new Set(["public-domain", "openlibrary", "standardebooks"]);
const isImported = (book: Book) =>
  book.source?.type ? IMPORTED_SOURCES.has(book.source.type) : false;

interface BookShelfProps {
  books: Book[];
  progress: UserProgress;
  shelfItems: ShelfItem[];
  onSelectBook: (book: Book) => void;
  onOpenCreateStory: () => void;
  onOpenPassport: () => void;
  onOpenBookDiscovery: () => void;
  onLevelOverride: (bookId: string, level: Book["levelShort"]) => Promise<void>;
  onStatusUpdate: (bookId: string, status: "approved" | "rejected") => void;
  onShelfToggle: (bookId: string) => void;
}

export const BookShelf: React.FC<BookShelfProps> = ({
  books,
  progress,
  shelfItems,
  onSelectBook,
  onOpenCreateStory,
  onOpenPassport,
  onOpenBookDiscovery,
  onLevelOverride,
  onStatusUpdate,
  onShelfToggle,
}) => {
  const [filter, setFilter] = useState<string>("all");
  const [overrideBook, setOverrideBook] = useState<Book | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const shelfMap = new Map(shelfItems.map((i) => [i.bookId, i]));

  const handleReviewAction = async (book: Book, status: "approved" | "rejected") => {
    setReviewingId(book.id);
    try {
      await updateBookStatus(book.id, status, ADMIN_KEY);
      onStatusUpdate(book.id, status);
    } catch (err) {
      console.error("Status update failed:", err);
    } finally {
      setReviewingId(null);
    }
  };

  const filteredBooks = books.filter((b) => {
    if (filter === "all") return true;
    if (filter === "fables") return b.category === "fable" || b.author.includes("Aesop");
    if (filter === "Level 1") return b.levelShort === "Level 1";
    if (filter === "Level 2") return b.levelShort === "Level 2";
    if (filter === "Level 3") return b.levelShort === "Level 3";
    if (filter === "custom") return b.id.startsWith("custom-");
    if (filter === "shelf") return shelfMap.has(b.id);
    return true;
  });

  const fablesCount = books.filter(
    (b) => b.category === "fable" || b.author.includes("Aesop")
  ).length;

  return (
    <div id="bookshelf-container" className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
      {/* Welcome Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-400 p-6 sm:p-8 text-white shadow-xl shadow-amber-200/50 mb-8 border border-amber-300/40">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-yellow-100" />
            <span>Children&apos;s Book Database &amp; Classics Collection</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-display font-extrabold tracking-tight mb-2 leading-tight">
            Read, Listen, &amp; Create Magical Illustrations!
          </h1>
          <p className="text-sm sm:text-base text-amber-50 font-medium leading-relaxed mb-6">
            Pre-seeded with timeless classics like <strong>Aesop&apos;s Fables</strong>. Every page
            can speak aloud with warm narration, interactive phonics sound-outs, and new custom
            illustrations in 1K, 2K, or 4K!
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              id="hero-create-story-btn"
              onClick={onOpenCreateStory}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white text-amber-900 font-extrabold text-sm shadow-md hover:bg-amber-50 hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <PlusCircle className="w-4 h-4 text-amber-600" />
              <span>Create My Own Story</span>
            </button>
            <button
              id="hero-find-more-books-btn"
              onClick={onOpenBookDiscovery}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-sky-800 font-bold text-sm shadow-md hover:bg-sky-50 transition-all border border-white/70"
            >
              <BookOpen className="w-4 h-4" />
              <span>Find More Books</span>
            </button>
            <button
              id="hero-view-passport-btn"
              onClick={onOpenPassport}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-900/20 backdrop-blur-sm text-white font-bold text-sm hover:bg-amber-900/30 transition-all border border-white/30"
            >
              <Award className="w-4 h-4 text-yellow-200" />
              <span>My Passport &amp; Badges</span>
            </button>
          </div>
        </div>

        <div className="absolute -right-6 -bottom-8 select-none pointer-events-none opacity-25 sm:opacity-40 text-9xl">
          📚
        </div>
      </div>

      {/* Gamified Reading Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg">
            ⭐
          </div>
          <div>
            <div className="text-xl font-extrabold text-amber-950">{progress.totalStars}</div>
            <div className="text-xs text-amber-800/80 font-medium">Stars Earned</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-lg">
            📖
          </div>
          <div>
            <div className="text-xl font-extrabold text-stone-900">{progress.totalPagesRead}</div>
            <div className="text-xs text-stone-500 font-medium">Pages Turned</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
            🏆
          </div>
          <div>
            <div className="text-xl font-extrabold text-emerald-950">
              {progress.booksCompleted.length}
            </div>
            <div className="text-xs text-stone-500 font-medium">Books Finished</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-lg">
            ✨
          </div>
          <div>
            <div className="text-xl font-extrabold text-purple-950">
              {progress.wordsExplored.length}
            </div>
            <div className="text-xs text-stone-500 font-medium">Words Learned</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-amber-800" />
          <h2 className="text-lg font-bold text-amber-950">
            Children&apos;s Storybooks ({filteredBooks.length})
          </h2>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: "all", label: `All Books (${books.length})` },
            { id: "shelf", label: `🔖 My Shelf (${shelfItems.length})` },
            { id: "fables", label: `📜 Aesop's Fables (${fablesCount})` },
            { id: "Level 1", label: "Level 1 (Early)" },
            { id: "Level 2", label: "Level 2 (Developing)" },
            { id: "Level 3", label: "Level 3 (Confident)" },
            { id: "custom", label: "My Custom Stories" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filter === tab.id
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-white text-stone-600 hover:text-stone-900 border border-stone-200/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Book Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBooks.map((book) => {
          const bookStat = progress.bookProgress[book.id] || {
            currentPage: 1,
            completed: false,
            pagesRead: [],
            starsEarned: 0,
          };
          const totalPages = book.pages.length;
          const readCount = bookStat.pagesRead.length;
          const percent = Math.round((readCount / totalPages) * 100);
          const isCompleted = bookStat.completed || percent === 100;

          const shelfItem = shelfMap.get(book.id);
          const onShelf = !!shelfItem;

          return (
            <div
              key={book.id}
              id={`book-card-${book.id}`}
              className="bg-white rounded-3xl overflow-hidden border border-amber-200/80 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group hover:-translate-y-1"
            >
              {/* Cover Image */}
              <div className="relative aspect-[4/3] overflow-hidden bg-amber-100">
                <SafeStoryImage
                  src={book.pages[0]?.currentImageUrl || book.coverImage}
                  alt={book.title}
                  title={book.title}
                  author={book.author}
                  category={book.category}
                  prompt={book.pages[0]?.illustrationPrompt}
                  className="w-full h-full"
                  imageClassName="group-hover:scale-105 transition-transform duration-500"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

                {/* Level & Category badges */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
                  <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-white/95 text-amber-900 shadow-sm backdrop-blur-xs">
                    {book.levelShort}
                  </span>
                  {book.tag && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-900/80 text-amber-100 backdrop-blur-xs">
                      {book.tag}
                    </span>
                  )}
                  {book.status === "pending-review" && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/90 text-white backdrop-blur-xs">
                      Pending Review
                    </span>
                  )}
                  {/* Shelf status badge */}
                  {shelfItem && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600/90 text-white backdrop-blur-xs">
                      {SHELF_STATUS_EMOJI[shelfItem.status]} {SHELF_STATUS_LABELS[shelfItem.status]}
                    </span>
                  )}
                </div>

                {/* Bookmark / shelf toggle button */}
                <button
                  onClick={(e) => { e.stopPropagation(); onShelfToggle(book.id); }}
                  title={onShelf ? "Remove from shelf" : "Save to shelf"}
                  className={`absolute top-3 right-3 z-20 p-1.5 rounded-full shadow-md transition-all active:scale-90 ${
                    onShelf
                      ? "bg-indigo-600 text-white"
                      : "bg-white/80 text-stone-400 hover:text-indigo-600 hover:bg-white backdrop-blur-xs"
                  }`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${onShelf ? "fill-current" : ""}`} />
                </button>

                {/* Completion / progress badge — repositioned below bookmark button */}
                {isCompleted ? (
                  <div className="absolute bottom-14 right-3 z-10 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-sm">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Completed!</span>
                  </div>
                ) : readCount > 0 ? (
                  <div className="absolute bottom-14 right-3 z-10 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-sm">
                    <span>
                      Page {bookStat.currentPage} of {totalPages}
                    </span>
                  </div>
                ) : null}

                {/* Title and author overlay */}
                <div className="absolute bottom-3 left-3 right-3 text-white z-10 pointer-events-none">
                  <h3 className="font-display font-bold text-lg leading-tight drop-shadow-sm">
                    {book.title}
                  </h3>
                  <p className="text-xs text-amber-100 font-medium">{book.author}</p>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed mb-3">
                    {book.summary}
                  </p>

                  {book.moral && (
                    <div className="p-2.5 rounded-2xl bg-purple-50/80 border border-purple-200/70 text-[11px] text-purple-900 leading-snug mb-4">
                      <span className="font-bold">Moral: </span>
                      <span className="italic">{book.moral}</span>
                    </div>
                  )}
                </div>

                {/* Progress & Actions */}
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold mb-1">
                      <span className="text-stone-500">Reading Progress</span>
                      <span className="text-amber-800">
                        {readCount} / {totalPages} pages ({percent}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Admin approve/reject — pending-review books only */}
                  {ADMIN_MODE && book.status === "pending-review" ? (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReviewAction(book, "approved"); }}
                        disabled={reviewingId === book.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-extrabold text-xs shadow-md transition-all active:scale-95"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReviewAction(book, "rejected"); }}
                        disabled={reviewingId === book.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-extrabold text-xs shadow-md transition-all active:scale-95"
                      >
                        ✗ Reject
                      </button>
                    </div>
                  ) : (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      id={`read-book-btn-${book.id}`}
                      onClick={() => onSelectBook(book)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs shadow-md shadow-amber-200 transition-all active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>
                        {isCompleted
                          ? "Read Again"
                          : readCount > 0
                          ? "Continue Reading"
                          : "Start Reading"}
                      </span>
                    </button>

                    {/* Level override button — imported books only */}
                    {isImported(book) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOverrideBook(book);
                        }}
                        className="p-2.5 rounded-2xl border border-stone-200 hover:bg-stone-50 text-stone-400 hover:text-amber-700 transition-colors"
                        title="Override reading level"
                      >
                        <GraduationCap className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Create New Story Card */}
        <div
          onClick={onOpenCreateStory}
          className="rounded-3xl border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/50 hover:bg-amber-50/80 p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 group min-h-[320px]"
        >
          <div className="w-16 h-16 rounded-3xl bg-amber-200/80 group-hover:bg-amber-300 text-amber-800 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform shadow-xs">
            🪄
          </div>
          <h3 className="font-display font-bold text-lg text-amber-950 mb-2">
            Create a New Story
          </h3>
          <p className="text-xs text-amber-800/80 max-w-xs leading-relaxed mb-5">
            Pick your child&apos;s name, companion animal, and theme. Our AI Storyteller will write
            a custom 4-page story ready for reading and illustration generation!
          </p>
          <button
            id="create-custom-story-card-btn"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs shadow-sm group-hover:bg-amber-700 transition-colors"
          >
            <span>Launch Story Maker</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Level Override Modal */}
      {overrideBook && (
        <LevelOverrideModal
          book={overrideBook}
          isOpen={true}
          onClose={() => setOverrideBook(null)}
          onSave={async (bookId, level) => {
            await onLevelOverride(bookId, level);
            setOverrideBook(null);
          }}
        />
      )}
    </div>
  );
};
