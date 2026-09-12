import { openLibraryProvider } from "./providers/openlibrary";
import { builtinProvider } from "./providers/builtin";
import { publicDomainProvider } from "./providers/publicDomain";
import { standardEbooksProvider } from "./providers/standardEbooks";
import { googleBooksProvider } from "./providers/googlebooks";
import { nytimesProviderInfo } from "./providers/nytimes";
import { BookRepository } from "./repository";

export const bookRepository = new BookRepository([
  builtinProvider,
  publicDomainProvider,
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

