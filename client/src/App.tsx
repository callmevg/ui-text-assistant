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

  // Load settings from local storage on component mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('apiKey');
    const savedEndpoint = localStorage.getItem('endpoint');
    const savedEndpointName = localStorage.getItem('endpointName');
    const savedGuidelines = localStorage.getItem('guidelines');
    const savedChatHistory = localStorage.getItem('chatHistory');

    if (savedApiKey) setApiKey(savedApiKey);
    if (savedEndpoint) setEndpoint(savedEndpoint);
    if (savedEndpointName) setEndpointName(savedEndpointName);
    if (savedGuidelines) setGuidelines(JSON.parse(savedGuidelines));
    if (savedChatHistory) setChatHistory(JSON.parse(savedChatHistory));
  }, []);
  
  // Save chat history whenever it changes
  useEffect(() => {
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
  }, [chatHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if API settings are configured
    if (!apiKey || !endpoint || !endpointName) {
      setError('Please configure your Azure API settings in the Settings tab before sending messages.');
      setTimeout(() => setError(null), 5000);
      return;
    }
    
    // Add user message to chat history
    const newChatHistory = [...chatHistory, {role: 'user', content: message}];
    setChatHistory(newChatHistory);
    
    // Clear message input and set loading state
    setMessage('');
    setIsLoading(true);
    setError(null);
    
    try {
      // Prepare guidelines text
      const guidelinesText = guidelines.length > 0 
        ? guidelines.map(g => `${g.name}:\n${g.content}`).join('\n\n')
        : 'No specific guidelines provided.';
      
      // Prepare the conversation history in the format Azure OpenAI expects
      const messages = [
        {
          role: "system",
          content: `You are an AI assistant that helps generate and improve UI text. 
          Consider these writing style guidelines when creating your responses:
          
          ${guidelinesText}`
        },
        ...newChatHistory.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        }))
      ];
      
      // Properly format the endpoint URL - remove any trailing slashes
      let apiEndpoint = endpoint;
      if (apiEndpoint.endsWith('/')) {
        apiEndpoint = apiEndpoint.slice(0, -1);
      }
      
      // Construct the correct URL for Azure OpenAI
      const apiUrl = `${apiEndpoint}/openai/deployments/${endpointName}/chat/completions?api-version=2023-05-15`;
      
      console.log('API URL:', apiUrl); // Debug log
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey
        },
        body: JSON.stringify({
          messages: messages,
          max_tokens: 800,
          temperature: 0.7,
          top_p: 0.95,
          frequency_penalty: 0,
          presence_penalty: 0
        })
      });
      
      // Improved error handling
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(`${response.status}: ${errorData.error?.message || JSON.stringify(errorData)}`);
        } else {
          // Handle XML or text error responses
          const errorText = await response.text();
          throw new Error(`Server returned ${response.status}: ${errorText.substring(0, 200)}...`);
        }
      }
      
      const data = await response.json();
      const assistantReply = data.choices[0].message.content;
      
      // Add assistant's reply to chat history
      setChatHistory([...newChatHistory, {
        role: 'assistant',
        content: assistantReply
      }]);
      
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

  return (
    <div className="App">
      <header>
        <h1>UI Text Assistant</h1>
      </header>
      
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
        </div>
      )}
      
      {activeTab === 'chat' && (
        <div className="chat-container">
          <div className="chat-header">
            <h2>UI Text Assistant</h2>
            {chatHistory.length > 0 && (
              <button className="clear-button" onClick={clearChat}>
                Clear Chat
              </button>
            )}
          </div>
          <div className="chat-history">
            {chatHistory.length === 0 ? (
              <div className="empty-chat">
                <p>No messages yet. Start a conversation!</p>
              </div>
            ) : (
              chatHistory.map((msg, index) => (
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
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
