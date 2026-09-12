/**
 * Integration tests for the auth -> child -> progress flow (Section 4,
 * Sprint B: Identity).
 *
 * These are deliberately black-box: they spawn the real `server.ts` as a
 * subprocess against a real Postgres database and drive it over HTTP with
 * `fetch`, the same way the manual curl session that shipped this sprint
 * did. That manual session is exactly what caught three real bugs
 * (missing auth schema export, a non-transactional register, and an
 * unguarded route handler that crashed the whole process) that
 * `tsc --noEmit` and `npm run build` both missed — a unit test that mocks
 * the DB or imports route handlers directly would not have caught any of
 * them either. This suite exists to make sure they stay caught.
 *
 * Requires a real, disposable Postgres database with this project's schema
 * pushed (`drizzle-kit push`). Set TEST_DATABASE_URL (falls back to
 * DATABASE_URL) to point at it. If neither is set, the whole suite is
 * skipped with a clear message rather than failing — this is meant to run
 * wherever a throwaway test DB is available (CI, or locally via e.g. a
 * disposable `docker run postgres`), not to require every contributor to
 * have Postgres running just to `npm test`.
 *
 * Each account logs in ONCE (in beforeAll) and every test reuses that
 * cookie. This isn't just an efficiency nicety: the login endpoint is
 * rate-limited by IP (10 attempts / 15 min, by design — see
 * server/auth/repository.ts), and a first draft of this suite that logged
 * in fresh inside every `it` block was flaky because of it, especially on
 * a dev machine where the same IP had also been used for manual curl
 * testing earlier. Reusing sessions is both faster and respects the real
 * rate limit instead of fighting it.
 *
 * WARNING: this suite calls DELETE on any users it creates as cleanup, but
 * do not point it at a database with data you care about.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";

const TEST_DB_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const PORT = process.env.TEST_SERVER_PORT || "3998";
const BASE = `http://localhost:${PORT}`;
const SESSION_COOKIE = "sp_session";
const PASSWORD = "correcthorsebattery";

const suite = TEST_DB_URL ? describe : describe.skip;

if (!TEST_DB_URL) {
  console.warn(
    "\n[auth-integration.test.ts] Skipping: set TEST_DATABASE_URL (or DATABASE_URL) " +
      "to a disposable Postgres database with the schema pushed (npx drizzle-kit push) to run this suite.\n"
  );
}

/** Extracts a cookie's value from a Set-Cookie header, or the empty string if absent. */
function extractCookie(setCookieHeader: string | null, name: string): string {
  if (!setCookieHeader) return "";
  const match = setCookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match ? `${name}=${match[1]}` : "";
}

