import { openLibraryProvider } from "./providers/openlibrary";
import { builtinProvider } from "./providers/builtin";
import { publicDomainProvider } from "./providers/publicDomain";
import { BookRepository } from "./repository";

export const bookRepository = new BookRepository([
  builtinProvider,
  publicDomainProvider,
  openLibraryProvider,
]);
