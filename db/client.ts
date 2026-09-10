import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

// ── Database Connection ────────────────────────────────────────────────────────
// Reads DATABASE_URL from environment. Must be set for production.

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn("[StoryPals] DATABASE_URL is not set. Database features will be unavailable.");
}

// Lazy-initialize so the app can start without DB during migration/development
let _sql: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    if (!DATABASE_URL) {
      throw new Error("DATABASE_URL is not configured. Cannot access database.");
    }
    _sql = postgres(DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    _db = drizzle(_sql, { schema });
  }
  return _db;
}

export function getSql() {
  if (!_sql) {
    getDb(); // triggers initialization
  }
  return _sql!;
}

/** Check if the database is configured and reachable */
export async function isDbHealthy(): Promise<boolean> {
  if (!DATABASE_URL) return false;
  try {
    const sql = getSql();
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/** Gracefully close the database connection */
export async function closeDb(): Promise<void> {
  if (_sql) {
    await _sql.end();
    _sql = null;
    _db = null;
  }
}

// Re-export schema for convenience
export { schema };
