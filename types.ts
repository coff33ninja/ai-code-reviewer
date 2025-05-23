export type InputMode = 'paste' | 'github' | 'gcs' | 'drive';
export type AnalysisType = 'review' | 'insights' | 'sequential_file_analysis' | 'suggest_edits' | 'generate_code';

// Specific action types for individual files within sequential analysis
export type SequentialFileActionType = 'review' | 'insights' | 'suggest_edits';


export interface LanguageOption {
  value: string;
  label: string;
}

export interface GithubRepoFile {
  name: string;
  path: string; // relative path in the repo
  sha: string;
  type: 'file' | 'dir';
  download_url: string | null; 
  url: string; // API URL to get content (base64 encoded) for individual files
  content?: string; // base64 encoded content if fetched directly
  encoding?: 'base64';
  size?: number;
}

// Types for AI Provider Settings
export type AiProviderType = 'gemini' | 'openai' | 'groq' | 'local_openai_api' | 'ollama' | 'lm_studio';

export type OpenAiModel = 
  | 'gpt-4o'
  | 'gpt-4-turbo' 
  | 'gpt-4-turbo-preview' 
  | 'gpt-4' 
  | 'gpt-3.5-turbo';

export type GroqModel = 
  | 'llama3-8b-8192' 
  | 'llama3-70b-8192' 
  | 'mixtral-8x7b-32768' 
  | 'gemma-7b-it';

export interface ModelOption {
  value: string;
  label: string;
}

export interface AiSettings {
  provider: AiProviderType;
  apiKey: string; 
  // Generic Local OpenAI API
  localApiUrl: string; 
  localModelName: string;
  // OpenAI
  openAiModel: OpenAiModel;
  // Groq
  groqModel: GroqModel;
  // Ollama
  ollamaBaseUrl: string;
  ollamaModelName: string;
  // LM Studio
  lmStudioBaseUrl: string;
  lmStudioModelName: string;
  lmStudioApiKey: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  data?: any; // Optional data, e.g., list of models for OpenAI/Groq/Ollama
}