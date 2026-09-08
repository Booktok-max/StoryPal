# Phase 1 Testing

## Install

From the project root:

```bash
npm install
```

## Run

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## API smoke tests

With the server running:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/providers
curl http://localhost:3000/api/books
curl "http://localhost:3000/api/books/search?q=tortoise"
curl http://localhost:3000/api/books/tortoise-and-hare
```

## Expected Phase 1 behavior

- The bookshelf still displays the existing StoryPals books.
- The frontend loads the built-in catalog from `/api/books`.
- AI-created custom books still load from localStorage for backward compatibility.
- `/api/providers` reports the built-in provider.
- Search works against the current built-in catalog.

## Important

The development environment used to prepare this scaffold did not have npm dependencies installed and could not complete `npm install` because external package downloads timed out. The source changes were therefore not runtime-built in this environment. Run `npm install`, then `npm run lint` and `npm run build` locally before deploying.
