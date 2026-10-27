import type { RssSourceConfig } from '../rssSource.js';

// These sources are used by the user's private local portfolio project.
// Playwright only reads public article metadata and thumbnail images; it does
// not attempt to bypass access controls or collect full article text.
const feedBase = 'https://indianexpress.com/section';
const articlePageSettings = {
  imageDownloadHosts: ['indianexpress.com'],
  pageEnrichment: {
    allowedHosts: ['indianexpress.com'],
    imageSelectors: ['article figure img', 'main article img', 'article img'],
    requireSourceHostedImage: true,
  },
};

export const indianExpressRssSources: RssSourceConfig[] = [
  {
    sourceId: 'indian-express-sports',
    feedUrl: `${feedBase}/sports/feed/`,
    source: 'The Indian Express',
    category: 'Sports',
    region: 'National',
    includeSummary: true,
    includeImages: true,
    ...articlePageSettings,
  },
  {
    sourceId: 'indian-express-entertainment',
    feedUrl: `${feedBase}/entertainment/feed/`,
    source: 'The Indian Express',
    category: 'Entertainment',
    region: 'National',
    includeSummary: true,
    includeImages: true,
    ...articlePageSettings,
  },
  {
    sourceId: 'indian-express-technology',
    feedUrl: `${feedBase}/technology/feed/`,
    source: 'The Indian Express',
    category: 'Technology',
    region: 'National',
    includeSummary: true,
    includeImages: true,
    ...articlePageSettings,
  },
];
