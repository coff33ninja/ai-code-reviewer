import { LanguageOption, AiSettings, AiProviderType, OpenAiModel, GroqModel, ModelOption } from './types';

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "typescript", label: "TypeScript" },
  { value: "csharp", label: "C#" },
  { value: "cpp", label: "C++" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "ruby", label: "Ruby" },
  { value: "php", label: "PHP" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "sql", label: "SQL" },
  { value: "kotlin", label: "Kotlin" },
  { value: "swift", label: "Swift" },
  { value: "markdown", label: "Markdown" },
  { value: "shell", label: "Shell Script (Bash/Sh/Zsh)" },
  { value: "powershell", label: "PowerShell" },
  { value: "batch", label: "Batch (CMD)" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "xml", label: "XML" },
  // Add more languages as needed
];

export const DEFAULT_LANGUAGE: string = "javascript";

export const FILE_EXTENSION_TO_LANGUAGE: { [key: string]: string } = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  java: 'java',
  cs: 'csharp',
  cpp: 'cpp',
  c: 'cpp',
  h: 'cpp',
  hpp: 'cpp',
  go: 'go',
  rb: 'ruby',
  php: 'php',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'css',
  sass: 'css',
  sql: 'sql',
  kt: 'kotlin',
  kts: 'kotlin',
  swift: 'swift',
  md: 'markdown',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  ps1: 'powershell',
  psm1: 'powershell',
  bat: 'batch',
  cmd: 'batch',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
};

// Constants for GitHub Repository Analysis
export const MAX_FILES_FOR_SEQUENTIAL_SCAN = 75; 
export const REPO_ANALYSIS_MAX_DEPTH = 2; 
export const COMMON_MANIFEST_FILES = [ 
    'package.json', 'requirements.txt', 'pom.xml', 'build.gradle', 
    'composer.json', 'gemfile', 'go.mod', 'cargo.toml', 'dockerfile', 
    'readme.md', 'readme.txt', '.gitignore'
];
export const MAX_INDIVIDUAL_FILE_SIZE_FOR_REPO_ANALYSIS = 50000; // 50KB

// AI Provider Settings
export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'gemini',
  apiKey: '', 
  // Generic Local OpenAI API
  localApiUrl: 'http://localhost:1234/v1', 
  localModelName: '',
  // OpenAI
  openAiModel: 'gpt-4o',
  // Groq
  groqModel: 'llama3-8b-8192',
  // Ollama
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModelName: '', // e.g., 'llama3:latest' or 'codellama:7b'
  // LM Studio
  lmStudioBaseUrl: 'http://localhost:1234/v1', // Default LM Studio port
  lmStudioModelName: '', // User needs to specify based on loaded model in LM Studio
  lmStudioApiKey: '', // Often not required or a placeholder like 'lm-studio'
};

export const AI_PROVIDER_OPTIONS: { value: AiProviderType; label: string }[] = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openai', label: 'OpenAI (GPT)' },
  { value: 'groq', label: 'Groq (Llama, etc.)' },
  { value: 'ollama', label: 'Ollama (Local)' },
  { value: 'lm_studio', label: 'LM Studio (Local)' },
  { value: 'local_openai_api', label: 'Other Local AI (OpenAI API)' },
];

export const OPENAI_MODELS: ModelOption[] = [
  { value: 'gpt-4o', label: 'GPT-4o (Latest)' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo Preview' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
];

export const GROQ_MODELS: ModelOption[] = [
  { value: 'llama3-70b-8192', label: 'LLaMA3 70b (8k)' },
  { value: 'llama3-8b-8192', label: 'LLaMA3 8b (8k)' },
  { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7b (32k)' },
  { value: 'gemma-7b-it', label: 'Gemma 7b IT (8k)' },
];