import { Schema, model } from 'mongoose';

const feedbackSchema = new Schema({
    userId: { type: String, required: true },
    chatContext: { type: String, required: true },
    feedbackText: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Feedback = model('Feedback', feedbackSchema);

export default Feedback;