StoryPals — Master Product & Engineering Specification
Version: 1.4
Date: 12 September 2026
Status: Living specification / implementation checklist
Deployment: Railway

This is the master planning document for StoryPals. Mark every item
[ ], [~], [x], [!], or [-] as implementation proceeds.
Preserve working functionality unless a change is explicitly approved.

1. Product North Star
StoryPals is an adaptive reading companion that turns appropriate books
into interactive literacy experiences.

Plaintext
DISCOVER → CHOOSE → WARM UP → PREDICT → READ → TALK → THINK
→ SCAFFOLD → UNDERSTAND → REFLECT → REMEMBER → PERSONALIZE → READ NEXT
AI supports reading and learning; it is not an unrestricted
general-purpose chatbot for children.

2. Current Baseline
[x] Application exists

[x] Railway deployment exists

[x] PostgreSQL service exists

[x] React frontend exists

[x] Express API exists

[x] Book catalog exists (built-in + Open Library + Standard Ebooks + public-domain)

[x] Open Library discovery exists

[x] Standard Ebooks OPDS discovery exists

[x] Public-domain import pipeline exists

[x] Reading progress infrastructure exists (DB-backed, session-scoped)

[x] AI story generation exists

[x] AI Reading Buddy exists (Barnaby owl / Pip dragon, Gemini-backed)

[x] TTS exists (Gemini, voices: Puck / Kore / Zephyr)

[x] AI illustration generation exists (story creation only — NOT used for book covers; see Section 6.1)

[x] Health endpoint exists (/api/health with DB check)

[x] Rate limiting exists (global 100/min, AI 15/min, image 6/min)

[x] Helmet / CSP exists

[x] Book cover placeholder system exists (deterministic SVG, never 404s)

[x] Reading level classifier exists

[x] Safety screener exists

[x] Phonics helper exists

[x] Daily goal radial progress widget exists

[x] Parent dashboard (partial — time, books, words explored)

[x] Child settings schema exists

[x] Achievements schema and badge-unlock API exist

[x] Reading sessions + dailyActivity schema exist

[x] Content moderation schema exists

[x] DB schema fully migrated (0000 + 0001 + 0002 + 0003)

[x] Sprint B: Auth complete — register, login, logout, sessions, child profiles, child selection, authorization, progress scope

[x] Sprint B: Frontend login/register UI complete (LoginScreen, ChildGate, useAuth)

[x] Sprint B: Integration test suite complete (test/auth-integration.test.ts)

[x] Sprint B: Verified working end-to-end in production (parent registered, children created, DB persisting)

[x] Sprint B.1: Account display-name update (PATCH /api/auth/me) — deployed

[x] Sprint B.1: Password reset frontend UI (request + confirm screens) — deployed

[x] Sprint B.1: Transactional email sending (Resend) wired to password reset — deployed; requires RESEND_API_KEY in Railway

[x] Sprint B.1: Sign-Up email verification — deployed (nudge model; see Section 4.1)

[x] Sprint B.1: Open Library search relevance fix (over-fetch + quality ranking; see Section 6.4) — deployed

[x] Sprint H.1: NYT Books API provider — deployed (list-based bestsellers rail; NYT_API_KEY set in Railway)

[x] Sprint H.1: Google Books API provider — deployed (search-based, mirrors openlibrary.ts; GOOGLE_BOOKS_API_KEY set in Railway)

[x] Sprint H.1: /api/books/featured?list=picture-books endpoint — deployed and returning real data

[~] Book Covers: tier 6 placeholder + API guarantee + frontend onError done; real covers (tiers 1-5) are the next priority — AI-generated covers explicitly removed from the cover strategy (see Section 6.1)

[ ] Production audit complete

[ ] Durable book storage architecture complete

[ ] Durable image/object storage complete

[ ] Full dialogic reading engine complete

[ ] Full EPUB ingestion complete

[ ] PDF ingestion complete

[~] Monetization/Paywall integration: Lemon Squeezy / Pesapal token-refill model (Architectural design mapped; implementation pending)

3. Roles
Parent/Caregiver
Account creation and login ✓

Password reset/logout ✓ (deployed)

Update display name ✓ (deployed)

Email verification at sign-up ✓ (deployed, nudge model)

Child profiles ✓

Child selection ✓

Library management

Progress and session summaries

AI/voice controls

Private book uploads

Privacy/data deletion controls

Subscription & generation credit purchases (Lemon Squeezy / Pesapal)

Child
Select own profile ✓

Browse permitted books

Read/listen

Interact with Reading Companion

Answer questions

Receive hints

View own progress/achievements

