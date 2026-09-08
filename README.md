# StoryPals — Children's AI-Enhanced Reading App

A read-aloud storybook platform for young readers (ages 4–9), featuring:
- 🎨 AI-generated illustrations (Gemini 3 Pro Image)
- 🔊 Voice narration with TTS (Gemini 3.1 Flash TTS)
- 🦉 Reading buddy chatbot (Barnaby the Owl / Pip the Dragon)
- ✨ Interactive phonics word explorer
- 📚 Book catalog with Open Library discovery
- 🏆 Gamified reading progress (stars, XP, badges, streaks)
- 📱 Offline-first design for tablet use
- 🛡️ Content safety screening for child-facing catalog

## Quick Start

**Prerequisites:** Node.js 22+

```bash
# 1. Install dependencies
npm install

# 2. Set your Gemini API key
cp .env.example .env.local
# Edit .env.local and set GEMINI_API_KEY

# 3. Run development server
npm run dev
```

Open <http://localhost:3000>

## Production Deployment

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for AI features |
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | No | Server port (default: 3000) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |
| `OPEN_LIBRARY_USER_AGENT` | Recommended | User-Agent for Open Library API |
| `BOOK_IMPORT_ENABLED` | No | Set to `true` to enable book import |
| `BOOK_IMPORT_ADMIN_KEY` | If import enabled | Admin key for import endpoint |

### Docker

```bash
docker compose up -d
```

### Manual

```bash
npm ci --omit=dev
npm run build
NODE_ENV=production GEMINI_API_KEY=your-key npm start
```

## Architecture

```
storypals/
├── server.ts            # Express server + API routes
├── server/books/        # Book catalog, providers, import pipeline
│   ├── catalog.ts       # Provider registration
│   ├── repository.ts    # Unified search + dedup
│   ├── importer.ts      # Controlled text ingestion
│   ├── normalization/   # Safety, reading level, page splitting
│   └── providers/       # builtin, publicDomain, openlibrary
├── src/                 # React frontend
│   ├── App.tsx          # Main app shell
│   ├── components/      # StoryReader, BookShelf, ReadingBuddyChat, etc.
│   ├── hooks/           # useOnlineStatus
│   ├── utils/           # audioPlayer, phonics, readingHabits
│   └── types.ts         # TypeScript types
├── data/                # Public-domain book catalog (JSON)
├── public/              # Static assets
├── test/                # Vitest test suite
├── Dockerfile           # Multi-stage production container
└── docker-compose.yml   # Local prod testing
```

## Security

- **Helmet** — security headers (CSP, HSTS, etc.) in production
- **CORS** — configurable origin whitelist
- **Rate limiting** — 100 req/min global, 15 req/min AI endpoints, 6 req/min image generation
- **Input sanitization** — HTML stripping, length caps, message count limits on all AI endpoints
- **Content safety** — hard blocks, context-window soft flags, and human-review queue for imported books
- **Graceful shutdown** — SIGTERM/SIGINT handlers with connection drain

## Testing

```bash
npm test          # Run once
npm run test:watch  # Watch mode
```

## Scripts

- `npm run dev` — development server with Vite HMR
- `npm run build` — production build (Vite + esbuild)
- `npm start` — serve production build
- `npm run lint` — TypeScript type checking
- `npm test` — Vitest test suite

## License

Private — see source headers for individual component licenses.
