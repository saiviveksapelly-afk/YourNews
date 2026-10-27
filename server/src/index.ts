import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';
import mongoose from "mongoose"
const app = express();
const PORT = Number(process.env.PORT) || 3000;
import authRouter from './routes/authRoutes.js';
import articleRouter from './routes/articleRoutes.js';
import { requireAuth } from './middleware/requireAuth.js';
import { getNewsRetentionDays } from './config/newsRetention.js';
import { startNewsIngestion } from './services/newsIngestionService.js';
app.use(express.json());
app.use('/api/media', express.static(fileURLToPath(new URL('../uploads/', import.meta.url))));
app.use('/api/auth',authRouter)
app.use('/api/articles', articleRouter);
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello World' });
});
app.get('/api/protected', requireAuth, (req, res) => {
  res.json({ message: 'You are authenticated.' });
});
async function startServer(){ 
  try{
    const mongoUrl = process.env.MONGODB_URI;
    if(!mongoUrl){
      throw new Error("MONGODB_URI is missing from server/.env")
    }
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is missing from server/.env');
    }
    getNewsRetentionDays();
    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB')
    startNewsIngestion();
    app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server listening on port ${PORT}`);
});
  }
  catch(error){
      console.error("failed to start server" , error);
      process.exit(1);
  }
}
startServer();
