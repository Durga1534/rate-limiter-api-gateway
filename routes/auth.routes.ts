import express from 'express';
import { registerController, loginController } from '../controllers/authController.ts';
import { authRateLimiter } from '../middlewares/rateLimiter.ts';

const router = express.Router();

// Apply rate limiting to auth endpoints
router.post('/register', authRateLimiter, registerController);
router.post('/login', authRateLimiter, loginController);

export default router;