StoryPals — Master Product & Engineering Specification
Version: 1.3
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

[x] AI illustration generation exists

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

[x] DB schema fully migrated (0000 + 0001 + 0002)

[x] Sprint B: Auth complete — register, login, logout, sessions, child profiles, child selection, authorization, progress scope

[x] Sprint B: Frontend login/register UI complete (LoginScreen, ChildGate, useAuth)

[x] Sprint B: Integration test suite complete (test/auth-integration.test.ts)

[x] Sprint B: Verified working end-to-end locally (parent registered, children created, DB persisting)

[x] Sprint B.1: Account display-name update (PATCH /api/auth/me) — implemented, lint-clean, not yet deployed

[x] Sprint B.1: Password reset frontend UI (request + confirm screens) — implemented, not yet deployed

[x] Sprint B.1: Transactional email sending (Resend) wired to password reset — code complete; requires RESEND_API_KEY in production to actually send mail

[x] Sprint B.1: Sign-up email verification — implemented (nudge model), not yet deployed (see Section 4.1)

[x] Sprint H.1: Additional discovery providers (NYT Books API, Google Books API) — implemented, not yet deployed (see Section 6.3)

[x] Book search relevance fix — Open Library provider now over-fetches and re-ranks by quality signal instead of filtering a single small page (see Section 6.4)

[~] Book Covers: tier 6 placeholder + API guarantee + frontend onError done; tiers 1-5 caching open

[ ] Production deploy of Sprint B (push pending)

[ ] Production deploy of Sprint B.1 (this document's new work — push pending)

[ ] Production audit complete

[ ] Authentication complete in production

[ ] Durable book storage architecture complete

[ ] Durable image/object storage complete

[ ] Full dialogic reading engine complete

[ ] Full EPUB ingestion complete

[ ] PDF ingestion complete

[~] Monetization/Paywall integration: Lemon Squeezy / Pesapal token-refill model (Architectural design mapped; implementation pending)

3. Roles
Parent/Caregiver
Account creation and login ✓

Password reset/logout ✓ (backend + frontend UI now both complete; production deploy pending)

Update display name ✓ (backend + frontend UI complete; production deploy pending)

Email verification at sign-up ✓ (backend + frontend banner/toast complete; production deploy pending)

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
API endpoints (Sprint B — all working)
Plaintext
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
PATCH  /api/auth/me                    ← new (Sprint B.1): update displayName
POST   /api/auth/switch-child
POST   /api/auth/logout
POST   /api/auth/password-reset/request
POST   /api/auth/password-reset/confirm
DELETE /api/auth/account
GET    /api/children
POST   /api/children
PATCH  /api/children/:id
DELETE /api/children/:id
GET    /api/progress         (requireAuth + requireChildContext)
PATCH  /api/progress/page    (requireAuth + requireChildContext)
POST   /api/progress/badge   (requireAuth + requireChildContext)
POST   /api/billing/checkout (Lemon Squeezy / Pesapal order initialization)
POST   /api/billing/webhook  (Lemon Squeezy / Pesapal IPN credit fulfillment)
Security (Sprint B — verified)
Sessions: HTTP-only cookie, sameSite: lax, secure in production

Passwords: bcrypt cost 12, wrapped in db.transaction()

Rate limiting: 10 login attempts / 15 min per IP; 3 reset requests / 1 hr per IP

Email enumeration: constant-time compare on login; always-200 on reset/request

Account deletion: requires password re-confirmation

Cross-account isolation: verified live — a second account cannot switch into or read another family's child data (403 FORBIDDEN / 403 NO_CHILD_SELECTED)

Known gaps
Sign-up email verification: implemented, nudge model chosen (see 4.1) — not yet deployed

Permissions: ownership-based only; no fine-grained permission model yet

4.1. Sign-Up Email Verification — Sprint B.1 (New)
Problem: registerUser() creates the account and establishes a session
immediately. There is no confirmation that the email address is real or
owned by the registrant. This matters more now that password reset
depends on that inbox actually being reachable.

Decision needed before implementation: block vs. nudge.
  - Block: unverified accounts cannot use the app until they click the
    verification link.
  - Nudge (recommended default): account is fully usable immediately;
    an unverified banner/reminder is shown and re-sendable, but nothing
    is gated on it. Lower friction for a low-stakes account type
    (a parent signing up a child to read a book), while still getting a
    real, confirmed contact channel over time.

Data model addition
Plaintext
users
  + emailVerifiedAt (timestamp, nullable) — null until confirmed

EmailVerificationToken (new table, same shape as PasswordResetToken)
  - id, userId, token, expiresAt, usedAt, createdAt

Implementation steps
[x] 1. Migration 0003: add users.email_verified_at; create
       email_verification_tokens table (mirror
       password_reset_tokens structure/indexes).
[x] 2. db/schema/auth.ts: add emailVerificationTokens table export;
       confirm it's re-exported from db/schema/index.ts (this exact
       omission broke the auth tables in production once already —
       double-check before deploying).