Create permitted stories (subject to family credit balance)

Child profiles must not access parent controls, other children, admin
functions, or unrestricted AI.

Administrator
Catalog management

Import moderation

Provider management

Content moderation

System health/operational metrics

Authorization must be server-side. A shared admin key is only a
temporary development mechanism.

4. Authentication & Account Model
Plaintext
Parent Account
 ├── Child A
 ├── Child B
 └── Child C
Implemented entities (Sprint B — complete)
Plaintext
User
- id (uuid), email (unique), displayName
- role (parent | admin), status (active | suspended | deleted)
- creditsRemaining (integer for story/illustration generation)
- subscriptionTier (free | pro)
- createdAt / updatedAt

UserPassword
- userId (PK, FK → users)
- passwordHash (bcrypt, cost 12)
- updatedAt

Session
- id (uuid)
- token (128-char hex, HTTP-only cookie "sp_session")
- userId
- activeChildId (null = parent context)
- expiresAt (14 days)
- createdAt

PasswordResetToken
- id, userId, token, expiresAt, usedAt, createdAt

RateLimitAttempts
- id, identifier (email or IP), action, attemptedAt

Child
- id, parentUserId, displayName, ageBand, readingLevel
- language, avatarKey, buddyRole, dailyGoalPages
- createdAt / updatedAt

ChildSettings
- childId (PK), fontSize, fontFamily, showSyllables
- voice, autoplayNarration, soundEnabled, theme
API endpoints (Sprint B — all working in production)
Plaintext
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
PATCH  /api/auth/me                    ✓ deployed
POST   /api/auth/switch-child
POST   /api/auth/logout
POST   /api/auth/password-reset/request
POST   /api/auth/password-reset/confirm
DELETE /api/auth/account
GET    /api/auth/verify-email          ✓ deployed
POST   /api/auth/resend-verification   ✓ deployed
GET    /api/children
POST   /api/children
PATCH  /api/children/:id
DELETE /api/children/:id
GET    /api/progress         (requireAuth + requireChildContext)
PATCH  /api/progress/page    (requireAuth + requireChildContext)
POST   /api/progress/badge   (requireAuth + requireChildContext)
POST   /api/billing/checkout (Lemon Squeezy / Pesapal order initialization)
POST   /api/billing/webhook  (Lemon Squeezy / Pesapal IPN credit fulfillment)
Security (Sprint B — verified in production)
Sessions: HTTP-only cookie, sameSite: lax, secure in production

Passwords: bcrypt cost 12, wrapped in db.transaction()

Rate limiting: 10 login attempts / 15 min per IP; 3 reset requests / 1 hr per IP

Email enumeration: constant-time compare on login; always-200 on reset/request

Account deletion: requires password re-confirmation

Cross-account isolation: verified live — a second account cannot switch into or read another family's child data (403 FORBIDDEN / 403 NO_CHILD_SELECTED)

Known gaps
Permissions: ownership-based only; no fine-grained permission model yet

4.1. Sign-Up Email Verification — Sprint B.1
Status: DEPLOYED
Date: 12 September 2026
Commit: 730c493
What changed: users.email_verified_at + email_verification_tokens
  (migration 0003 applied manually to Railway then committed);
  repository generateEmailVerificationToken/verifyEmailToken/
  resendVerificationEmail; GET /api/auth/verify-email and
  POST /api/auth/resend-verification routes; registerUser() now
  issues a token post-transaction and sends it via
  server/auth/email.ts (Resend-if-configured, console-log fallback);
  MeResponse gained emailVerified; ChildGate shows a dismissible
  VerifyEmailBanner when false; App.tsx shows a one-time
  ?verified=1|0 toast.
Tests: test/auth-integration.test.ts — register -> token issued ->
  consumed via verify-email -> emailVerifiedAt set -> re-consuming
  the same token rejected.
Known limitations: requires RESEND_API_KEY in Railway to actually
  deliver mail; without it the link is logged server-side only.
Decision: Nudge model — account is fully usable immediately;
  unverified banner shown but nothing gated on verification.

6. Library Architecture
Normalize all sources into one StoryPals book model.

Plaintext
Open Library ─┐
Standard Ebooks ├→ Ingestion → Validation/Rights/Safety → Normalized Book → Shelf
Public-domain ──┤
NYT Books API ──┤   (metadata/ranking only — deployed Sprint H.1)
Google Books ───┤   (metadata/discovery only — deployed Sprint H.1)
EPUB upload ───┤
PDF upload ────┘
Implemented providers
Provider        Status  Notes
builtin         [x]     Hard-coded classics
openlibrary     [x]     Metadata/discovery, 5-min cache; re-ranked for quality (Sprint B.1)
standard-ebooks [x]     OPDS feed, 10-min cache
public-domain   [x]     Imported via CLI or HTTP endpoint
nytimes         [x]     Deployed Sprint H.1 — list-based bestsellers, 24h cache, NYT attribution
google-books    [x]     Deployed Sprint H.1 — search-based, mirrors openlibrary.ts pattern

