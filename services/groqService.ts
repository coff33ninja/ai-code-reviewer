import { AnalysisType, TestConnectionResult, GroqModel } from '../types';
import { getReviewPromptContent, getInsightsPromptContent, getSuggestEditsPromptContent, getGenerateCodePromptContent, PromptContent } from './promptService';

const GROQ_API_BASE_URL = 'https://api.groq.com/openai/v1'; // Groq uses an OpenAI-compatible API

interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqErrorResponse {
  error: {
    message: string;
    type: string;
    param: string | null;
    code: string | null;
  };
}


const callGroqAPI = async (
  messages: ChatCompletionMessage[],
  apiKey: string,
  model: GroqModel
): Promise<string> => {
  if (!apiKey) {
    throw new Error('Groq API Key is not configured. Please set it in settings.');
  }

  const response = await fetch(`${GROQ_API_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0.2, // Groq is fast, lower temp for consistency
    }),
  });

  if (!response.ok) {
    const errorData: GroqErrorResponse = await response.json();
    console.error('Groq API Error:', errorData);
    const readableError = errorData.error?.message || `HTTP error ${response.status}: ${response.statusText}`;
     if (response.status === 401) {
        throw new Error(`Groq API request failed: Invalid API Key. ${readableError}`);
    }
    if (response.status === 429) {
        throw new Error(`Groq API request failed: Rate limit exceeded or quota issues. ${readableError}`);
    }
    if (response.status === 400 && readableError.includes("model_not_found")) {
         throw new Error(`Groq API request failed: Model "${model}" not found or not available with your key. ${readableError}`);
    }
    throw new Error(`Groq API request failed: ${readableError}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
};


export const getAIFeedback = async (
  codeOrDescription: string,
  language: string,
  analysisType: AnalysisType,
  apiKey: string,
  model: GroqModel
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

  return callGroqAPI(messages, apiKey, model);
};

export const testConnection = async (apiKey: string, model: GroqModel): Promise<TestConnectionResult> => {
   if (!apiKey) {
    return { success: false, message: 'Groq API Key is not provided.' };
  }
  try {
    // Test by trying to list models or a very simple chat completion
    // Listing models is `GET /v1/models`
    const response = await fetch(`${GROQ_API_BASE_URL}/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!response.ok) {
        const errorData: GroqErrorResponse = await response.json().catch(() => ({ error: { message: "Unknown error structure" }}));
        const readableError = errorData.error?.message || `HTTP error ${response.status}: ${response.statusText}`;
        if (response.status === 401) return { success: false, message: `Test failed: Invalid Groq API Key. ${readableError}` };
        return { success: false, message: `Test failed to list models: ${readableError}` };
    }
    
    const modelsData = await response.json();
    const availableModels = modelsData.data?.map((m: any) => m.id) || [];
    
    // Additionally, try a very small chat completion with the selected model to ensure it works
    const messages: ChatCompletionMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Test: Respond with OK.' },
    ];
    const chatResponseText = await callGroqAPI(messages, apiKey, model);

    if (chatResponseText && chatResponseText.toLowerCase().includes('ok')) {
         return { success: true, message: `Groq connection successful with ${model}! Available models include: ${availableModels.slice(0,3).join(', ')}...` , data: { availableModels }};
    } else {
        return { success: false, message: `Groq connection test with ${model} failed: Unexpected chat response.`, data: chatResponseText };
    }

  } catch (error) {
    console.error('Groq connection test failed:', error);
     if (error instanceof Error) {
      return { success: false, message: `Test failed: ${error.message}` };
    }
    return { success: false, message: 'Test failed: An unknown error occurred with Groq.' };
  }
};