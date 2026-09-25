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
    credentials: "include", // send the sp_session cookie on every request
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

// ── Auth (Sprint B/C: Identity) ──────────────────────────────────────────────

export interface ChildSummary {
  id: string;
  displayName: string;
  ageBand: string | null;
  readingLevel: string | null;
  avatarKey: string | null;
  buddyRole: "owl" | "dragon";
}

export interface MeResponse {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  activeChildId: string | null;
  emailVerified: boolean;
  children: ChildSummary[];
}

export interface AuthApiError {
  error: { code: string; message?: string };
}

/** Throws with a readable message parsed from the { error: { code, message } } shape. */
async function authFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    credentials: "include",
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = (data as AuthApiError)?.error;
    const error = new Error(err?.message || err?.code || `Request failed (${res.status})`);
    (error as any).code = err?.code;
    (error as any).status = res.status;
    throw error;
  }
  return data as T;
}

/** Register a new parent/guardian account. Does not log in automatically. */
export async function registerAccount(params: {
  email: string;
  displayName: string;
  password: string;
}): Promise<{ userId: string }> {
  return authFetch("/api/auth/register", { method: "POST", body: JSON.stringify(params) });
}

/** Log in and establish the session cookie. */
export async function loginAccount(params: { email: string; password: string }): Promise<{ ok: true; userId: string }> {
  return authFetch("/api/auth/login", { method: "POST", body: JSON.stringify(params) });
}

/** Log out and clear the session cookie. */
export async function logoutAccount(): Promise<{ ok: true }> {
  return authFetch("/api/auth/logout", { method: "POST" });
}

/**
 * Current session: who's logged in, their children, and which child is
 * active. Throws (401) if there is no valid session — callers should treat
 * that as "show the login screen", not as an error to surface.
 */
export async function fetchMe(): Promise<MeResponse> {
  return authFetch("/api/auth/me");
}

/** Re-send the sign-up verification email for the logged-in parent. Rate-limited. */
export async function resendVerificationEmail(): Promise<{ ok: true; message: string }> {
  return authFetch("/api/auth/resend-verification", { method: "POST" });
}

/** Switch the active child for this session (or pass null for parent context). */
export async function switchActiveChild(childId: string | null): Promise<{ ok: true; activeChildId: string | null }> {
  return authFetch("/api/auth/switch-child", { method: "POST", body: JSON.stringify({ childId }) });
}

/** Create a new child profile under the logged-in parent's account. */
export async function createChildProfile(params: {
  displayName: string;
  ageBand?: "4-5" | "6-7" | "8-9";
  readingLevel?: string;
  avatarKey?: string;
  buddyRole?: "owl" | "dragon";
}): Promise<{ child: ChildSummary }> {
  return authFetch("/api/children", { method: "POST", body: JSON.stringify(params) });
}

export interface ShelfItem {
  id: string;
  childId: string;
  bookId: string;
  status: "want-to-read" | "reading" | "finished";
  favorite: boolean;
  progressPage: number;
  addedAt: string;
  lastOpenedAt: string | null;
}

/** Load the signed-in child's durable shelf. */
export async function fetchShelf(): Promise<{ items: ShelfItem[] }> {
  return authFetch("/api/shelf");
}

/** Add a book to the signed-in child's shelf (idempotent). */
export async function addToShelf(params: {
  bookId: string;
  status?: ShelfItem["status"];
  favorite?: boolean;
}): Promise<{ item: ShelfItem }> {
  return authFetch("/api/shelf", { method: "POST", body: JSON.stringify(params) });
}

/** Update shelf state for one book. */
export async function updateShelfItem(
  bookId: string,
  updates: Partial<Pick<ShelfItem, "status" | "favorite" | "progressPage">>,
): Promise<{ item: ShelfItem }> {
  return authFetch(`/api/shelf/${encodeURIComponent(bookId)}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

/** Remove a book from the signed-in child's shelf. */
export async function removeFromShelf(bookId: string): Promise<{ ok: true }> {
  return authFetch(`/api/shelf/${encodeURIComponent(bookId)}`, { method: "DELETE" });
}

// ── Progress persistence ────────────────────────────────────────────────────
// Session-scoped as of Sprint C: the server reads the active child from
// req.session.activeChildId (set via switchActiveChild above), so these
// calls take no childId — a stale/foreign id in the URL can no longer be
// used to read or write another family's progress.

/** Load full progress for the session's active child from the DB */
export async function fetchProgress(): Promise<{ progress: any }> {
  return apiFetch(`/api/progress`);
}

/** Record a page read for the session's active child. Fire-and-forget from the caller's perspective. */
export async function recordPage(
  params: { bookId: string; pageNumber: number; starsEarned?: number; totalPages?: number }
): Promise<{ persisted: boolean }> {
  return apiFetch(`/api/progress/page`, {
    method: "PATCH",
    body: JSON.stringify(params),
  });
}

/** Unlock a badge server-side for the session's active child. Idempotent — safe to call more than once. */
export async function unlockBadgeRemote(
  params: { badgeId: string; badgeName?: string; icon?: string }
): Promise<{ persisted: boolean }> {
  return apiFetch(`/api/progress/badge`, {
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

// ── Shelf ─────────────────────────────────────────────────────────────────

export type ShelfUpdateInput = {
  status?: "want-to-read" | "reading" | "finished";
  favorite?: boolean;
  progressPage?: number;
};

// ── Personal EPUB/PDF imports (Sprint D) ────────────────────────────────────
// Uploads are private to the logged-in family account, never public.

/**
 * Upload a personal EPUB or PDF. Deliberately bypasses apiFetch: that
 * helper forces a JSON Content-Type header, which would stomp the
 * multipart/form-data boundary the browser needs to set itself for a
 * FormData body.
 */
export async function uploadImportFile(file: File): Promise<{ job: import("../types").ImportJob }> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch("/api/imports", {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = (data as AuthApiError)?.error;
    const error = new Error(err?.message || err?.code || `Upload failed (${res.status})`);
    (error as any).code = err?.code;
    (error as any).status = res.status;
    throw error;
  }
  return data;
}

/** List this family's import jobs, most recent first. */
export async function listImportJobs(): Promise<{ jobs: import("../types").ImportJob[] }> {
  return apiFetch("/api/imports");
}

/** Fetch a single import job's current status. */
export async function getImportJob(id: string): Promise<{ job: import("../types").ImportJob }> {
  return apiFetch(`/api/imports/${encodeURIComponent(id)}`);
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
