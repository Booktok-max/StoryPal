export interface BookPage {
  pageNumber: number;
  text: string;
  illustrationPrompt: string;
  currentImageUrl?: string;
  imageSize?: "1K" | "2K" | "4K";
  keyWords: string[];
  phonicsFocus?: string;
}

export type BookSourceType =
  | "builtin"
  | "openlibrary"
  | "standardebooks"
  | "public-domain"
  | "uploaded"
  | "ai";

export type BookStatus = "draft" | "pending-review" | "approved" | "rejected";

export interface BookSource {
  type: BookSourceType;
  providerId: string;
  externalId?: string;
  sourceUrl?: string;
  /** Open Library's own signal that a full readable text exists somewhere. */
  hasFullText?: boolean;
  /** Open Library's ebook_access value ("public", "borrowable", etc.). */
  ebookAccess?: string;
}

export interface BookRights {
  license?: string;
  publicDomain?: boolean;
  attributionRequired?: boolean;
  redistributionAllowed?: boolean;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  coverImage: string;
  level: "Level 1 (Early Reader)" | "Level 2 (Developing)" | "Level 3 (Confident)";
  levelShort: "Level 1" | "Level 2" | "Level 3";
  colorTheme: string;
  summary: string;
  pages: BookPage[];
  category?: "fable" | "classic" | "adventure" | "custom";
  moral?: string;
  tag?: string;

  // Book platform metadata. Optional so existing books remain backward compatible.
  source?: BookSource;
  rights?: BookRights;
  language?: string;
  subjects?: string[];
  ageMin?: number;
  ageMax?: number;
  wordCount?: number;
  estimatedMinutes?: number;
  status?: BookStatus;
  aiEnhanced?: boolean;
}

export interface DailyReadingActivity {
  date: string; // YYYY-MM-DD
  dayLabel: string; // "Mon", "Tue", etc.
  pages: number;
  minutes: number;
  stars: number;
  goalMet: boolean;
}

export interface UserProgress {
  totalStars: number;
  readingStreakDays: number;
  totalPagesRead: number;
  xp: number;
  booksCompleted: string[];
  bookProgress: Record<
    string,
    {
      currentPage: number;
      completed: boolean;
      pagesRead: number[];
      starsEarned: number;
    }
  >;
  unlockedBadges: string[];
  wordsExplored: Array<{
    word: string;
    syllables: string;
    meaning: string;
    bookTitle: string;
  }>;
  dailyActivity?: DailyReadingActivity[];
  dailyGoalPages?: number;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  requirement: string;
  color: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: number;
  modelUsed?: string;
  taskType?: "general" | "complex" | "fast";
}

export type BuddyRole = "owl" | "dragon";

export type ImageSizeOption = "1K" | "2K" | "4K";

export interface ReaderSettings {
  fontSize: "normal" | "large" | "extra-large";
  fontFamily: "quicksand" | "fredoka" | "dyslexic";
  showSyllables: boolean;
  voice: "Puck" | "Kore" | "Zephyr";
}
