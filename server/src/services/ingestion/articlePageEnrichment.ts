import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { ArticleDocument } from '../../models/Article.js';

export interface ArticlePageSourceConfig {
  source: string;
  allowedHosts: string[];
  imageSelectors?: string[];
  imageCreditSelectors?: string[];
  contentSelectors?: string[];
  maxContentCharacters?: number;
  requireSourceHostedImage?: boolean;
  requireImageCredit?: boolean;
}

export interface EnrichedArticleFields {
  title?: string;
  summary?: string;
  content?: string;
  author?: string;
  canonicalUrl?: string;
  imageUrl?: string;
  imageCredit?: string;
  publishedAt?: Date;
}

type StructuredArticle = Record<string, unknown>;

export async function launchNewsBrowser(): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    return { browser, context };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

function isAllowedArticleUrl(value: string, allowedHosts: string[]): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && allowedHosts.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

function isUsableImageUrl(value: string | undefined, articleUrl: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, articleUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    if (/logo|favicon|avatar|sprite|tracking|pixel|icon/i.test(url.pathname)) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

function findStructuredArticle(value: unknown): StructuredArticle | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const article = findStructuredArticle(item);
      if (article) return article;
    }
    return undefined;
  }
  if (!value || typeof value !== 'object') return undefined;

  const record = value as StructuredArticle;
  const rawType = record['@type'];
  const types = Array.isArray(rawType) ? rawType : [rawType];
  if (types.some((type) => typeof type === 'string' && /article|news/i.test(type))) {
    return record;
  }

  return findStructuredArticle(record['@graph'])
    ?? findStructuredArticle(record.mainEntity)
    ?? findStructuredArticle(record.hasPart);
}

function structuredImageUrls(imageValue: unknown): string[] {
  if (typeof imageValue === 'string') return [imageValue];
  if (Array.isArray(imageValue)) return imageValue.flatMap(structuredImageUrls);
  if (!imageValue || typeof imageValue !== 'object') return [];

  const image = imageValue as Record<string, unknown>;
  const url = image.url ?? image.contentUrl ?? image.thumbnailUrl;
  return typeof url === 'string' ? [url] : [];
}

function structuredAuthorName(value: unknown): string | undefined {
  const author = Array.isArray(value) ? value[0] : value;
  if (typeof author === 'string') return author;
  if (author && typeof author === 'object' && 'name' in author) {
    const name = (author as { name?: unknown }).name;
    return typeof name === 'string' ? name : undefined;
  }
  return undefined;
}

async function readMeta(page: Page, selector: string): Promise<string | undefined> {
  const locator = page.locator(selector).first();
  if (await locator.count() === 0) return undefined;
  const content = await locator.getAttribute('content').catch(() => null);
  return content?.trim() || undefined;
}

async function readArticleContent(
  page: Page,
  selectors: string[],
  maxCharacters: number,
): Promise<string | undefined> {
  for (const selector of selectors) {
    const article = page.locator(selector).first();
    if (await article.count() === 0) continue;

    const paragraphs = await article.locator('p').allTextContents();
    const paragraphText = paragraphs
      .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n\n');
    const content = paragraphText || (await article.textContent())?.replace(/\s+/g, ' ').trim();
    if (content) return content.slice(0, maxCharacters);
  }

  return undefined;
}

