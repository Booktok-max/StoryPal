import { openLibraryProvider } from "./providers/openlibrary";
import { builtinProvider } from "./providers/builtin";
import { publicDomainProvider } from "./providers/publicDomain";
import { standardEbooksProvider } from "./providers/standardEbooks";
import { BookRepository } from "./repository";

export const bookRepository = new BookRepository([
  builtinProvider,
  publicDomainProvider,
  openLibraryProvider,
  standardEbooksProvider,
]);

