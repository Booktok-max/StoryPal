# StoryPals Book Platform — Phase 3

## What changed

Phase 3 turns the public-domain scaffold into a controlled full-text ingestion pipeline.

### New components

- `server/books/importer.ts` — validates and imports UTF-8 text into the StoryPals catalog.
- `server/books/normalization/normalizeBook.ts` — splits text into reader pages and creates StoryPals metadata.
- `server/books/normalization/readingLevel.ts` — deterministic first-pass Level 1/2/3 analysis.
- `server/books/normalization/safety.ts` — conservative block/review screening before publication.
- `server/books/providers/publicDomain.ts` — serves approved imported books from `data/public-domain-books.json`.
- `scripts/import-public-domain.ts` — local CLI for importing a verified text file.
- `POST /api/books/import` — controlled server endpoint, disabled by default and protected by an admin key when enabled.

## Source and rights model

The importer requires an explicit `license` and `publicDomain: true`. The application does not assume that a catalog record, cover, or download link grants redistribution rights.

For Project Gutenberg, review its current terms and license for the specific work and your jurisdiction before importing. Project Gutenberg says its main website is for human users and directs automated/bulk use to its mirrors, offline catalogs, and feeds. It also notes that copyright status outside the United States must be checked by the user. See:
- https://www.gutenberg.org/policy/terms_of_use.html
- https://www.gutenberg.org/policy/license
- https://www.gutenberg.org/ebooks/offline_catalogs.html

Standard Ebooks is another promising future source: its site states that content produced by or for Standard Ebooks is dedicated to the public domain, and it publishes OPDS feeds, but access to some feeds is restricted. Verify the applicable source/edition and access terms before automating ingestion.

## Important Phase 3 boundary

This release deliberately does **not** crawl or bulk-download Project Gutenberg or another external site. It gives StoryPals a safe, reusable ingestion pipeline into which verified source content can be supplied.

That keeps rights verification separate from ingestion mechanics and prevents the child-facing catalog from becoming an unreviewed mirror of an external library.
