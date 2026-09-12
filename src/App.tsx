import React, { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import { Book, UserProgress, ReaderSettings, BuddyRole, ImageSizeOption } from "./types";
import { INITIAL_BOOKS } from "./data/initialBooks";
import {
  generateInitial7DayActivity,
  reconcile7DayActivity,
  recordPageReadActivity,
} from "./utils/readingHabits";
import { Navbar } from "./components/Navbar";
import { BookShelf } from "./components/BookShelf";
import { StoryReader } from "./components/StoryReader";
import { ReadingBuddyChat } from "./components/ReadingBuddyChat";
import { ProgressDashboard } from "./components/ProgressDashboard";
import { ParentalDashboard } from "./components/ParentalDashboard";
import { StoryCreatorModal } from "./components/StoryCreatorModal";
import { OfflineBanner } from "./components/OfflineBanner";
import { PhonicsWordInfo } from "./utils/phonics";
import { BookDiscoveryModal } from "./components/BookDiscoveryModal";
import { LoginScreen } from "./components/LoginScreen";
import { ChildGate } from "./components/ChildGate";
import { useApiHealth } from "./hooks/useApiHealth";
import { useAuth } from "./hooks/useAuth";
import { saveIllustration, fetchProgress, recordPage, unlockBadgeRemote } from "./api/client";

const STORAGE_KEY_PROGRESS = "storypals_user_progress_v1";
const STORAGE_KEY_BOOKS = "storypals_custom_books_v1";

interface AppShellProps {
  activeChildId: string;
  activeChildName: string;
  onSwitchProfile: () => void;
}

function AppShell({ activeChildId, activeChildName, onSwitchProfile }: AppShellProps) {
  const { aiAvailable } = useApiHealth();

  const [books, setBooks] = useState<Book[]>(INITIAL_BOOKS);

  useEffect(() => {
    let cancelled = false;

    const loadBooks = async () => {
      try {
        const response = await fetch("/api/books");
        if (!response.ok) throw new Error(`Book catalog request failed (${response.status})`);

        const data = await response.json();
        if (cancelled || !Array.isArray(data.books)) return;

        let customBooks: Book[] = [];
        try {
          const saved = localStorage.getItem(STORAGE_KEY_BOOKS);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) customBooks = parsed;
          }
        } catch (e) {
          console.warn("Failed to load saved books", e);
        }

        setBooks([...data.books, ...customBooks]);
      } catch (e) {
        console.warn("Failed to load book catalog; using built-in fallback", e);
      }
    };

    loadBooks();
    return () => { cancelled = true; };
  }, []);

  const [selectedBook, setSelectedBook] = useState<Book | null>(INITIAL_BOOKS[0]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [activeView, setActiveView] = useState<"shelf" | "reader" | "passport" | "parent">("shelf");

  const [progress, setProgress] = useState<UserProgress>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PROGRESS);
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            ...parsed,
            dailyActivity: parsed.dailyActivity
              ? reconcile7DayActivity(parsed.dailyActivity)
              : generateInitial7DayActivity(),
            dailyGoalPages: parsed.dailyGoalPages || 3,
          };
        }
      } catch (e) {
        console.warn("Failed to load saved progress", e);
      }
    }
    return {
      totalStars: 4,
      readingStreakDays: 4,
      totalPagesRead: 19,
      xp: 145,
      booksCompleted: [],
      bookProgress: {
        "tortoise-and-hare": {
          currentPage: 2,
          completed: false,
          pagesRead: [1, 2],
          starsEarned: 3,
        },
      },
      unlockedBadges: ["first-page"],
      wordsExplored: [
        {
          word: "tortoise",
          syllables: "tor·toise",
          meaning: "A calm, gentle creature with a sturdy shell who moves slowly and steadily.",
          bookTitle: "The Tortoise & the Hare",
        },
        {
          word: "hare",
          syllables: "hare",
          meaning: "A swift animal with long ears like a large rabbit who can leap very fast.",
          bookTitle: "The Tortoise & the Hare",
        },
      ],
      dailyActivity: generateInitial7DayActivity(),
      dailyGoalPages: 3,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(progress));
    } catch (e) {
      console.warn("Could not save progress", e);
    }
  }, [progress]);

  // ── DB-backed progress (Sprint C: Identity) ─────────────────────────────────
  // The active child now comes from the session (via AppShell's props, set by
  // useAuth/switchActiveChild) rather than an auto-provisioned default or a
  // client-cached id — the server resolves req.session.activeChildId itself,
  // so no id needs to be sent from here at all. Merge DB progress over the
  // localStorage snapshot: DB wins on conflict; if the DB is unreachable this
  // silently falls back to the localStorage-only behavior above.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { progress: dbProgress } = await fetchProgress();
        if (cancelled || !dbProgress) return;

        setProgress((prev) => ({
          ...prev,
          ...dbProgress,
          dailyActivity: dbProgress.dailyActivity
            ? reconcile7DayActivity(dbProgress.dailyActivity)
            : prev.dailyActivity,
        }));
      } catch (e) {
        // DB unavailable or child not found yet — keep using localStorage only.
        console.warn("Could not load progress from DB, using local cache", e);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Re-fetch whenever the active child changes (e.g. switching profiles).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChildId]);

  const [settings, setSettings] = useState<ReaderSettings>({
    fontSize: "large",
    fontFamily: "quicksand",
    showSyllables: false,
    voice: "Puck",
  });

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [buddyRole, setBuddyRole] = useState<BuddyRole>("owl");
  const [pendingChatPrompt, setPendingChatPrompt] = useState<{
    text: string;
    taskType: "general" | "complex" | "fast";
  } | null>(null);

  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [isBookDiscoveryOpen, setIsBookDiscoveryOpen] = useState(false);

  const [badgeToast, setBadgeToast] = useState<{ name: string; icon: string } | null>(null);

  const unlockBadge = (badgeId: string, badgeName: string, icon: string) => {
    if (!progress.unlockedBadges.includes(badgeId)) {
      setProgress((prev) => ({
        ...prev,
        unlockedBadges: [...prev.unlockedBadges, badgeId],
        xp: prev.xp + 25,
        totalStars: prev.totalStars + 2,
      }));

      setBadgeToast({ name: badgeName, icon });
      confetti({ particleCount: 40, spread: 70, origin: { y: 0.2 } });
      setTimeout(() => setBadgeToast(null), 4000);

      // activeChildId is always present here — AppShell only mounts once a
      // child profile is selected — so this is unconditional (Sprint C).
      unlockBadgeRemote({ badgeId, badgeName, icon }).catch((e) =>
        console.warn("Could not persist badge unlock", e)
      );
    }
  };

  const handleSelectBook = (book: Book) => {
    setSelectedBook(book);
    const existing = progress.bookProgress[book.id];
    setCurrentPageIndex(existing ? Math.max(0, existing.currentPage - 1) : 0);
    setActiveView("reader");
  };

  const handlePageCompleted = (pageNumber: number) => {
    if (!selectedBook) return;

    unlockBadge("first-page", "Page Turner", "📖");

    const bookId = selectedBook.id;
    const currentBookProg = progress.bookProgress[bookId] || {
      currentPage: 1,
      completed: false,
      pagesRead: [],
      starsEarned: 0,
    };

    const newPagesRead = Array.from(new Set([...currentBookProg.pagesRead, pageNumber]));
    const isBookNowCompleted = newPagesRead.length >= selectedBook.pages.length;
    const newStarsEarned = currentBookProg.starsEarned + 1;
    const newTotalStars = progress.totalStars + 1;

    setProgress((prev) => {
      const updatedBooksCompleted = isBookNowCompleted
        ? Array.from(new Set([...prev.booksCompleted, bookId]))
        : prev.booksCompleted;

      const updatedDailyActivity = recordPageReadActivity(prev.dailyActivity, 1);

      return {
        ...prev,
        totalStars: newTotalStars,
        totalPagesRead: prev.totalPagesRead + 1,
        xp: prev.xp + 15,
        booksCompleted: updatedBooksCompleted,
        dailyActivity: updatedDailyActivity,
        bookProgress: {
          ...prev.bookProgress,
          [bookId]: {
            currentPage: Math.min(pageNumber + 1, selectedBook.pages.length),
            completed: isBookNowCompleted,
            pagesRead: newPagesRead,
            starsEarned: newStarsEarned,
          },
        },
      };
    });

    if (isBookNowCompleted) unlockBadge("book-finisher", "Book Champion", "🏆");
    if (newTotalStars >= 10) unlockBadge("super-streak", "Star Reader", "⭐");

    recordPage({
      bookId,
      pageNumber,
      starsEarned: 1,
      totalPages: selectedBook.pages.length,
    }).catch((e) => console.warn("Could not persist page read", e));
  };

  const handleWordExplored = (wordInfo: PhonicsWordInfo) => {
    if (!selectedBook) return;

    setProgress((prev) => {
      const exists = prev.wordsExplored.some((w) => w.word === wordInfo.word);
      const newWords = exists
        ? prev.wordsExplored
        : [
            ...prev.wordsExplored,
            {
              word: wordInfo.word,
              syllables: wordInfo.syllables,
              meaning: wordInfo.meaning,
              bookTitle: selectedBook.title,
            },
          ];

      if (newWords.length >= 5) {
        setTimeout(() => unlockBadge("word-wizard", "Word Wizard", "✨"), 300);
      }

      return { ...prev, xp: prev.xp + 2, wordsExplored: newWords };
    });
  };

  const handleIllustrationGenerated = (
    pageIndex: number,
    newImageUrl: string,
    size: ImageSizeOption
  ) => {
    if (!selectedBook) return;

    const updatedPages = [...selectedBook.pages];
    updatedPages[pageIndex] = {
      ...updatedPages[pageIndex],
      currentImageUrl: newImageUrl,
      imageSize: size,
    };

    const updatedBook = { ...selectedBook, pages: updatedPages };
    setSelectedBook(updatedBook);
    setBooks((prev) => prev.map((b) => (b.id === updatedBook.id ? updatedBook : b)));

    saveIllustration(updatedBook.id, { pageIndex, imageUrl: newImageUrl, imageSize: size }).catch(
      (err) => console.warn("Failed to persist illustration:", err)
    );

    unlockBadge("art-director", "AI Illustrator", "🎨");
  };

  const handleOpenChatWithContext = (
    promptText: string,
    taskType: "general" | "complex" | "fast"
  ) => {
    setPendingChatPrompt({ text: promptText, taskType });
    setIsChatOpen(true);
  };

  const handleBookAdded = (newBook: Book) => {
    setBooks((prev) => {
      if (prev.some((b) => b.id === newBook.id)) return prev;
      return [newBook, ...prev];
    });
    unlockBadge("book-scout", "Book Scout", "🔎");
  };

  const handleStoryCreated = (newBook: Book) => {
    setBooks((prev) => {
      const updated = [newBook, ...prev];
      try {
        const customOnly = updated.filter((b) => b.id.startsWith("custom-"));
        localStorage.setItem(STORAGE_KEY_BOOKS, JSON.stringify(customOnly));
      } catch (e) {
        console.warn("Failed to persist custom book", e);
      }
      return updated;
    });

    setSelectedBook(newBook);
    setCurrentPageIndex(0);
    setActiveView("reader");
    unlockBadge("story-creator", "Story Maker", "🪄");
  };

  const handleUpdateDailyGoal = (newGoal: number) => {
    setProgress((prev) => ({ ...prev, dailyGoalPages: newGoal }));
  };

  // Handler: Parental reading level override
  const handleLevelOverride = async (bookId: string, level: Book["levelShort"]) => {
    const levelFull =
      level === "Level 1"
        ? "Level 1 (Early Reader)"
        : level === "Level 2"
        ? "Level 2 (Developing)"
        : "Level 3 (Confident)";

    const response = await fetch(`/api/books/${encodeURIComponent(bookId)}/level`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ levelShort: level, level: levelFull }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error((data as any).error || "Failed to save level override.");
    }

    setBooks((prev) =>
      prev.map((b) =>
        b.id === bookId ? { ...b, levelShort: level, level: levelFull } : b
      )
    );

    // Keep selected book in sync if it's the one being overridden
    setSelectedBook((prev) =>
      prev && prev.id === bookId ? { ...prev, levelShort: level, level: levelFull } : prev
    );
  };

  const handleStatusUpdate = (bookId: string, status: "approved" | "rejected") => {
    setBooks((prev) =>
      prev.map((b) => (b.id === bookId ? { ...b, status } : b))
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfbf7] text-stone-800">
      <OfflineBanner />

      {aiAvailable === false && (
        <aside className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2.5 text-xs shadow-sm flex items-center justify-center gap-3 z-50">
          <span className="font-extrabold tracking-wide">✨ AI Features Offline</span>
          <span className="text-indigo-100 font-medium">
            Voice narration, illustrations, reading buddy & story creation require a Gemini API key.
          </span>
          <span className="text-indigo-200 text-[11px]">
            Set GEMINI_API_KEY in .env.local and restart the server.
          </span>
        </aside>
      )}

      <Navbar
        progress={progress}
        activeView={activeView}
        setActiveView={setActiveView}
        isChatOpen={isChatOpen}
        setIsChatOpen={setIsChatOpen}
        buddyRole={buddyRole}
        setBuddyRole={setBuddyRole}
        settings={settings}
        setSettings={setSettings}
        hasActiveBook={!!selectedBook}
        activeChildName={activeChildName}
        onSwitchProfile={onSwitchProfile}
      />

      <main className="flex-1">
        {activeView === "shelf" && (
          <BookShelf
            books={books}
            progress={progress}
            onSelectBook={handleSelectBook}
            onOpenCreateStory={() => setIsCreateStoryOpen(true)}
            onOpenPassport={() => setActiveView("passport")}
            onOpenBookDiscovery={() => setIsBookDiscoveryOpen(true)}
            onLevelOverride={handleLevelOverride}
            onStatusUpdate={handleStatusUpdate}
          />
        )}

        {activeView === "reader" && selectedBook && (
          <StoryReader
            book={selectedBook}
            currentPageIndex={currentPageIndex}
            onPageChange={(idx) => setCurrentPageIndex(idx)}
            onBackToShelf={() => setActiveView("shelf")}
            onPageCompleted={handlePageCompleted}
            onWordExplored={handleWordExplored}
            onIllustrationGenerated={handleIllustrationGenerated}
            onOpenChatWithContext={handleOpenChatWithContext}
            settings={settings}
            setSettings={setSettings}
          />
        )}

        {activeView === "passport" && (
          <ProgressDashboard
            progress={progress}
            books={books}
            onBackToShelf={() => setActiveView("shelf")}
            onSelectBook={handleSelectBook}
            onUpdateDailyGoal={handleUpdateDailyGoal}
          />
        )}

        {activeView === "parent" && (
          <ParentalDashboard
            progress={progress}
            books={books}
            onBackToShelf={() => setActiveView("shelf")}
          />
        )}
      </main>

      <ReadingBuddyChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        buddyRole={buddyRole}
        setBuddyRole={setBuddyRole}
        currentBook={selectedBook || undefined}
        currentPage={selectedBook?.pages[currentPageIndex] || undefined}
        settings={settings}
        pendingPrompt={pendingChatPrompt}
        clearPendingPrompt={() => setPendingChatPrompt(null)}
        onBuddyChatCompleted={() => {
          unlockBadge("reading-buddy", "Story Chat Friend", "🦉");
        }}
      />

      <BookDiscoveryModal
        isOpen={isBookDiscoveryOpen}
        onClose={() => setIsBookDiscoveryOpen(false)}
        onBookAdded={handleBookAdded}
      />

      <StoryCreatorModal
        isOpen={isCreateStoryOpen}
        onClose={() => setIsCreateStoryOpen(false)}
        onStoryCreated={handleStoryCreated}
      />

      {badgeToast && (
        <div
          id="badge-unlock-toast"
          className="fixed top-20 right-4 sm:right-8 z-50 bg-white rounded-2xl p-4 shadow-2xl border-2 border-amber-400 flex items-center gap-3 animate-in slide-in-from-top-4 duration-300"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center text-2xl">
            {badgeToast.icon}
          </div>
          <div>
            <div className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider">
              Badge Unlocked!
            </div>
            <div className="font-display font-extrabold text-sm text-stone-900">
              {badgeToast.name}
            </div>
            <div className="text-xs text-amber-700 font-medium">+2 Stars ⭐ & 25 XP</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Auth gate (Sprint C: Identity) ──────────────────────────────────────────
// Login → pick/create a child profile → AppShell. AppShell only mounts once
// there's a real activeChildId, so none of its hooks ever run signed-out.

export default function App() {
  const auth = useAuth();

  if (auth.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdfbf7]">
        <div className="text-stone-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (auth.status === "signed-out" || !auth.me) {
    return <LoginScreen onLogin={auth.login} onRegister={auth.register} />;
  }

  if (!auth.activeChild) {
    return (
      <ChildGate
        childProfiles={auth.me.children}
        onSelect={auth.selectChild}
        onAdd={auth.addChild}
        onLogout={auth.logout}
      />
    );
  }

  return (
    <AppShell
      key={auth.activeChild.id}
      activeChildId={auth.activeChild.id}
      activeChildName={auth.activeChild.displayName}
      onSwitchProfile={() => {
        auth.deselectChild().catch((e) => console.warn("Could not switch profiles", e));
      }}
    />
  );
}
