# StoryPals — Master Product & Engineering Specification

**Version:** 1.2
**Date:** 12 September 2026
**Status:** Living specification / implementation checklist
**Deployment:** Railway

> This is the master planning document for StoryPals. Mark every item
> `[ ]`, `[~]`, `[x]`, `[!]`, or `[-]` as implementation proceeds.
> Preserve working functionality unless a change is explicitly approved.

## 1. Product North Star

StoryPals is an adaptive reading companion that turns appropriate books
into interactive literacy experiences.

```text
DISCOVER → CHOOSE → WARM UP → PREDICT → READ → TALK → THINK
→ SCAFFOLD → UNDERSTAND → REFLECT → REMEMBER → PERSONALIZE → READ NEXT
```

AI supports reading and learning; it is not an unrestricted
general-purpose chatbot for children.

## 2. Current Baseline

* [x] Application exists
* [x] Railway deployment exists
* [x] PostgreSQL service exists
* [x] React frontend exists
* [x] Express API exists
* [x] Book catalog exists (built-in + Open Library + Standard Ebooks + public-domain)
* [x] Open Library discovery exists
* [x] Standard Ebooks OPDS discovery exists
* [x] Public-domain import pipeline exists
* [x] Reading progress infrastructure exists (DB-backed, session-scoped)
* [x] AI story generation exists
* [x] AI Reading Buddy exists (Barnaby owl / Pip dragon, Gemini-backed)
* [x] TTS exists (Gemini, voices: Puck / Kore / Zephyr)
* [x] AI illustration generation exists
* [x] Health endpoint exists (`/api/health` with DB check)
* [x] Rate limiting exists (global 100/min, AI 15/min, image 6/min)
* [x] Helmet / CSP exists
* [x] Book cover placeholder system exists (deterministic SVG, never 404s)
* [x] Reading level classifier exists
* [x] Safety screener exists
* [x] Phonics helper exists
* [x] Daily goal radial progress widget exists
* [x] Parent dashboard (partial — time, books, words explored)
* [x] Child settings schema exists
* [x] Achievements schema and badge-unlock API exist
* [x] Reading sessions + dailyActivity schema exist
* [x] Content moderation schema exists
* [x] DB schema fully migrated (0000 + 0001 + 0002)
* [x] Sprint B: Auth complete — register, login, logout, sessions, child profiles, child selection, authorization, progress scope
* [x] Sprint B: Frontend login/register UI complete (LoginScreen, ChildGate, useAuth)
* [x] Sprint B: Integration test suite complete (test/auth-integration.test.ts)
* [x] Sprint B: Verified working end-to-end locally (parent registered, children created, DB persisting)
* [~] Book Covers: tier 6 placeholder + API guarantee + frontend onError done; tiers 1-5 caching open
* [x] Production deploy of Sprint B — pushed to `origin/main` (commit `79a2cf3`, mislabeled "sprint c" — it is Sprint B: auth routes, ChildGate, LoginScreen, useAuth, auth-integration.test.ts) and confirmed live on Railway 2026-09-12
* [ ] Production audit complete
* [x] Authentication complete in production (confirmed live)
* [ ] Durable book storage architecture complete — **schema already exists and has existed since migration 0000** (`books`, `book_editions`, `book_pages`, `assets`, `book_page_assets`, `provider_registry`, `book_sources`), but is entirely unused: `server/books/repository.ts` and all four providers (builtin, public-domain, Open Library, Standard Ebooks) read from JSON/in-memory sources only, never from these tables. No `db.` or drizzle import exists anywhere under `server/books/`. This is the actual Sprint C starting point — wiring, not schema design.
* [ ] Durable image/object storage complete
* [ ] Full dialogic reading engine complete
* [ ] Full EPUB ingestion complete
* [ ] PDF ingestion complete

## 3. Roles

### Parent/Caregiver

* Account creation and login ✓
* Password reset/logout ✓ (backend only; no reset UI yet)
* Child profiles ✓
* Child selection ✓
* Library management
* Progress and session summaries
* AI/voice controls
* Private book uploads
* Privacy/data deletion controls

### Child

* Select own profile ✓
* Browse permitted books
* Read/listen
* Interact with Reading Companion
* Answer questions
* Receive hints
* View own progress/achievements
* Create permitted stories

