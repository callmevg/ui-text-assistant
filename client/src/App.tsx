import React, { useState, useEffect } from 'react';
import './App.css';

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
  const [chatHistory, setChatHistory] = useState<Array<{role: string, content: string}>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('chat');

  // Debug state
  const [showDebug, setShowDebug] = useState(false);

  // New states for managing multiple chats and sidebar visibility
  const [chats, setChats] = useState<Array<{
    id: string;
    title: string;
    messages: Array<{role: string, content: string}>;
    createdAt: number;
  }>>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);

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
  
  // Save chat history whenever it changes
  useEffect(() => {
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
  }, [chatHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if there's an active chat
    if (!activeChatId) {
      createNewChat();
      return;
    }
    
    // Check if API settings are configured
    if (!apiKey || !endpoint || !endpointName) {
      setError('Please configure your Azure API settings in the Settings tab before sending messages.');
      setTimeout(() => setError(null), 5000);
      return;
    }
    
    const activeChat = getActiveChat();
    if (!activeChat) return;
    
    // Add user message to chat history
    const newMessages = [...activeChat.messages, {role: 'user', content: message}];
    updateActiveChatMessages(newMessages);
    
    // Clear message input and set loading state
    setMessage('');
    setIsLoading(true);
    setError(null);
    
    try {
      // Prepare guidelines text
      const guidelinesText = guidelines.length > 0 
        ? guidelines.map(g => `${g.name}:\n${g.content}`).join('\n\n')
        : 'No specific guidelines provided.';
      
      // Prepare the conversation history
      const messages = [
        {
          role: "system",
          content: `You are an AI assistant that helps generate and improve UI text. 
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
      
      // Call the API (rest of your existing API call code)
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
      const updatedMessages = [...newMessages, {
        role: 'assistant',
        content: assistantReply
      }];
      
      // Update the active chat with the new messages
      updateActiveChatMessages(updatedMessages);
      
      // Update chat title if it's the default title and this is the first message
      if (activeChat.title.startsWith('Chat ') && activeChat.messages.length === 0) {
        // Use the first few words of the user's message as the title
        const defaultTitle = message.split(' ').slice(0, 3).join(' ') + '...';
        renameChat(activeChatId, defaultTitle);
      }
      
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
      title: `Chat ${chats.length + 1}`,
      messages: [],
      createdAt: Date.now()
    };
    
    const updatedChats = [...chats, newChat];
    setChats(updatedChats);
    setActiveChatId(newChat.id);
    setMessage('');
    
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

  return (
    <div className="App">
      <header>
        <button className="sidebar-toggle" onClick={() => setShowSidebar(!showSidebar)}>
          {showSidebar ? '◀' : '▶'}
        </button>
        <h1>UI Text Assistant</h1>
      </header>

      <div className="main-container">
        {/* Sidebar */}
        <div className={`chat-sidebar ${showSidebar ? 'open' : 'closed'}`}>
          <div className="sidebar-header">
            <h2>Your Chats</h2>
            <button className="new-chat-btn" onClick={createNewChat}>
              + New Chat
            </button>
          </div>
          
          <div className="chat-list">
            {chats.length === 0 ? (
              <div className="empty-chats">No chats yet</div>
            ) : (
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
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="main-content">
          {/* Your existing tab navigation */}
          <div className="tab-navigation">
            <button 
              className={activeTab === 'chat' ? 'active' : ''} 
              onClick={() => setActiveTab('chat')}
            >
              Chat
            </button>
            <button 
              className={activeTab === 'settings' ? 'active' : ''} 
              onClick={() => setActiveTab('settings')}
            >
              API Settings
            </button>
          </div>
          
          {/* Update your chat container to work with the active chat */}
          {activeTab === 'chat' && (
            <div className="chat-container">
              <div className="chat-header">
                <h2>{getActiveChat()?.title || 'New Chat'}</h2>
                {getActiveChat() && getActiveChat()!.messages.length > 0 && (
                  <button className="clear-button" onClick={() => {
                    if (window.confirm('Clear this chat history?')) {
                      updateActiveChatMessages([]);
                    }
                  }}>
                    Clear Chat
                  </button>
                )}
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
                      <div className="message-content">{msg.content}</div>
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
                  placeholder="Enter your text here..."
                  required
                  disabled={isLoading || !activeChatId}
                />
                <button type="submit" disabled={isLoading || !activeChatId}>
                  {isLoading ? 'Sending...' : 'Send'}
                </button>
              </form>
            </div>
          )}
          
          {/* Keep your existing settings panel */}
          {activeTab === 'settings' && (
            <div className="settings-panel">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;