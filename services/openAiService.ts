import { AnalysisType, TestConnectionResult, OpenAiModel } from '../types';
import { getReviewPromptContent, getInsightsPromptContent, getSuggestEditsPromptContent, getGenerateCodePromptContent, PromptContent } from './promptService';

const OPENAI_API_BASE_URL = 'https://api.openai.com/v1';

interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
    param: string | null;
    code: string | null;
  };
}

const callOpenAI = async (
  messages: ChatCompletionMessage[],
  apiKey: string,
  model: OpenAiModel
): Promise<string> => {
  if (!apiKey) {
    throw new Error('OpenAI API Key is not configured. Please set it in settings.');
  }

  const response = await fetch(`${OPENAI_API_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0.3, // Lower temperature for more deterministic code-related tasks
    }),
  });

  if (!response.ok) {
    const errorData: OpenAIErrorResponse = await response.json();
    console.error('OpenAI API Error:', errorData);
    const readableError = errorData.error?.message || `HTTP error ${response.status}: ${response.statusText}`;
    if (response.status === 401) {
        throw new Error(`OpenAI API request failed: Invalid API Key. ${readableError}`);
    }
    if (response.status === 429) {
        throw new Error(`OpenAI API request failed: Rate limit exceeded or quota issues. ${readableError}`);
    }
    throw new Error(`OpenAI API request failed: ${readableError}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
};

export const getAIFeedback = async (
  codeOrDescription: string,
  language: string,
  analysisType: AnalysisType,
  apiKey: string,
  model: OpenAiModel
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

  return callOpenAI(messages, apiKey, model);
};

export const testConnection = async (apiKey: string, model: OpenAiModel): Promise<TestConnectionResult> => {
  if (!apiKey) {
    return { success: false, message: 'OpenAI API Key is not provided.' };
  }
  try {
    // A more robust test is to list models, but a simple chat completion can also work
    // For simplicity and to also check model access for the selected model:
    const messages: ChatCompletionMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Test: Respond with OK.' },
    ];
    const responseText = await callOpenAI(messages, apiKey, model);

    if (responseText && responseText.toLowerCase().includes('ok')) {
        return { success: true, message: `OpenAI connection successful with ${model}!` };
    } else {
        return { success: false, message: `OpenAI connection test with ${model} failed: Unexpected response.`, data: responseText };
    }

  } catch (error) {
    console.error('OpenAI connection test failed:', error);
    if (error instanceof Error) {
      return { success: false, message: `Test failed: ${error.message}` };
    }
    return { success: false, message: 'Test failed: An unknown error occurred with OpenAI.' };
  }
};