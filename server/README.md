# News ingestion

## Data flow

RSS/API is used for efficient article discovery where available. Playwright is used for browser-based article enrichment and metadata/image extraction, with source-specific adapters for publishers whose pages permit browser access.

```text
RSS/API discovery -> normalize URL -> Playwright enrich when configured
                  -> cache permitted images locally -> MongoDB -> catalog API
```

The collector runs at server startup and every 20 minutes. After each cycle, the database keeps the 100 newest articles and removes older entries; the existing image cleanup then removes local images no longer referenced by stored articles. A single headless Chromium process is reused for the cycle; article pages are opened two at a time and closed after extraction. A page is visited only when its source adapter explicitly enables page enrichment. For NASA, new feed URLs are opened so Playwright can read missing metadata, an image, and the configured article text.

Feed/API images take precedence. For sources with an explicit `imageDownloadHosts` allowlist, the server downloads permitted images into `uploads/news/` and saves a local `/api/media/news/...` path in MongoDB. The downloader accepts HTTPS images only from those hosts, limits each file to 1.5 MB, and stores at most 300 news images. Files without a remaining article reference are removed after an ingestion cycle. Express serves the image folder as static media.

When an article page is permitted, Playwright checks Open Graph, Twitter metadata, JSON-LD, then source-configured article image selectors. The resulting image URL goes through the same host-checked downloader. If it cannot be cached, the article keeps its feed image URL if one is available; the frontend then uses the category fallback only if that image also fails. Multer handles files uploaded by a browser; these images are fetched by the server during ingestion, so Multer is not part of this flow.

## Source adapters

Source configuration is in `src/services/ingestion/sourceAdapters/`:

- `techCrunch.ts` uses its RSS feed and does not visit article pages.
- `nasa.ts` uses NASA's technology RSS feed and only enriches URLs on `nasa.gov` subdomains. Its image rule requires a NASA-hosted image and a visible figure credit.
- `indianExpress.ts` reads the publisher's category feeds but does not open article pages or cache their images locally.
- `hackerNewsSource.ts` uses the official Hacker News API. It does not open story URLs because those may belong to unrelated publishers.

The catalog links cards to an authenticated `/api/articles/:id` detail page. That page displays stored, source-permitted text and metadata and always links to the original publisher. A source that provides only a headline or excerpt is shown with that excerpt; its full article remains on the publisher's website.

Add a source adapter only after checking its current feed/API terms, page access rules, attribution requirements, and robots.txt. Set `pageEnrichment` only if article-page browser access is allowed; set `imageDownloadHosts` only for image hosts whose use the source permits. Each source also needs its correct category and region.

Canonical URLs have fragments and common tracking query parameters removed before the unique MongoDB index is used. Existing database records are not revisited by Playwright. Mongoose timestamps already provide `createdAt` and `updatedAt`.

Source policy references: [NASA media guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/) and [NASA RSS feeds](https://www.nasa.gov/rss-feeds/). Playwright browser navigation follows its [page navigation guidance](https://playwright.dev/docs/navigations).

## Local setup

Install dependencies and Chromium:

```sh
npm install
npm run install:browser
npm run typecheck
```

## Cloud deployment

The server host must support headless Chromium. Install the matching browser and Linux system dependencies during the image/build stage, for example with `npx playwright install --with-deps chromium` on a Debian/Ubuntu image. Do not download browsers for every server start. Configure the host's persistent build cache or deployment image to include the Playwright browser binaries. Some serverless providers impose execution or process limits that do not fit a long-running 20-minute in-process scheduler; on those providers, run ingestion as a separate scheduled worker. The API itself remains available if Chromium fails to launch; feed/API metadata collection continues without page enrichment.
