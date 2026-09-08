# StoryPals Phase 2 — Open Library Discovery

## Architecture

```text
StoryPals UI
    |
    v
GET /api/books/search
    |
    v
BookRepository
    |
    v
OpenLibraryProvider
    |
    v
Open Library Search API
```

The browser never calls Open Library directly. This keeps provider logic server-side and gives StoryPals one place to add caching, rate-limit controls, filtering, and future providers.

## Current behavior

Open Library is a **discovery provider** only in Phase 2. Search results are normalized into the StoryPals `Book` model but have an empty `pages` array, so they are intentionally not sent into the StoryPals reader.

## Safety boundary

Search results are not treated as approved StoryPals reading content. The provider uses a conservative subject filter for discovery and blocks obvious adult/unsafe subject signals. This is only a first layer; a future import pipeline needs stronger moderation and rights verification before content can enter the child-facing catalog.

## Rights boundary

Open Library metadata and cover URLs are used according to Open Library's API guidance. StoryPals should not bulk-harvest or redistribute Open Library data through this integration. Full-text ingestion is a separate future provider and rights workflow.

## Next phase

Phase 3 should add a rights-aware public-domain content provider and an import pipeline:

`source -> rights -> safety -> normalization -> reading level -> StoryPals edition -> catalog`
