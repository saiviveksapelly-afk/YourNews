import type { NewsCategory } from './newsCategories.ts';

export const CATEGORY_FALLBACK_IMAGES: Record<NewsCategory, string> = {
  Politics: '/potics.webp',
  Sports: '/sports.jpeg',
  Entertainment: '/entertainment.avif',
  Technology: '/tech.webp',
};