async function waitForHealth(timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server did not become healthy on ${BASE} within ${timeoutMs}ms`);
}

async function registerAndLogin(email: string, displayName: string): Promise<string> {
  await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, displayName, password: PASSWORD }),
  });
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (login.status !== 200) {
    const body = await login.json().catch(() => ({}));
    throw new Error(`Setup login failed for ${email}: ${login.status} ${JSON.stringify(body)}`);
  }
  const cookie = extractCookie(login.headers.get("set-cookie"), SESSION_COOKIE);
  if (!cookie) throw new Error(`Setup login for ${email} did not return a session cookie`);
  return cookie;
}

suite("auth -> child -> progress integration", () => {
  let serverProcess: ChildProcess;
  const emailA = `test-a-${Date.now()}@storypals-test.local`;
  const emailB = `test-b-${Date.now()}@storypals-test.local`;
  let cookieA: string;
  let cookieB: string;

  beforeAll(async () => {
    serverProcess = spawn("npx", ["tsx", "server.ts"], {
      env: { ...process.env, DATABASE_URL: TEST_DB_URL, NODE_ENV: "development", PORT },
      stdio: "pipe",
    });
    // Surface server-side crashes in the test output instead of hiding them.
    serverProcess.stderr?.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));

    await waitForHealth();

    // One login per account for the whole suite — see file header.
    cookieA = await registerAndLogin(emailA, "Test Parent A");
    cookieB = await registerAndLogin(emailB, "Test Parent B");
  }, 20_000);

  afterAll(async () => {
    // Best-effort cleanup: delete the accounts this suite created so reruns
    // against a persistent test DB don't accumulate rows.
    for (const cookie of [cookieA, cookieB]) {
      if (!cookie) continue;
      try {
        await fetch(`${BASE}/api/auth/account`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({ password: PASSWORD }),
        });
      } catch {
        // best-effort; don't fail teardown over cleanup
      }
    }
    serverProcess?.kill("SIGKILL");
  });

  it("rejects unauthenticated access to /api/progress", async () => {
    const res = await fetch(`${BASE}/api/progress`);
    expect(res.status).toBe(401);
  });

  it("rejects a duplicate registration with the same email", async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailA, displayName: "Test Parent A", password: PASSWORD }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("EMAIL_TAKEN");
  });

  it("reads its own session via /me after login, with no active child yet", async () => {
    const me = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: cookieA } });
    expect(me.status).toBe(200);
    const body = await me.json();
    expect(body.email).toBe(emailA);
    expect(body.activeChildId).toBeNull();
    expect(body.children).toEqual([]);
  });

  it("blocks progress access until a child is selected, then completes the full flow", async () => {
    // No active child yet -> 403, not 401 (the caller IS authenticated).
    const preSelect = await fetch(`${BASE}/api/progress`, { headers: { Cookie: cookieA } });
    expect(preSelect.status).toBe(403);
    expect((await preSelect.json()).error.code).toBe("NO_CHILD_SELECTED");

    const createChild = await fetch(`${BASE}/api/children`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ displayName: "Test Child", ageBand: "6-7", buddyRole: "owl" }),
    });
    expect(createChild.status).toBe(201);
    const { child } = await createChild.json();
    expect(child.id).toBeTruthy();

    const switchChild = await fetch(`${BASE}/api/auth/switch-child`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ childId: child.id }),
    });
    expect(switchChild.status).toBe(200);

    const recordPage = await fetch(`${BASE}/api/progress/page`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ bookId: "integration-test-book", pageNumber: 1, starsEarned: 1, totalPages: 5 }),
    });
    expect(recordPage.status).toBe(200);

    const unlockBadge = await fetch(`${BASE}/api/progress/badge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ badgeId: "integration-test-badge", badgeName: "Test Badge", icon: "⭐" }),
    });
    expect(unlockBadge.status).toBe(200);

    const progress = await fetch(`${BASE}/api/progress`, { headers: { Cookie: cookieA } });
    expect(progress.status).toBe(200);
    const { progress: data } = await progress.json();
    expect(data.totalPagesRead).toBeGreaterThanOrEqual(1);
    expect(data.unlockedBadges).toContain("integration-test-badge");
    expect(data.bookProgress["integration-test-book"]).toBeTruthy();
  });

  it("survives a malformed switch-child request instead of crashing the process", async () => {
    // This exact payload (an empty-string childId) crashed the entire
    // Node process before the asyncHandler fix — a Postgres type error
    // thrown inside an unguarded async handler became an unhandled
    // rejection. It must now fail cleanly with a 5xx instead.
    const malformed = await fetch(`${BASE}/api/auth/switch-child`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ childId: "" }),
    });
    expect(malformed.status).toBeGreaterThanOrEqual(400);
    expect(malformed.status).toBeLessThan(600);

    // The real assertion: the server is still answering requests at all.
    const health = await fetch(`${BASE}/api/health`);
    expect(health.status).toBe(200);
  });

  it("isolates child data between two unrelated accounts", async () => {
    const meA = await (await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: cookieA } })).json();
    const childOfA = meA.children[0].id;

    // B must not be able to switch into A's child.
    const crossSwitch = await fetch(`${BASE}/api/auth/switch-child`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieB },
      body: JSON.stringify({ childId: childOfA }),
    });
    expect(crossSwitch.status).toBe(403);
    expect((await crossSwitch.json()).error.code).toBe("FORBIDDEN");

    // B's own progress must never resolve to A's data — it has no active
    // child of its own yet, so this must be 403 NO_CHILD_SELECTED, never
    // 200 with A's progress in it.
    const progressB = await fetch(`${BASE}/api/progress`, { headers: { Cookie: cookieB } });
    expect(progressB.status).toBe(403);
    expect((await progressB.json()).error.code).toBe("NO_CHILD_SELECTED");
  });
});