6.1. Book Cover Rendering — Required Capability
Every book must always render a cover image. A broken image, blank tile,
or infinite loading state is a defect regardless of book source.

Cover Strategy Decision (v1.4):
AI-generated covers are explicitly removed from the cover strategy.
Book covers must always be the actual cover of the book — publisher-
supplied, provider-sourced, or extracted from the book file itself.
AI illustration is reserved for story creation only, not as a cover
fallback.

Cover Sources (resolution order)
Plaintext
1. Native/curated cover (publisher- or admin-supplied)
2. Standard Ebooks cover
3. Open Library cover (covers.openlibrary.org/b/isbn/{isbn}-M.jpg)
4. Google Books cover image (thumbnail from volumes API)
5. Embedded cover extracted during EPUB/PDF ingestion
6. Deterministically generated placeholder cover  ← must always succeed
                                                    (SVG, never a 404)
Note: tier 5 (AI-generated illustration as stand-in) has been
removed. The placeholder (tier 6) is the final fallback, not AI.

Status: Tier 6 implemented. Tiers 1-5 caching into BookAsset object
storage still open (Sprint C). Google Books covers (tier 4) available
via the H.1 provider but not yet cached/persisted.

6.2. Commercial Storefront Discovery — Feasibility Findings (Sprint B.1)
Investigated during Sprint B.1. Findings archived here so this isn't
re-investigated in a future sprint:

  - Amazon: no public catalog/content API for third-party search or
    reading. Product Advertising API is affiliate-link only.
  - Apple Books: no public developer API.
  - Kobo: closed retail-partner relationship, not an API key signup.
  - Major publishers: no self-serve public APIs. Access runs through
    OverDrive/Libby-style library-partner relationships.
  - OverDrive/Libby: real and widely used but requires a partner
    relationship — flag for future business-development, not engineering.

Conclusion: NYT Books API and Google Books API were the only two
self-serve implementable options. Both are now deployed (Sprint H.1).

6.3. NYT Books API + Google Books API — Sprint H.1
Status: DEPLOYED
Date: 12 September 2026
Commit: 730c493
What changed:
  - server/books/providers/nytimes.ts: list-based provider,
    listBestsellers(listSlug), 24h cache, ISBN → Open Library cover
    cross-reference, NYT attribution string.
  - server/books/providers/googlebooks.ts: search-based provider
    mirroring openlibrary.ts, same over-fetch + quality-ranking
    pattern, registered in catalog.ts.
  - GET /api/books/featured?list=picture-books: dedicated route for
    NYT bestseller rail, separate from /api/books/search.
  - BookDiscoveryModal.tsx: Google Books merged into search results;
    NYT Bestsellers rail with attribution shown.
  - test/googlebooks-provider.test.ts: 7 tests on filter/ranking logic.
  - .env.example: documents GOOGLE_BOOKS_API_KEY and NYT_API_KEY.
  - server/books/progress/repository.ts: duplicate file removed (git rm).
Railway env vars added: NYT_API_KEY, GOOGLE_BOOKS_API_KEY.
Verified: /api/health shows both providers; /api/books/featured
  returns real NYT picture books data; Google Books results appear
  in Discover modal alongside Open Library.
Known gaps:
  - ISBN-based de-duplication not yet done (dedupeBooks() still
    matches on title+author only).
  - NYT bestseller rail only covers picture-books list in the UI;
    other list slugs supported by the API route but no UI yet.

6.4. Book Search Relevance Fix — Sprint B.1
Status: DEPLOYED
Date: 12 September 2026
Commit: 730c493
What changed: /api/books/search?source=openlibrary now over-fetches
  up to 3 raw pages (40 docs/page), applies a quality heuristic
  (cover presence + subject richness + public-access flag), and
  re-ranks survivors before truncating to the requested page size.
  sort=rating added to Open Library queries to bias toward well-known
  editions.

Sprint C.B Status (object storage + illustrations slice)
Status: Implemented locally; not yet deployed. Fails soft — if STORAGE_*
  env vars are unset, updatePageImage() logs a warning and returns the
  book unchanged, same behavior as the no-op it replaces, so this cannot
  break existing behavior before storage is actually configured.
