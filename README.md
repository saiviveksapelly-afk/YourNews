# YourNews

A full-stack MERN news aggregator (MongoDB, Express, React, Node.js, written in TypeScript) that collects headlines from several publishers, merges duplicate stories, and ranks the ones covered by the most sources. Users register, log in, and browse a Top 10 carousel, filter by category and date, and search headlines. Every story links back to the original publisher.

**Live demo:** https://your-news-tan.vercel.app

## Features

- **Multi-source ingestion:** BBC (Politics, Sport, Entertainment & Arts, Technology), TechCrunch, NASA Technology, and Hacker News
- **Story merging:** headlines are normalized and grouped so the same story from different sources shows once, ranked by how many sources cover it
- **Top 10 and Latest views:** a hero carousel of top stories plus a filterable article grid
- **Filters and search:** category (Politics, Sports, Entertainment, Technology), date range, and headline search with prefix matches ranked first
- **Authentication:** register/login with bcrypt-hashed passwords and JWT sessions (1 hour); catalog and article routes are protected
- **Article detail page:** stored text and metadata, image credit, and a link to the original source
- **Automated collection:** runs on server startup and every 20 minutes, keeping the catalog capped at 100 articles, with expired articles auto-removed via a MongoDB TTL index (default 28 days)
- **Playwright enrichment:** headless Chromium reads Open Graph, Twitter, and JSON-LD metadata for sources that permit it (NASA); permitted images are cached locally
- **Light/dark theme** on the catalog and auth pages
- **Source-aware design:** each source is a configurable adapter, with page access and image hosting limited to what the publisher allows

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, React Router, Vite |
| Backend | Node.js, Express 5, TypeScript |
| Database | MongoDB with Mongoose |
| Auth | JWT, bcrypt |
| Scraping | Playwright (Chromium), RSS feeds, Hacker News API |
| Deployment | Vercel (client), Docker (server) |

## How It Works

```text
RSS / API discovery -> normalize URL -> Playwright enrichment (where allowed)
  -> cache permitted images -> MongoDB -> REST API -> React client
```

## Project Structure

```text
YourNews/
├── client/                 # React + Vite frontend
│   └── src/
│       ├── pages/          # Login, Register, Catalog, Article
│       ├── components/     # ProtectedRoute, NewsImage, ToastMessage
│       └── auth/           # Token and theme helpers
└── server/                 # Express + TypeScript API
    └── src/
        ├── controllers/    # auth, articles
        ├── models/         # User, Article
        ├── routes/
        ├── middleware/     # requireAuth (JWT)
        └── services/
            ├── newsIngestionService.ts
            └── ingestion/  # RSS, Hacker News, Playwright, source adapters
```

## Getting Started

### Prerequisites

- Node.js 20+
- A MongoDB database (local or Atlas)

### 1. Clone

```bash
git clone https://github.com/saiviveksapelly-afk/YourNews.git
cd YourNews
```

### 2. Server

```bash
cd server
npm install
npm run install:browser   # installs Chromium for Playwright
cp .env.example .env      # then fill in the values
```

`.env`:

```env
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=a-long-random-secret
NEWS_RETENTION_DAYS=28
```

Build and start (the server listens on port 3000 by default):

```bash
npm run build
npm start
```

### 3. Client

```bash
cd client
npm install
npm run dev
```

The client calls `/api/...`. In production, `client/vercel.json` rewrites these to the backend URL; update the destination there to point at your own deployed server. In local development, Vite already proxies `/api` to `http://localhost:3000`, so start the server first.

## API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Create an account |
| POST | `/api/auth/login` | No | Log in and receive a JWT |
| GET | `/api/auth/check` | Yes | Verify the current session |
| GET | `/api/articles` | Yes | List articles; query: `region`, `view` (`latest` or `top10`), `category`, `from`, `to`, `search` |
| GET | `/api/articles/:id` | Yes | Get one article |

## Deployment

- **Client:** deploy `client/` to Vercel.
- **Server:** the included `Dockerfile` installs Chromium and its system dependencies. The host must support headless Chromium and a long-running process, since ingestion runs in-process every 20 minutes.

## Notes on Sources

Each source adapter lives in `server/src/services/ingestion/sourceAdapters/`. Add a new source only after checking its feed terms, robots.txt, and attribution requirements. See `server/README.md` for the full ingestion design.

## Future Improvements

- Personalized feeds based on reading history
- Saved/bookmarked articles
- More regions and sources
- Automated tests and CI

## Author
#Sapelly Sai Vivek

**Sai Vivek Sapelly**
GitHub: [@saiviveksapelly-afk](https://github.com/saiviveksapelly-afk)
