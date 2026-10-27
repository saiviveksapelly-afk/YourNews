export const NEWS_CATEGORIES = [
  'Politics',
  'Sports',
  'Entertainment',
  'Technology',
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];
