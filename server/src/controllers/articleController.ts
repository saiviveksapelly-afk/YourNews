import type { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import Article from '../models/Article.js';
import { isNewsCategory } from '../config/newsCategories.js';
import { isNewsRegion } from '../config/newsRegions.js';

const ARTICLE_FIELDS = 'title summary source sourceId sourceName canonicalUrl imageUrl imageCredit category region author publishedAt sourceRank sourceViewCount popularitySource';
const COMMON_STORY_SCAN_LIMIT = 2000;
const SEARCH_RESULT_LIMIT = 50;

type StoryCandidate = {
  title: string;
  source: string;
  sourceViewCount?: number;
  sourceRank?: number;
  publishedAt: Date;
};

function normalizeHeadline(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function groupCommonHeadlines<T extends StoryCandidate>(articles: T[]) {
  const groups = new Map<string, { article: T; sources: Set<string> }>();

  for (const article of articles) {
    const headlineKey = normalizeHeadline(article.title);
    const existingGroup = groups.get(headlineKey);

    if (existingGroup) {
      existingGroup.sources.add(article.source);
    } else {
      groups.set(headlineKey, {
        article,
        sources: new Set([article.source]),
      });
    }
  }

  return [...groups.values()]
    .map(({ article, sources }) => ({
      ...article,
      coverageCount: sources.size,
      coverageSources: [...sources].sort(),
    }))
    .sort((first, second) => {
      const coverageDifference = second.coverageCount - first.coverageCount;
      if (coverageDifference !== 0) return coverageDifference;

      const viewDifference = (second.sourceViewCount ?? 0) - (first.sourceViewCount ?? 0);
      if (viewDifference !== 0) return viewDifference;

      const firstRank = first.sourceRank ?? Number.MAX_SAFE_INTEGER;
      const secondRank = second.sourceRank ?? Number.MAX_SAFE_INTEGER;
      if (firstRank !== secondRank) return firstRank - secondRank;

      return second.publishedAt.getTime() - first.publishedAt.getTime();
    });
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function getArticles(req: Request, res: Response) {
  const requestedCategory = req.query.category;
  const requestedRegion = req.query.region;
  const requestedView = req.query.view;
  const requestedFrom = req.query.from;
  const requestedTo = req.query.to;
  const requestedSearch = req.query.search;

  if (requestedSearch !== undefined && typeof requestedSearch !== 'string') {
    return res.status(400).json({ message: 'Enter a word or phrase to search headlines.' });
  }

  const searchTerm = typeof requestedSearch === 'string' ? requestedSearch.trim() : '';
  if (searchTerm.length > 100) {
    return res.status(400).json({ message: 'Search headlines using 100 characters or fewer.' });
  }

  if (
    requestedCategory !== undefined &&
    (typeof requestedCategory !== 'string' || !isNewsCategory(requestedCategory))
  ) {
    return res.status(400).json({
      message: 'Choose one of the available news categories.',
    });
  }

  if (
    typeof requestedRegion !== 'string' ||
    !isNewsRegion(requestedRegion)
  ) {
    return res.status(400).json({
      message: 'Choose International news.',
    });
  }

  if (requestedView !== 'latest' && requestedView !== 'top10') {
    return res.status(400).json({
      message: 'Choose Latest articles or the Top 10.',
    });
  }

  const dateFilter: { $gte?: Date; $lte?: Date } = {};
  if (requestedFrom !== undefined) {
    const fromDate = typeof requestedFrom === 'string' ? new Date(requestedFrom) : null;
    if (!fromDate || Number.isNaN(fromDate.getTime())) {
      return res.status(400).json({ message: 'Choose a valid start date.' });
    }
    fromDate.setUTCHours(0, 0, 0, 0);
    dateFilter.$gte = fromDate;
  }
  if (requestedTo !== undefined) {
    const toDate = typeof requestedTo === 'string' ? new Date(requestedTo) : null;
    if (!toDate || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ message: 'Choose a valid end date.' });
    }
    toDate.setUTCHours(23, 59, 59, 999);
    dateFilter.$lte = toDate;
  }
  if (dateFilter.$gte && dateFilter.$lte && dateFilter.$gte > dateFilter.$lte) {
    return res.status(400).json({ message: 'The start date must be on or before the end date.' });
  }

  const filter = {
    region: requestedRegion,
    expiresAt: { $gt: new Date() },
    ...(typeof requestedCategory === 'string' && isNewsCategory(requestedCategory)
      ? { category: requestedCategory }
      : {}),
    ...(Object.keys(dateFilter).length ? { publishedAt: dateFilter } : {}),
  };
  // The hero carousel is the regional Top 10 across every genre. The category
  // filter applies only to the article grid below it.
  const bannerFilter = {
    region: requestedRegion,
    expiresAt: { $gt: new Date() },
    ...(Object.keys(dateFilter).length ? { publishedAt: dateFilter } : {}),
  };
  try {
    const imageFilter = {
      imageUrl: { $exists: true, $ne: '', $regex: /\S/ },
    };
    const topStories = groupCommonHeadlines(await Article.find({ ...bannerFilter, ...imageFilter })
      .select(ARTICLE_FIELDS)
      .sort({ sourceViewCount: -1, sourceRank: 1, publishedAt: -1 })
      .limit(COMMON_STORY_SCAN_LIMIT)
      .lean()).slice(0, 10);

    let articles;
    if (searchTerm) {
      const escapedSearch = escapeRegularExpression(searchTerm);
      const headlineFilter = {
        ...filter,
        title: { $regex: escapedSearch, $options: 'i' },
      };
      const prefixArticles = await Article.find({
        ...filter,
        title: { $regex: `^${escapedSearch}`, $options: 'i' },
      })
        .select(ARTICLE_FIELDS)
        .sort({ publishedAt: -1 })
        .limit(SEARCH_RESULT_LIMIT)
        .lean();
      const prefixIds = prefixArticles.map((article) => article._id);
      const remainingArticles = await Article.find({
        ...headlineFilter,
        ...(prefixIds.length ? { _id: { $nin: prefixIds } } : {}),
      })
        .select(ARTICLE_FIELDS)
        .sort({ publishedAt: -1 })
        .limit(SEARCH_RESULT_LIMIT - prefixArticles.length)
        .lean();
      articles = [...prefixArticles, ...remainingArticles];
    } else if (requestedView === 'top10') {
      articles = groupCommonHeadlines(await Article.find({ ...filter, ...imageFilter })
        .select(ARTICLE_FIELDS)
        .sort({ sourceViewCount: -1, sourceRank: 1, publishedAt: -1 })
        .limit(COMMON_STORY_SCAN_LIMIT)
        .lean()).slice(0, 10);
    } else {
      articles = await Article.find(filter)
        .select(ARTICLE_FIELDS)
        .sort({ publishedAt: -1 })
        .limit(50)
        .lean();
    }

    const featuredArticle = topStories[0] ?? null;

    return res.status(200).json({ articles, featuredArticle, topStories, searchTerm });
  } catch (error) {
    console.error('Could not load news articles:', error);
    return res.status(500).json({
      message: 'We could not load the latest news. Please try again.',
    });
  }
}

export async function getArticleById(req: Request, res: Response) {
  const articleId = req.params.id;
  if (!isValidObjectId(articleId)) {
    return res.status(404).json({ message: 'We could not find that story.' });
  }

  try {
    const article = await Article.findById(articleId)
      .select('title summary content source sourceId sourceName canonicalUrl imageUrl imageCredit category region author publishedAt sourceRank sourceViewCount popularitySource')
      .lean();

    if (!article) {
      return res.status(404).json({ message: 'We could not find that story.' });
    }

    return res.status(200).json({ article });
  } catch (error) {
    console.error('Could not load the news story:', error);
    return res.status(500).json({
      message: 'We could not load this story. Please try again.',
    });
  }
}