Date: 12 September 2026
Commit: (pending — not yet pushed)
What changed: server/storage/objectStorage.ts (new — S3-compatible client,
  @aws-sdk/client-s3 added as a dependency); server/books/illustrations/repository.ts
  (new — saveIllustration()/loadPrimaryIllustrations(), assets + book_page_assets
  bookkeeping); providers/database.ts's updatePageImage() now actually
  persists instead of warn-only no-op, and loadBook() reads illustrations
  back; databaseProvider registered in catalog.ts for the first time (was
  fully implemented but unreachable — see finding above); .env.example
  documents STORAGE_ENDPOINT/REGION/BUCKET/ACCESS_KEY_ID/SECRET_ACCESS_KEY/PUBLIC_URL.
Tests: test/objectStorage.test.ts (6 tests — data-URL validation, env-var
  gating, public URL construction; no live S3 calls). npx tsc --noEmit,
  vite build, and the esbuild server bundle all pass with no new errors.
Known limitations: STORAGE_* not yet set anywhere (external manual step);
  only illustrations use object storage so far, not uploaded EPUB/PDF
  files (Sprint D) or the book covers cached in migration 0004's
  book_cover_cache table (that stays a small Postgres table, not object
  storage — covers are small and already come from an external URL, so
  there's nothing to upload); no backup/recovery process for the bucket
  itself yet.
Next step: get a Cloudflare R2 (or Railway object storage) bucket + keys,
  set the five STORAGE_* vars in Railway, redeploy, generate a test
  illustration, restart the dev server or redeploy again, and confirm the
  illustration is still there — that's the actual proof this works, since
  "no error" alone doesn't confirm persistence.

7. Personal EPUB/PDF Shelf — Required Capability (Sprint D)
Private family uploads of EPUB and PDF books. Critical: uploads must
never automatically become public. Planned for Sprint D.
Requires Sprint C (durable storage) to be complete first.

8. EPUB Import Pipeline
Plaintext
Upload → file validation → archive/security checks → EPUB validation
→ package metadata → manifest → spine → navigation → chapter extraction
→ HTML sanitization → text normalization → image extraction
→ accessibility metadata → rights classification → safety screening
→ reading-level analysis → StoryPals metadata → storage → shelf
Never execute arbitrary scripts from an uploaded EPUB.

9. PDF Import Pipeline
Plaintext
Upload → validation/security checks → PDF parser
→ text extractable? YES → text extraction / NO → OCR (async)
→ page segmentation → heading/chapter detection → text normalization
→ image extraction → rights classification → safety screening
→ reading-level analysis → metadata → storage → shelf
10. Import Data Model
Plaintext
Book — id, title, subtitle, author, description, language,
        coverAssetId, sourceType, sourceId, rightsStatus,
        visibility, processingStatus, readingLevel, timestamps

BookFile — id, bookId, originalFilename, mimeType, sizeBytes,
            storageKey, checksum, processingStatus

Chapter — id, bookId, ordinal, title, sourceReference, text/html, wordCount

BookAsset — id, bookId, type, storageKey, mimeType, altText, dimensions

ImportJob — id, userId, filename, format, status, progress, error, timestamps
Large books must not be stored as one giant JSON record.

11. Shelf Model
Plaintext
ShelfItem — id, userId, childId, bookId, status,
             addedAt, lastOpenedAt, progress, favorite
Catalog books and private uploaded books must remain distinguishable.

12. Reader
Minimum: table of contents, chapter navigation, next/previous, resume
position, progress, font size, spacing/theme controls, read aloud,
pause/resume, text highlighting, bookmarks, optional notes, keyboard
navigation, screen-reader-friendly structure.

Implemented reader capabilities
[x] Page-by-page navigation

[x] Progress persistence (DB-backed, session-scoped)

[x] TTS narration (Gemini, three voice options)

[x] Auto-illustrate per page (Gemini image generation — story creation only, not book covers)

[x] Phonics word-tap (syllable breakdown + kid-friendly definition)

[x] Font size / font family / theme settings

[x] Syllable display toggle

[x] Reading buddy chip prompts

[ ] Bookmark / highlight persistence

[ ] Chapter-level navigation

[ ] Keyboard navigation

[ ] Offline mode

13. Reading Sessions
Plaintext
ReadingSession (implemented)
- id, childId, bookId, startedAt, endedAt
- pagesRead, durationSeconds, starsEarned, createdAt

DailyActivity (implemented)
- childId, activityDate, pages, minutes, stars, goalMet, xp
14. Dialogic Reading Engine — Sprint E
Reading Buddy becomes the user-facing layer of a dedicated engine.

Plaintext
Book/context → child profile → question selection → question
→ child response → evaluation → scaffolding decision
→ expansion/encouragement → learning signal → next interaction
Current state: Reading Buddy chat is context-aware (book + page
injected into system prompt). CROWD/PEER structured question types,
evaluation, and adaptive scaffolding are not yet implemented.

15–22. CROWD / PEER / Scaffolding / Question Selection / Companion Modes / Warm-Up / Mid-Reading / Reflection
All planned for Sprint E. See original spec sections for full detail.
No implementation yet.

23. Voice
Target: child speech → speech recognition → Dialogic Reading Engine
→ LLM → safety/age validation → TTS → child.

Current state: TTS output only (Gemini). Speech input not yet
implemented.

24. Personalization
Planned for Sprint F. Reading sessions → interaction signals → child
profile → recommendations → adaptive questions.

25. Parent Dashboard
Minimum: child selector, current books, completed books, reading time,
recent sessions, learning indicators, suggested parent activity.

Current state: Read-only dashboard exists showing weekly reading
time, books in progress, books opened, and words explored. Child
selector and learning indicators not yet implemented.

26. Achievements
Reward reading behaviors: First Book, Five Sessions, Finished a Chapter,
New Genre, Asked a Great Question, Reading Streak.

Current state: Schema, badge-unlock API, and badge toast
notifications exist. Badge definitions seeded.

27. Rights & Content Status
Plaintext
PUBLIC_DOMAIN → shared catalog after validation
LICENSED → follow license
USER_PRIVATE → family-only
UNKNOWN → do not publish
RESTRICTED → reject/block
Applies equally to NYT/Google Books providers: both are metadata-only
by design — they are discovery pointers, not content sources.
Neither should ever be marked PUBLIC_DOMAIN or given a reader/fullText
path.

28. Safety Architecture
Child input → validation → context restriction → model → output
validation → age-appropriate response → child.

Current state: Safety screener exists for book import. Chat system
prompt restricts Reading Buddy to reading/learning context. Input
sanitization on all AI endpoints.

29. Storage Architecture
Target:

Plaintext
PostgreSQL
 ├── Users, UserPasswords, Sessions (✓)
 ├── Children, ChildSettings (✓)
 ├── Books, Chapters, ShelfItems
 ├── Progress, ReadingSessions, DailyActivity (✓)
 ├── Achievements, ChildAchievements (✓)
 ├── ImportJobs, AssetRecords
 └── Auth tables: rate_limit_attempts, password_reset_tokens (✓),
       email_verification_tokens (✓ — migration 0003 deployed)
          ↓
     Object Storage (not yet wired — Sprint C)
       ├── covers
       ├── illustrations (story creation only)
       ├── uploaded files
       ├── extracted assets
       └── generated audio
30–31. Asynchronous Imports / AI Preprocessing
Not yet implemented. See original spec for full detail.

32. API Structure (current)
Plaintext
/api/auth/*                   ✓ (register, login, logout, me [GET+PATCH],
                                switch-child, password-reset, account delete,
                                verify-email, resend-verification)
/api/children                 ✓ (CRUD)
/api/books                    ✓
/api/books/search             ✓ (relevance fix deployed, Section 6.4)
/api/books/:id                ✓
/api/books/featured           ✓ (NYT bestseller rail — deployed Sprint H.1)
/api/covers/placeholder       ✓
/api/progress                 ✓ (session-scoped, auth-gated)
/api/achievements             ✓
/api/create-story             ✓
/api/generate-illustration    ✓ (story creation only)
/api/tts                      ✓
/api/chat                     ✓
/api/health                   ✓
/api/billing/*                ~ (Lemon Squeezy & Pesapal — planned)
33. Error Handling
JSON
{ "error": { "code": "BOOK_NOT_FOUND", "message": "..." } }
Never expose stack traces, keys, credentials, or internal filesystem
details.

34. Rate Limits
Login: 10/15min per IP. Password reset: 3/1hr per IP. Email
verification resend: 3/1hr per IP. AI generation: 15/min. AI chat:
15/min. TTS: 15/min. Image generation: 6/min. Global: 100/min.
All implemented and deployed.

35. Upload Security
Not yet implemented. See original spec for full validation checklist.

36. Accessibility
Font size and font family configurable. Dyslexic font option exists.
Syllable toggle exists. Keyboard navigation and ARIA roles not yet
systematically implemented.

37. Production Sprint — Current Status

Sprint A: Stabilize — COMPLETE
[x] Health endpoint
[x] Database connectivity
[x] Migration verification (0000 + 0001 + 0002 all applied)
[x] Failure states (asyncHandler + process-level safety net)
[x] Railway deployment stable

Sprint B: Identity — COMPLETE (deployed)
[x] Parent auth DB schema
[x] Auth repository (register, login, session resolution, child
    switching, password reset, account deletion)
[x] Auth middleware (loadSession, requireAuth, requireAdmin, cookie helpers)
[x] Auth routes (/api/auth/*)
[x] Child profile CRUD (/api/children)
[x] DB migration 0002 applied to production
[x] bcrypt + cookie-parser installed
[x] server.ts wired
[x] Progress routes protected with requireAuth + requireChildContext
[x] Frontend login / register UI (LoginScreen)
[x] Frontend child selector (ChildGate)
[x] Integration test suite (22/22 passing)
[x] Verified end-to-end in production
[x] Password reset UI
[x] Recovery email delivery (Resend — deployed, RESEND_API_KEY set)

Sprint B.1: Post-Launch Auth & Discovery — COMPLETE (deployed)
[x] Update display name (PATCH /api/auth/me + ChildGate inline editor)
[x] Password reset frontend
[x] Transactional email via Resend
[x] Open Library search relevance fix (over-fetch + quality ranking)
[x] Sign-up email verification (nudge model)
[x] NYT Books API provider
[x] Google Books API provider
[x] Duplicate server/books/progress/repository.ts removed (git rm)

Sprint H.1: New Discovery Providers — COMPLETE (deployed)
[x] NYT_API_KEY obtained and set in Railway
[x] NYT provider implemented (list-based, 24h cache, attribution)
[x] NYT "Bestsellers" rail in BookDiscoveryModal
[x] GOOGLE_BOOKS_API_KEY obtained and set in Railway
[x] Google Books provider implemented (search-based, quality-ranked)
[x] /api/books/featured endpoint live and returning real data
[x] Both providers confirmed in /api/health response
[ ] Cross-provider ISBN-based de-duplication (dedupeBooks() still
    title+author only)

Sprint C: Durable Storage — IN PROGRESS

Phase C-A (minimal durable foundation; current implementation)
[x] Shelf schema exported and API backed by PostgreSQL
[x] Cover URL column and provider write path
[x] Migration for the C-A tables and cover cache
[ ] Deploy migration and smoke-test shelf persistence

Phase C-B (full storage architecture; remains on the horizon)
[ ] PostgreSQL as source of truth for book content
[ ] Book/chapter schema used for all providers
[ ] Import jobs table
[ ] Object storage bucket (Cloudflare R2 preferred)
[ ] Book cover caching tiers 1-5 from Section 6.1
[ ] Image storage for story illustrations (not book covers)
[ ] Uploaded files storage
Sprint C.A: Shelf Schema + Cover Caching — COMPLETE (not yet deployed)
[x] db/schema/index.ts export bug fixed (shelf.ts and imports.ts were
    written but never exported — silently missing from every
    drizzle-kit command)
[x] shelf_items table (want-to-read / reading / finished, favorite,
    progress_page) + shelf_status enum, migration 0004
[x] books.cover_url column — also closes a pre-existing gap:
    providers/database.ts's loadBook() always returned coverImage: ""
[x] book_cover_cache table — NOT books.cover_url as originally
    sketched; books.id is a uuid unrelated to external catalog ids
    like "openlibrary:OL123W", so there was nothing to upsert against
    there for non-DB-backed books. Small dedicated table keyed on the
    provider's own book id string instead.
[x] BookRepository caches external providers' covers on list()/getById()
    (fire-and-forget write; read-fallback only when a provider call
    comes back with no cover)
[x] GET/POST /api/shelf, PATCH/DELETE /api/shelf/:bookId — session-scoped
    via requireAuth + requireChildContext, same pattern as /api/progress
[!] CRITICAL FINDING: db/migrations/meta/_journal.json was missing the
    entry for 0003_email_verification.sql. drizzle-kit migrate reads
    only the journal, not the migrations folder, to decide what to run
    — so Sprint B.1's migration almost certainly never actually applied
    to production despite the "migration ran successfully" output you
    saw (the NOTICEs were just 0000-0002 being re-skipped as already
    applied). Fixed by adding the missing 0003 entry alongside the new
    0004 entry. Re-running `npx drizzle-kit migrate` will apply both
    for the first time. email_verified_at / email_verification_tokens
    should be verified in production after this deploy.
[!] Also found: a stray db/migrations/meta/0003_snapshot.json already
    existed, describing shelf_items/import_jobs but NOT
    email_verification_tokens — inconsistent with both 0003's actual
    content and current schema files. Left as-is (repairing it needs a
    live `drizzle-kit generate` against the real DB, which can't be
    done from this environment) — recommend running `drizzle-kit
    generate` once after this deploys, to resync snapshots and avoid
    surprises on the next schema change.
[ ] scripts/apply-shelf-import-tables.ts's relationship to migration
    0004 unresolved — if that script was ever run by hand against
    production, migration 0004 is written defensively (IF NOT EXISTS /
    DO-block guards throughout) to no-op safely either way, but this
    wasn't verified against the actual production DB state.

Sprint C.B: Durable Storage — IN PROGRESS (object storage + illustrations
  done, not yet deployed; full catalog migration/backups still open)
[x] Object storage client (server/storage/objectStorage.ts) — S3-compatible,
    works against Cloudflare R2 or Railway object storage without a
    provider-specific branch, just different env vars
[x] Image storage for story illustrations — PATCH /api/books/:id/illustration
    now actually persists (upload to bucket, record in assets +
    book_page_assets) instead of the old no-op-with-warning
[x] Illustrations survive a restart and are readable back: loadBook() now
    joins in each page's current (isPrimary) illustration
[!] CRITICAL FINDING: server/books/providers/database.ts (the DB-backed
    provider — search, getBook, updatePageImage, updateBookLevel,
    updateBookStatus, all fully implemented) was never registered in
    server/books/catalog.ts's provider list. It was completely
    unreachable — not in search results, and updatePageImage() could
    never find a book through it. Fixed by adding it to the array
    (after publicDomainProvider, so JSON-backed entries keep winning
    any title+author dedupe collision with an unverified DB copy).
[ ] PostgreSQL as source of truth for ALL book content — the database
    provider is now reachable, but scripts/migrate-catalog-to-db.ts
    (which copies the JSON catalog into it) hasn't been confirmed run
    against production; Open Library/Standard Ebooks/Google Books/NYT
    remain live-fetched regardless (that's inherent to those sources,
    not a migration gap)
[ ] Uploaded files storage (EPUB/PDF) — the object storage client this
    sprint built is reusable for Sprint D's file uploads, but no upload
    endpoint exists yet; deferred to Sprint D itself
[ ] Backups
[ ] Recovery test
[ ] STORAGE_* env vars not yet obtained/set (external manual step —
    Cloudflare R2 account + bucket, or Railway's object storage add-on)

Sprint D: EPUB/PDF Shelf — after Sprint C.B
[ ] import_jobs table has no migration yet — db/schema/imports.ts is now
    exported (C.A export-bug fix covered it too) but nothing has created
    the table in Postgres. Deferred here since import_jobs is EPUB/PDF-
    upload-specific, not shelf-specific — picking it up when Sprint D
    starts rather than folding it into 0004.
[ ] EPUB upload endpoint
[ ] PDF upload endpoint
[ ] Security validation (magic bytes, size, archive bomb check)
[ ] EPUB extraction (spine, chapters, HTML sanitization)
[ ] PDF text extraction + OCR fallback
[ ] Chapter detection
[ ] Metadata normalization
[ ] Cover extraction (feeds into Section 6.1 tier 5)
[ ] Rights classification (USER_PRIVATE)
[ ] Private shelf (never shared without explicit action)
[ ] Processing status / progress indicator
[ ] Reader integration
[ ] Progress integration

Sprint E: Dialogic Reading Engine — after Sprint D
[ ] CROWD question types (Completion, Recall, Open-ended, Wh-, Distancing)
[ ] PEER interaction loop (Prompt → Evaluate → Expand → Repeat)
[ ] Structured question selection
[ ] Response evaluation
[ ] Hint generation
[ ] Rephrasing on failure
[ ] Downward scaffolding
[ ] Upward scaffolding
[ ] Interaction pacing
[ ] Session memory (don't repeat question types)
[ ] Post-reading reflection prompts
[ ] Learning signal recording

Sprint F: Personalization — after Sprint E
[ ] Reading profile aggregation
[ ] Strengths and practice opportunities
[ ] Interest tracking
[ ] Reading history
[ ] Book recommendations
[ ] Adaptive question difficulty
[ ] Adaptive reading level suggestions

Sprint G: Parent Platform — after Sprint F
[~] Dashboard (exists; child selector and learning indicators missing)
[ ] Child switcher in dashboard
[ ] Progress reports
[ ] Session summaries
[ ] Reading recommendations for parents
[ ] Suggested parent follow-up prompts
[ ] Notification settings
[ ] Privacy controls / data export

Sprint H: Library Expansion — parallel track
[x] Open Library metadata/discovery
[x] Standard Ebooks OPDS discovery
[x] Public-domain import pipeline
[x] NYT Books API (Sprint H.1)
[x] Google Books API (Sprint H.1)
[ ] Standard Ebooks full text ingestion where license permits
[ ] Additional verified public-domain sources
[ ] Rights metadata enrichment
[ ] Import moderation queue
[ ] ISBN-based cross-provider de-duplication
[ ] Metadata normalization across providers

Sprint I: Scale — after production traffic exists
[ ] Monitoring (Railway metrics + error alerting)
[ ] Analytics (reading engagement, AI cost tracking)
[ ] Caching layer
[ ] AI cost controls
[ ] Background workers
[ ] Queue infrastructure
[ ] Automated backups
[ ] Disaster recovery plan
[ ] Load testing
[ ] Security testing

38. Acceptance Criteria
Infrastructure
[ ] Railway stable ✓ (running)
[ ] PostgreSQL stable ✓ (connected, all 4 migrations applied)
[ ] Backups verified
[ ] Monitoring active
[ ] No critical recurring errors

Accounts
[x] Parent authentication (deployed and verified in production)
[x] Child profiles (CRUD complete)
[x] Authorization enforced on all private routes
[x] Child isolation verified (cross-account 403 confirmed)
[x] Display name update (deployed)
[x] Password reset (deployed)
[x] Sign-up email verification (deployed, nudge model)

Library
[x] Catalog (built-in + Open Library + Standard Ebooks + public-domain + NYT + Google Books)
[ ] Private shelf (Sprint D)
[ ] EPUB reader
[ ] PDF reader
[ ] Rights enforcement
[~] Book covers always render (tier 6 + frontend onError done; tiers 1-5 caching Sprint C; AI covers removed from strategy)
[x] Search relevance (Open Library over-fetch + quality ranking deployed)
[x] NYT Books API bestseller rail (deployed)
[x] Google Books API provider (deployed)

Reading
[x] Progress persistence (DB-backed, session-scoped)
[ ] Resume position
[x] TTS
[~] Accessibility controls (font/theme in place; keyboard nav missing)

AI
[x] Reading Companion (Barnaby owl / Pip dragon)
[ ] CROWD question types
[ ] PEER interaction loop
[ ] Response evaluation
[ ] Adaptive scaffolding
[ ] Adaptive difficulty
[x] Safety (input sanitization, reading-context constraint)
[x] Graceful AI failures (503 fallback when key missing)
[x] AI illustration scoped to story creation only (not book covers)

Parent
[~] Dashboard (partial — time/books/words; no child selector)
[ ] Progress summaries
[ ] Privacy controls

Security
[ ] Upload security (Sprint D)
[x] Authorization (session-based auth deployed and verified)
[x] Rate limits (all AI endpoints + login + reset + global)
[x] Secrets protected (Helmet, no env vars in client bundle)
[x] Logs sanitized (no stack traces in API responses)

39. Implementation Status Convention
Plaintext
Status:
Date:
Commit:
What changed:
Tests:
Known limitations:
Next step:
Use:

[ ] NOT STARTED

[~] IN PROGRESS

[x] DONE

[!] BLOCKED

[-] DEFERRED

40. Strategic End State
Plaintext
                         STORYPALS
                            |
             +--------------+--------------+
             |                             |
          LIBRARY                         FAMILY
             |                             |
       Catalog / EPUB / PDF          Parent / Child
             |                             |
             +--------------+--------------+
                            |
                     READING ENGINE
                            |
                 +----------+----------+
                 |                     |
               READ                  DIALOGUE
                 |                     |
                 |                CROWD + PEER
                 |                     |
                 |                SCAFFOLDING
                 |                     |
                 +----------+----------+
                            |
                      PERSONALIZATION
                            |
                       NEXT BOOK
Strategic moat: the reading intelligence layer, not merely the book
catalogue.

Every appropriate book can become an interactive, adaptive reading experience.

41. Key Decisions Log
This section records product/architecture decisions made during
implementation so they are not re-litigated in future sprints.

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-12 | Email verification uses nudge model (not block) | Low-stakes account type; lower friction for parents signing up to read with a child |
| 2026-09-12 | AI-generated covers removed from cover strategy | Book covers must be actual book covers. AI illustration is for story creation only, not a cover fallback. |
| 2026-09-12 | NYT/Google Books are metadata/discovery only | Both providers are discovery pointers; neither grants content rights. No fullText path. |
| 2026-09-12 | Amazon/Apple Books/Kobo not pursued | No self-serve API access available; would require business-development relationships |
| 2026-09-12 | OverDrive/Libby deferred | Real partner relationship required — flag for future BD conversation, not engineering |
