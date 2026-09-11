/**
 * StoryPals API Client
 *
 * Centralized fetch wrapper with:
 * - Automatic error handling
 * - AI availability awareness (checks /api/health on init)
 * - Type-safe responses
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApiHealth {
  status: "ok" | "error";
  hasApiKey: boolean;
  env: string;
  uptime: string;
  memory: { rss: string; heapUsed: string };
  providers: string[];
}

export interface ApiError {
  error: string;
  fallback?: boolean;
}

export interface TtsResponse {
  audioBase64: string;
  mimeType: string;
  voice: string;
}

export interface IllustrationResponse {
  imageUrl: string;
  imageSize: string;
  aspectRatio: string;
}

export interface ChatResponse {
  reply: string;
  modelUsed: string;
  taskType: string;
}

export interface StoryResponse {
  story: Record<string, any>;
}

// ── AI availability state ─────────────────────────────────────────────────────

let aiAvailable: boolean | null = null;
let healthChecked = false;

/**
 * Check server health to determine if AI (Gemini) is available.
 * Call once on app init; the result is cached.
 */
export async function checkApiHealth(): Promise<ApiHealth> {
  try {
    const res = await fetch("/api/health");
    const data: ApiHealth = await res.json();
    aiAvailable = data.hasApiKey;
    healthChecked = true;
    return data;
  } catch {
    aiAvailable = false;
    healthChecked = true;
    return { status: "error", hasApiKey: false, env: "unknown", uptime: "0", memory: { rss: "0", heapUsed: "0" }, providers: [] };
  }
}

/** Returns true if the Gemini API key is configured on the server. */
export function isAiAvailable(): boolean | null {
  return aiAvailable;
}

/** Returns true if the health check has completed at least once. */
export function hasHealthChecked(): boolean {
  return healthChecked;
}

// ── Generic fetch wrapper ─────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    const err = data as ApiError;
    const error = new Error(err.error || `API error ${res.status}`);
    (error as any).status = res.status;
    (error as any).fallback = err.fallback;
    throw error;
  }

  return data as T;
}

// ── API methods ───────────────────────────────────────────────────────────────

/** Fetch the book catalog */
export async function fetchBooks(params?: {
  q?: string;
  level?: string;
  category?: string;
  source?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ books: any[]; total: number; page: number; pageSize: number }> {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.level) query.set("level", params.level);
  if (params?.category) query.set("category", params.category);
  if (params?.source) query.set("source", params.source);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));

  const qs = query.toString();
  return apiFetch(`/api/books${qs ? `?${qs}` : ""}`);
}

/** Search books (Open Library) */
export async function searchBooks(q: string, source?: string): Promise<{ books: any[]; total: number; query?: string }> {
  const query = new URLSearchParams({ q });
  if (source) query.set("source", source);
  return apiFetch(`/api/books/search?${query}`);
}

/** "Add to My Library": import a discovered Open Library book's full text. */
export async function discoverImportBook(params: {
  workId: string;
  title: string;
  author: string;
  summary?: string;
  subjects?: string[];
  coverImage?: string;
  sourceUrl?: string;
}): Promise<{ book: any }> {
  return apiFetch("/api/books/discover-import", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/** Get a single book by ID */
export async function fetchBook(id: string): Promise<{ book: any }> {
  return apiFetch(`/api/books/${encodeURIComponent(id)}`);
}

// ── Progress persistence ────────────────────────────────────────────────────
// No auth yet, so these work against a single auto-provisioned "default"
// child profile. localStorage stays the fast optimistic cache; the DB is
// the source of truth once it's reachable.

/** Get (or create) the default child profile's ID. Call once and cache it. */
export async function fetchDefaultChildId(): Promise<{ childId: string }> {
  return apiFetch("/api/child/default");
}

/** Load full progress for a child from the DB */
export async function fetchProgress(childId: string): Promise<{ progress: any }> {
  return apiFetch(`/api/progress/${encodeURIComponent(childId)}`);
}

/** Record a page read. Fire-and-forget from the caller's perspective. */
export async function recordPage(
  childId: string,
  params: { bookId: string; pageNumber: number; starsEarned?: number; totalPages?: number }
): Promise<{ persisted: boolean }> {
  return apiFetch(`/api/progress/${encodeURIComponent(childId)}/page`, {
    method: "PATCH",
    body: JSON.stringify(params),
  });
}

/** Unlock a badge server-side. Idempotent — safe to call more than once. */
export async function unlockBadgeRemote(
  childId: string,
  params: { badgeId: string; badgeName?: string; icon?: string }
): Promise<{ persisted: boolean }> {
  return apiFetch(`/api/progress/${encodeURIComponent(childId)}/badge`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/** Approve or reject a pending-review book (admin only) */
export async function updateBookStatus(
  bookId: string,
  status: "approved" | "rejected",
  adminKey: string
): Promise<{ persisted: boolean; book: unknown | null }> {
  return apiFetch(`/api/books/${encodeURIComponent(bookId)}/status`, {
    method: "PATCH",
    headers: { "x-storypals-admin-key": adminKey },
    body: JSON.stringify({ status }),
  });
}

/** Generate TTS audio for story text */
export async function generateTts(text: string, voice: string = "Puck"): Promise<TtsResponse> {
  return apiFetch("/api/tts", {
    method: "POST",
    body: JSON.stringify({ text, voice }),
  });
}

/** Generate an AI illustration */
export async function generateIllustration(params: {
  prompt: string;
  imageSize?: "1K" | "2K" | "4K";
  aspectRatio?: string;
  style?: string;
  pageNumber?: number;
  bookTitle?: string;
}): Promise<IllustrationResponse> {
  return apiFetch("/api/generate-illustration", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/** Persist a generated illustration so it survives a server restart. */
export async function saveIllustration(
  bookId: string,
  params: { pageIndex: number; imageUrl: string; imageSize: "1K" | "2K" | "4K" }
): Promise<{ persisted: boolean; book?: any }> {
  return apiFetch(`/api/books/${encodeURIComponent(bookId)}/illustration`, {
    method: "PATCH",
    body: JSON.stringify(params),
  });
}

/** Send a message to the Reading Buddy chatbot */
export async function sendBuddyChat(params: {
  messages: Array<{ role: string; content: string }>;
  taskType?: "general" | "complex" | "fast";
  buddyRole?: "owl" | "dragon";
  currentBook?: { title: string; level: string };
  currentPage?: { pageNumber: number; text: string };
}): Promise<ChatResponse> {
  return apiFetch("/api/chat", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/** Create a custom AI story */
export async function createStory(params: {
  childName?: string;
  theme?: string;
  favoriteCompanion?: string;
  readingLevel?: "Level 1" | "Level 2" | "Level 3";
}): Promise<StoryResponse> {
  return apiFetch("/api/create-story", {
    method: "POST",
    body: JSON.stringify(params),
  });
}
