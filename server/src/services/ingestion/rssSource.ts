import Article, { type ArticleDocument } from '../../models/Article.js';
import { getArticleExpiryDate } from '../../config/newsRetention.js';
import type { BrowserContext } from 'playwright';
import { enrichArticlePage, type ArticlePageSourceConfig } from './articlePageEnrichment.js';
import { normalizeCanonicalUrl } from './normalizeCanonicalUrl.js';
import { hasStoredNewsImage, storeNewsImage } from './newsImageStorage.js';

export interface RssSourceConfig {
  sourceId: string;
  feedUrl: string;
  source: string;
  category: ArticleDocument['category'];
  region: ArticleDocument['region'];
  includeSummary?: boolean;
  includeImages?: boolean;
  includeItem?: (title: string, summary?: string) => boolean;
  imageDownloadHosts?: string[];
  requireNasaImageCredit?: boolean;
  pageEnrichment?: Omit<ArticlePageSourceConfig, 'source'>;
}

interface FeedArticle extends ArticleDocument {
  canonicalUrl: string;
}

const LOCAL_NEWS_IMAGE_PREFIX = '/api/media/news/';

function decodeXml(value: string): string {
  const withoutCdata = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

  return withoutCdata.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code: string) => {
    if (code[0] === '#') {
      const isHexadecimal = code[1]?.toLowerCase() === 'x';
      const number = Number.parseInt(code.slice(isHexadecimal ? 2 : 1), isHexadecimal ? 16 : 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : entity;
    }

    const namedEntities: Record<string, string> = {
      amp: '&',
      lt: '<',
      gt: '>',
      quot: '"',
      apos: "'",
      nbsp: ' ',
    };
    return namedEntities[code.toLowerCase()] ?? entity;
  });
}

function readTag(xml: string, tagName: string): string | undefined {
  const escapedTagName = tagName.replace(':', '\\:');
  const match = xml.match(
    new RegExp(`<${escapedTagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapedTagName}>`, 'i'),
  );

  return match?.[1] ? decodeXml(match[1]).trim() : undefined;
}

