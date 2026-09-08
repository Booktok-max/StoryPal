# Phase 3 testing

## 1. Install and run

```bash
npm install
npm run lint
npm run build
npm run dev
```

## 2. Check providers

Open:

`http://localhost:3000/api/providers`

You should see:

- builtin
- public-domain
- openlibrary

## 3. Import a verified UTF-8 text file

The easiest test is the CLI. Use only text for which you have verified redistribution rights.

```bash
npx tsx scripts/import-public-domain.ts ./my-book.txt "My Verified Book" "Author Name" "CC0 1.0"
```

The CLI writes the normalized book to:

`data/public-domain-books.json`

It reports the generated ID, number of pages, reading level, and safety status.

## 4. View the imported book through the API

```text
http://localhost:3000/api/books?source=public-domain
```

Only books whose safety status is `approved` are exposed by the provider.

## 5. Test the protected HTTP importer

Set in `.env`:

```text
BOOK_IMPORT_ENABLED=true
BOOK_IMPORT_ADMIN_KEY=your-local-test-key
```

Then POST JSON to `/api/books/import` with the header:

`x-storypals-admin-key: your-local-test-key`

Example body:

```json
{
  "title": "My Verified Book",
  "author": "Author Name",
  "text": "Your verified text goes here.",
  "license": "CC0 1.0",
  "publicDomain": true,
  "attributionRequired": false,
  "language": "en"
}
```

Do not enable this endpoint on a public deployment until it is connected to StoryPals' authenticated parent/admin authorization system.

## 6. Expected behavior

- Invalid/missing license: rejected.
- `publicDomain: false`: rejected.
- Blocked safety signal: imported record is marked `rejected`.
- Review signal: imported record is marked `pending-review` and is not child-visible.
- Clean content: imported record becomes `approved` and is available through the public-domain provider.