[x] 3. server/auth/repository.ts: add generateEmailVerificationToken(userId)
       and verifyEmailToken(token) — mirror
       requestPasswordReset/consumePasswordReset shape and TTL pattern
       (recommend 24h TTL, longer than the 1h reset window since this
       isn't a security-sensitive action).
[x] 4. registerUser(): after the existing transaction, generate a
       verification token and call sendVerificationEmail() (new function
       in server/auth/email.ts, same Resend-or-console-log pattern as
       sendPasswordResetEmail).
[x] 5. New route: GET /api/auth/verify-email?token=... — consumes the
       token, sets emailVerifiedAt, redirects to
       {APP_URL}/?verified=1 (frontend shows a one-time confirmation
       toast, no dedicated screen needed).
[x] 6. New route: POST /api/auth/resend-verification (requireAuth) —
       rate-limited same as password reset (reuse rateLimitAttempts
       action="verify-resend").
[x] 7. Frontend: MeResponse gains emailVerified: boolean. If false,
       AppShell/ChildGate shows a small dismissible banner: "Please
       verify your email — Resend link." No blocking of any screen
       (nudge model) unless the block decision above is chosen instead.
[x] 8. Update test/auth-integration.test.ts: register → verify token
       issued → consume → emailVerifiedAt set → re-consuming the same
       token fails (INVALID_TOKEN, matching the reset-token pattern).
[x] 9. Update Section 39-style status block here once shipped.

Status: Implemented locally (nudge model — see decision above); not yet deployed to Railway production.
Date: 12 September 2026
Commit: (pending — not yet pushed)
What changed: users.email_verified_at + email_verification_tokens (migration 0003); repository generateEmailVerificationToken/verifyEmailToken/resendVerificationEmail; GET /api/auth/verify-email and POST /api/auth/resend-verification routes; registerUser() now issues a token post-transaction and sends it via server/auth/email.ts (Resend-if-configured, console-log fallback — same seam used for password reset); MeResponse gained emailVerified; ChildGate shows a dismissible VerifyEmailBanner when false; App.tsx shows a one-time ?verified=1|0 toast.
Tests: test/auth-integration.test.ts — register -> token issued -> consumed via verify-email -> emailVerifiedAt set -> re-consuming the same token rejected. Reads the token directly from the test DB (never returned over HTTP, by design).
Known limitations: requires RESEND_API_KEY in Railway to actually deliver mail in production; without it the link is only logged server-side, same as password reset today.
Next step: production deploy of Sprint B.1 (already pending for display-name update and password reset).

Known limitations (anticipated): same as password reset — requires
RESEND_API_KEY configured in Railway to actually deliver mail in
production; without it, the link is only logged server-side.

6. Library Architecture
Normalize all sources into one StoryPals book model.

Plaintext
Open Library ─┐
Standard Ebooks ├→ Ingestion → Validation/Rights/Safety → Normalized Book → Shelf
Public-domain ──┤
NYT Books API ──┤   (metadata/ranking only — Sprint H.1)
Google Books ───┤   (metadata/discovery only — Sprint H.1)
EPUB upload ───┤
PDF upload ────┘
Implemented providers
Provider	Status	Notes
builtin	[x]	Hard-coded classics
openlibrary	[x]	Metadata/discovery, 5-min cache; re-ranked for quality (Sprint B.1, see 6.4)
standard-ebooks	[x]	OPDS feed, 10-min cache
public-domain	[x]	Imported via CLI or HTTP endpoint
nytimes	[ ]	Planned — Sprint H.1, see 6.3
google-books	[ ]	Planned — Sprint H.1, see 6.3

6.1. Book Cover Rendering — Required Capability
Every book must always render a cover image. A broken image, blank tile,
or infinite loading state is a defect regardless of book source.

Cover Sources (resolution order)
Plaintext
1. Native/curated cover (publisher- or admin-supplied)
2. Standard Ebooks cover
3. Open Library cover (covers.openlibrary.org)
4. Embedded cover extracted during EPUB/PDF ingestion
5. AI-generated illustration used as a stand-in cover
6. Deterministically generated placeholder cover  ← must always succeed
Status: Tier 6 implemented at both layers. Server-side
GET /api/covers/placeholder wired into every book endpoint via
withGuaranteedCover(). Client-side SafeStoryImage wraps every
cover/illustration with onError → StoryImagePlaceholder. Admin
cover override via PATCH /api/books/:id/cover implemented.
Still open: tiers 1-5 caching into BookAsset object storage;
durable fallback-rate monitoring. Google Books covers (6.3) would
slot in as an additional tier-3-equivalent source once implemented.

6.2. Commercial Storefront Discovery — Feasibility Findings (Sprint B.1)
Investigated during Sprint B.1 in response to a request to add Kindle,
Apple Books, Kobo, and major-publisher APIs. Findings, so this isn't
re-investigated in a future sprint:

  - Amazon: no public catalog/content API for third-party search or
    reading. The Product Advertising API is affiliate-link/product-data
    only and requires an Associates account with sales history — not
    usable as a discovery provider here.
  - Apple Books: no public developer API for catalog access.
  - Kobo (Rakuten): no open self-serve developer program; existing
    access is a closed retail-partner relationship, not an API key
    signup.
  - Major publishers (Scholastic, Penguin Random House, HarperCollins,
    Macmillan): no self-serve public APIs. Real content-distribution
    access to their catalogs runs through OverDrive/Libby-style
    library-partner relationships — a business-development process,
    not an engineering task.
  - OverDrive/Libby: real and widely used for library ebook lending,
    but onboarding is a partner relationship, not a public API — flag
    for a future business-development conversation, not this sprint.

Conclusion: of everything investigated, NYT Books API and Google Books
API are the two that are actually self-serve and implementable now.
Both are metadata/discovery-only (fullText: false), same as the
existing Open Library and Standard Ebooks providers' metadata mode —
neither changes the "never publish content without rights" rule in
Section 27.

6.3. New Providers — Sprint H.1 (New)

NYT Books API
  - Source: developer.nytimes.com, free self-serve API key.
  - Covers 50+ list categories; relevant ones: "Children's Middle
    Grade Hardcover", "Picture Books", "Series Books for Young
    People", "Chapter Books".
  - Returns: title, author, ISBN, rank, weeks-on-list, publisher,
    Amazon product URL. No full text, no cover image hosting of its
    own (cross-reference ISBN to Open Library/Google Books for a
    cover).
  - Terms require attribution ("Based on reporting from The New York
    Times") and prohibit reproducing full list contents beyond
    reasonable display use — check current terms at
    developer.nytimes.com before shipping, since these can change.
  - Use case: not a search provider in the usual sense (no free-text
    query) — it's a curated "featured/bestsellers" rail, which
    directly helps the "generic results" complaint by giving
    editorially-vetted picks alongside raw search.

  Implementation steps
  [!] 1. Register for an NYT Developer API key (manual, external —
         cannot be automated); add NYT_API_KEY to Railway env vars. BLOCKED on you — code is ready and reads NYT_API_KEY; returns an empty bestseller list until it's set.
  [x] 2. server/books/providers/nytimes.ts: new provider file.
         Capabilities: { metadata: true, fullText: false, covers: false,
         requiresApiKey: true }.
  [x] 3. Implement listBestsellers(listName) — no search(), since NYT's
         API is list-based, not query-based; this provider won't fit
         BookProvider.search() the same way Open Library does. Went
         with the dedicated GET /api/books/featured?list= endpoint,
         not a BookProvider.search() extension.
  [x] 4. Cross-reference each NYT entry's ISBN against the existing
         Open Library cover endpoint (covers.openlibrary.org/b/isbn/
         {isbn}-M.jpg) for a display image, since NYT doesn't host one.
  [x] 5. New frontend surface: a "Bestsellers" rail/section in
         BookDiscoveryModal, separate from the free-text search
         results — do not merge into the same list, since the data
         shapes and interaction (browse vs. search) differ. Shipped
         for the "Picture Books" list; the other three list slugs
         (middle-grade, series, chapter books) are supported by the
         same /api/books/featured?list= endpoint but have no rail UI yet.
  [x] 6. Cache aggressively (NYT list data updates weekly) — a 12-24h
         cache TTL is appropriate, unlike Open Library's 5-minute
         cache for live search. 24h TTL, per-list-slug.
  [x] 7. Attribution line displayed wherever NYT data is shown.

Google Books API
  - Source: Google Cloud Console, free self-serve API key (no billing
    account strictly required for the free tier, but Google may ask
    you to enable one — confirm at setup time).
  - Same shape as Open Library: volumes.list search endpoint,
    supports free-text query + subject filtering, returns cover
    images, and for public-domain works can return preview/full-text
    links.
  - Use case: second metadata/search provider, same role as Open
    Library — broader/different cover-image coverage in practice, so
    it materially helps "book covers must always render" independent
    of the bestseller-rail use case above.

  Implementation steps
  [!] 1. Create a Google Cloud project, enable the Books API, generate
         an API key restricted to that API (manual, external); add
         GOOGLE_BOOKS_API_KEY to Railway env vars. BLOCKED on you — code reads
         GOOGLE_BOOKS_API_KEY and fails soft (contributes nothing to
         search) until it's set.
  [x] 2. server/books/providers/googlebooks.ts: new provider file,
         modeled directly on server/books/providers/openlibrary.ts —
         same isChildRelevant()-style filtering (Google Books has its
         own subject/category taxonomy, will need its own term list),
         same over-fetch-then-filter pattern from the openlibrary.ts
         fix (6.4) applied from the start rather than retrofitted
         later.
  [x] 3. Register the new provider in server/books/catalog.ts /
         index.ts alongside the existing four.
  [x] 4. Add "google-books" as a valid query.source value end-to-end
         (types.ts, BookDiscoveryModal's search merge). server.ts never had a
         source whitelist to update — query.source is passed straight
         through as BookSourceType.
  [~] 5. Decide de-duplication behavior: a popular children's book
         will likely appear in both Open Library and Google Books
         results for the same query — BookRepository.list()'s
         dedupeBooks() needs a real key (ISBN-based, not just title
         string match) to avoid showing the same book twice in a
         combined view. NOT YET DONE — dedupeBooks() still only
         dedupes by book.id and a normalized title+author fingerprint,
         not ISBN. Left as-is for this pass since neither provider's
         Book object currently carries an isbn field; flagging as the
         next follow-up rather than a silent scope-add here.
  [x] 6. Test suite: unit test the new provider's filtering logic in
         isolation, matching the pattern used for openlibrary.ts if
         such tests exist, or add one now if they don't. Added
         test/googlebooks-provider.test.ts (7 tests) — no such tests
         existed for any provider before this.

6.4. Book Search Relevance Fix — Sprint B.1 (Shipped)
Status: DONE (local, lint-clean; not yet deployed)
Date: 2026-09-12
What changed: /api/books/search?source=openlibrary was fetching only
  20 raw Open Library docs and filtering for child-relevance after the
  fetch — when most of a page got filtered out, users saw only a
  handful of leftover, often-obscure results ("generic results").
  Fixed in server/books/providers/openlibrary.ts:
    - Over-fetch up to 3 raw pages (40 docs/page) until enough
      child-relevant survivors are collected, instead of filtering a
      single small page.
    - Added sort=rating to Open Library's query to bias toward
      well-known editions over raw text-match relevance.
    - Added a quality heuristic (cover presence + subject richness +
      full-text/public-access flag) to rank survivors before
      truncating to the requested page size.
Tests: verified via tsc/build; no dedicated unit test yet for this
  provider's filtering logic (candidate for the Section 6.3 test-suite
  step above, since Google Books will need the same pattern).
Known limitations: still page:1-only (the caller
  (server.ts /api/books/search) always requests page 1 today, so this
  wasn't a regression, but true pagination through the over-fetched
  pool isn't implemented — would need to slice the already-fetched,
  already-ranked pool rather than re-fetching per page).
Next step: apply the same over-fetch + quality-ranking pattern to the
  new Google Books provider (6.3) from the start.

6.3 Status
Status: Implemented locally; not yet deployed. Both providers fail soft
  (contribute nothing) if their API key env var is unset, so this cannot
  break existing search/catalog behavior even before keys are configured.
Date: 12 September 2026
Commit: (pending — not yet pushed)
What changed: server/books/providers/googlebooks.ts (BookProvider,
  registered in catalog.ts, same over-fetch+quality-rank pattern as 6.4);
  server/books/providers/nytimes.ts (listBestsellers(), not a BookProvider —
  list-based per spec); GET /api/books/featured?list= route; BookDiscoveryModal
  now merges google-books into search and shows a "Picture Books" NYT rail;
  BookSourceType gained "google-books" | "nytimes"; .env.example documents
  GOOGLE_BOOKS_API_KEY and NYT_API_KEY.
Tests: test/googlebooks-provider.test.ts (7 tests, isChildRelevant +
  qualityScore) — new pattern, none existed for any provider before this.
  npx tsc --noEmit, vite build, and the esbuild server bundle all pass with
  no new errors (one pre-existing, unrelated error in
  server/books/progress/repository.ts was already there before this work).
Known limitations: NYT_API_KEY / GOOGLE_BOOKS_API_KEY not yet obtained/set
  (external manual step — see steps 1 above in each section); Bestsellers
  rail only wired up for the "picture-books" list, not the other three;
  ISBN-based de-duplication (6.3 Google Books step 5) not implemented —
  dedupeBooks() still uses title+author fingerprint only.
Next step: register for NYT_API_KEY and GOOGLE_BOOKS_API_KEY, set both in
  Railway, redeploy, then verify both providers return real results.

7. Personal EPUB/PDF Shelf — Required Capability (Sprint D)
Private family uploads of EPUB and PDF books. Critical: uploads must
never automatically become public. Planned for Sprint D.

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

[x] Auto-illustrate per page (Gemini image generation)

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
Applies equally to the planned NYT/Google Books providers (6.3):
both are metadata-only by design, so nothing they return should ever
be marked PUBLIC_DOMAIN or given a reader/fullText path — they are
discovery pointers, same rights treatment as the existing Open
Library metadata mode.

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
       email_verification_tokens (planned, Section 4.1)
          ↓
     Object Storage (not yet wired)
       ├── covers
       ├── illustrations
       ├── uploaded files
       ├── extracted assets
       └── generated audio
30–31. Asynchronous Imports / AI Preprocessing
Not yet implemented. See original spec for full detail.

32. API Structure (current)
Plaintext
/api/auth/*          ✓ (register, login, logout, me [GET+PATCH], switch-child, password-reset, account delete)
/api/auth/verify-email          ~ (planned, Section 4.1)
/api/auth/resend-verification   ~ (planned, Section 4.1)
/api/children        ✓ (CRUD)
/api/books           ✓
/api/books/search    ✓ (relevance fix shipped, Section 6.4)
/api/books/:id       ✓
/api/books/featured  ~ (planned — NYT bestseller rail, Section 6.3)
/api/covers/placeholder ✓
/api/progress        ✓ (session-scoped, auth-gated)
/api/achievements    ✓
/api/create-story    ✓
/api/generate-illustration ✓
/api/tts             ✓
/api/chat            ✓
/api/health          ✓
/api/billing/*       ~ (Lemon Squeezy & Pesapal checkout/IPN routing)
33. Error Handling
JSON
{ "error": { "code": "BOOK_NOT_FOUND", "message": "..." } }
Never expose stack traces, keys, credentials, or internal filesystem
details.

34. Rate Limits
Login: 10/15min per IP. Password reset: 3/1hr per IP. Email
verification resend: 3/1hr per IP (planned, mirror reset). AI
generation: 15/min. AI chat: 15/min. TTS: 15/min. Image generation:
6/min. Global: 100/min. All implemented except verification-resend.

35. Upload Security
Not yet implemented. See original spec for full validation checklist.

36. Accessibility
Font size and font family configurable. Dyslexic font option exists.
Syllable toggle exists. Keyboard navigation and ARIA roles not yet
systematically implemented.

37. Production Sprint — Current
Sprint A: Stabilize
[x] Health endpoint

[x] Database connectivity

[x] Migration verification (0000 + 0001 + 0002 all applied)

[x] Failure states (asyncHandler + process-level safety net)

[ ] Railway audit

[ ] Runtime logs review

[ ] Full frontend smoke test on production URL

[ ] Fix P0 issues

[ ] Classify P1/P2

Sprint B: Identity
[x] Parent auth DB schema (user_passwords, sessions, rate limits, reset tokens)

[x] Auth repository (register, login, session resolution, child switching, password reset, account deletion)

[x] Auth middleware (loadSession, requireAuth, requireAdmin, cookie helpers)

[x] Auth routes (/api/auth/*)

[x] Child profile CRUD (/api/children)

[x] DB migration 0002 applied to production

[x] bcrypt + cookie-parser installed in package.json

[x] server.ts wired (cookieParser + loadSession + route mounts)

[x] Progress routes protected with requireAuth + requireChildContext

[x] childId derived from req.session.activeChildId

[x] Frontend login / register UI (LoginScreen)

[x] Frontend child selector (ChildGate)

[x] Integration test suite (22/22 passing)

[x] Verified end-to-end locally (parent + 2 children registered, DB persisting)

[x] Password reset UI

[ ] Account deletion UI

[x] Recovery email delivery (transactional mail provider) — Resend, code complete; needs RESEND_API_KEY in Railway

[ ] Push to Railway + production smoke test

Sprint B.1: Post-Launch Auth & Discovery Additions (New)
[x] Update display name (PATCH /api/auth/me + ChildGate inline editor)

[x] Password reset frontend (LoginScreen "Forgot password?" flow + ResetPasswordScreen)

[x] Transactional email sending via Resend (server/auth/email.ts)

[x] Open Library search relevance fix (over-fetch + quality ranking, Section 6.4)

[x] Sign-up email verification (Section 4.1) — nudge model chosen; implemented, not yet deployed

[ ] NYT Books API provider (Section 6.3)

[ ] Google Books API provider (Section 6.3)

[ ] Push Sprint B.1 to Railway + production smoke test

[!] Recurring build hazard: an orphaned duplicate file
    (server/books/progress/repository.ts, byte-identical to
    server/progress/repository.ts) has reappeared and broken `tsc`
    across three separate exports of this repo. It is not imported
    anywhere. This needs to be `git rm`'d from the repository itself
    (not just deleted locally each session) or it will keep
    recurring in every future export/deploy.

Sprint C: Durable Storage
[ ] PostgreSQL as source of truth for book content

[ ] Book/chapter schema used for all providers

[ ] Shelf schema

[ ] Import jobs table

[ ] Object storage bucket

[ ] Image migration (illustrations currently in-memory/client-only)

[ ] Uploaded files storage

[ ] Backups

[ ] Recovery test

Sprint D: EPUB/PDF Shelf
[ ] EPUB upload endpoint

[ ] PDF upload endpoint

[ ] Security validation (magic bytes, size, archive bomb check)

[ ] EPUB extraction (spine, chapters, HTML sanitization)

[ ] PDF text extraction + OCR fallback

[ ] Chapter detection

[ ] Metadata normalization

[ ] Cover extraction

[ ] Rights classification (USER_PRIVATE)

[ ] Private shelf (never shared without explicit action)

[ ] Processing status / progress indicator

[ ] Reader integration

[ ] Progress integration

Sprint E: Dialogic Reading Engine
[ ] CROWD question types (Completion, Recall, Open-ended, Wh-, Distancing)

[ ] PEER interaction loop (Prompt → Evaluate → Expand → Repeat)

[ ] Structured question selection

[ ] Response evaluation

[ ] Hint generation

[ ] Rephrasing on failure

[ ] Downward scaffolding (simpler → choices → yes/no → explain)

[ ] Upward scaffolding (recall → inference → prediction → evidence)

[ ] Interaction pacing

[ ] Session memory (don't repeat question types)

[ ] Post-reading reflection prompts

[ ] Learning signal recording

Sprint F: Personalization
[ ] Reading profile aggregation

[ ] Strengths and practice opportunities

[ ] Interest tracking

[ ] Reading history

[ ] Book recommendations

[ ] Adaptive question difficulty

[ ] Adaptive reading level suggestions

Sprint G: Parent Platform
[~] Dashboard (exists; child selector and learning indicators missing)

[ ] Child switcher in dashboard

[ ] Progress reports

[ ] Session summaries

[ ] Reading recommendations for parents

[ ] Suggested parent follow-up prompts

[ ] Notification settings

[ ] Privacy controls / data export

Sprint H: Library Expansion
[x] Open Library metadata/discovery

[x] Standard Ebooks OPDS discovery

[x] Public-domain import pipeline

[ ] Standard Ebooks full text ingestion where license permits

[ ] Additional verified public-domain sources

[ ] Rights metadata enrichment

[ ] Import moderation queue

[ ] Duplicate detection

[ ] Metadata normalization across providers

Sprint H.1: New Discovery Providers (New — see Section 6.3)
[ ] NYT Books API key obtained (external/manual step)

[ ] NYT provider implemented (list-based, not query-based)

[ ] NYT "Bestsellers" rail in BookDiscoveryModal

[ ] Google Books API key obtained (external/manual step)

[ ] Google Books provider implemented (search-based, mirrors openlibrary.ts)

[ ] Cross-provider de-duplication by ISBN (not title string match)

[ ] Commercial storefront feasibility findings documented (Section 6.2) — no further action planned; revisit only if OverDrive/Libby partner relationship becomes a real business priority

Sprint I: Scale
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
[ ] Railway stable

[ ] PostgreSQL stable

[ ] Backups verified

[ ] Monitoring active

[ ] No critical recurring errors

Accounts
[x] Parent authentication (complete end-to-end locally; production deploy pending)

[x] Child profiles (CRUD complete)

[x] Authorization enforced on all private routes

[x] Child isolation verified (cross-account 403 confirmed via integration tests)

[x] Display name update (complete locally; production deploy pending)

[x] Password reset (backend + frontend complete locally; production deploy pending)

[x] Sign-up email verification (implemented, not yet deployed)

Library
[x] Catalog (built-in + Open Library + Standard Ebooks + public-domain)

[ ] Private shelf (Sprint D)

[ ] EPUB reader

[ ] PDF reader

[ ] Rights enforcement

[~] Book covers always render (tier 6 + frontend onError done; caching open)

[x] Search relevance (Open Library over-fetch + quality ranking shipped, Section 6.4)

[x] NYT Books API bestseller rail (implemented, not yet deployed; NYT_API_KEY not yet set)

[x] Google Books API provider (implemented, not yet deployed; GOOGLE_BOOKS_API_KEY not yet set)

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

Parent
[~] Dashboard (partial — time/books/words; no child selector)

[ ] Progress summaries

[ ] Privacy controls

Security
[ ] Upload security (Sprint D)

[x] Authorization (session-based auth complete and verified)

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
