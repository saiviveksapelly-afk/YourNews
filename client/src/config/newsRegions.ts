export const NEWS_REGIONS = ['National', 'International'] as const;

export type NewsRegion = (typeof NEWS_REGIONS)[number];
