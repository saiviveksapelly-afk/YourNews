const DEFAULT_RETENTION_DAYS = 28;

export function getNewsRetentionDays(): number {
  const configuredDays = process.env.NEWS_RETENTION_DAYS;
  const retentionDays = configuredDays
    ? Number(configuredDays)
    : DEFAULT_RETENTION_DAYS;

  if (!Number.isInteger(retentionDays) || retentionDays < 1) {
    throw new Error('NEWS_RETENTION_DAYS must be a positive whole number.');
  }

  return retentionDays;
}

export function getArticleExpiryDate(publishedAt: Date): Date {
  const expiryDate = new Date(publishedAt);
  expiryDate.setDate(expiryDate.getDate() + getNewsRetentionDays());
  return expiryDate;
}
