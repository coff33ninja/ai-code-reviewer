import React, { useState, useEffect, useCallback } from 'react';
import { AiSettings, AiProviderType, ModelOption, TestConnectionResult, OpenAiModel, GroqModel } from '../types';
import { LoadingSpinner } from './LoadingSpinner'; 
import * as ollamaService from '../services/ollamaService'; // Import ollamaService

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: AiSettings;
  onSave: (settings: AiSettings) => void;
  providerOptions: { value: AiProviderType; label: string }[];
  openAiModels: ModelOption[];
  groqModels: ModelOption[];
  onTestConnection: (settingsToTest: AiSettings) => Promise<TestConnectionResult>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, 
    onClose, 
    currentSettings, 
    onSave, 
    providerOptions,
    openAiModels,
    groqModels,
    onTestConnection
}) => {
  const [settings, setSettings] = useState<AiSettings>(currentSettings);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [ollamaModels, setOllamaModels] = useState<ModelOption[]>([]);
  const [isFetchingOllamaModels, setIsFetchingOllamaModels] = useState(false);

  useEffect(() => {
    setSettings(currentSettings);
    setTestResult(null); 
    setOllamaModels([]); // Clear Ollama models when modal reopens or settings change significantly
  }, [currentSettings, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
    setTestResult(null); 
  };

  const handleSave = () => {
    onSave(settings);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await onTestConnection(settings);
      setTestResult(result);
      if (settings.provider === 'ollama' && result.success && result.data?.availableModels) {
        setOllamaModels(result.data.availableModels.map((m: string) => ({ value: m, label: m })));
      }
    } catch (error) {
      setTestResult({ success: false, message: `Test error: ${error instanceof Error ? error.message : 'Unknown error'}`});
    } finally {
      setIsTesting(false);
    }
  };

  const handleFetchOllamaModels = useCallback(async () => {
    if (settings.provider !== 'ollama' || !settings.ollamaBaseUrl) {
      setTestResult({ success: false, message: "Ollama Base URL is not set." });
      return;
    }
    setIsFetchingOllamaModels(true);
    setTestResult(null);
    try {
      const models = await ollamaService.listModels(settings.ollamaBaseUrl);
      setOllamaModels(models.map(m => ({ value: m, label: m })));
      if (models.length > 0) {
        setTestResult({ success: true, message: `Fetched ${models.length} Ollama models.` });
        // Optionally auto-select the first model if current ollamaModelName is empty
        if (!settings.ollamaModelName && models.length > 0) {
          setSettings(prev => ({ ...prev, ollamaModelName: models[0] }));
        }
      } else {
        setTestResult({ success: true, message: "Successfully connected to Ollama, but no models found. Make sure you have pulled models (e.g., `ollama pull llama3`)." });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.toLowerCase().includes('network error') || errorMessage.toLowerCase().includes('failed to fetch')) {
         setTestResult({ success: false, message: `Failed to fetch Ollama models: Network error. Ensure Ollama is running at ${settings.ollamaBaseUrl} and accessible. Check CORS (OLLAMA_ORIGINS). Original: ${errorMessage}` });
      } else {
        setTestResult({ success: false, message: `Failed to fetch Ollama models: ${errorMessage}` });
      }
      setOllamaModels([]);
    } finally {
      setIsFetchingOllamaModels(false);
    }
  }, [settings.provider, settings.ollamaBaseUrl, settings.ollamaModelName]);


  const renderProviderSpecificFields = () => {
    switch (settings.provider) {
      case 'gemini':
        return (
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-accent-light mb-1">
              API Key for Gemini:
            </label>
            <input
              type="password"
              id="apiKey"
              name="apiKey"
              value={settings.apiKey}
              onChange={handleInputChange}
              className="w-full p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action outline-none text-accent"
              placeholder={process.env.API_KEY ? "Using environment variable" : "Enter API Key"}
            />
            {!settings.apiKey && !process.env.API_KEY && (
              <p className="text-xs text-danger-light mt-1">Gemini API Key required if not set in environment.</p>
            )}
             {process.env.API_KEY && (
              <p className="text-xs text-secondary-light mt-1">Note: An API_KEY environment variable is set and will be prioritized if the field above is left blank for Gemini.</p>
            )}
          </div>
        );
      case 'openai':
        return (
          <>
            <div>
              <label htmlFor="apiKeyOpenAI" className="block text-sm font-medium text-accent-light mb-1">
                API Key for OpenAI:
              </label>
              <input
                type="password"
                id="apiKeyOpenAI"
                name="apiKey"
                value={settings.apiKey}
                onChange={handleInputChange}
                className="w-full p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action outline-none text-accent"
                placeholder="Enter OpenAI API Key"
              />
            </div>
            <div>
              <label htmlFor="openAiModel" className="block text-sm font-medium text-accent-light mt-3 mb-1">
                OpenAI Model:
              </label>
              <select
                id="openAiModel"
                name="openAiModel"
                value={settings.openAiModel}
                onChange={handleInputChange}
                className="w-full p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action outline-none text-accent"
              >
                {openAiModels.map(model => (
                  <option key={model.value} value={model.value} className="bg-primary text-accent">{model.label}</option>
                ))}
              </select>
            </div>
          </>
        );
      case 'groq':
        return (
          <>
            <div>
              <label htmlFor="apiKeyGroq" className="block text-sm font-medium text-accent-light mb-1">
                API Key for Groq:
              </label>
              <input
                type="password"
                id="apiKeyGroq"
                name="apiKey"
                value={settings.apiKey}
                onChange={handleInputChange}
                className="w-full p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action outline-none text-accent"
                placeholder="Enter Groq API Key"
              />
            </div>
             <div>
              <label htmlFor="groqModel" className="block text-sm font-medium text-accent-light mt-3 mb-1">
                Groq Model:
              </label>
              <select
                id="groqModel"
                name="groqModel"
                value={settings.groqModel}
                onChange={handleInputChange}
                className="w-full p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action outline-none text-accent"
              >
                {groqModels.map(model => (
                  <option key={model.value} value={model.value} className="bg-primary text-accent">{model.label}</option>
                ))}
              </select>
            </div>
          </>
        );
      case 'ollama':
        return (
          <>
            <div>
              <label htmlFor="ollamaBaseUrl" className="block text-sm font-medium text-accent-light mb-1">
                Ollama Base URL:
              </label>
              <input
                type="url"
                id="ollamaBaseUrl"
                name="ollamaBaseUrl"
                value={settings.ollamaBaseUrl}
                onChange={handleInputChange}
                className="w-full p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action outline-none text-accent"
                placeholder="http://localhost:11434"
              />
            </div>
            <div className="mt-3">
                <label htmlFor="ollamaModelName" className="block text-sm font-medium text-accent-light mb-1">
                    Ollama Model Name (e.g., llama3, codellama:7b):
                </label>
                <div className="flex space-x-2 items-end">
                    <input
                        type="text"
                        id="ollamaModelNameInput"
                        name="ollamaModelName"
                        value={settings.ollamaModelName}
                        onChange={handleInputChange}
                        className="flex-grow p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action outline-none text-accent"
                        placeholder="Enter model name or select"
                    />
                    <button 
                        onClick={handleFetchOllamaModels}
                        disabled={isFetchingOllamaModels || !settings.ollamaBaseUrl.trim()}
                        className="p-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg disabled:opacity-50 text-sm flex items-center"
                        type="button"
                    >
                        {isFetchingOllamaModels && <LoadingSpinner size="sm" className="mr-1"/>} Fetch Models
                    </button>
                </div>
            </div>
            {ollamaModels.length > 0 && (
                 <div className="mt-3">
                    <label htmlFor="ollamaModelSelect" className="block text-sm font-medium text-accent-light mb-1">
                        Select from Fetched Ollama Models:
                    </label>
                    <select
                        id="ollamaModelSelect"
                        name="ollamaModelName" // This should also update ollamaModelName
                        value={settings.ollamaModelName}
                        onChange={handleInputChange}
                        className="w-full p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action outline-none text-accent"
                    >
                        <option value="">-- Select a model --</option>
                        {ollamaModels.map(model => (
                            <option key={model.value} value={model.value} className="bg-primary text-accent">{model.label}</option>
                        ))}
                    </select>
                </div>
            )}
             <p className="text-xs text-secondary-light mt-1">Ensure the Ollama server is running and accessible from your browser. You may need to configure Ollama's CORS policy (e.g., set `OLLAMA_ORIGINS=*` or similar environment variable for Ollama). Make sure the model is pulled (e.g., `ollama pull llama3`).</p>
          </>
        );
      case 'lm_studio':
        return (
          <>
            <div>
              <label htmlFor="lmStudioBaseUrl" className="block text-sm font-medium text-accent-light mb-1">
                LM Studio Base URL:
              </label>
              <input
                type="url"
                id="lmStudioBaseUrl"
                name="lmStudioBaseUrl"
                value={settings.lmStudioBaseUrl}
                onChange={handleInputChange}
                className="w-full p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action outline-none text-accent"
                placeholder="http://localhost:1234/v1"
              />
            </div>
            <div>
              <label htmlFor="lmStudioModelName" className="block text-sm font-medium text-accent-light mt-3 mb-1">
                Model Identifier / Path (from LM Studio server):
              </label>
              <input
                type="text"
                id="lmStudioModelName"
                name="lmStudioModelName"
                value={settings.lmStudioModelName}
                onChange={handleInputChange}
                className="w-full p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action outline-none text-accent"
                placeholder="e.g., QuantFactory/Meta-Llama-3-8B-Instruct-GGUF/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf"
              />
               <p className="text-xs text-secondary-light mt-1">This is the model identifier shown in LM Studio's local server logs or UI. LM Studio typically requires this. Ensure its server is running, accessible, and CORS is enabled (usually default for localhost).</p>
            </div>
            <div>
              <label htmlFor="lmStudioApiKey" className="block text-sm font-medium text-accent-light mt-3 mb-1">
                API Key (if required, usually not):
              </label>
              <input
                type="password"
                id="lmStudioApiKey"
                name="lmStudioApiKey" 
                value={settings.lmStudioApiKey} 
                onChange={handleInputChange}
                className="w-full p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action outline-none text-accent"
                placeholder="Typically not needed"
              />
            </div>
          </>
        );
      case 'local_openai_api':
        return (
          <>
            <div>
              <label htmlFor="localApiUrl" className="block text-sm font-medium text-accent-light mb-1">
                Local API Base URL (e.g., http://localhost:8000/v1):
              </label>
              <input
                type="url"
                id="localApiUrl"
                name="localApiUrl"
                value={settings.localApiUrl}
                onChange={handleInputChange}
                className="w-full p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action outline-none text-accent"
                placeholder="http://localhost:1234/v1"
              />
            </div>
            <div>
              <label htmlFor="localModelName" className="block text-sm font-medium text-accent-light mt-3 mb-1">
                Model Name (if required by your server):
              </label>
              <input
                type="text"
                id="localModelName"
                name="localModelName"
                value={settings.localModelName}
                onChange={handleInputChange}
                className="w-full p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action outline-none text-accent"
                placeholder="e.g., MyCustomModel-7B" 
              />
               <p className="text-xs text-secondary-light mt-1">Consult your local server's documentation. Ensure its server is running, accessible, and CORS is configured to allow requests from this web application's origin.</p>
            </div>
            <div>
              <label htmlFor="apiKeyLocal" className="block text-sm font-medium text-accent-light mt-3 mb-1">
                API Key (if required by local server):
              </label>
              <input
                type="password"
                id="apiKeyLocal"
                name="apiKey" // Note: reusing 'apiKey' field for this generic local option
                value={settings.apiKey} 
                onChange={handleInputChange}
                className="w-full p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action outline-none text-accent"
                placeholder="Usually not needed, or a placeholder"
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
      <div className="bg-primary-light p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 id="settings-modal-title" className="text-2xl font-semibold text-accent">AI Provider Settings</h2>
          <button onClick={onClose} className="p-1 rounded-full text-accent-light hover:bg-secondary" aria-label="Close settings">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label htmlFor="aiProviderSelect" className="block text-sm font-medium text-accent-light mb-1">Select AI Provider:</label>
            <select
              id="aiProviderSelect"
              name="provider"
              value={settings.provider}
              onChange={(e) => {
                const newProvider = e.target.value as AiProviderType;
                // Reset specific fields when provider changes to avoid carrying over incompatible settings
                let newSettings = { ...settings, provider: newProvider };
                if (newProvider !== 'ollama') {
                  setOllamaModels([]);
                }
                if (newProvider !== 'gemini' && newProvider !== 'openai' && newProvider !== 'groq' && newProvider !== 'local_openai_api') {
                    // For providers that don't use the generic 'apiKey' field (like LM Studio which has its own)
                    // we might want to clear it if switching from a provider that does.
                    // However, 'local_openai_api' *does* use settings.apiKey. LM Studio uses lmStudioApiKey
                    // The current settings structure reuses 'apiKey' for multiple cloud services AND generic local.
                    // This might need more granular reset if there are conflicts.
                    // For now, primarily concerned with resetting UI specific states like ollamaModels.
                }

                setSettings(newSettings);
                setTestResult(null);
              }}
              className="w-full p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action outline-none text-accent"
            >
              {providerOptions.map(option => (
                <option key={option.value} value={option.value} className="bg-primary text-accent">{option.label}</option>
              ))}
            </select>
          </div>

          {renderProviderSpecificFields()}

          <div className="mt-4">
            <button 
              onClick={handleTestConnection}
              disabled={isTesting || isFetchingOllamaModels}
              className="w-full bg-secondary hover:bg-secondary-light text-accent font-semibold py-2 px-4 rounded-lg disabled:opacity-50 flex items-center justify-center"
            >
              {isTesting && <LoadingSpinner size="sm" className="mr-2" />}
              Test Connection
            </button>
            {testResult && (
              <div className={`mt-2 text-sm p-3 rounded-md ${testResult.success ? 'bg-green-700/30 text-green-300 border border-green-600' : 'bg-danger/30 text-danger-light border border-danger'}`}>
                <p className="font-semibold">{testResult.success ? 'Success!' : 'Test Failed'}</p>
                <p>{testResult.message}</p>
                {testResult.data && typeof testResult.data === 'object' && (
                   <details className="mt-1 text-xs">
                     <summary className="cursor-pointer hover:underline">Details</summary>
                     <pre className="mt-1 p-2 bg-primary/50 rounded whitespace-pre-wrap break-all">
                       {JSON.stringify(testResult.data, null, 2)}
                     </pre>
                   </details>
                )}
                 {testResult.data && typeof testResult.data === 'string' && (
                    <pre className="mt-1 text-xs p-2 bg-primary/50 rounded whitespace-pre-wrap break-all">{testResult.data}</pre>
                 )}
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-6 p-3 bg-primary border border-secondary rounded-md">
            <h4 className="text-sm font-semibold text-accent-light mb-1">Important Notes:</h4>
            <ul className="list-disc list-inside text-xs text-secondary-light space-y-1">
                <li>API keys for cloud services are stored in your browser's local storage. Do not use this on shared computers if security is a concern.</li>
                <li>For locally hosted AIs (Ollama, LM Studio, Other):
                    <ul className="list-disc list-inside pl-4">
                        <li>Ensure your local AI server is running and accessible at the configured Base URL.</li>
                        <li>Your local server must have CORS (Cross-Origin Resource Sharing) enabled to allow requests from this web application.
                            For Ollama, set the `OLLAMA_ORIGINS` environment variable (e.g., `OLLAMA_ORIGINS=*` for testing, or specify the origin like `http://localhost:your_app_port`).
                            Other local servers may have different CORS settings; consult their documentation.
                        </li>
                         <li>Network errors often indicate the server is not running, the URL is incorrect, or CORS is not properly configured.</li>
                    </ul>
                </li>
            </ul>
        </div>


        <div className="mt-8 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-3 text-accent bg-secondary hover:bg-secondary-light rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="w-full sm:w-auto px-6 py-3 text-white bg-accent-action hover:bg-accent-actionHover rounded-lg font-semibold transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};