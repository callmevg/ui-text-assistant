import { Router } from 'express';
import { generateResponse, validateText, improveText, rewriteText } from '../controllers/chatController';

const router = Router();

// Route to generate a response based on user input
router.post('/generate', generateResponse);

// Route to validate a text string
router.post('/validate', validateText);

// Route to improve a text string
router.post('/improve', improveText);

// Route to rewrite a text string
router.post('/rewrite', rewriteText);

export default router;