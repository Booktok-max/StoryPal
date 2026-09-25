StoryPal STATUS
Generated 2026-09-25. Branch: codex/release-sync-migrations (tracks origin).

PURPOSE
Children's read-aloud app (roughly ages 4-9): discover books, read with TTS,
AI illustrations, a reading buddy, phonics, and parent/child accounts.
Product name in package.json: storypals. Deploy target: Railway.

STACK
Node 20+, TypeScript, Express, React 19, Vite, Tailwind 4, Drizzle + Postgres,
Gemini (TTS/chat/images), S3-compatible object storage, Vitest, Docker, Railway.

FOLDER STRUCTURE
server.ts                 Express app, APIs, static frontend
server/auth/              login, sessions, children, email
server/books/             catalog, providers, import, safety, illustrations
server/imports/           EPUB/PDF extractors
server/progress/          reading progress
server/shelf/             child shelf
server/storage/           object storage
src/                      React UI (reader, shelf, discovery, dashboards)
db/schema + db/migrations Drizzle models (0000 through 0006)
data/                     public-domain catalog JSON
test/                     Vitest
scripts/                  seed, import, migrate
railway.json, dockerfile, docker-compose.yml, .github/workflows/ci.yml

LAST 20 COMMITS
4230e6c 2026-09-25 Move drizzle-kit to dependencies so migrations run in production containers
dd7b69d 2026-09-25 Fix listShelf import mismatch (use fetchShelf)
ebeb0ac 2026-09-25 Fix release migration and shelf merge conflicts
5db86ed 2026-09-24 Merge PR #2 booktok-max-sprint-c-durable-storage
123cf1b 2026-09-24 Merge PR #1 railway/fix-deploy-15d88a
1bef795 2026-09-24 Merge main into booktok-max-sprint-c-durable-storage
b7aff61 2026-09-21 Create 0006_book_ownership.sql
f7ee6d5 2026-09-21 Upload package lock
dbac310 2026-09-15 epub + PDF extractions
2302606 2026-09-13 Bookshelf, ImportBookModal
9086257 2026-09-13 Importing ePub
f1406aa 2026-09-12 Apply persistence
5770c1e 2026-09-12 Sprint C.B: object storage + illustration persistence
5a6b77f 2026-09-12 Fix 0003: make idempotent
f7b5b05 2026-09-12 Sprint C.A: shelf_items, cover caching
5138fba 2026-09-12 Sprint C: durable covers and child shelf API
540c9a5 2026-09-12 Spec v1.4: mark B, B.1, H.1 complete
730c493 2026-09-12 Apply migration 0003: email verification
c58d858 2026-09-12 environment updated at node
02a379c 2026-09-12 sign-up email verification (nudge model)

OPEN TODOS IN CODE
server/progress/repository.ts — still says replace default childId "once auth exists"
  (auth/child profiles already exist; this comment is stale).
db/migrations/0004_shelf_and_cover_url.sql — historical comment about empty coverImage.

INCOMPLETE / GAPS
Spec v1.4 is behind the code. Code has shelf APIs, migrations 0004-0006, object
storage, ImportBookModal, EPUB/PDF extractors. The spec still marks much of
Sprint C.B and Sprint D as open.

Still open per spec and/or missing wiring:
- Production audit
- Full dialogic reading engine (Sprint E)
- Personalization loop (Sprint F)
- Bookmark/highlight persistence, chapter nav, keyboard nav, real offline mode
- Cross-provider ISBN dedupe (title+author only today)
- STORAGE_* / backups / recovery test called out as external/manual
- Reader handoff from Atomic Shelf (storypal.atomic-shelf.com query params
  save_to_shelfmates_love) is not implemented in this repo
- No traffic-split or feature-flag system

CI builds and tests on main; Railway config is in-repo. Custom DNS is not in Git.
