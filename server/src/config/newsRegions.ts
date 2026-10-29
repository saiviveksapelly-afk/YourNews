export const NEWS_REGIONS = ['International'] as const;

export type NewsRegion = (typeof NEWS_REGIONS)[number];

export function isNewsRegion(value: string): value is NewsRegion {
  return NEWS_REGIONS.includes(value as NewsRegion);
}
