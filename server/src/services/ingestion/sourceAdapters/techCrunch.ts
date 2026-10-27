import type { RssSourceConfig } from '../rssSource.js';

// TechCrunch is deliberately feed-only here. RSS terms support attributed feed
// use; this adapter does not open publisher article pages with Playwright.
export const techCrunchRssSource: RssSourceConfig = {
  sourceId: 'techcrunch',
  feedUrl: 'https://techcrunch.com/feed/',
  source: 'TechCrunch',
  category: 'Technology',
  region: 'International',
  includeSummary: false,
  includeImages: true,
  imageDownloadHosts: ['techcrunch.com'],
};
