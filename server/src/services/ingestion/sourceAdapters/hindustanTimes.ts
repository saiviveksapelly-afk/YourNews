import type { RssSourceConfig } from '../rssSource.js';

const politicsStoryPattern = /\b(?:politic\w*|election\w*|electoral|parliament|lok sabha|rajya sabha|assembly poll\w*|polls?|voters?|bjp|congress|aap|dmk|chief minister|prime minister|minister\w*|government|cabinet|policy|opposition|political party|mla|mps?|legislator\w*|governor|ordinance|campaign\w*|coalition|constituenc\w*)\b/i;

function isPoliticsStory(title: string, summary?: string): boolean {
  return politicsStoryPattern.test(`${title} ${summary ?? ''}`);
}

export const hindustanTimesPoliticsSource: RssSourceConfig = {
  sourceId: 'hindustan-times-politics',
  feedUrl: 'https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml',
  source: 'Hindustan Times',
  category: 'Politics',
  region: 'National',
  includeSummary: true,
  includeImages: true,
  includeItem: isPoliticsStory,
  imageDownloadHosts: ['hindustantimes.com'],
};
