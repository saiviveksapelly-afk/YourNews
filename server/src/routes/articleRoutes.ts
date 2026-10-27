import { Router } from 'express';
import { getArticleById, getArticles } from '../controllers/articleController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const articleRouter = Router();

articleRouter.get('/', requireAuth, getArticles);
articleRouter.get('/:id', requireAuth, getArticleById);

export default articleRouter;
