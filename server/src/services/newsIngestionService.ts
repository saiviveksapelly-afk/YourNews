import { collectHackerNewsArticles } from './ingestion/hackerNewsSource.js';
import { collectRssSource, type RssSourceConfig } from './ingestion/rssSource.js';
import { launchNewsBrowser } from './ingestion/articlePageEnrichment.js';
import { nasaRssSource } from './ingestion/sourceAdapters/nasa.js';
import { techCrunchRssSource } from './ingestion/sourceAdapters/techCrunch.js';
import { bbcRssSources } from './ingestion/sourceAdapters/bbc.js';
import { removeUnreferencedNewsImages } from './ingestion/newsImageStorage.js';
import Article from '../models/Article.js';

const INGESTION_INTERVAL_MS = 20 * 60 * 1000;
const MAX_STORED_ARTICLES = 100;
let collectionIsRunning = false;
const rssSources: RssSourceConfig[] = [
  techCrunchRssSource,
  nasaRssSource,
  ...bbcRssSources,
] as const;

async function runCollection(): Promise<void> {
  if (collectionIsRunning) return;

  collectionIsRunning = true;
  let browserSession: Awaited<ReturnType<typeof launchNewsBrowser>> | undefined;
  const seenUrls = new Set<string>();

  try {
    if (rssSources.some((source) => source.pageEnrichment)) {
      try {
        browserSession = await launchNewsBrowser();
        console.info('[NEWS] Playwright browser launched for article enrichment.');
      } catch (error) {
        console.error('[NEWS] Playwright could not launch; continuing with feed/API metadata:', error);
      }
    }

    console.info('[NEWS] Ingestion started.');
    const removedNationalArticles = await Article.deleteMany({ region: 'National' });
    if (removedNationalArticles.deletedCount > 0) {
      console.info(`[NEWS] Removed ${removedNationalArticles.deletedCount} National articles.`);
    }
    const collectionTasks = [
      ...rssSources.map((source) => ({
        source: `${source.source} (${source.region} ${source.category})`,
        collect: () => collectRssSource(source, browserSession?.context, seenUrls),
      })),
      { source: 'Hacker News', collect: () => collectHackerNewsArticles(seenUrls) },
    ];
    const results = await Promise.allSettled(collectionTasks.map(async (task) => {
      try {
        await task.collect();
      } catch (error) {
        console.error(`[NEWS] ${task.source} collection failed:`, error);
        throw error;
      }
    }));

    const failedSourceCount = results.filter((result) => result.status === 'rejected').length;
    console.info(`[NEWS] Ingestion totals: ${results.length} collectors processed, ${failedSourceCount} failed.`);
    const articlesToRemove = await Article.find()
      .sort({ publishedAt: -1, _id: -1 })
      .skip(MAX_STORED_ARTICLES)
      .select('_id')
      .lean();
    if (articlesToRemove.length > 0) {
      await Article.deleteMany({ _id: { $in: articlesToRemove.map(({ _id }) => _id) } });
      console.info(`[NEWS] Removed ${articlesToRemove.length} older stories to keep the catalog at ${MAX_STORED_ARTICLES} articles.`);
    }
    await removeUnreferencedNewsImages();
  } catch (error) {
    console.error('News collection failed:', error);
  } finally {
    await browserSession?.browser.close().catch((error: unknown) => {
      console.error('[NEWS] Could not close Playwright browser cleanly:', error);
    });
    console.info('[NEWS] Ingestion completed.');
    collectionIsRunning = false;
  }
}

export function startNewsIngestion(): void {
  void runCollection();
  setInterval(() => void runCollection(), INGESTION_INTERVAL_MS);
}
