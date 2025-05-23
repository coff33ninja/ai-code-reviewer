import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AnalysisType, TestConnectionResult } from '../types'; 
import { getReviewPromptContent, getInsightsPromptContent, getSuggestEditsPromptContent, getGenerateCodePromptContent, PromptContent } from './promptService';

// API_KEY from process.env is the primary source, especially in a deployed environment.
const ENV_API_KEY = process.env.API_KEY;

// Model name can be constant for this service
const GEMINI_MODEL_NAME = 'gemini-2.5-flash-preview-04-17';

// Function to get the AI client, potentially configured with a user's key
const getAiClient = (userApiKey?: string): GoogleGenAI => {
  const apiKeyToUse = userApiKey || ENV_API_KEY;
  if (!apiKeyToUse) {
    throw new Error("Gemini API Key is not configured. Please set it in settings or ensure the API_KEY environment variable is available.");
  }
  return new GoogleGenAI({ apiKey: apiKeyToUse });
};

export const getAIFeedback = async (
    codeOrDescription: string, // Can be code or description for generation
    language: string, // Can be language of code or target language for generation
    analysisType: AnalysisType,
    apiKey?: string // Optional API key from settings
  ): Promise<string> => {
  
  let ai: GoogleGenAI;
  try {
    ai = getAiClient(apiKey); 
  } catch (initError) {
    if (initError instanceof Error) throw initError; 
    throw new Error("Failed to initialize Gemini AI client.");
  }

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
  
  // For Gemini, we typically combine system and user prompts into a single prompt string.
  const fullPrompt = `${promptContent.system}\n\n${promptContent.user}`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME,
      contents: fullPrompt,
    });
    
    const feedbackText = response.text;
    if (feedbackText === undefined || feedbackText === null) {
      return ""; 
    }
    return feedbackText;
  } catch (error) {
    console.error('Gemini API request failed:', error);
    if (error instanceof Error) {
        if (error.message.includes('API key not valid')) {
            throw new Error('The provided Gemini API Key is not valid. Please check your configuration in Settings.');
        }
         if (error.message.includes('quota')) {
            throw new Error('You have exceeded your Gemini API quota. Please check your usage limits.');
        }
         if (error.message.includes('Access to model') && error.message.includes('denied')) {
            throw new Error('Access to the Gemini model was denied. This might be an issue with the API key or permissions.');
         }
    }
    throw new Error(`Failed to get ${analysisType.replace('_', ' ')} from AI (Gemini). The model may be unavailable or an issue occurred.`);
  }
};

export const testConnection = async (apiKey?: string): Promise<TestConnectionResult> => {
  let ai: GoogleGenAI;
  try {
    ai = getAiClient(apiKey);
  } catch (initError) {
    if (initError instanceof Error) return { success: false, message: `Initialization failed: ${initError.message}` };
    return { success: false, message: "Failed to initialize Gemini AI client for test." };
  }

  try {
    // Using a very short, simple prompt to test connectivity and API key validity.
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME,
      contents: "Test: Respond with OK if you are working.",
       config: { thinkingConfig: { thinkingBudget: 0 } } // Disable thinking for a faster, cheaper test
    });

    if (response.text && response.text.toLowerCase().includes('ok')) {
      return { success: true, message: "Gemini connection successful!" };
    } else {
      return { success: false, message: "Gemini connection test failed: Unexpected response from model." , data: response.text};
    }
  } catch (error) {
    console.error('Gemini connection test failed:', error);
    if (error instanceof Error) {
      if (error.message.includes('API key not valid')) {
        return { success: false, message: 'Test failed: The Gemini API Key is not valid.' };
      }
      if (error.message.includes('quota')) {
        return { success: false, message: 'Test failed: Gemini API quota exceeded.' };
      }
      return { success: false, message: `Test failed: ${error.message}` };
    }
    return { success: false, message: "Test failed: An unknown error occurred with Gemini." };
  }
};