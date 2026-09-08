# StoryPals Book Platform

## Provider architecture

The frontend talks to StoryPals APIs. Providers stay server-side.

- `builtin` — current StoryPals library.
- `public-domain` — approved books imported through the Phase 3 ingestion pipeline.
- `openlibrary` — metadata/discovery provider; excluded from the default child catalog because it does not itself grant full-text redistribution rights.

## Phase 3 pipeline

```text
Verified source text
      ↓
Rights metadata
      ↓
Text normalization
      ↓
Page splitting
      ↓
Reading-level analysis
      ↓
Safety review
      ↓
Approved catalog
      ↓
StoryPals reader
```

Do not enable the HTTP importer on a public deployment until it is protected by the application's authenticated parent/admin authorization layer.
