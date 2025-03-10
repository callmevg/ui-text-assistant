import { Router } from 'express';
import { submitFeedback } from '../controllers/feedbackController';

const router = Router();

router.post('/submit', submitFeedback);

export default router;