export async function enrichArticlePage(
  context: BrowserContext,
  article: ArticleDocument & { canonicalUrl: string },
  sourceConfig: ArticlePageSourceConfig,
): Promise<EnrichedArticleFields> {
  if (!isAllowedArticleUrl(article.canonicalUrl, sourceConfig.allowedHosts)) {
    throw new Error('Article URL is outside this source adapter’s allowed hosts.');
  }

  const page: Page = await context.newPage();
  page.setDefaultNavigationTimeout(12_000);

  try {
    // Wait for the document response first. Some publisher pages keep loading
    // scripts or other resources long enough to time out before DOMContentLoaded.
    await page.goto(article.canonicalUrl, { waitUntil: 'commit', timeout: 12_000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);

    const jsonLdTexts = await page.locator('script[type="application/ld+json"]').allTextContents();
    let structuredArticle: StructuredArticle | undefined;
    for (const text of jsonLdTexts) {
      try {
        structuredArticle = findStructuredArticle(JSON.parse(text));
      } catch {
        // Continue to the next structured-data block if this one is malformed.
      }
      if (structuredArticle) break;
    }

    const imageFromArticle = await readMeta(page, 'meta[property="og:image"]');
    const imageFromTwitter = await readMeta(page, 'meta[name="twitter:image"]');
    const imageFromStructuredData = structuredImageUrls(
      structuredArticle?.image ?? structuredArticle?.thumbnailUrl,
    );
    const selectorImages: string[] = [];

    for (const selector of sourceConfig.imageSelectors ?? ['article figure img', 'main article img', 'main img']) {
      const image = page.locator(selector).first();
      if (await image.count() === 0) continue;
      const details = await image.evaluate((element) => {
        const img = element as HTMLImageElement;
        return {
          url: img.currentSrc || img.src || img.getAttribute('data-src') || '',
          width: img.naturalWidth || Number(img.getAttribute('width')) || 0,
          height: img.naturalHeight || Number(img.getAttribute('height')) || 0,
          description: `${img.alt} ${img.className} ${img.currentSrc || img.src}`.toLowerCase(),
        };
      });
      if (
        details.url && details.width >= 250 && details.height >= 120 &&
        !/logo|avatar|icon|advert|banner-ad|tracking/.test(details.description)
      ) {
        selectorImages.push(details.url);
      }
    }

    let imageCredit: string | undefined;
    const creditSelectors = sourceConfig.imageCreditSelectors ?? ['article figure figcaption'];
    for (const selector of creditSelectors) {
      const creditElements = await page.locator(selector).allTextContents();
      imageCredit = creditElements.map((text) => text.trim()).find(
        (text) => text.length > 0 && /\b(image|photo|photograph|illustration|chart)\b.*\b(by|courtesy|credit)\b/i.test(text),
      );
      if (imageCredit) break;
    }
    const imageCandidates = [imageFromArticle, imageFromTwitter, ...imageFromStructuredData, ...selectorImages];
    const prioritizedImage = imageCandidates
      .map((candidate) => isUsableImageUrl(candidate, page.url()))
      .find(Boolean);
    const imageHost = prioritizedImage ? new URL(prioritizedImage).hostname : '';
    const sourceHostedImage = sourceConfig.allowedHosts.some(
      (host) => imageHost === host || imageHost.endsWith(`.${host}`),
    );
    const imageUrl = sourceConfig.requireSourceHostedImage && !sourceHostedImage
      ? undefined
      : sourceConfig.requireImageCredit && !imageCredit ? undefined : prioritizedImage;

    const canonicalLocator = page.locator('link[rel="canonical"]').first();
    const canonicalHref = await canonicalLocator.count() > 0
      ? await canonicalLocator.getAttribute('href').catch(() => null)
      : null;
    const headingLocator = page.locator('h1').first();
    const heading = await headingLocator.count() > 0
      ? await headingLocator.textContent().catch(() => null)
      : null;
    const pageTitle = await page.title();
    const titleFromOpenGraph = await readMeta(page, 'meta[property="og:title"]');
    const summaryFromOpenGraph = await readMeta(page, 'meta[property="og:description"]');
    const summaryFromDescription = await readMeta(page, 'meta[name="description"]');
    const authorFromMeta = await readMeta(page, 'meta[name="author"]');
    const authorValue = structuredAuthorName(structuredArticle?.author);
    const publishedDateValue = structuredArticle?.datePublished;
    const publishedAtValue = await readMeta(page, 'meta[property="article:published_time"]')
      ?? await readMeta(page, 'meta[name="date"]')
      ?? (typeof publishedDateValue === 'string' ? publishedDateValue : undefined);
    const publishedAt = publishedAtValue ? new Date(publishedAtValue) : undefined;
    let canonicalUrl: string | undefined;
    if (canonicalHref) {
      try {
        canonicalUrl = new URL(canonicalHref, page.url()).href;
      } catch {
        canonicalUrl = undefined;
      }
    }
    const title = titleFromOpenGraph || heading?.trim() || pageTitle;
    const summary = summaryFromOpenGraph || summaryFromDescription;
    const author = authorFromMeta || authorValue;
    const content = sourceConfig.contentSelectors
      ? await readArticleContent(
        page,
        sourceConfig.contentSelectors,
        sourceConfig.maxContentCharacters ?? 20_000,
      )
      : undefined;

    return {
      ...(title ? { title: title.slice(0, 300) } : {}),
      ...(summary && summary.length <= 2000 ? { summary } : {}),
      ...(content ? { content } : {}),
      ...(author ? { author: author.slice(0, 200) } : {}),
      ...(canonicalUrl && isAllowedArticleUrl(canonicalUrl, sourceConfig.allowedHosts) ? { canonicalUrl } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(imageUrl && imageCredit ? { imageCredit: imageCredit.slice(0, 300) } : {}),
      ...(publishedAt && !Number.isNaN(publishedAt.getTime()) ? { publishedAt } : {}),
    };
  } finally {
    await page.close();
  }
}
