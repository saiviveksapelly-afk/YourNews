const TRACKING_PARAMETERS = new Set([
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'ref',
]);

export function normalizeCanonicalUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';

  for (const key of [...url.searchParams.keys()]) {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey.startsWith('utm_') || TRACKING_PARAMETERS.has(normalizedKey)) {
      url.searchParams.delete(key);
    }
  }

  return url.href;
}
