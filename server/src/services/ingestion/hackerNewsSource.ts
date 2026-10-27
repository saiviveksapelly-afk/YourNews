import Article, { type ArticleDocument } from '../../models/Article.js';
import { getArticleExpiryDate } from '../../config/newsRetention.js';
import { normalizeCanonicalUrl } from './normalizeCanonicalUrl.js';

interface HackerNewsStory {
  id: number;
  type?: string;
  title?: string;
  url?: string;
  time?: number;
  deleted?: boolean;
  dead?: boolean;
}

type CollectedArticle = ArticleDocument & { canonicalUrl: string };

async function getTopStoryIds(): Promise<number[]> {
  const response = await fetch(
    'https://hacker-news.firebaseio.com/v0/topstories.json',
  );

  if (!response.ok) {
    throw new Error(`Hacker News returned HTTP ${response.status}.`);
  }

  const storyIds: unknown = await response.json();

  if (!Array.isArray(storyIds)) {
    throw new Error('Hacker News returned an unexpected story list.');
  }

  return storyIds.slice(0, 20) as number[];
}

async function getStory(id: number): Promise<HackerNewsStory | null> {
  const response = await fetch(
    `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
  );

  if (!response.ok) return null;
  return (await response.json()) as HackerNewsStory | null;
}

function isWebArticleUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function collectHackerNewsArticles(seenUrls = new Set<string>()): Promise<void> {
  const storyIds = await getTopStoryIds();
  const stories = await Promise.all(storyIds.map((id) => getStory(id)));
  const scrapedAt = new Date();

  const articles: CollectedArticle[] = stories.flatMap((story, index) => {
    if (
      !story ||
      story.type !== 'story' ||
      story.deleted ||
      story.dead ||
      !story.title ||
      !story.url ||
      !isWebArticleUrl(story.url) ||
      !story.time
    ) {
      return [];
    }

    const publishedAt = new Date(story.time * 1000);

    const canonicalUrl = normalizeCanonicalUrl(story.url);
    if (seenUrls.has(canonicalUrl)) return [];
    seenUrls.add(canonicalUrl);

    return [{
      title: story.title,
      normalizedTitle: story.title.trim().toLowerCase(),
      source: 'Hacker News',
      sourceId: 'hacker-news',
      sourceName: 'Hacker News',
      canonicalUrl,
      category: 'Technology',
      region: 'International',
      publishedAt,
      scrapedAt,
      sourceRank: index + 1,
      popularitySource: 'Hacker News',
      expiresAt: getArticleExpiryDate(publishedAt),
    }];
  });

  if (articles.length === 0) {
    console.info('Hacker News collection finished: no linked stories found.');
    return;
  }

  const uniqueArticlesByUrl = new Map<string, CollectedArticle>();
  for (const article of articles) {
    if (!uniqueArticlesByUrl.has(article.canonicalUrl)) {
      uniqueArticlesByUrl.set(article.canonicalUrl, article);
    }
  }
  const uniqueArticles = [...uniqueArticlesByUrl.values()];
  let newArticleCount = 0;
  for (const article of uniqueArticles) {
    if (!(await Article.exists({ canonicalUrl: article.canonicalUrl }))) {
      newArticleCount += 1;
    }
  }
  const updates = uniqueArticles.map((article) => {
    const { scrapedAt, sourceRank, popularitySource, expiresAt, ...articleDetails } = article;

    return {
      updateOne: {
        filter: { canonicalUrl: article.canonicalUrl },
        update: {
          $set: { sourceRank, popularitySource },
          $setOnInsert: { ...articleDetails, scrapedAt, expiresAt },
        },
        upsert: true,
      },
    };
  });

  await Article.bulkWrite(updates, { ordered: false });
  console.info(`Hacker News collection finished: ${newArticleCount} new stories; ${uniqueArticles.length - newArticleCount} existing ranks refreshed.`);
}
