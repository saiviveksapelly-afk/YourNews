export const NEWS_CATEGORIES = [
  'Politics',
  'Sports',
  'Entertainment',
  'Technology',
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export function isNewsCategory(value: string): value is NewsCategory {
  return NEWS_CATEGORIES.includes(value as NewsCategory);
}
