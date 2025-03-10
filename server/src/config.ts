import dotenv from 'dotenv';

dotenv.config();

const config = {
    azure: {
        apiKey: process.env.AZURE_API_KEY || '',
        endpointName: process.env.AZURE_ENDPOINT_NAME || '',
        endpointUrl: process.env.AZURE_ENDPOINT_URL || ''
    },
    server: {
        port: process.env.PORT || 5000,
        chatHistoryLimit: parseInt(process.env.CHAT_HISTORY_LIMIT) || 100
    },
    feedback: {
        feedbackApiUrl: process.env.FEEDBACK_API_URL || ''
    }
};

export default config;