import { openLibraryProvider } from "./providers/openlibrary";
import { builtinProvider } from "./providers/builtin";
import { publicDomainProvider } from "./providers/publicDomain";
import { standardEbooksProvider } from "./providers/standardEbooks";
import { googleBooksProvider } from "./providers/googlebooks";
import { nytimesProviderInfo } from "./providers/nytimes";
import { databaseProvider } from "./providers/database";
import { BookRepository } from "./repository";

export const bookRepository = new BookRepository([
  ...(process.env.DATABASE_URL ? [databaseProvider] : []),
  builtinProvider,
  publicDomainProvider,
  // Registered here for the first time (Sprint C.B) — this file existed,
  // fully implemented, but was never added to this array, so none of it
  // was reachable: not in search results, and updatePageImage() could
  // never find a book to attach a persisted illustration to. Placed after
  // publicDomainProvider so JSON-backed entries keep winning
  // dedupeBooks()'s title+author precedence if scripts/migrate-catalog-to-db.ts
  // has copied the same books into Postgres — safer during the transition
  // than letting an unverified DB copy silently shadow the known-good JSON one.
  databaseProvider,
  openLibraryProvider,
  standardEbooksProvider,
  googleBooksProvider,
]);

// NYT isn't a BookProvider (list-based, not search-based — see
// providers/nytimes.ts) so it isn't in the array above and won't appear in
// combined search/list results. It's still surfaced in /api/providers so
// the frontend knows it exists and can show the right attribution.
export { nytimesProviderInfo };
export { listBestsellers, NYT_LIST_NAMES, NYT_ATTRIBUTION } from "./providers/nytimes";
export type { NytListSlug } from "./providers/nytimes";
