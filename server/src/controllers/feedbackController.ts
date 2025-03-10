import { Request, Response } from 'express';
import Feedback from '../models/Feedback';

class FeedbackController {
    async submitFeedback(req: Request, res: Response) {
        try {
            const { userId, feedbackText, chatContext } = req.body;

            const feedback = new Feedback({
                userId,
                feedbackText,
                chatContext,
                createdAt: new Date(),
            });

            await feedback.save();
            res.status(201).json({ message: 'Feedback submitted successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Error submitting feedback', error });
        }
    }

    async getFeedback(req: Request, res: Response) {
        try {
            const feedbacks = await Feedback.find();
            res.status(200).json(feedbacks);
        } catch (error) {
            res.status(500).json({ message: 'Error retrieving feedback', error });
        }
    }
}

export default new FeedbackController();