function toPlainText(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const text = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text || undefined;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isLikelyImageUrl(value: string): boolean {
  try {
    return /\.(?:avif|gif|jpe?g|png|webp)$/i.test(new URL(value).pathname);
  } catch {
    return false;
  }
}

function getLargestSrcSetUrl(srcSet: string | undefined): string | undefined {
  if (!srcSet) return undefined;

  return srcSet
    .split(',')
    .map((candidate) => {
      const [url, descriptor] = candidate.trim().split(/\s+/);
      const width = descriptor?.match(/^(\d+(?:\.\d+)?)w$/i)?.[1];
      const density = descriptor?.match(/^(\d+(?:\.\d+)?)x$/i)?.[1];
      const resolution = width ? Number(width) : density ? Number(density) * 10_000 : 1;
      return { url, resolution };
    })
    .filter((candidate): candidate is { url: string; resolution: number } => Boolean(candidate.url))
    .sort((first, second) => second.resolution - first.resolution)[0]?.url;
}

function getMediaImageWidth(tag: string): number {
  const width = tag.match(/\bwidth=(['"])(\d+)\1/i)?.[2];
  return width ? Number(width) : 0;
}

function readImageDetails(
  item: string,
  sourceConfig: RssSourceConfig,
): { imageUrl: string; imageCredit?: string } | undefined {
  if (!sourceConfig.includeImages) return undefined;

  const mediaTags = item.match(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*>/gi) ?? [];
  const mediaImageTags = mediaTags.filter((tag) => {
    if (/<media:thumbnail\b/i.test(tag)) return true;
    const url = tag.match(/\burl=(['"])(.*?)\1/i)?.[2] ?? '';
    return /\bmedium=(['"])image\1/i.test(tag)
      || /\btype=(['"])image\/[a-z0-9.+-]+\1/i.test(tag)
      || (url && isLikelyImageUrl(url));
  });
  const mediaImageTag = mediaImageTags
    .filter((tag) => !/<media:thumbnail\b/i.test(tag))
    .sort((first, second) => getMediaImageWidth(second) - getMediaImageWidth(first))[0];
  const mediaImage = mediaImageTag?.match(/\burl=(['"])(.*?)\1/i);
  const thumbnailImage = mediaImageTags
    .find((tag) => /<media:thumbnail\b/i.test(tag))
    ?.match(/\burl=(['"])(.*?)\1/i);
  const htmlContent = [
    readTag(item, 'content:encoded'),
    readTag(item, 'description'),
    item,
  ].filter(Boolean).join(' ');
  const imageAttributes = htmlContent.match(/<img\b[^>]*>/gi) ?? [];
  const htmlImageUrl = imageAttributes.map((imageTag) => {
    const srcSetUrl = getLargestSrcSetUrl(imageTag.match(/\bsrcset=(['"])(.*?)\1/i)?.[2]);
    if (srcSetUrl) return srcSetUrl;

    const imageAttribute = imageTag.match(/\b(?:src|data-src|data-lazy-src|data-original)=(['"])(.*?)\1/i);
    return imageAttribute?.[2];
  }).find((url) => url && isHttpUrl(decodeXml(url)));
  const imageUrl = decodeXml(mediaImage?.[2] ?? htmlImageUrl ?? thumbnailImage?.[2] ?? '').trim();
  if (!imageUrl || !isHttpUrl(imageUrl)) return undefined;

  const imageCredit = toPlainText(readTag(item, 'media:credit'));

  if (sourceConfig.requireNasaImageCredit) {
    const imageHost = new URL(imageUrl).hostname;
    if (
      (imageHost !== 'nasa.gov' && !imageHost.endsWith('.nasa.gov')) ||
      !imageCredit ||
      /copyright|©/i.test(readTag(item, 'copyright') ?? readTag(item, 'dc:rights') ?? '')
    ) {
      return undefined;
    }
  }

  return {
    imageUrl,
    ...(imageCredit ? { imageCredit } : {}),
  };
}

function parseFeed(xml: string, sourceConfig: RssSourceConfig): FeedArticle[] {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const scrapedAt = new Date();

  return items.flatMap((item): FeedArticle[] => {
    const title = readTag(item, 'title');
    const rawCanonicalUrl = readTag(item, 'link');
    const canonicalUrl = rawCanonicalUrl && isHttpUrl(rawCanonicalUrl)
      ? normalizeCanonicalUrl(rawCanonicalUrl)
      : undefined;
    const publishedValue = readTag(item, 'pubDate') ?? readTag(item, 'dc:date');
    const publishedAt = publishedValue ? new Date(publishedValue) : null;

    if (
      !title ||
      title.length > 300 ||
      !canonicalUrl ||
      !isHttpUrl(canonicalUrl) ||
      !publishedAt ||
      Number.isNaN(publishedAt.getTime())
    ) {
      return [];
    }

    const description = sourceConfig.includeSummary
      ? toPlainText(readTag(item, 'description') ?? readTag(item, 'content:encoded'))
      : undefined;
    const summary = description && description.length <= 2000 ? description : undefined;
    if (sourceConfig.includeItem && !sourceConfig.includeItem(title, summary)) return [];
    const imageDetails = readImageDetails(item, sourceConfig);

    return [{
      title,
      normalizedTitle: title.trim().toLowerCase(),
      ...(summary ? { summary } : {}),
      source: sourceConfig.source,
      canonicalUrl,
      ...(imageDetails ?? {}),
      category: sourceConfig.category,
      region: sourceConfig.region,
      publishedAt,
      scrapedAt,
      expiresAt: getArticleExpiryDate(publishedAt),
    }];
  });
}

export async function collectRssSource(
  sourceConfig: RssSourceConfig,
  browserContext?: BrowserContext,
  seenUrls = new Set<string>(),
): Promise<void> {
  const response = await fetch(sourceConfig.feedUrl, {
    headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
  });

  if (!response.ok) {
    throw new Error(`${sourceConfig.source} RSS returned HTTP ${response.status}.`);
  }

  const feedXml = await response.text();
  const articles = parseFeed(feedXml, sourceConfig);
  const uniqueArticlesByUrl = new Map<string, FeedArticle>();

  for (const article of articles) {
    if (!uniqueArticlesByUrl.has(article.canonicalUrl)) {
      uniqueArticlesByUrl.set(article.canonicalUrl, article);
    }
  }

  const discoveredArticles = [...uniqueArticlesByUrl.values()];
  if (discoveredArticles.length === 0) {
    console.info(`${sourceConfig.source} RSS collection finished: no valid articles found.`);
    return;
  }

  const newArticles: FeedArticle[] = [];
  const existingArticlesNeedingEnrichment: FeedArticle[] = [];
  const pageConfig = sourceConfig.pageEnrichment;
  let existingImagesRefreshed = 0;
  for (const article of discoveredArticles) {
    seenUrls.add(article.canonicalUrl);
    const existingArticle = await Article.findOne({ canonicalUrl: article.canonicalUrl })
      .select('imageUrl content')
      .lean();
    if (!existingArticle) {
      newArticles.push(article);
      continue;
    }

    const existingImageIsLocal = existingArticle.imageUrl?.startsWith(LOCAL_NEWS_IMAGE_PREFIX);
    const existingLocalImageIsAvailable = existingImageIsLocal
      ? await hasStoredNewsImage(existingArticle.imageUrl ?? '')
      : false;
    let imageWasRecovered = false;
    if (article.imageUrl && (!existingImageIsLocal || !existingLocalImageIsAvailable)) {
      const imageUrl = sourceConfig.imageDownloadHosts
        ? await storeNewsImage(article.imageUrl, sourceConfig.imageDownloadHosts) ?? article.imageUrl
        : article.imageUrl;
      imageWasRecovered = imageUrl.startsWith(LOCAL_NEWS_IMAGE_PREFIX);
      await Article.updateOne(
        { canonicalUrl: article.canonicalUrl },
        {
          $set: {
            imageUrl,
            source: sourceConfig.source,
            sourceId: sourceConfig.sourceId,
            sourceName: sourceConfig.source,
            category: sourceConfig.category,
            region: sourceConfig.region,
            ...(article.imageCredit ? { imageCredit: article.imageCredit } : {}),
          },
        },
      );
      existingImagesRefreshed += 1;
    }

    const contentIsMissing = Boolean(pageConfig?.contentSelectors?.length && !existingArticle.content);
    const imageNeedsLocalCopy = Boolean(
      pageConfig?.imageSelectors?.length &&
      !imageWasRecovered &&
      (!existingArticle.imageUrl || !existingImageIsLocal || !existingLocalImageIsAvailable),
    );
    if (contentIsMissing || imageNeedsLocalCopy) {
      existingArticlesNeedingEnrichment.push({
        ...article,
        ...(existingArticle.imageUrl && (!existingImageIsLocal || existingLocalImageIsAvailable)
          ? { imageUrl: existingArticle.imageUrl }
          : {}),
      });
    }
  }

  let pagesVisited = 0;
  let imageCount = 0;
  let existingContentRefreshed = 0;
  if (browserContext && pageConfig) {
    const newArticleCandidates = newArticles.filter(
      (article) => !article.content || !article.imageUrl || !article.summary || !article.author,
    );
    const enrichmentCandidates = [
      ...newArticleCandidates,
      ...existingArticlesNeedingEnrichment,
    ].slice(0, 20);
    const enrichedArticles = new Map<string, FeedArticle>();
    console.info(`[NEWS] ${sourceConfig.source} Playwright checking ${enrichmentCandidates.length} articles for missing thumbnails or metadata`);
    for (let index = 0; index < enrichmentCandidates.length; index += 2) {
      const batch = enrichmentCandidates.slice(index, index + 2);
      const enrichedBatch = await Promise.all(batch.map(async (article) => {
        pagesVisited += 1;
        try {
          const metadata = await enrichArticlePage(browserContext, article, {
            ...pageConfig,
            source: sourceConfig.source,
          });
          if (metadata.imageUrl) imageCount += 1;

          const canonicalUrl = metadata.canonicalUrl
            ? normalizeCanonicalUrl(metadata.canonicalUrl)
            : article.canonicalUrl;
          const imageCredit = metadata.imageCredit ?? article.imageCredit;

          return {
            ...article,
            ...(metadata.title ? { title: metadata.title } : {}),
            ...(metadata.title ? { normalizedTitle: metadata.title.trim().toLowerCase() } : {}),
            ...(metadata.summary ? { summary: metadata.summary } : {}),
            ...(metadata.content ? { content: metadata.content } : {}),
            ...(metadata.author ? { author: metadata.author } : {}),
            canonicalUrl,
            ...(article.imageUrl || !metadata.imageUrl ? {} : { imageUrl: metadata.imageUrl }),
            ...(imageCredit ? { imageCredit } : {}),
            ...(metadata.publishedAt ? { publishedAt: metadata.publishedAt } : {}),
            expiresAt: getArticleExpiryDate(metadata.publishedAt ?? article.publishedAt),
          } satisfies FeedArticle;
        } catch (error) {
          console.warn(`[NEWS] [${sourceConfig.source}] [${article.canonicalUrl}] Playwright enrichment failed:`, error);
          return article;
        }
      }));
      for (const article of enrichedBatch) {
        enrichedArticles.set(article.canonicalUrl, article);
      }
    }
    const articlesWithEnrichment = newArticles.map(
      (article) => enrichedArticles.get(article.canonicalUrl) ?? article,
    );
    newArticles.splice(0, newArticles.length, ...articlesWithEnrichment);

    for (const existingArticle of existingArticlesNeedingEnrichment) {
      const enrichedArticle = enrichedArticles.get(existingArticle.canonicalUrl);
      if (!enrichedArticle) continue;

      const imageUrl = enrichedArticle.imageUrl && sourceConfig.imageDownloadHosts
        ? await storeNewsImage(enrichedArticle.imageUrl, sourceConfig.imageDownloadHosts)
          ?? enrichedArticle.imageUrl
        : enrichedArticle.imageUrl;
      await Article.updateOne(
        { canonicalUrl: existingArticle.canonicalUrl },
        {
          $set: {
            ...(enrichedArticle.content ? { content: enrichedArticle.content } : {}),
            ...(enrichedArticle.title ? { title: enrichedArticle.title } : {}),
            ...(enrichedArticle.normalizedTitle ? { normalizedTitle: enrichedArticle.normalizedTitle } : {}),
            ...(enrichedArticle.summary ? { summary: enrichedArticle.summary } : {}),
            ...(enrichedArticle.author ? { author: enrichedArticle.author } : {}),
            ...(imageUrl ? { imageUrl } : {}),
            ...(enrichedArticle.imageCredit ? { imageCredit: enrichedArticle.imageCredit } : {}),
            publishedAt: enrichedArticle.publishedAt,
            expiresAt: enrichedArticle.expiresAt,
          },
        },
      );
      if (enrichedArticle.content) existingContentRefreshed += 1;
    }
  }

  if (sourceConfig.imageDownloadHosts) {
    for (const article of newArticles) {
      if (!article.imageUrl || article.imageUrl.startsWith(LOCAL_NEWS_IMAGE_PREFIX)) continue;
      article.imageUrl = await storeNewsImage(article.imageUrl, sourceConfig.imageDownloadHosts)
        ?? article.imageUrl;
    }
  }

  const finalArticles: FeedArticle[] = [];
  const finalUrls = new Set<string>();
  for (const article of newArticles) {
    const discoveredUrl = article.canonicalUrl;
    article.canonicalUrl = normalizeCanonicalUrl(discoveredUrl);
    if (article.canonicalUrl !== discoveredUrl && seenUrls.has(article.canonicalUrl)) continue;
    if (finalUrls.has(article.canonicalUrl)) continue;
    finalUrls.add(article.canonicalUrl);
    seenUrls.add(article.canonicalUrl);
    if (!(await Article.exists({ canonicalUrl: article.canonicalUrl }))) {
      finalArticles.push(article);
    }
  }
  newArticles.splice(0, newArticles.length, ...finalArticles);

  if (newArticles.length === 0) {
    console.info(`[NEWS] ${sourceConfig.source} discovered ${discoveredArticles.length} URLs; all were already stored. Feed images refreshed: ${existingImagesRefreshed}.`);
    return;
  }

  console.info(`[NEWS] ${sourceConfig.source} discovered ${discoveredArticles.length} URLs; ${newArticles.length} are new.`);

  const updates = newArticles.map((article) => {
    const { scrapedAt, expiresAt, imageUrl, imageCredit, ...articleDetails } = article;

    return {
      updateOne: {
        filter: { canonicalUrl: article.canonicalUrl },
        update: {
          $setOnInsert: {
            ...articleDetails,
            scrapedAt,
            expiresAt,
            sourceId: sourceConfig.sourceId,
            sourceName: sourceConfig.source,
            ...(imageUrl ? { imageUrl } : {}),
            ...(imageCredit ? { imageCredit } : {}),
          },
        },
        upsert: true,
      },
    };
  });

  await Article.bulkWrite(updates, { ordered: false });
  console.info(`[NEWS] ${sourceConfig.source} saved ${newArticles.length} new stories; refreshed ${existingImagesRefreshed} feed images and ${existingContentRefreshed} article texts; Playwright pages visited ${pagesVisited}, images extracted ${imageCount}/${pagesVisited}.`);
}
