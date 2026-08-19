import { Router } from 'express';
import {
  scheduleEmails,
  getScheduledEmails,
  getSentEmails,
  getStats,
} from '../controllers/emailController';

export const emailRouter = Router();

emailRouter.post('/schedule', scheduleEmails);
emailRouter.get('/scheduled', getScheduledEmails);
emailRouter.get('/sent', getSentEmails);
emailRouter.get('/stats', getStats);
