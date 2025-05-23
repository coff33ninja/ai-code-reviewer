import { AiSettings } from '../types';
import { DEFAULT_AI_SETTINGS } from '../constants';

const AI_SETTINGS_STORAGE_KEY = 'geminiCodeReviewer_aiSettings';

export const saveAiSettings = (settings: AiSettings): void => {
  try {
    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Error saving AI settings to localStorage:", error);
  }
};

export const loadAiSettings = (): AiSettings | null => {
  try {
    const storedSettings = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (storedSettings) {
      const parsedSettings = JSON.parse(storedSettings) as Partial<AiSettings>;
      // Ensure all fields are present, falling back to defaults if some are missing
      // This handles cases where the stored settings object might be from an older version
      return {
        provider: parsedSettings.provider || DEFAULT_AI_SETTINGS.provider,
        apiKey: parsedSettings.apiKey || DEFAULT_AI_SETTINGS.apiKey,
        // Generic Local OpenAI API
        localApiUrl: parsedSettings.localApiUrl || DEFAULT_AI_SETTINGS.localApiUrl,
        localModelName: parsedSettings.localModelName || DEFAULT_AI_SETTINGS.localModelName,
        // OpenAI
        openAiModel: parsedSettings.openAiModel || DEFAULT_AI_SETTINGS.openAiModel,
        // Groq
        groqModel: parsedSettings.groqModel || DEFAULT_AI_SETTINGS.groqModel,
        // Ollama
        ollamaBaseUrl: parsedSettings.ollamaBaseUrl || DEFAULT_AI_SETTINGS.ollamaBaseUrl,
        ollamaModelName: parsedSettings.ollamaModelName || DEFAULT_AI_SETTINGS.ollamaModelName,
        // LM Studio
        lmStudioBaseUrl: parsedSettings.lmStudioBaseUrl || DEFAULT_AI_SETTINGS.lmStudioBaseUrl,
        lmStudioModelName: parsedSettings.lmStudioModelName || DEFAULT_AI_SETTINGS.lmStudioModelName,
        lmStudioApiKey: parsedSettings.lmStudioApiKey || DEFAULT_AI_SETTINGS.lmStudioApiKey,
      };
    }
    return null; // Returns null if no settings found, App.tsx will use DEFAULT_AI_SETTINGS
  } catch (error) {
    console.error("Error loading AI settings from localStorage:", error);
    return null; // Fallback to default if parsing fails
  }
};