Child profiles must not access parent controls, other children, admin
functions, or unrestricted AI.

### Administrator

* Catalog management
* Import moderation
* Provider management
* Content moderation
* System health/operational metrics

Authorization must be server-side. A shared admin key is only a
temporary development mechanism.

## 4. Authentication & Account Model

```text
Parent Account
 ├── Child A
 ├── Child B
 └── Child C
```

### Implemented entities (Sprint B — complete)

```text
User
- id (uuid), email (unique), displayName
- role (parent | admin), status (active | suspended | deleted)
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
```

### API endpoints (Sprint B — all working)

```text
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
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
```

### Security (Sprint B — verified)

* Sessions: HTTP-only cookie, `sameSite: lax`, secure in production
* Passwords: bcrypt cost 12, wrapped in db.transaction()
* Rate limiting: 10 login attempts / 15 min per IP; 3 reset requests / 1 hr per IP
* Email enumeration: constant-time compare on login; always-200 on reset/request
* Account deletion: requires password re-confirmation
* Cross-account isolation: verified live — a second account cannot switch into or read another family's child data (403 FORBIDDEN / 403 NO_CHILD_SELECTED)

### Known gaps

* Password reset: backend endpoints exist; no frontend UI yet
* Account deletion: backend endpoint exists; no frontend UI yet
* Permissions: ownership-based only; no fine-grained permission model yet

### Implementation Status — Sprint B: Identity

```text
Status: COMPLETE (local); pending production deploy
Date: 2026-09-12
What shipped:
  Backend: register/login/logout, bcrypt sessions, child CRUD,
  switch-child, progress routes scoped to session activeChildId,
  asyncHandler on all routes, process-level unhandledRejection safety net.
  Three bugs found and fixed during real-server testing (not caught by tsc):
    1. db/schema/index.ts missing auth export — tables never created
       on real deployments. Fixed + verified via drizzle-kit push.
    2. registerUser() non-transactional inserts left orphaned users rows
       on crash. Fixed: wrapped in db.transaction().
    3. Zero try/catch in auth routes — malformed request crashed entire
       Node process. Fixed: asyncHandler wrapper on every handler.
  Frontend: LoginScreen, ChildGate, useAuth hook, App.tsx restructured,
  Navbar switch-profile affordance, apiFetch credentials: "include".
  DB migration 0002_auth_sessions.sql applied to production Railway DB.
  Verified working: register → login → /me → create child → switch-child
  → record page → unlock badge → fetch progress, all end-to-end.
Tests: test/auth-integration.test.ts — black-box Vitest suite, 22/22
  passing. Covers auth, child CRUD, progress scoping, cross-account
  isolation, and the malformed-request crash scenario.
Deployment: local only — git push pending.
```

## 5. Child Reading Profile

```text
Identity: display name, age band, language, reading level
Reading: books, sessions, time, progress
Learning: vocabulary, recall, comprehension, inference indicators
Preferences: genres, topics, narration, interaction
Achievements: badges and milestones
```

These are learning indicators, not diagnoses.

## 6. Library Architecture

Normalize all sources into one StoryPals book model.

```text
Open Library ─┐
Standard Ebooks ├→ Ingestion → Validation/Rights/Safety → Normalized Book → Shelf
Public-domain ──┤
EPUB upload ───┤
PDF upload ────┘
```

### Implemented providers

| Provider | Status | Notes |
|---|---|---|
| `builtin` | [x] | Hard-coded classics |
| `openlibrary` | [x] | Metadata/discovery, 5-min cache |
| `standard-ebooks` | [x] | OPDS feed, 10-min cache |
| `public-domain` | [x] | Imported via CLI or HTTP endpoint |

## 6.1. Book Cover Rendering — Required Capability

Every book must always render a cover image. A broken image, blank tile,
or infinite loading state is a defect regardless of book source.

### Cover Sources (resolution order)

```text
1. Native/curated cover (publisher- or admin-supplied)
2. Standard Ebooks cover
3. Open Library cover (covers.openlibrary.org)
4. Embedded cover extracted during EPUB/PDF ingestion
5. AI-generated illustration used as a stand-in cover
6. Deterministically generated placeholder cover  ← must always succeed
```

