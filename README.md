# UI Text Assistant

## Overview
The UI Text Assistant is a chatbot application designed to help users generate, validate, improve, or rewrite text strings for user interfaces. It leverages Azure's API for generating responses and provides a user-friendly interface for interaction.

## Features
- **Azure API Integration**: Users can input their Azure API secrets (key, endpoint name, and URL) to enable the chatbot functionality.
- **Chat Interface**: A dedicated chat interface for users to communicate with the chatbot.
- **Chat History**: The application records chat history locally for each user, allowing them to revisit previous conversations.
- **Feedback System**: Users can submit feedback, which is stored on the server along with the chat context for future improvements.
- **Guideline Viewer**: Users can view writing style guidelines embedded in the application to ensure consistency in text generation.

## Project Structure
The project is divided into two main parts: the client and the server.

### Client
- **public/index.html**: Main HTML file serving as the entry point for the client application.
- **src/components**: Contains React components for chat interface, API key setup, feedback form, guideline viewer, and settings.
- **src/contexts**: Context providers for managing authentication and chat state.
- **src/services**: Services for API calls, chat logic, local storage management, and feedback handling.
- **src/utils**: Utility functions for local storage interactions.
- **src/App.tsx**: Main application component.
- **src/index.tsx**: Entry point for the React application.

### Server
- **src/controllers**: Controllers for handling chat and feedback requests.
- **src/models**: Data models for feedback.
- **src/routes**: API routes for chat and feedback.
- **src/services**: Services for Azure API interaction and guideline management.
- **src/index.ts**: Entry point for the server application.
- **src/config.ts**: Configuration settings for the server.

## Installation
1. Clone the repository.
2. Navigate to the `client` directory and run `npm install` to install client dependencies.
3. Navigate to the `server` directory and run `npm install` to install server dependencies.
4. Set up your Azure API credentials in the client application.
5. Start the server and client applications.

## Usage
- Open the client application in your browser.
- Enter your Azure API credentials in the settings.
- Start chatting with the bot to generate or improve text strings.
- Provide feedback to help improve the application.

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License
This project is licensed under the MIT License.