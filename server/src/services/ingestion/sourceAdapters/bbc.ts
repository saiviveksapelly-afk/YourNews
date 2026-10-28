import type { RssSourceConfig } from '../rssSource.js';

// BBC permits RSS feed display with attribution and a link to the original.
// These feed adapters deliberately do not open BBC article pages with Playwright.
export const bbcRssSources: RssSourceConfig[] = [
  {
    sourceId: 'bbc-politics',
    feedUrl: 'https://feeds.bbci.co.uk/news/politics/rss.xml',
    source: 'BBC News',
    category: 'Politics',
    region: 'International',
    includeSummary: true,
    includeImages: true,
  },
  {
    sourceId: 'bbc-sport',
    feedUrl: 'https://feeds.bbci.co.uk/sport/rss.xml',
    source: 'BBC Sport',
    category: 'Sports',
    region: 'International',
    includeSummary: true,
    includeImages: true,
  },
  {
    sourceId: 'bbc-entertainment',
    feedUrl: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml',
    source: 'BBC News',
    category: 'Entertainment',
    region: 'International',
    includeSummary: true,
    includeImages: true,
  },
  {
    sourceId: 'bbc-technology',
    feedUrl: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
    source: 'BBC News',
    category: 'Technology',
    region: 'International',
    includeSummary: true,
    includeImages: true,
  },
];
