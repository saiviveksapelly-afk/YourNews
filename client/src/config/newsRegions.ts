export const NEWS_REGIONS = ['International'] as const;

export type NewsRegion = (typeof NEWS_REGIONS)[number];
