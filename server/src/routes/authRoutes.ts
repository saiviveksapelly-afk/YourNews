import {Router} from "express";
const authRouter = Router();
import {registerUser , loginUser, demoLoginUser} from "../controllers/authController.js"
import { requireAuth } from '../middleware/requireAuth.js';
authRouter.post('/register' , registerUser) 
authRouter.post('/login' , loginUser)
authRouter.post('/demo-login', demoLoginUser)
authRouter.get('/check', requireAuth, (_req, res) => {
  res.json({ authenticated: true });
});
export default authRouter
