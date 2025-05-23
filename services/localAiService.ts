import { AnalysisType, TestConnectionResult } from '../types';
import { getReviewPromptContent, getInsightsPromptContent, getSuggestEditsPromptContent, getGenerateCodePromptContent, PromptContent } from './promptService';

interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LocalAIErrorResponse {
  error?: { // Error structure can vary greatly with local servers
    message: string;
    type?: string;
    code?: string | number;
  };
  message?: string; // Some servers might just return a message
  detail?: string; // FastAPI validation errors often use this
}

const callLocalAI = async (
  messages: ChatCompletionMessage[],
  baseUrl: string,
  modelName: string,
  apiKey?: string 
): Promise<string> => {
  if (!baseUrl) {
    throw new Error('Local AI API Base URL is not configured. Please set it in settings.');
  }
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  
  const body: any = {
    messages: messages,
    temperature: 0.3,
  };

  if (modelName) {
    body.model = modelName;
  }

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorData: LocalAIErrorResponse = {};
      try {
          errorData = await response.json();
      } catch (e) {
          throw new Error(`Local AI API request failed: HTTP error ${response.status}: ${response.statusText}. URL: ${endpoint}`);
      }
      console.error('Local AI API Error:', errorData);
      const readableError = errorData.error?.message || errorData.message || errorData.detail || `HTTP error ${response.status}: ${response.statusText}`;
      throw new Error(`Local AI API request failed: ${readableError}. URL: ${endpoint}, Model: ${modelName || 'default'}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    console.error(`Error in callLocalAI fetching from ${endpoint}:`, error);
    if (error instanceof TypeError && (error.message.toLowerCase().includes('failed to fetch') || error.message.toLowerCase().includes('networkerror'))) {
        throw new Error(`Network error calling Local AI at ${endpoint}. Ensure the server is running, accessible, and CORS is configured correctly. Original error: ${error.message}`);
    }
    if (error instanceof Error) throw error;
    throw new Error(`Unknown error calling Local AI at ${endpoint}.`);
  }
};


export const getAIFeedback = async (
  codeOrDescription: string,
  language: string,
  analysisType: AnalysisType,
  baseUrl: string,
  modelName: string,
  apiKey?: string
): Promise<string> => {
  let promptContent: PromptContent;

  switch (analysisType) {
    case 'insights':
      promptContent = getInsightsPromptContent(codeOrDescription, language);
      break;
    case 'suggest_edits':
      promptContent = getSuggestEditsPromptContent(codeOrDescription, language);
      break;
    case 'generate_code':
      promptContent = getGenerateCodePromptContent(codeOrDescription, language);
      break;
    case 'review':
    case 'sequential_file_analysis':
    default:
      promptContent = getReviewPromptContent(codeOrDescription, language);
      break;
  }

  const messages: ChatCompletionMessage[] = [
    { role: 'system', content: promptContent.system },
    { role: 'user', content: promptContent.user },
  ];

  return callLocalAI(messages, baseUrl, modelName, apiKey);
};


export const testConnection = async (baseUrl: string, modelName?: string, apiKey?: string): Promise<TestConnectionResult> => {
  if (!baseUrl) {
    return { success: false, message: 'Local AI API Base URL is not provided.' };
  }
  const modelsEndpoint = `${baseUrl.replace(/\/+$/, '')}/models`;
  try {
    const headers: HeadersInit = { 'Accept': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(modelsEndpoint, { headers });

    if (!response.ok) {
        let errorData: LocalAIErrorResponse = {};
        try {
            errorData = await response.json();
        } catch (e) {
             return { success: false, message: `Test failed: HTTP error ${response.status}: ${response.statusText} when fetching ${modelsEndpoint}. Ensure the server is running and URL is correct. Check CORS.` };
        }
        const readableError = errorData.error?.message || errorData.message || `HTTP error ${response.status}: ${response.statusText}`;
        return { success: false, message: `Test failed: Could not list models from ${modelsEndpoint}. ${readableError}` };
    }
    
    const modelsData = await response.json();
    const availableModels = modelsData.data?.map((m: any) => m.id || m.name).filter(Boolean) || [];

    let message = `Local AI connection to ${baseUrl} successful!`;
    if (availableModels.length > 0) {
        message += ` Found models: ${availableModels.slice(0,3).join(', ')}${availableModels.length > 3 ? '...' : ''}.`;
    } else {
        message += ` No specific models listed by server (via ${modelsEndpoint}), but endpoint is reachable.`;
    }
    
    if (modelName) {
        const messages: ChatCompletionMessage[] = [
            { role: 'system', content: 'You are a test assistant.' },
            { role: 'user', content: 'Test: Respond with OK.' },
        ];
        try {
            const chatResponseText = await callLocalAI(messages, baseUrl, modelName, apiKey);
            if (chatResponseText && chatResponseText.toLowerCase().includes('ok')) {
                message += ` Chat test with model "${modelName}" successful.`;
            } else {
                 message += ` Chat test with model "${modelName}" returned an unexpected response (or empty): ${chatResponseText || '(empty)'}. The model might be running but not responding as expected.`;
                 return { success: true, message, data: { availableModels, chatTestResponse: chatResponseText } };
            }
        } catch (chatError) {
             const chatErrorMessage = chatError instanceof Error ? chatError.message : String(chatError);
             message += ` Chat test with model "${modelName}" failed: ${chatErrorMessage}. Ensure model is loaded/correct.`;
             return { success: true, message, data: { availableModels, chatTestError: chatErrorMessage } };
        }
    }

    return { success: true, message, data: { availableModels }};

  } catch (error) {
    console.error(`Local AI connection test to ${baseUrl} failed:`, error);
    if (error instanceof TypeError && (error.message.toLowerCase().includes('failed to fetch') || error.message.toLowerCase().includes('networkerror'))) {
      return { success: false, message: `Test failed: Network error connecting to ${baseUrl}. Ensure the server is running, accessible, and CORS is configured correctly. Original error: ${error.message}` };
    }
    if (error instanceof Error) {
      return { success: false, message: `Test failed: ${error.message}. Ensure the local AI server is running and the Base URL is correct.` };
    }
    return { success: false, message: 'Test failed: An unknown error occurred with Local AI. Check server logs and Base URL.' };
  }
};