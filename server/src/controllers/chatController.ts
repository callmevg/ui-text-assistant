import { Request, Response } from 'express';
import { generateResponse } from '../services/azureService';
import { saveChatHistory } from '../services/storageService';

export const handleChatRequest = async (req: Request, res: Response) => {
    const { userInput, userId } = req.body;

    try {
        const response = await generateResponse(userInput);
        await saveChatHistory(userId, userInput, response);
        res.status(200).json({ response });
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
};