> **Status:** Tier 6 implemented at both layers. Server-side
> `GET /api/covers/placeholder` wired into every book endpoint via
> `withGuaranteedCover()`. Client-side `SafeStoryImage` wraps every
> cover/illustration with `onError` → `StoryImagePlaceholder`. Admin
> cover override via `PATCH /api/books/:id/cover` implemented.
> Still open: tiers 1-5 caching into `BookAsset` object storage;
> durable fallback-rate monitoring.

## 6.2. Commercial Storefront Discovery — Optional Capability

Not yet implemented. Amazon (Creators API), Apple Books (iTunes Search),
and Kobo (Rakuten) are viable discovery-only providers. All return
`fullText: false` — they supply metadata and links back to storefronts,
never readable book content. See prior spec version for full feasibility
notes.

## 7. Personal EPUB/PDF Shelf — Required Capability (Sprint D)

Private family uploads of EPUB and PDF books. Critical: uploads must
never automatically become public. Planned for Sprint D.

## 8. EPUB Import Pipeline

```text
Upload → file validation → archive/security checks → EPUB validation
→ package metadata → manifest → spine → navigation → chapter extraction
→ HTML sanitization → text normalization → image extraction
→ accessibility metadata → rights classification → safety screening
→ reading-level analysis → StoryPals metadata → storage → shelf
```

Never execute arbitrary scripts from an uploaded EPUB.

## 9. PDF Import Pipeline

```text
Upload → validation/security checks → PDF parser
→ text extractable? YES → text extraction / NO → OCR (async)
→ page segmentation → heading/chapter detection → text normalization
→ image extraction → rights classification → safety screening
→ reading-level analysis → metadata → storage → shelf
```

## 10. Import Data Model

```text
Book — id, title, subtitle, author, description, language,
        coverAssetId, sourceType, sourceId, rightsStatus,
        visibility, processingStatus, readingLevel, timestamps

BookFile — id, bookId, originalFilename, mimeType, sizeBytes,
            storageKey, checksum, processingStatus

Chapter — id, bookId, ordinal, title, sourceReference, text/html, wordCount

BookAsset — id, bookId, type, storageKey, mimeType, altText, dimensions

ImportJob — id, userId, filename, format, status, progress, error, timestamps
```

Large books must not be stored as one giant JSON record.

## 11. Shelf Model

```text
ShelfItem — id, userId, childId, bookId, status,
             addedAt, lastOpenedAt, progress, favorite
```

Catalog books and private uploaded books must remain distinguishable.

## 12. Reader

Minimum: table of contents, chapter navigation, next/previous, resume
position, progress, font size, spacing/theme controls, read aloud,
pause/resume, text highlighting, bookmarks, optional notes, keyboard
navigation, screen-reader-friendly structure.

### Implemented reader capabilities

* [x] Page-by-page navigation
* [x] Progress persistence (DB-backed, session-scoped)
* [x] TTS narration (Gemini, three voice options)
* [x] Auto-illustrate per page (Gemini image generation)
* [x] Phonics word-tap (syllable breakdown + kid-friendly definition)
* [x] Font size / font family / theme settings
* [x] Syllable display toggle
* [x] Reading buddy chip prompts
* [ ] Bookmark / highlight persistence
* [ ] Chapter-level navigation
* [ ] Keyboard navigation
* [ ] Offline mode

## 13. Reading Sessions

```text
ReadingSession (implemented)
- id, childId, bookId, startedAt, endedAt
- pagesRead, durationSeconds, starsEarned, createdAt

DailyActivity (implemented)
- childId, activityDate, pages, minutes, stars, goalMet, xp
```

## 14. Dialogic Reading Engine — Sprint E

Reading Buddy becomes the user-facing layer of a dedicated engine.

```text
Book/context → child profile → question selection → question
→ child response → evaluation → scaffolding decision
→ expansion/encouragement → learning signal → next interaction
```

**Current state:** Reading Buddy chat is context-aware (book + page
injected into system prompt). CROWD/PEER structured question types,
evaluation, and adaptive scaffolding are not yet implemented.

## 15–22. CROWD / PEER / Scaffolding / Question Selection / Companion Modes / Warm-Up / Mid-Reading / Reflection

