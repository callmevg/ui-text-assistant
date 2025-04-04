import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './App.css';
import { Prism as SyntaxHighlighter, SyntaxHighlighterProps } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Add the Message interface here
interface Message {
  role: string;
  content: string;
  thinking?: string;
  feedback?: {
    rating?: 'positive' | 'negative' | null;
    comments?: string;
    timestamp?: number;
  };
}

// Add interfaces for the chat structure
interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

function App() {
  // States for API settings
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [endpointName, setEndpointName] = useState('');
  
  // States for guidelines
  const [guidelines, setGuidelines] = useState<Array<{name: string, content: string}>>([]);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  
  // Chat states
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('chat');

  // Debug state
  const [showDebug, setShowDebug] = useState(false);
  const [showThinking, setShowThinking] = useState(false);

  // New states for managing multiple chats and sidebar visibility
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);

  // Add to your state variables
  const [feedbackModal, setFeedbackModal] = useState({
    isOpen: false,
    messageIndex: -1,
    comment: ''
  });

  // Add to your existing state variables
  const [darkMode, setDarkMode] = useState<boolean>(
    localStorage.getItem('darkMode') === 'true' || 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // Add this function and call it once
  const cleanLocalStorage = () => {
    const chatsString = localStorage.getItem('chats');
    if (chatsString && chatsString.includes('{getActiveChat()')) {
      // Found corrupted data, remove it
      localStorage.removeItem('chats');
      window.location.reload(); // Reload the page
    }
  };

  // Load settings from local storage on component mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('apiKey');
    const savedEndpoint = localStorage.getItem('endpoint');
    const savedEndpointName = localStorage.getItem('endpointName');
    const savedGuidelines = localStorage.getItem('guidelines');
    const savedChats = localStorage.getItem('chats');

    if (savedApiKey) setApiKey(savedApiKey);
    if (savedEndpoint) setEndpoint(savedEndpoint);
    if (savedEndpointName) setEndpointName(savedEndpointName);
    if (savedGuidelines) setGuidelines(JSON.parse(savedGuidelines));
    
    if (savedChats) {
      const parsedChats = JSON.parse(savedChats);
      setChats(parsedChats);
      // Set the most recent chat as active
      if (parsedChats.length > 0) {
        setActiveChatId(parsedChats[parsedChats.length - 1].id);
      }
    } else {
      // Create a default chat if none exists
      createNewChat();
    }
  }, []);
  
  // Call this in a useEffect
  useEffect(() => {
    cleanLocalStorage();
  }, []);
  
  // Save chat history whenever it changes
  useEffect(() => {
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
  }, [chatHistory]);

  // Add effect to apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if API settings are configured
    if (!apiKey || !endpoint || !endpointName) {
      setError('Please configure your Azure API settings in the Settings tab before sending messages.');
      setTimeout(() => setError(null), 5000);
      return;
    }
    
    // Create a new chat if none is active
    if (!activeChatId) {
      // Create a new chat with the first message already included
      const newChatId = generateId();
      const firstMessage = {role: 'user', content: message};
      
      // Use the first few words of the user's message as the title
      const defaultTitle = message.split(' ').slice(0, 3).join(' ') + '...';
      
      const newChat = {
        id: newChatId,
        title: defaultTitle,
        messages: [firstMessage],
        createdAt: Date.now()
      };
      
      // Add to beginning of the array
      const updatedChats = [newChat, ...chats];
      setChats(updatedChats);
      setActiveChatId(newChatId);
      localStorage.setItem('chats', JSON.stringify(updatedChats));
      
      // Continue with API call using this new chat
      const newMessages = [firstMessage];
      setMessage('');
      setIsLoading(true);
      setError(null);
      
      try {
        // Prepare guidelines text and API call with the first message
        // Rest of your API call logic...
        const guidelinesText = guidelines.length > 0 
          ? guidelines.map(g => `${g.name}:\n${g.content}`).join('\n\n')
          : 'No specific guidelines provided.';
        
        // Prepare the conversation history
        const messages = [
          {
            role: "system",
            content: `You are an AI assistant that helps generate and improve UI text.

            THINKING PROCESS:
            1. First, carefully analyze the user's request or text
            2. Consider the context, purpose, and audience for the UI text
            3. Think step-by-step about the most effective approach
            4. Consider multiple alternatives before selecting the best option
            5. Ensure your response follows all writing guidelines provided

            Consider these writing style guidelines when creating your responses:
            
            ${guidelinesText}`
          },
          ...newMessages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          }))
        ];
        
        // Clean the endpoint URL (remove trailing slash)
        let apiEndpoint = endpoint.trim();
        if (apiEndpoint.endsWith('/')) {
          apiEndpoint = apiEndpoint.slice(0, -1);
        }
        
        // Call the API
        const apiUrl = `${apiEndpoint}/openai/deployments/${endpointName}/chat/completions?api-version=2023-05-15`;
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': apiKey
          },
          body: JSON.stringify({
            messages: messages,
            max_tokens: 800,
            temperature: 0.7
          })
        });
        
        if (!response.ok) {
          // Your existing error handling code
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            throw new Error(`${response.status}: ${errorData.error?.message || JSON.stringify(errorData)}`);
          } else {
            const errorText = await response.text();
            throw new Error(`Server returned ${response.status}: ${errorText.substring(0, 200)}...`);
          }
        }
        
        const data = await response.json();
        const assistantReply = data.choices[0].message.content;
        
        // Add assistant's reply to chat history
        const updatedMessagesWithReply = [...newMessages, {
          role: 'assistant',
          content: assistantReply
        }];
        
        // Update the newly created chat with the AI response
        const finalUpdatedChats = updatedChats.map(chat => 
          chat.id === newChatId ? { ...chat, messages: updatedMessagesWithReply } : chat
        );
        
        setChats(finalUpdatedChats);
        localStorage.setItem('chats', JSON.stringify(finalUpdatedChats));
        
      } catch (err) {
        console.error('Error calling Azure API:', err);
        setError(`Failed to get response: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
      
      return; // Exit after handling the first message
    }
    
    // For existing chats, proceed with the normal flow
    const activeChat = getActiveChat();
    if (!activeChat) return;
    
    // Add user message to chat history
    const newMessages = [...activeChat.messages, {role: 'user', content: message}];
    
    // Update the active chat with the new message immediately
    const updatedChats = chats.map(chat => 
      chat.id === activeChatId ? { ...chat, messages: newMessages } : chat
    );
    setChats(updatedChats);
    localStorage.setItem('chats', JSON.stringify(updatedChats));
    
    // Clear message input and set loading state
    setMessage('');
    setIsLoading(true);
    setError(null);
    
    try {
      // Rest of your existing API call code for subsequent messages
      const guidelinesText = guidelines.length > 0 
        ? guidelines.map(g => `${g.name}:\n${g.content}`).join('\n\n')
        : 'No specific guidelines provided.';
      
      // Prepare the conversation history
      const messages = [
        {
          role: "system",
          content: `You are an AI assistant that helps generate and improve UI text.

          THINKING PROCESS:
          1. First, carefully analyze the user's request or text
          2. Consider the context, purpose, and audience for the UI text
          3. Ensure your response follows all writing guidelines provided. Strictly adhere to these writing style guidelines when creating your responses:
          ${guidelinesText}
          4. Think step-by-step about the most accurate response
          5. Consider multiple alternatives before selecting the best option
          6. Ensure your response follows all writing guidelines provided`
        },
        ...newMessages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        }))
      ];
      
      // Clean the endpoint URL (remove trailing slash)
      let apiEndpoint = endpoint.trim();
      if (apiEndpoint.endsWith('/')) {
        apiEndpoint = apiEndpoint.slice(0, -1);
      }
      
      // Call the API
      const apiUrl = `${apiEndpoint}/openai/deployments/${endpointName}/chat/completions?api-version=2023-05-15`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey
        },
        body: JSON.stringify({
          messages: messages,
          max_tokens: 800,
          temperature: 0.7
        })
      });
      
      if (!response.ok) {
        // Your existing error handling code
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(`${response.status}: ${errorData.error?.message || JSON.stringify(errorData)}`);
        } else {
          const errorText = await response.text();
          throw new Error(`Server returned ${response.status}: ${errorText.substring(0, 200)}...`);
        }
      }
      
      const data = await response.json();
      const assistantReply = data.choices[0].message.content;
      
      // Add assistant's reply to chat history
      const updatedMessagesWithReply = [...newMessages, {
        role: 'assistant',
        content: assistantReply
      }];
      
      // Update the chat with both the user message and AI response
      const finalUpdatedChats = updatedChats.map(chat => 
        chat.id === activeChatId ? { ...chat, messages: updatedMessagesWithReply } : chat
      );
      
      setChats(finalUpdatedChats);
      localStorage.setItem('chats', JSON.stringify(finalUpdatedChats));
      
    } catch (err) {
      console.error('Error calling Azure API:', err);
      setError(`Failed to get response: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSaveSettings = () => {
    // Save API settings to local storage
    localStorage.setItem('apiKey', apiKey);
    localStorage.setItem('endpoint', endpoint);
    localStorage.setItem('endpointName', endpointName);
    
    alert('API settings saved successfully!');
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(e.target.files);
    }
  };
  
  const handleFileUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    // Process all selected files
    const newGuidelines = [...guidelines];
    
    // Use Promise.all to read all files
    const filePromises = Array.from(selectedFiles).map(file => {
      return new Promise<{name: string, content: string}>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            name: file.name,
            content: e.target?.result as string
          });
        };
        reader.readAsText(file);
      });
    });
    
    // Wait for all files to be read
    const results = await Promise.all(filePromises);
    
    // Add all new guidelines
    const updatedGuidelines = [...guidelines, ...results];
    setGuidelines(updatedGuidelines);
    
    // Save to local storage
    localStorage.setItem('guidelines', JSON.stringify(updatedGuidelines));
    
    // Reset selected files
    setSelectedFiles(null);
    
    // Reset the file input
    const fileInput = document.getElementById('guideline-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };
  
  const removeGuideline = (index: number) => {
    const newGuidelines = [...guidelines];
    newGuidelines.splice(index, 1);
    setGuidelines(newGuidelines);
    localStorage.setItem('guidelines', JSON.stringify(newGuidelines));
  };

  const clearChat = () => {
    setChatHistory([]);
    localStorage.removeItem('chatHistory');
  };

  // Add these functions to your App component

  // Create a new chat
  const createNewChat = () => {
    const newChat = {
      id: generateId(),
      title: `New Chat ${chats.length + 1}`,
      messages: [],
      createdAt: Date.now()
    };
    
    // Add new chat to the beginning of the array instead of the end
    const updatedChats = [newChat, ...chats];
    setChats(updatedChats);
    setActiveChatId(newChat.id);
    
    // Save to localStorage
    localStorage.setItem('chats', JSON.stringify(updatedChats));
  };

  // Helper to generate a unique ID
  const generateId = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  // Rename a chat
  const renameChat = (id: string, newTitle: string) => {
    const updatedChats = chats.map(chat => 
      chat.id === id ? { ...chat, title: newTitle } : chat
    );
    
    setChats(updatedChats);
    localStorage.setItem('chats', JSON.stringify(updatedChats));
  };

  // Delete a chat
  const deleteChat = (id: string) => {
    const updatedChats = chats.filter(chat => chat.id !== id);
    setChats(updatedChats);
    
    // If the active chat was deleted, set a new active chat
    if (activeChatId === id) {
      setActiveChatId(updatedChats.length > 0 ? updatedChats[0].id : null);
    }
    
    localStorage.setItem('chats', JSON.stringify(updatedChats));
  };

  // Get the active chat
  const getActiveChat = () => {
    return chats.find(chat => chat.id === activeChatId) || null;
  };

  // Update messages in the active chat
  const updateActiveChatMessages = (messages: Array<{role: string, content: string}>) => {
    if (!activeChatId) return;
    
    const updatedChats = chats.map(chat => 
      chat.id === activeChatId ? { ...chat, messages } : chat
    );
    
    setChats(updatedChats);
    localStorage.setItem('chats', JSON.stringify(updatedChats));
  };

  // Add these functions to handle feedback
  const handleFeedback = (messageIndex: number, rating: 'positive' | 'negative') => {
    const chat = getActiveChat();
    if (!chat) return;
  
    const updatedMessages = [...chat.messages];
    const message = updatedMessages[messageIndex];
    
    // If same rating clicked, remove feedback
    if (message.feedback?.rating === rating) {
      updatedMessages[messageIndex] = {
        ...message,
        feedback: {
          ...message.feedback,
          rating: null
        }
      };
    } else {
      // Add or update feedback rating
      updatedMessages[messageIndex] = {
        ...message,
        feedback: {
          ...message.feedback || {},
          rating: rating,
          timestamp: Date.now()
        }
      };
    }
    
    // Update the chat with the new feedback
    const updatedChats = chats.map(c => 
      c.id === activeChatId ? { ...c, messages: updatedMessages } : c
    );
    
    setChats(updatedChats);
    localStorage.setItem('chats', JSON.stringify(updatedChats));
  };
  
  const openFeedbackModal = (messageIndex: number) => {
    const chat = getActiveChat();
    if (!chat) return;
    
    setFeedbackModal({
      isOpen: true,
      messageIndex,
      comment: chat.messages[messageIndex].feedback?.comments || ''
    });
  };
  
  const saveFeedbackComment = () => {
    const chat = getActiveChat();
    if (!chat) return;
    
    const updatedMessages = [...chat.messages];
    const message = updatedMessages[feedbackModal.messageIndex];
    
    updatedMessages[feedbackModal.messageIndex] = {
      ...message,
      feedback: {
        ...message.feedback || {},
        comments: feedbackModal.comment,
        timestamp: Date.now()
      }
    };
    
    // Update the chat with the new feedback
    const updatedChats = chats.map(c => 
      c.id === activeChatId ? { ...c, messages: updatedMessages } : c
    );
    
    setChats(updatedChats);
    localStorage.setItem('chats', JSON.stringify(updatedChats));
    setFeedbackModal({...feedbackModal, isOpen: false});
  };

  // Add this function to export chat with feedback
  const exportChatWithFeedback = () => {
    const chat = getActiveChat();
    if (!chat) return;
    
    // Prepare the data for export
    const exportData = {
      chatId: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      exportedAt: Date.now(),
      messages: chat.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        feedback: msg.feedback || null
      }))
    };
    
    // Create the blob and download link
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-feedback-${chat.id.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Option for CSV format export
  const exportChatAsCSV = () => {
    const chat = getActiveChat();
    if (!chat) return;
    
    // CSV headers
    let csvContent = "Message Role,Message Content,Feedback Rating,Feedback Comments,Feedback Timestamp\n";
    
    // Add each message as a row
    chat.messages.forEach(msg => {
      const role = msg.role;
      // Escape quotes in content
      const content = `"${msg.content.replace(/"/g, '""')}"`;
      const rating = msg.feedback?.rating || '';
      const comments = msg.feedback?.comments ? `"${msg.feedback.comments.replace(/"/g, '""')}"` : '';
      const timestamp = msg.feedback?.timestamp ? new Date(msg.feedback.timestamp).toISOString() : '';
      
      csvContent += `${role},${content},${rating},${comments},${timestamp}\n`;
    });
    
    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-feedback-${chat.id.slice(0, 8)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className="App">
      <div className="main-container">
        {/* Sidebar */}
        <div className={`chat-sidebar ${showSidebar ? 'open' : 'closed'}`}>
          {/* Title section */}
          <div className="sidebar-header">
            <h1 className="app-title">WE Write</h1>
          </div>

          {/* Chat list - WITHOUT the settings button */}
          <div className="chat-list">
            {chats.length === 0 ? (
              <div className="empty-chats">No chats yet</div>
            ) : (
              // Chat items mapping (keep this part as is)
              chats.map(chat => (
                <div 
                  key={chat.id} 
                  className={`chat-item ${chat.id === activeChatId ? 'active' : ''}`}
                  onClick={() => setActiveChatId(chat.id)}
                >
                  <div className="chat-item-title">{chat.title}</div>
                  <div className="chat-item-actions">
                    <button 
                      className="chat-rename-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        const newTitle = prompt('Rename chat:', chat.title);
                        if (newTitle && newTitle.trim()) {
                          renameChat(chat.id, newTitle.trim());
                        }
                      }}
                      title="Rename chat"
                    >
                      ✏️
                    </button>
                    <button 
                      className="chat-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('Are you sure you want to delete this chat?')) {
                          deleteChat(chat.id);
                        }
                      }}
                      title="Delete chat"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          {/* Settings button at bottom of sidebar */}
            <div className="settings-list-item" onClick={() => setActiveTab('settings')}>
              <div className="chat-item-title settings-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Settings</span>
              </div>
          </div>
        </div>
        {/* Main content */}
        <div className="main-content">
          {/* Update your chat container to work with the active chat */}
          {activeTab === 'chat' && (
            <div className="chat-container">
              <div className="chat-header">
  {/* Hamburger menu for mobile - Add onClick handler */}
  <button 
    className="mobile-menu-toggle header-action-btn" 
    onClick={() => setShowSidebar(!showSidebar)} 
    title="Toggle sidebar"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </button>
  
  {/* Chat title */}
  <h2>{activeChatId ? (chats.find(chat => chat.id === activeChatId)?.title || 'Untitled Chat') : 'New Chat'}</h2>
  
  <div className="chat-actions">
    {/* New chat button - Add onClick handler */}
    <button 
      className="new-chat-btn" 
      onClick={createNewChat} 
      title="Start a new chat"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 4V20M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span>New</span>
    </button>
    
    {/* Clear chat button */}
    {getActiveChat() && getActiveChat()!.messages.length > 0 && (
      <button 
        className="clear-button header-action-btn" 
        onClick={() => {
          if (window.confirm('Clear this chat history?')) {
            updateActiveChatMessages([]);
          }
        }}
        title="Clear chat"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 7L18.1327 19.1425C18.0579 20.1891 17.187 21 16.1378 21H7.86224C6.81296 21 5.94208 20.1891 5.86732 19.1425L5 7M10 11V17M14 11V17M15 7V4C15 3.44772 14.5523 3 14 3H10C9.44772 3 9 3.44772 9 4V7M4 7H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    )}
    
    {/* Export button */}
    {getActiveChat() && getActiveChat()!.messages.length > 0 && (
      <button 
        className="export-button header-action-btn" 
        onClick={exportChatWithFeedback} 
        title="Export chat as JSON"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15M17 8L12 3M12 3L7 8M12 3V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    )}
    {/* Add this to your chat actions div in the chat header */}
    <button 
      className="theme-toggle-btn header-action-btn"
      onClick={toggleDarkMode}
      title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {darkMode ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 2V4M12 20V22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M2 12H4M20 12H22M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  </div>
</div>

              <div className="chat-history">
                {!activeChatId ? (
                  <div className="empty-chat">
                    <p>Create a new chat to get started!</p>
                  </div>
                ) : getActiveChat()?.messages.length === 0 ? (
                  <div className="empty-chat">
                    <p>No messages yet. Start a conversation!</p>
                  </div>
                ) : (
                  getActiveChat()?.messages.map((msg, index) => (
                    <div key={index} className={`message ${msg.role}`}>
                      <div className="message-content">
                        {msg.role === 'assistant' ? (
                          <>
                            <div className="markdown-content">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                            
                            {/* Display thinking if available */}
                            {showThinking && msg.thinking && (
                              <div className="thinking-section">
                                {/* ...existing thinking section code... */}
                              </div>
                            )}
                            
                            {/* Add feedback buttons */}
                            <div className="message-feedback">
                              <button 
                                className={`feedback-btn ${msg.feedback?.rating === 'positive' ? 'active' : ''}`}
                                onClick={() => handleFeedback(index, 'positive')}
                                title="This response was helpful"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M7 22H4C3.46957 22 2.96086 21.7893 2.58579 21.4142C2.21071 21.0391 2 20.5304 2 20V13C2 12.4696 2.21071 11.9609 2.58579 11.5858C2.96086 11.2107 3.46957 11 4 11H7M14 9V5C14 4.20435 13.6839 3.44129 13.1213 2.87868C12.5587 2.31607 11.7956 2 11 2L7 11V22H18.28C18.7623 22.0055 19.2304 21.8364 19.5979 21.524C19.9654 21.2116 20.2077 20.7769 20.28 20.3L21.66 11.3C21.7035 11.0134 21.6842 10.7207 21.6033 10.4423C21.5225 10.1638 21.3821 9.90629 21.1919 9.68751C21.0016 9.46873 20.7661 9.29393 20.5016 9.17522C20.2371 9.0565 19.9499 8.99672 19.66 9H14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                              
                              <button 
                                className={`feedback-btn ${msg.feedback?.rating === 'negative' ? 'active' : ''}`}
                                onClick={() => handleFeedback(index, 'negative')}
                                title="This response could be improved"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M17 2H20C20.5304 2 21.0391 2.21071 21.4142 2.58579C21.7893 2.96086 22 3.46957 22 4V11C22 11.5304 21.7893 12.0391 21.4142 12.4142C21.0391 12.7893 20.5304 13 20 13H17M10 15V19C10 19.7956 10.3161 20.5587 10.8787 21.1213C11.4413 21.6839 12.2044 22 13 22L17 13V2H5.72C5.23768 1.99448 4.76965 2.16359 4.40209 2.47599C4.03452 2.78839 3.79221 3.22309 3.72 3.7L2.34 12.7C2.29647 12.9866 2.31583 13.2793 2.39666 13.5577C2.47749 13.8362 2.6179 14.0937 2.80814 14.3125C2.99839 14.5313 3.23393 14.7061 3.49843 14.8248C3.76294 14.9435 4.05014 15.0033 4.34 15H10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                              
                              {/* Rest of the feedback UI remains the same */}
                              {msg.feedback?.rating && !msg.feedback?.comments && (
                                <button 
                                  className="feedback-comment-btn"
                                  onClick={() => openFeedbackModal(index)}
                                  title="Add detailed feedback"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M7 8H17M7 12H11M3 20.2895V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7.96125C7.66178 17 7.3706 17.0949 7.13093 17.2713L4.26258 19.5634C3.90408 19.8534 3.89641 20.4016 3.94761 20.6905C3.96308 20.7619 4.02754 20.2498 3 20.2895Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </button>
                              )}
                              
                              {/* Show feedback comment if provided */}
                              {msg.feedback?.comments && (
                                <div className="feedback-comment" onClick={() => openFeedbackModal(index)}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M7 8H17M7 12H11M3 20.2895V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7.96125C7.66178 17 7.3706 17.0949 7.13093 17.2713L4.26258 19.5634C3.90408 19.8534 3.89641 20.4016 3.94761 20.6905C3.96308 20.7619 4.02754 20.2498 3 20.2895Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  <span>{msg.feedback.comments.length > 20 ? msg.feedback.comments.substring(0, 20) + '...' : msg.feedback.comments}</span>
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="message assistant loading">
                    <div className="message-content">
                      <div className="loading-indicator">
                        <div></div><div></div><div></div>
                      </div>
                    </div>
                  </div>
                )}
                {error && (
                  <div className="error-message">
                    <p>{error}</p>
                  </div>
                )}
              </div>
              
              <form onSubmit={handleSubmit} className="message-form">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={activeChatId ? "Enter your text here..." : "Create a chat to start"}
                  required
                  disabled={isLoading || !activeChatId}
                />
                {/* Add tooltip to the form submit button */}
                <button type="submit" disabled={isLoading || !activeChatId} title="Send message">
                  {isLoading ? 'Sending...' : 'Send'}
                </button>
              </form>
            </div>
          )}
          
          {/* Keep your existing settings panel */}
          {activeTab === 'settings' && (
            <div className="settings-panel">
              <button className="back-button" onClick={() => setActiveTab('chat')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Back to Chat
              </button>
              <h2>API Settings</h2>
              <h2>Azure API Settings</h2>
              <div className="form-group">
                <label>API Key</label>
                <input 
                  type="password" 
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Azure API key"
                />
              </div>
              <div className="form-group">
                <label>Deployment Name <span className="label-hint">(model deployment name)</span></label>
                <input 
                  type="text" 
                  value={endpointName} 
                  onChange={(e) => setEndpointName(e.target.value)}
                  placeholder="e.g., gpt-4o or your-deployment-name"
                />
              </div>
              <div className="form-group">
                <label>Endpoint URL <span className="label-hint">(from Azure portal)</span></label>
                <input 
                  type="text" 
                  value={endpoint} 
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="https://your-resource-name.openai.azure.com"
                />
                <div className="field-help">Format: https://your-resource-name.openai.azure.com</div>
              </div>
              <button className="save-button" onClick={handleSaveSettings}>Save Settings</button>
              
              <div className="guidelines-section">
                <div className="guidelines-header">
                  <h2>Writing Style Guidelines</h2>
                </div>
                
                <div className="guidelines-list">
                  {guidelines.length > 0 ? (
                    guidelines.map((guideline, index) => (
                      <div key={index} className="guideline-item">
                        <div>{guideline.name}</div>
                        <button onClick={() => removeGuideline(index)}>Remove</button>
                      </div>
                    ))
                  ) : (
                    <p>No guidelines added yet. Upload text files to use as reference for AI responses.</p>
                  )}
                </div>
                
                <div className="file-upload-container">
                  <input
                    type="file"
                    id="guideline-upload"
                    accept=".txt"
                    className="file-input"
                    onChange={handleFileChange}
                    multiple
                  />
                  <label htmlFor="guideline-upload" className="file-upload-label">Choose Files</label>
                  {selectedFiles && selectedFiles.length > 0 && (
                    <div className="selected-files">
                      <p>Selected {selectedFiles.length} file(s):</p>
                      <ul>
                        {Array.from(selectedFiles).map((file, index) => (
                          <li key={index}>{file.name}</li>
                        ))}
                      </ul>
                      <button onClick={handleFileUpload}>Upload Guidelines</button>
                    </div>
                  )}
                </div>
              </div>

              <div className="debug-section">
                <div className="debug-header" onClick={() => setShowDebug(!showDebug)}>
                  <h3>Troubleshooting</h3>
                  <span>{showDebug ? '▲' : '▼'}</span>
                </div>
                
                {showDebug && (
                  <div className="debug-content">
                    <p>If you're getting 405 errors, please verify:</p>
                    <ol>
                      <li>Your <strong>Endpoint URL</strong> should be in this format:<br/>
                      <code>https://your-resource-name.openai.azure.com</code><br/>
                      (without any trailing slashes)
                      </li>
                      <li>Your <strong>Deployment Name</strong> should match exactly what you created in Azure OpenAI Studio</li>
                      <li>Your <strong>API Key</strong> should be one of the keys shown in the Azure Portal for this resource</li>
                    </ol>
                    
                    <div className="test-connection">
                      <h4>Test Connection</h4>
                      <p>Current API URL that will be called:</p>
                      <code>{`${endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint}/openai/deployments/${endpointName}/chat/completions?api-version=2023-05-15`}</code>
                    </div>
                  </div>
                )}
              </div>

              {/* Add this inside your settings panel */}
              <div className="theme-section">
                <h2>Appearance</h2>
                <div className="form-group">
                  <label htmlFor="theme-toggle">Theme</label>
                  <div className="theme-toggle-wrapper">
                    <div className="toggle-switch">
                      <input
                        type="checkbox"
                        id="theme-toggle"
                        checked={darkMode}
                        onChange={toggleDarkMode}
                      />
                      <label htmlFor="theme-toggle" className="toggle-label">
                        <span className="toggle-inner"></span>
                        <span className="toggle-switch"></span>
                      </label>
                    </div>
                    <span className="toggle-text">{darkMode ? 'Dark' : 'Light'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add this feedback modal to your JSX */}
      {feedbackModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content feedback-modal">
            <h3>Provide Detailed Feedback</h3>
            <p>Your feedback helps improve the model responses.</p>
            
            <textarea
              value={feedbackModal.comment}
              onChange={(e) => setFeedbackModal({...feedbackModal, comment: e.target.value})}
              placeholder="What was helpful or unhelpful about this response? How could it be improved?"
              rows={5}
            ></textarea>
            
            <div className="modal-buttons">
              <button onClick={() => setFeedbackModal({...feedbackModal, isOpen: false})}>Cancel</button>
              <button onClick={saveFeedbackComment} className="primary-button">Save Feedback</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;