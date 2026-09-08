# StoryPals Book Platform — Phase 4 Roadmap

## What Phase 4 should deliver

Phase 3 gives us a safe ingestion pipeline and a verified seed list.
Phase 4 is about making that pipeline feel like a real, growing library
rather than a developer tool.

---

## 1. Run the seed script — get real books in the catalog

```bash
# In one terminal:
BOOK_IMPORT_ENABLED=true BOOK_IMPORT_ADMIN_KEY=your-key npm run dev

# In another:
BOOK_IMPORT_ADMIN_KEY=your-key npx tsx scripts/seed-classics.ts
```

After this, `data/public-domain-books.json` will contain ~10 classic
children's books with proper reading levels, chapter-aware page splits,
and scene-specific illustration prompts.

---

## 2. Connect AI illustration generation to public-domain pages

Phase 3 now generates specific `illustrationPrompt` values per page
(not the generic fallback). Phase 4 should wire these to Gemini Imagen
so imported books get real illustrations — not just text.

The `/api/books/import` response already includes `illustrationPrompt`
on each page. The client needs a background job that:
1. Checks if `page.currentImageUrl` is empty
2. Calls `/api/generate-image` with `page.illustrationPrompt`
3. Stores the result URL back to the book

---

## 3. "Add to My Library" button in BookDiscoveryModal

Currently Open Library discovery results link out to openlibrary.org.
Phase 4 should allow a parent/teacher to tap "Add to StoryPals" on
a discovery result, which:
1. Checks if the book has `has_fulltext: true` and `ebook_access: "public"`
   in the Open Library API response (already available in the provider)
2. Fetches the plain-text edition if available
3. Runs it through the Phase 3 import pipeline (safety + reading level)
4. Adds it to the child's library with a "Pending Review" badge until approved

This closes the loop: discover → verify → import → read.

---

## 4. Standard Ebooks integration

Standard Ebooks produces high-quality, beautifully formatted public-domain
texts with modern spelling and layout. Their content is dedicated to the
public domain and they publish OPDS feeds.

- OPDS catalog feed: `https://standardebooks.org/feeds/opds/subjects/childrens`
- Filter for `subject:childrens` or `subject:juvenile`
- Map Standard Ebooks metadata to the `TextBookInput` schema
- Add `standardebooks` as a `BookSourceType`

Rights note: verify the specific feed access terms before automating ingestion.

---

## 5. Parental reading level override

The automated reading-level classifier is conservative by design (it can
upgrade a Level 1 book to Level 2 but never the reverse). Some classic
texts — particularly Aesop's Fables — classify as Level 2 even though
experienced early readers handle them comfortably.

Phase 4 should let a parent or teacher override `levelShort` per book
via a simple admin UI. The override is stored in `data/public-domain-books.json`
alongside the book and survives re-import.

---

## 6. Reading progress for public-domain books

Public-domain books use `id: public-domain:slug-hash`. The existing
`UserProgress.bookProgress` record uses book IDs as keys — so progress
tracking already works for imported books. But the StoryReader needs
to handle books without `coverImage` gracefully (show the
`StoryImagePlaceholder` instead of a broken image).

---

## Files changed in Phase 3B (this release)

| File | Change |
|---|---|
| `server/books/normalization/readingLevel.ts` | Flesch-Kincaid + syllable count |
| `server/books/normalization/safety.ts` | Context-window matching, not word-match |
| `server/books/normalization/normalizeBook.ts` | Chapter detection + smart illustration prompts |
| `server/books/repository.ts` | Title+author deduplication across providers |
| `src/components/BookDiscoveryModal.tsx` | Parent/child-facing copy, quick-search chips |
| `scripts/seed-classics.ts` | NEW: imports 10 verified classic children's books |
| `.env.example` | Added `BOOK_IMPORT_ADMIN_KEY`, seed script docs |
