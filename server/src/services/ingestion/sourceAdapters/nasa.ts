import type { RssSourceConfig } from '../rssSource.js';

export const nasaRssSource: RssSourceConfig = {
  sourceId: 'nasa',
  feedUrl: 'https://www.nasa.gov/technology/feed/',
  source: 'NASA',
  category: 'Technology',
  region: 'International',
  includeSummary: true,
  includeImages: true,
  imageDownloadHosts: ['nasa.gov'],
  requireNasaImageCredit: true,
  pageEnrichment: {
    allowedHosts: ['nasa.gov'],
    imageSelectors: ['main article figure img', 'main article img', 'main img'],
    imageCreditSelectors: ['main article figure figcaption', 'main article p'],
    contentSelectors: ['main article'],
    maxContentCharacters: 20_000,
    requireSourceHostedImage: true,
    requireImageCredit: true,
  },
};
