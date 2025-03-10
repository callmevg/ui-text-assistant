import axios from 'axios';

interface AzureConfig {
    key: string;
    endpoint: string;
    url: string;
}

export class AzureService {
    private config: AzureConfig;

    constructor(config: AzureConfig) {
        this.config = config;
    }

    async generateResponse(prompt: string): Promise<string> {
        try {
            const response = await axios.post(this.config.url, {
                prompt: prompt,
                // Additional parameters can be added here
            }, {
                headers: {
                    'Ocp-Apim-Subscription-Key': this.config.key,
                    'Content-Type': 'application/json',
                }
            });

            return response.data; // Adjust based on the actual response structure
        } catch (error) {
            console.error('Error generating response from Azure:', error);
            throw new Error('Failed to generate response');
        }
    }

    // Additional methods for validation, improvement, and rewriting can be added here
}