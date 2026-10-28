import { collectHackerNewsArticles } from './ingestion/hackerNewsSource.js';
import { collectRssSource, type RssSourceConfig } from './ingestion/rssSource.js';
import { launchNewsBrowser } from './ingestion/articlePageEnrichment.js';
import { nasaRssSource } from './ingestion/sourceAdapters/nasa.js';
import { techCrunchRssSource } from './ingestion/sourceAdapters/techCrunch.js';
import { indianExpressRssSources } from './ingestion/sourceAdapters/indianExpress.js';
import { hindustanTimesPoliticsSource } from './ingestion/sourceAdapters/hindustanTimes.js';
import { bbcRssSources } from './ingestion/sourceAdapters/bbc.js';
import { removeUnreferencedNewsImages } from './ingestion/newsImageStorage.js';

const INGESTION_INTERVAL_MS = 20 * 60 * 1000;
let collectionIsRunning = false;
const rssSources: RssSourceConfig[] = [
  techCrunchRssSource,
  nasaRssSource,
  hindustanTimesPoliticsSource,
  ...bbcRssSources,
  ...indianExpressRssSources,
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
    const collectionTasks = [
      ...rssSources.map((source) => ({
        source: source.source,
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
