import { Schema, model } from 'mongoose';
import { NEWS_CATEGORIES, type NewsCategory } from '../config/newsCategories.js';
import { NEWS_REGIONS, type NewsRegion } from '../config/newsRegions.js';

export interface ArticleDocument {
  title: string;
  normalizedTitle: string;
  summary?: string;
  content?: string;
  source: string;
  sourceId?: string;
  sourceName?: string;
  canonicalUrl?: string;
  imageUrl?: string;
  imageCredit?: string;
  category: NewsCategory;
  region: NewsRegion;
  author?: string;
  publishedAt: Date;
  scrapedAt: Date;
  sourceRank?: number;
  sourceViewCount?: number;
  popularitySource?: string;
  expiresAt: Date;
}

const articleSchema = new Schema<ArticleDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    normalizedTitle: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    summary: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    content: {
      type: String,
      trim: true,
      maxlength: 20000,
    },
    source: {
      type: String,
      required: true,
      trim: true,
    },
    sourceId: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 100,
    },
    sourceName: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    canonicalUrl: {
      type: String,
      trim: true,
      minlength: 1,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    imageCredit: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: NEWS_CATEGORIES,
      required: true,
    },
    region: {
      type: String,
      enum: NEWS_REGIONS,
      required: true,
    },
    author: {
      type: String,
      trim: true,
    },
    publishedAt: {
      type: Date,
      required: true,
      index: true,
    },
    scrapedAt: {
      type: Date,
      required: true,
    },
    sourceRank: {
      type: Number,
      min: 1,
    },
    sourceViewCount: {
      type: Number,
      min: 0,
    },
    popularitySource: {
      type: String,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

articleSchema.index({ canonicalUrl: 1 }, { unique: true, sparse: true });
articleSchema.index(
  { source: 1, normalizedTitle: 1 },
  {
    unique: true,
    partialFilterExpression: { canonicalUrl: { $exists: false } },
  },
);
articleSchema.index({ category: 1, publishedAt: -1 });
articleSchema.index({ region: 1, category: 1, publishedAt: -1 });
articleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Article = model<ArticleDocument>('Article', articleSchema);

export default Article;
