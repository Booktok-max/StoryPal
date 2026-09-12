import { openLibraryProvider } from "./providers/openlibrary";
import { builtinProvider } from "./providers/builtin";
import { publicDomainProvider } from "./providers/publicDomain";
import { standardEbooksProvider } from "./providers/standardEbooks";
import { databaseProvider } from "./providers/database";
import { BookRepository } from "./repository";

// `databaseProvider` is additive for now — it runs alongside the JSON/
// in-memory providers, not in place of them. It only serves books that have
// been migrated in via scripts/migrate-catalog-to-db.ts. Once the builtin
// and public-domain catalogs are fully migrated and verified, retire
// `builtinProvider`/`publicDomainProvider` in a follow-up change (Sprint C).
export const bookRepository = new BookRepository([
  builtinProvider,
  publicDomainProvider,
  databaseProvider,
  openLibraryProvider,
  standardEbooksProvider,
]);

