import { AnalysisType, TestConnectionResult } from '../types';
import { getReviewPromptContent, getInsightsPromptContent, getSuggestEditsPromptContent, getGenerateCodePromptContent, PromptContent } from './promptService';

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaChatCompletionRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  options?: Record<string, any>; // For temperature, etc.
}

interface OllamaChatCompletionResponse {
  model: string;
  created_at: string;
  message: {
    role: 'assistant';
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaErrorResponse {
  error: string;
}

interface OllamaTagsResponse {
    models: Array<{
        name: string;
        model: string;
        modified_at: string;
        size: number;
        digest: string;
        details: {
            parent_model: string;
            format: string;
            family: string;
            families: string[] | null;
            parameter_size: string;
            quantization_level: string;
        }
    }>;
}


const callOllamaAPI = async (
  requestBody: OllamaChatCompletionRequest,
  baseUrl: string,
): Promise<string> => {
  if (!baseUrl) {
    throw new Error('Ollama Base URL is not configured. Please set it in settings.');
  }
   if (!requestBody.model) {
    throw new Error('Ollama Model Name is not configured. Please set it in settings.');
  }

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/api/chat`;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...requestBody, stream: false, options: { temperature: 0.3, ...requestBody.options } }),
    });

    if (!response.ok) {
      let errorData: OllamaErrorResponse | { detail?: string } = { error: `HTTP error ${response.status}: ${response.statusText}`};
      try {
        errorData = await response.json();
      } catch (e) {
        // Keep default error if JSON parsing fails
      }
      console.error('Ollama API Error:', errorData);
      const readableError = (errorData as OllamaErrorResponse).error || (errorData as {detail?:string}).detail || `HTTP error ${response.status}: ${response.statusText}`;
      if (readableError.includes("model not found") || readableError.includes("not found")) {
          throw new Error(`Ollama API request failed: Model '${requestBody.model}' not found. Ensure it's pulled or exists at ${baseUrl}. ${readableError}`);
      }
      throw new Error(`Ollama API request failed: ${readableError}. URL: ${endpoint}, Model: ${requestBody.model}`);
    }

    const data: OllamaChatCompletionResponse = await response.json();
    return data.message?.content || '';
  } catch (error) {
    console.error(`Error in callOllamaAPI fetching from ${endpoint}:`, error);
    if (error instanceof TypeError && (error.message.toLowerCase().includes('failed to fetch') || error.message.toLowerCase().includes('networkerror'))) {
        throw new Error(`Network error calling Ollama at ${endpoint}. Ensure the server is running, accessible, and CORS is configured correctly (e.g., OLLAMA_ORIGINS). Original error: ${error.message}`);
    }
    if (error instanceof Error) throw error;
    throw new Error(`Unknown error calling Ollama at ${endpoint}.`);
  }
};

export const getAIFeedback = async (
  codeOrDescription: string,
  language: string,
  analysisType: AnalysisType,
  baseUrl: string,
  modelName: string,
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

  const messages: OllamaMessage[] = [
    { role: 'system', content: promptContent.system },
    { role: 'user', content: promptContent.user },
  ];

  const requestBody: OllamaChatCompletionRequest = {
    model: modelName,
    messages: messages,
  };

  return callOllamaAPI(requestBody, baseUrl);
};

export const listModels = async (baseUrl: string): Promise<string[]> => {
    if (!baseUrl) {
        throw new Error('Ollama Base URL is not provided to list models.');
    }
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/api/tags`;
    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            let errorMsg = `Failed to fetch models from Ollama at ${endpoint}: ${response.status} ${response.statusText}`;
            try {
                const errorData: OllamaErrorResponse | { detail?: string } = await response.json();
                errorMsg += ` - ${(errorData as OllamaErrorResponse).error || (errorData as {detail?: string}).detail || ''}`;
            } catch(e) { /* ignore json parsing error */ }
            throw new Error(errorMsg);
        }
        const data: OllamaTagsResponse = await response.json();
        return data.models.map(m => m.name).sort();
    } catch (error) {
        console.error(`Error in listModels fetching from ${endpoint}:`, error);
        if (error instanceof TypeError && (error.message.toLowerCase().includes('failed to fetch') || error.message.toLowerCase().includes('networkerror'))) {
            throw new Error(`Network error listing Ollama models from ${endpoint}. Ensure the server is running, accessible, and CORS is configured correctly. Original error: ${error.message}`);
        }
        if (error instanceof Error) throw error;
        throw new Error(`Unknown error listing Ollama models from ${endpoint}.`);
    }
};


export const testConnection = async (baseUrl: string, modelName?: string): Promise<TestConnectionResult> => {
  if (!baseUrl) {
    return { success: false, message: 'Ollama Base URL is not provided.' };
  }
  try {
    let availableModels: string[] = [];
    try {
        availableModels = await listModels(baseUrl);
    } catch (listError) {
        console.error('Ollama listModels failed during testConnection:', listError);
        const errorMessage = listError instanceof Error ? listError.message : String(listError);
        // Check if the error message already contains network error specific advice
        if (errorMessage.toLowerCase().includes('network error') || errorMessage.toLowerCase().includes('failed to fetch')) {
             return { success: false, message: `Test failed: Could not list models. ${errorMessage}` };
        }
        return { success: false, message: `Test failed: Could not connect to Ollama or list models at ${baseUrl}. Ensure Ollama is running. Error: ${errorMessage}` };
    }
    
    let message = `Ollama connection to ${baseUrl} successful!`;
    if (availableModels.length > 0) {
        message += ` Found models: ${availableModels.slice(0,3).join(', ')}${availableModels.length > 3 ? '...' : ''}.`;
    } else {
        message += ` No models found. Make sure you have pulled models (e.g., 'ollama pull llama3').`;
    }

    if (modelName) {
        const messages: OllamaMessage[] = [
            { role: 'system', content: 'You are a test assistant.' },
            { role: 'user', content: 'Test: Respond with OK.' },
        ];
        const requestBody: OllamaChatCompletionRequest = {
            model: modelName,
            messages: messages,
        };
        try {
            const chatResponseText = await callOllamaAPI(requestBody, baseUrl);
            if (chatResponseText && chatResponseText.toLowerCase().includes('ok')) {
                message += ` Chat test with model "${modelName}" successful.`;
            } else {
                 message += ` Chat test with model "${modelName}" returned an unexpected response: ${chatResponseText || '(empty)'}. The model might be running but not responding as expected.`;
                 return { success: true, message, data: { availableModels, chatTestResponse: chatResponseText } };
            }
        } catch (chatError) {
             const chatErrorMessage = chatError instanceof Error ? chatError.message : String(chatError);
             message += ` Chat test with model "${modelName}" failed: ${chatErrorMessage}. Ensure model is valid and loaded.`;
             return { success: true, message, data: { availableModels, chatTestError: chatErrorMessage } };
        }
    }
    return { success: true, message, data: { availableModels }};

  } catch (error) { 
    console.error('Ollama connection test failed (outer catch):', error);
    if (error instanceof TypeError && (error.message.toLowerCase().includes('failed to fetch') || error.message.toLowerCase().includes('networkerror'))) {
        return { success: false, message: `Test failed: Network error connecting to Ollama at ${baseUrl}. Ensure Ollama is running, accessible, and CORS is configured. Original error: ${error.message}` };
    }
    if (error instanceof Error) {
      return { success: false, message: `Test failed: ${error.message}. Ensure Ollama server is running and the Base URL is correct.` };
    }
    return { success: false, message: 'Test failed: An unknown error occurred with Ollama. Check server logs and Base URL.' };
  }
};