All planned for Sprint E. See original spec sections for full detail.
No implementation yet.

## 23. Voice

Target: child speech → speech recognition → Dialogic Reading Engine
→ LLM → safety/age validation → TTS → child.

**Current state:** TTS output only (Gemini). Speech input not yet
implemented.

## 24. Personalization

Planned for Sprint F. Reading sessions → interaction signals → child
profile → recommendations → adaptive questions.

## 25. Parent Dashboard

Minimum: child selector, current books, completed books, reading time,
recent sessions, learning indicators, suggested parent activity.

**Current state:** Read-only dashboard exists showing weekly reading
time, books in progress, books opened, and words explored. Child
selector and learning indicators not yet implemented.

## 26. Achievements

Reward reading behaviors: First Book, Five Sessions, Finished a Chapter,
New Genre, Asked a Great Question, Reading Streak.

**Current state:** Schema, badge-unlock API, and badge toast
notifications exist. Badge definitions seeded.

## 27. Rights & Content Status

```text
PUBLIC_DOMAIN → shared catalog after validation
LICENSED → follow license
USER_PRIVATE → family-only
UNKNOWN → do not publish
RESTRICTED → reject/block
```

## 28. Safety Architecture

Child input → validation → context restriction → model → output
validation → age-appropriate response → child.

**Current state:** Safety screener exists for book import. Chat system
prompt restricts Reading Buddy to reading/learning context. Input
sanitization on all AI endpoints.

## 29. Storage Architecture

Target:

```text
PostgreSQL
 ├── Users, UserPasswords, Sessions (✓)
 ├── Children, ChildSettings (✓)
 ├── Books, Chapters, ShelfItems
 ├── Progress, ReadingSessions, DailyActivity (✓)
 ├── Achievements, ChildAchievements (✓)
 ├── ImportJobs, AssetRecords
 └── Auth tables: rate_limit_attempts, password_reset_tokens (✓)
          ↓
     Object Storage (not yet wired)
       ├── covers
       ├── illustrations
       ├── uploaded files
       ├── extracted assets
       └── generated audio
```

## 30–31. Asynchronous Imports / AI Preprocessing

Not yet implemented. See original spec for full detail.

## 32. API Structure (current)

```text
/api/auth/*          ✓ (register, login, logout, me, switch-child, password-reset, account delete)
/api/children        ✓ (CRUD)
/api/books           ✓
/api/books/search    ✓
/api/books/:id       ✓
/api/covers/placeholder ✓
/api/progress        ✓ (session-scoped, auth-gated)
/api/achievements    ✓
/api/create-story    ✓
/api/generate-illustration ✓
/api/tts             ✓
/api/chat            ✓
/api/health          ✓
```

## 33. Error Handling

```json
{ "error": { "code": "BOOK_NOT_FOUND", "message": "..." } }
```

Never expose stack traces, keys, credentials, or internal filesystem
details.

## 34. Rate Limits

Login: 10/15min per IP. Password reset: 3/1hr per IP. AI generation:
15/min. AI chat: 15/min. TTS: 15/min. Image generation: 6/min. Global:
100/min. All implemented.

## 35. Upload Security

Not yet implemented. See original spec for full validation checklist.

## 36. Accessibility

Font size and font family configurable. Dyslexic font option exists.
Syllable toggle exists. Keyboard navigation and ARIA roles not yet
systematically implemented.

## 37. Production Sprint — Current

### Sprint A: Stabilize

* [x] Health endpoint
* [x] Database connectivity
* [x] Migration verification (0000 + 0001 + 0002 all applied)
* [x] Failure states (asyncHandler + process-level safety net)
* [ ] Railway audit
* [ ] Runtime logs review
* [ ] Full frontend smoke test on production URL
* [ ] Fix P0 issues
* [ ] Classify P1/P2

### Sprint B: Identity

