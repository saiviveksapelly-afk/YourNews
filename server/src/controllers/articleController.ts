import type { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import Article from '../models/Article.js';
import { isNewsCategory } from '../config/newsCategories.js';
import { isNewsRegion } from '../config/newsRegions.js';

export async function getArticles(req: Request, res: Response) {
  const requestedCategory = req.query.category;
  const requestedRegion = req.query.region;
  const requestedView = req.query.view;
  const requestedFrom = req.query.from;
  const requestedTo = req.query.to;

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
      message: 'Choose National or International news.',
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
  const sort = requestedView === 'top10'
    ? { sourceViewCount: -1 as const, sourceRank: 1 as const, publishedAt: -1 as const }
    : { publishedAt: -1 as const };
  const articleLimit = requestedView === 'top10' ? 10 : 50;

  try {
    const articles = await Article.find(filter)
      .select('title summary source sourceId sourceName canonicalUrl imageUrl imageCredit category region author publishedAt sourceRank sourceViewCount popularitySource')
      .sort(sort)
      .limit(articleLimit)
      .lean();

    const topStories = await Article.find(bannerFilter)
      .select('title summary source sourceId sourceName canonicalUrl imageUrl imageCredit category region author publishedAt sourceRank sourceViewCount popularitySource')
      .sort({ sourceViewCount: -1, sourceRank: 1, publishedAt: -1 })
      .limit(10)
      .lean();

    const popularityFilter = {
      ...bannerFilter,
      $or: [
        { sourceViewCount: { $exists: true } },
        { sourceRank: { $exists: true } },
      ],
    };
    const rankedArticleWithImage = await Article.findOne({ ...popularityFilter, imageUrl: { $exists: true, $ne: '' } })
      .select('title summary source sourceId sourceName canonicalUrl imageUrl imageCredit category region author publishedAt sourceRank sourceViewCount popularitySource')
      .sort({ sourceViewCount: -1, sourceRank: 1, publishedAt: -1 })
      .lean();

    const rankedArticle = rankedArticleWithImage ?? await Article.findOne(popularityFilter)
      .select('title summary source sourceId sourceName canonicalUrl imageUrl imageCredit category region author publishedAt sourceRank sourceViewCount popularitySource')
      .sort({ sourceViewCount: -1, sourceRank: 1, publishedAt: -1 })
      .lean();

    const featuredArticle = rankedArticle ?? topStories[0] ?? await Article.findOne(bannerFilter)
      .select('title summary source sourceId sourceName canonicalUrl imageUrl imageCredit category region author publishedAt sourceRank sourceViewCount popularitySource')
      .sort({ publishedAt: -1 })
      .lean();

    return res.status(200).json({ articles, featuredArticle, topStories });
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
