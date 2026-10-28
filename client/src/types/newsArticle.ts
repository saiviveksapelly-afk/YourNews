import type { NewsCategory } from '../config/newsCategories.ts';
import type { NewsRegion } from '../config/newsRegions.ts';

export interface NewsArticle {
  _id: string;
  title: string;
  summary?: string;
  content?: string;
  source: string;
  sourceId?: string;
  sourceName?: string;
  canonicalUrl?: string;
  imageUrl?: string;
  imageCredit?: string;
  category: NewsCategory;
  region: NewsRegion;
  author?: string;
  publishedAt: string;
  sourceRank?: number;
  sourceViewCount?: number;
  popularitySource?: string;
  coverageCount?: number;
  coverageSources?: string[];
}
