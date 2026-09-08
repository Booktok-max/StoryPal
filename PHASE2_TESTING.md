# StoryPals Phase 2 — Open Library Discovery Testing

## What changed
- Open Library is now an active metadata/discovery provider.
- External search is server-side and cached for 5 minutes.
- The server sends a descriptive User-Agent header.
- A new **Find More Books** button opens a discovery modal.
- Discovery results are filtered for child-oriented subject signals and obvious adult/unsafe subject terms.
- Phase 2 does **not** import external full text into the StoryPals reader.
- External results link back to their Open Library record.

## Run

```bash
npm install
npm run lint
npm run build
npm run dev
```

## Test API

```text
http://localhost:3000/api/providers
http://localhost:3000/api/books/search?q=animals&source=openlibrary
```

The providers response should contain both `builtin` and `openlibrary`.

## Test UI

1. Open StoryPals.
2. Click **Find More Books** in the hero area.
3. Search for `animals`, `fairy tales`, or `friendship`.
4. Confirm results appear.
5. Click **View in Open Library** on a result.
6. Confirm the existing StoryPals bookshelf and reader still work.
7. Confirm the existing built-in books remain readable.

## Important scope note
Open Library is being used for human-facing discovery/lookup, not bulk harvesting. Cache responses and keep traffic low. The provider currently does not claim that an external result is licensed for StoryPals redistribution or that its full text can be imported.