* [x] Parent auth DB schema (user_passwords, sessions, rate limits, reset tokens)
* [x] Auth repository (register, login, session resolution, child switching, password reset, account deletion)
* [x] Auth middleware (loadSession, requireAuth, requireAdmin, cookie helpers)
* [x] Auth routes (/api/auth/*)
* [x] Child profile CRUD (/api/children)
* [x] DB migration 0002 applied to production
* [x] bcrypt + cookie-parser installed in package.json
* [x] server.ts wired (cookieParser + loadSession + route mounts)
* [x] Progress routes protected with requireAuth + requireChildContext
* [x] childId derived from req.session.activeChildId
* [x] Frontend login / register UI (LoginScreen)
* [x] Frontend child selector (ChildGate)
* [x] Integration test suite (22/22 passing)
* [x] Verified end-to-end locally (parent + 2 children registered, DB persisting)
* [ ] Password reset UI
* [ ] Account deletion UI
* [ ] Recovery email delivery (transactional mail provider)
* [ ] Push to Railway + production smoke test

### Sprint C: Durable Storage

* [~] Book/chapter schema — **already exists in DB since migration 0000** (`books`, `book_editions`, `book_pages`, `assets`, `book_page_assets`, `provider_registry`, `book_sources`); zero code reads or writes it yet
* [ ] PostgreSQL as source of truth for book content — schema present, wiring not started; providers still read JSON/in-memory only
* [ ] Shelf schema (`ShelfItem` table does not exist yet — genuinely not started)
* [ ] Import jobs table (`ImportJob` table does not exist yet — genuinely not started)
* [ ] Object storage bucket
* [ ] Image migration (illustrations currently in-memory/client-only)
* [ ] Uploaded files storage
* [ ] Backups
* [ ] Recovery test

**2026-09-12 status note:** Discovered while planning this sprint that the
Book/chapter/asset schema was designed and migrated on day one but never
connected to `server/books/*`. Revised plan: (1) add the two missing tables
(`shelf_items`, `import_jobs`), (2) build a DB-backed `BookProvider` that
reads/writes the existing tables, (3) migrate the builtin + public-domain
catalogs into Postgres as the first real durable-storage cutover, (4) only
then tackle object storage for images, which is genuinely greenfield.

### Sprint D: EPUB/PDF Shelf

* [ ] EPUB upload endpoint
* [ ] PDF upload endpoint
* [ ] Security validation (magic bytes, size, archive bomb check)
* [ ] EPUB extraction (spine, chapters, HTML sanitization)
* [ ] PDF text extraction + OCR fallback
* [ ] Chapter detection
* [ ] Metadata normalization
* [ ] Cover extraction
* [ ] Rights classification (USER_PRIVATE)
* [ ] Private shelf (never shared without explicit action)
* [ ] Processing status / progress indicator
* [ ] Reader integration
* [ ] Progress integration

### Sprint E: Dialogic Reading Engine

* [ ] CROWD question types (Completion, Recall, Open-ended, Wh-, Distancing)
* [ ] PEER interaction loop (Prompt → Evaluate → Expand → Repeat)
* [ ] Structured question selection
* [ ] Response evaluation
* [ ] Hint generation
* [ ] Rephrasing on failure
* [ ] Downward scaffolding (simpler → choices → yes/no → explain)
* [ ] Upward scaffolding (recall → inference → prediction → evidence)
* [ ] Interaction pacing
* [ ] Session memory (don't repeat question types)
* [ ] Post-reading reflection prompts
* [ ] Learning signal recording

### Sprint F: Personalization

* [ ] Reading profile aggregation
* [ ] Strengths and practice opportunities
* [ ] Interest tracking
* [ ] Reading history
* [ ] Book recommendations
* [ ] Adaptive question difficulty
* [ ] Adaptive reading level suggestions

### Sprint G: Parent Platform

* [~] Dashboard (exists; child selector and learning indicators missing)
* [ ] Child switcher in dashboard
* [ ] Progress reports
* [ ] Session summaries
* [ ] Reading recommendations for parents
* [ ] Suggested parent follow-up prompts
* [ ] Notification settings
* [ ] Privacy controls / data export

### Sprint H: Library Expansion

* [x] Open Library metadata/discovery
* [x] Standard Ebooks OPDS discovery
* [x] Public-domain import pipeline
* [ ] Standard Ebooks full text ingestion where license permits
* [ ] Additional verified public-domain sources
* [ ] Rights metadata enrichment
* [ ] Import moderation queue
* [ ] Duplicate detection
* [ ] Metadata normalization across providers

### Sprint I: Scale

* [ ] Monitoring (Railway metrics + error alerting)
* [ ] Analytics (reading engagement, AI cost tracking)
* [ ] Caching layer
* [ ] AI cost controls
* [ ] Background workers
* [ ] Queue infrastructure
* [ ] Automated backups
* [ ] Disaster recovery plan
* [ ] Load testing
* [ ] Security testing

## 38. Acceptance Criteria

### Infrastructure

* [ ] Railway stable
* [ ] PostgreSQL stable
* [ ] Backups verified
* [ ] Monitoring active
* [ ] No critical recurring errors

### Accounts

* [x] Parent authentication (complete end-to-end locally; production deploy pending)
* [x] Child profiles (CRUD complete)
* [x] Authorization enforced on all private routes
* [x] Child isolation verified (cross-account 403 confirmed via integration tests)

### Library

* [x] Catalog (built-in + Open Library + Standard Ebooks + public-domain)
* [ ] Private shelf (Sprint D)
* [ ] EPUB reader
* [ ] PDF reader
* [ ] Rights enforcement
* [~] Book covers always render (tier 6 + frontend onError done; caching open)

### Reading

* [x] Progress persistence (DB-backed, session-scoped)
* [ ] Resume position
* [x] TTS
* [~] Accessibility controls (font/theme in place; keyboard nav missing)

### AI

* [x] Reading Companion (Barnaby owl / Pip dragon)
* [ ] CROWD question types
* [ ] PEER interaction loop
* [ ] Response evaluation
* [ ] Adaptive scaffolding
* [ ] Adaptive difficulty
* [x] Safety (input sanitization, reading-context constraint)
* [x] Graceful AI failures (503 fallback when key missing)

### Parent

* [~] Dashboard (partial — time/books/words; no child selector)
* [ ] Progress summaries
* [ ] Privacy controls

### Security

* [ ] Upload security (Sprint D)
* [x] Authorization (session-based auth complete and verified)
* [x] Rate limits (all AI endpoints + login + reset + global)
* [x] Secrets protected (Helmet, no env vars in client bundle)
* [x] Logs sanitized (no stack traces in API responses)

## 38.1. Implementation Status — Sprint C: Durable Storage (started)

```text
Status: IN PROGRESS
Date: 2026-09-12
What shipped (schema + wiring, not yet migrated/verified in production):
  db/schema/shelf.ts — new `shelf_items` table (was missing entirely).
  db/schema/imports.ts — new `import_jobs` table (was missing entirely).
  server/books/providers/database.ts — first BookProvider backed by
    Postgres (`books`/`book_pages`/`book_sources`), registered additively
    in catalog.ts alongside the existing JSON/in-memory providers.
  scripts/migrate-catalog-to-db.ts — idempotent one-time script to copy
    the builtin catalog into the tables that have existed since migration
    0000 but were never written to.
Tests: none yet — not run, since this environment has no DATABASE_URL
  or node_modules. Needs real verification against the dev DB.
Known limitations:
  - updatePageImage() on the database provider is a documented no-op
    until object storage exists; illustrations still aren't durable.
  - Migration script only covers the builtin catalog — public-domain.json
    was empty at time of writing, so nothing else needed migrating yet.
  - builtinProvider/publicDomainProvider are NOT retired — database
    provider runs alongside them until migrated content is verified.
Next step:
  1. Run `npm run db:generate` then `npm run db:push` (or generate a
     numbered migration file) to create shelf_items/import_jobs.
  2. Run `npx tsx scripts/migrate-catalog-to-db.ts` against dev DB.
  3. Verify `/api/books?source=public-domain` serves migrated titles.
  4. Wire shelf_items into a real `/api/shelf` endpoint (currently no
     route uses it — table only, same gap the book tables just had).
  5. Retire builtinProvider once verified, then start object storage.
```

## 39. Implementation Status Convention

```text
Status:
Date:
Commit:
What changed:
Tests:
Known limitations:
Next step:
```

Use:
* `[ ]` NOT STARTED
* `[~]` IN PROGRESS
* `[x]` DONE
* `[!]` BLOCKED
* `[-]` DEFERRED

## 40. Strategic End State

```text
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
```

**Strategic moat:** the reading intelligence layer, not merely the book
catalogue.

> **Every appropriate book can become an interactive, adaptive reading experience.**
