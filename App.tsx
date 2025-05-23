
import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { CodeInput } from './components/CodeInput';
import { LanguageSelector } from './components/LanguageSelector';
import { FeedbackDisplay } from './components/FeedbackDisplay';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorMessage } from './components/ErrorMessage';
import { SettingsModal } from './components/SettingsModal';
import * as geminiService from './services/geminiService';
import * as openAiService from './services/openAiService';
import * as groqService from './services/groqService';
import * as localAiService from './services/localAiService';
import * as ollamaService from './services/ollamaService'; 
import { parseSuggestedEdits } from './services/promptService'; 

import { parseGitHubUrl, fetchGitHubPathContents, fetchFileContent, fetchAllFilesRecursive } from './services/githubService';
import { fetchGCSObjectContent, parseGCSUrl, inferLanguageFromGCSObjectName, getGCSObjectUrl } from './services/gcsService';
import { parseGoogleDriveLink, getGoogleDriveFileDownloadUrl, fetchDriveFileContent, inferLanguageFromDriveFileName } from './services/driveService';
import { loadAiSettings, saveAiSettings } from './services/settingsService';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, FILE_EXTENSION_TO_LANGUAGE, DEFAULT_AI_SETTINGS, AI_PROVIDER_OPTIONS, OPENAI_MODELS, GROQ_MODELS } from './constants';
import { LanguageOption, InputMode, GithubRepoFile, AnalysisType, SequentialFileActionType, AiSettings, TestConnectionResult } from './types';

const App: React.FC = () => {
  const [inputMode, setInputMode] = useState<InputMode>('paste');
  const [code, setCode] = useState<string>(''); // For paste/file content, or description for generation
  const [language, setLanguage] = useState<string>(DEFAULT_LANGUAGE);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [suggestedCodeEdit, setSuggestedCodeEdit] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false); 
  const [error, setError] = useState<string | null>(null);
  
  const [analysisType, setAnalysisType] = useState<AnalysisType>('review');

  // GitHub specific state
  const [repoUrl, setRepoUrl] = useState<string>('');
  const [repoFiles, setRepoFiles] = useState<GithubRepoFile[]>([]);
  const [currentGitHubPath, setCurrentGitHubPath] = useState<string>('');
  const [selectedFilePath, setSelectedFilePath] = useState<string>('');
  const [isLoadingRepoData, setIsLoadingRepoData] = useState<boolean>(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  
  // Sequential GitHub scan state
  const [repoScanFileList, setRepoScanFileList] = useState<GithubRepoFile[]>([]);
  const [currentRepoScanFileIndex, setCurrentRepoScanFileIndex] = useState<number>(-1);
  const [isSequentialLoading, setIsSequentialLoading] = useState<boolean>(false);
  const [currentFileName, setCurrentFileName] = useState<string>(''); 
  const [sequentialFileAction, setSequentialFileAction] = useState<SequentialFileActionType>('review');

  // GCS specific state
  const [gcsUrl, setGcsUrl] = useState<string>('');
  const [gcsError, setGcsError] = useState<string | null>(null);
  const [isLoadingGCSData, setIsLoadingGCSData] = useState<boolean>(false);

  // Google Drive specific state
  const [driveUrl, setDriveUrl] = useState<string>('');
  const [driveError, setDriveError] = useState<string | null>(null);
  const [isLoadingDriveData, setIsLoadingDriveData] = useState<boolean>(false);

  // Settings State
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [aiSettings, setAiSettings] = useState<AiSettings>(loadAiSettings() || DEFAULT_AI_SETTINGS);

  // Output Panel State
  const [isOutputExpanded, setIsOutputExpanded] = useState<boolean>(false);


  useEffect(() => {
    const loadedSettings = loadAiSettings();
    if (loadedSettings) {
      setAiSettings(loadedSettings);
    }
  }, []);

  const handleSaveSettings = (newSettings: AiSettings) => {
    setAiSettings(newSettings);
    saveAiSettings(newSettings);
    setShowSettingsModal(false);
    setError(null); 
    setFeedback(null); 
    setSuggestedCodeEdit(null);
    setGeneratedCode(null);
  };

  const resetAllSourcesState = (fullReset: boolean = true) => {
    setFeedback(null);
    setError(null);
    setSuggestedCodeEdit(null);
    setGeneratedCode(null);
    setCurrentFileName('');
    setCode(''); // Clears code input/description
    
    if (fullReset) {
      setRepoFiles([]);
      setRepoScanFileList([]);
      setCurrentRepoScanFileIndex(-1);
      setSelectedFilePath('');
      setCurrentGitHubPath('');
      setRepoError(null);
      setGcsError(null);
      setDriveError(null);
      setSequentialFileAction('review'); 
    }
  };

  const handleClearOutput = () => {
    setFeedback(null);
    setSuggestedCodeEdit(null);
    setGeneratedCode(null);
    setError(null);
  };
  
  const handleInputModeChange = (mode: InputMode) => {
    setInputMode(mode);
    resetAllSourcesState(true);
    setAnalysisType(mode === 'paste' ? 'review' : 'review'); 
    
    if (mode === 'paste') {
        setRepoUrl(''); 
        setGcsUrl('');
        setDriveUrl('');
    } else if (mode === 'github') {
        setGcsUrl('');
        setDriveUrl('');
    } else if (mode === 'gcs') {
        setRepoUrl('');
        setDriveUrl('');
    } else if (mode === 'drive') {
        setRepoUrl('');
        setGcsUrl('');
    }
  };

  const handleAnalysisTypeChange = (newAnalysisType: AnalysisType) => {
    setAnalysisType(newAnalysisType);
    setError(null);
    setFeedback(null);
    setSuggestedCodeEdit(null);
    setGeneratedCode(null);
    
    if (newAnalysisType === 'sequential_file_analysis' || (inputMode !== 'paste' && newAnalysisType !== 'generate_code' && !code) ) {
        setCode(''); 
    }
    if (newAnalysisType === 'generate_code' && inputMode === 'paste') {
      // Don't clear code if it's a description for generation
    } else if (inputMode !== 'paste' && newAnalysisType !== 'generate_code') {
      // Clear if not paste and not generate
    }
    
    if (newAnalysisType !== 'sequential_file_analysis') {
      setRepoScanFileList([]);
      setCurrentRepoScanFileIndex(-1);
      setSequentialFileAction('review'); 
    } else { 
      setSelectedFilePath(''); 
      setRepoFiles([]); 
      setCurrentGitHubPath('');
    }
  };
  
  const handleRepoUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRepoUrl = e.target.value;
    setRepoUrl(newRepoUrl);
    resetAllSourcesState(true); 
    setAnalysisType('review'); 
    if (!newRepoUrl.trim()) setRepoError(null);
  };

  const loadGitHubPathListing = async (owner: string, repo: string, path: string) => {
    setIsLoadingRepoData(true);
    setRepoError(null);
    setCode(''); 
    setFeedback(null);
    setSuggestedCodeEdit(null);
    setGeneratedCode(null);
    setSelectedFilePath(''); 
    try {
        const items = await fetchGitHubPathContents(owner, repo, path);
        setRepoFiles(items);
        setCurrentGitHubPath(path);
        if (items.length === 0) setRepoError(`No files or folders found in '${path || '/'}'.`);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error fetching repository path contents.';
        setRepoError(msg);
        setRepoFiles([]); 
    } finally {
        setIsLoadingRepoData(false);
    }
};

  const handleLoadRepositoryData = useCallback(async () => { 
    if (!repoUrl.trim()) {
      setRepoError('Please enter a GitHub repository URL.');
      return;
    }
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      setRepoError('Invalid GitHub repository URL format. Example: https://github.com/owner/repo');
      return;
    }

    setIsLoadingRepoData(true);
    setRepoError(null);
    resetAllSourcesState(false); 

    try {
      if (analysisType === 'sequential_file_analysis') {
        const files = await fetchAllFilesRecursive(parsed.owner, parsed.repo);
        setRepoScanFileList(files);
        setCurrentRepoScanFileIndex(0); 
        if (files.length === 0) {
          setRepoError('No suitable files found for sequential analysis.');
        }
        setRepoFiles([]); setCurrentGitHubPath(''); 
      } else { 
        await loadGitHubPathListing(parsed.owner, parsed.repo, '');
        setRepoScanFileList([]); setCurrentRepoScanFileIndex(-1); 
      }
    } catch (err) {
      console.error('Error fetching repository data:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error fetching repository data.';
      setRepoError(msg);
      setRepoScanFileList([]); setRepoFiles([]); setCurrentRepoScanFileIndex(-1); setCurrentGitHubPath('');
    } finally {
      setIsLoadingRepoData(false);
    }
  }, [repoUrl, analysisType]);

  const handleDirectoryNavigation = (dirPath: string) => {
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
        setRepoError("Repository URL is missing or invalid for navigation.");
        return;
    }
    loadGitHubPathListing(parsed.owner, parsed.repo, dirPath);
  };

  const handleNavigateUp = () => {
      const parsed = parseGitHubUrl(repoUrl);
      if (!parsed) {
          setRepoError("Repository URL is missing or invalid for navigation.");
          return;
      }
      if (!currentGitHubPath) return; 

      const pathParts = currentGitHubPath.split('/').filter(p => p);
      pathParts.pop();
      const newPath = pathParts.join('/');
      loadGitHubPathListing(parsed.owner, parsed.repo, newPath);
  };

  const handleFileSelectedForSingleAnalysis = useCallback(async (selectedFile: GithubRepoFile) => {
    setSelectedFilePath(selectedFile.url); 
    if (!selectedFile) {
      setCode(''); setLanguage(DEFAULT_LANGUAGE); setFeedback(null); setSuggestedCodeEdit(null); setGeneratedCode(null); setCurrentFileName('');
      return;
    }
    
    setIsLoading(true); setError(null); setFeedback(null); setSuggestedCodeEdit(null); setGeneratedCode(null); setCode(''); 
    setCurrentFileName(selectedFile.name);
    try {
      const fileContent = await fetchFileContent(selectedFile);
      setCode(fileContent);
      const extension = selectedFile.name.split('.').pop()?.toLowerCase();
      if (extension && FILE_EXTENSION_TO_LANGUAGE[extension]) {
        const inferredLang = FILE_EXTENSION_TO_LANGUAGE[extension];
        if (SUPPORTED_LANGUAGES.some(lang => lang.value === inferredLang)) setLanguage(inferredLang);
        else setLanguage(DEFAULT_LANGUAGE);
      } else setLanguage(DEFAULT_LANGUAGE);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error fetching file content.';
      setError(errorMsg); setRepoError(errorMsg); 
    } finally {
      setIsLoading(false);
    }
  }, []); 

  const processAIFeedbackResponse = (resultText: string, currentLang: string, currentAnalysisType: AnalysisType | SequentialFileActionType) => {
    if (currentAnalysisType === 'suggest_edits' || currentAnalysisType === 'generate_code') {
      const { explanation, modifiedCode } = parseSuggestedEdits(resultText, currentLang); 
      setFeedback(explanation);
      if (currentAnalysisType === 'suggest_edits') {
        setSuggestedCodeEdit(modifiedCode);
        if (!modifiedCode && explanation) {
            setError("AI provided an explanation but no modified code block was found or it was not formatted correctly. Please check the raw feedback.");
        } else if (!modifiedCode && !explanation) {
            setError("AI failed to provide suggestions or code. The response was empty or malformed.");
        }
      } else { // generate_code
        setGeneratedCode(modifiedCode);
         if (!modifiedCode && explanation) {
            setError("AI provided an explanation but no generated code block was found or it was not formatted correctly. Please check the raw feedback.");
        } else if (!modifiedCode && !explanation) {
            setError("AI failed to generate code. The response was empty or malformed.");
        }
      }
    } else {
      setFeedback(resultText);
    }
  };

  const _fetchAIFeedbackFromConfiguredProvider = async (
    currentCodeOrDescription: string, 
    currentLanguage: string, 
    currentAnalysisType: AnalysisType | SequentialFileActionType,
    settings: AiSettings
  ): Promise<string> => {
    switch (settings.provider) {
      case 'gemini':
        return geminiService.getAIFeedback(currentCodeOrDescription, currentLanguage, currentAnalysisType as AnalysisType, settings.apiKey);
      case 'openai':
        return openAiService.getAIFeedback(currentCodeOrDescription, currentLanguage, currentAnalysisType as AnalysisType, settings.apiKey, settings.openAiModel);
      case 'groq':
        return groqService.getAIFeedback(currentCodeOrDescription, currentLanguage, currentAnalysisType as AnalysisType, settings.apiKey, settings.groqModel);
      case 'ollama':
        return ollamaService.getAIFeedback(currentCodeOrDescription, currentLanguage, currentAnalysisType as AnalysisType, settings.ollamaBaseUrl, settings.ollamaModelName);
      case 'lm_studio':
        return localAiService.getAIFeedback(currentCodeOrDescription, currentLanguage, currentAnalysisType as AnalysisType, settings.lmStudioBaseUrl, settings.lmStudioModelName, settings.lmStudioApiKey);
      case 'local_openai_api':
        return localAiService.getAIFeedback(currentCodeOrDescription, currentLanguage, currentAnalysisType as AnalysisType, settings.localApiUrl, settings.localModelName, settings.apiKey);
      default:
        throw new Error(`Unsupported AI provider: ${(settings.provider as any)}`);
    }
  };


  const handleAnalyzeNextFile = useCallback(async () => {
    if (currentRepoScanFileIndex < 0 || currentRepoScanFileIndex >= repoScanFileList.length) {
      setError("No more files to analyze or index out of bounds."); return;
    }
    const fileToAnalyze = repoScanFileList[currentRepoScanFileIndex];
    setIsSequentialLoading(true); setError(null); setFeedback(null); setSuggestedCodeEdit(null); setGeneratedCode(null); setCode('');
    setCurrentFileName(fileToAnalyze.name);

    try {
      const fileContent = await fetchFileContent(fileToAnalyze);
      setCode(fileContent);
      const extension = fileToAnalyze.name.split('.').pop()?.toLowerCase();
      let inferredLanguage = DEFAULT_LANGUAGE;
      if (extension && FILE_EXTENSION_TO_LANGUAGE[extension]) {
        const langValue = FILE_EXTENSION_TO_LANGUAGE[extension];
        if (SUPPORTED_LANGUAGES.some(l => l.value === langValue)) inferredLanguage = langValue;
      }
      setLanguage(inferredLanguage);

      const resultText = await _fetchAIFeedbackFromConfiguredProvider(fileContent, inferredLanguage, sequentialFileAction, aiSettings);
      processAIFeedbackResponse(resultText, inferredLanguage, sequentialFileAction);
      setCurrentRepoScanFileIndex(prev => prev + 1);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : `Error analyzing ${fileToAnalyze.name}.`;
      setError(errorMsg);
    } finally {
      setIsSequentialLoading(false);
    }
  }, [currentRepoScanFileIndex, repoScanFileList, sequentialFileAction, aiSettings]);

  const handleGcsUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newGcsUrl = e.target.value;
    setGcsUrl(newGcsUrl);
    resetAllSourcesState(true);
    setAnalysisType('review'); 
    if (!newGcsUrl.trim()) setGcsError(null);
  };

  const handleLoadGCSObject = useCallback(async () => {
    if (!gcsUrl.trim()) {
      setGcsError('Please enter a GCS object URL.'); return;
    }
    const parsedGcsPath = parseGCSUrl(gcsUrl);
    if (!parsedGcsPath) {
      setGcsError('Invalid GCS URL. Example: https://storage.googleapis.com/bucket/object or gs://bucket/object'); return;
    }
    
    const fullGcsHttpUrl = getGCSObjectUrl(parsedGcsPath.bucket, parsedGcsPath.objectName);

    setIsLoadingGCSData(true); setGcsError(null); resetAllSourcesState(false);
    setCurrentFileName(parsedGcsPath.objectName.split('/').pop() || parsedGcsPath.objectName);
    
    try {
      const content = await fetchGCSObjectContent(fullGcsHttpUrl);
      setCode(content);
      const inferredLang = inferLanguageFromGCSObjectName(parsedGcsPath.objectName);
      if (SUPPORTED_LANGUAGES.some(lang => lang.value === inferredLang)) setLanguage(inferredLang);
      else setLanguage(DEFAULT_LANGUAGE);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error fetching GCS object.';
      setGcsError(errorMsg); setError(errorMsg);
    } finally {
      setIsLoadingGCSData(false);
    }
  }, [gcsUrl]);

  const handleDriveUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDriveUrl = e.target.value;
    setDriveUrl(newDriveUrl);
    resetAllSourcesState(true);
    setAnalysisType('review');
    if(!newDriveUrl.trim()) setDriveError(null);
  };

  const handleLoadDriveFile = useCallback(async () => {
    if(!driveUrl.trim()) {
        setDriveError('Please enter a Google Drive file URL.'); return;
    }
    const parsedDriveInfo = parseGoogleDriveLink(driveUrl);
    if (!parsedDriveInfo || !parsedDriveInfo.fileId) {
        setDriveError('Invalid Google Drive URL or could not extract File ID. Please provide a public shareable link.'); return;
    }
    const downloadUrl = getGoogleDriveFileDownloadUrl(parsedDriveInfo.fileId);
    
    setIsLoadingDriveData(true); setDriveError(null); resetAllSourcesState(false);
    setCurrentFileName(parsedDriveInfo.originalFileName || `drive_file_${parsedDriveInfo.fileId.substring(0,8)}`);

    try {
        const content = await fetchDriveFileContent(downloadUrl);
        setCode(content);
        const inferredLang = inferLanguageFromDriveFileName(parsedDriveInfo.originalFileName);
        if (SUPPORTED_LANGUAGES.some(lang => lang.value === inferredLang)) setLanguage(inferredLang);
        else setLanguage(DEFAULT_LANGUAGE);

    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error fetching Google Drive file.';
        setDriveError(errorMsg); setError(errorMsg);
    } finally {
        setIsLoadingDriveData(false);
    }
  }, [driveUrl]);

  const handleAIFeedbackRequest = useCallback(async () => {
    const contentForAI = code; 
    if (!contentForAI.trim()) {
      setError(analysisType === 'generate_code' ? 'Please describe the code you want to generate.' : 'No code content to analyze.');
      return;
    }
    if (analysisType === 'sequential_file_analysis' && inputMode === 'github') {
      setError('Sequential analysis is handled by the "Analyze Next File" button controls.'); return;
    }

    setIsLoading(true); setError(null); setFeedback(null); setSuggestedCodeEdit(null); setGeneratedCode(null);
    
    try {
      const resultText = await _fetchAIFeedbackFromConfiguredProvider(contentForAI, language, analysisType, aiSettings);
      processAIFeedbackResponse(resultText, language, analysisType);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : `Error fetching ${analysisType.replace('_', ' ')}.`;
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [code, language, analysisType, inputMode, aiSettings]);
  
  const handleApplyAIEdits = () => {
    if (suggestedCodeEdit) {
      setCode(suggestedCodeEdit);
      setSuggestedCodeEdit(null); 
      setFeedback(prev => (prev ? prev + "\\n\\n--- Edits Applied to Editor ---" : "--- Edits Applied to Editor ---"));
    }
  };

  const handleDownloadCode = () => {
    if (!code && analysisType !== 'generate_code') { 
      setError("No code to download.");
      return;
    }
    const codeToDownload = analysisType === 'generate_code' && generatedCode ? generatedCode : code;
    if (!codeToDownload) {
        setError("No code available to download.");
        return;
    }

    let extension = '.txt';
    const foundExtension = Object.keys(FILE_EXTENSION_TO_LANGUAGE).find(key => FILE_EXTENSION_TO_LANGUAGE[key] === language);
    if (foundExtension) {
        extension = `.${foundExtension}`;
    }
    
    let defaultFileName = "code" + extension;
    if (currentFileName && analysisType !== 'generate_code') {
        const nameParts = currentFileName.split('.');
        if (nameParts.length > 1 && nameParts[nameParts.length-1].length <= 4) { 
            defaultFileName = nameParts.slice(0, -1).join('.') + extension; 
        } else { 
            defaultFileName = currentFileName + extension; 
        }
    } else {
        defaultFileName = `${language}_${analysisType === 'generate_code' ? 'generated_code' : 'code'}${extension}`;
    }
    
    const blob = new Blob([codeToDownload], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = defaultFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleCopyGeneratedCode = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode)
        .then(() => { /* Optionally show a success message */ })
        .catch(err => {
          console.error('Failed to copy generated code:', err);
          setError('Failed to copy code to clipboard.');
        });
    }
  };

  const handleLoadGeneratedCodeToEditor = () => {
    if (generatedCode) {
      setCode(generatedCode); 
      setGeneratedCode(null); 
      setFeedback(null);      
      setAnalysisType('review'); 
    }
  };

  const handleTestProviderConnection = async (settingsToTest: AiSettings): Promise<TestConnectionResult> => {
    switch (settingsToTest.provider) {
        case 'gemini':
            return geminiService.testConnection(settingsToTest.apiKey);
        case 'openai':
            return openAiService.testConnection(settingsToTest.apiKey, settingsToTest.openAiModel);
        case 'groq':
            return groqService.testConnection(settingsToTest.apiKey, settingsToTest.groqModel);
        case 'ollama':
            return ollamaService.testConnection(settingsToTest.ollamaBaseUrl, settingsToTest.ollamaModelName);
        case 'lm_studio':
            return localAiService.testConnection(settingsToTest.lmStudioBaseUrl, settingsToTest.lmStudioModelName, settingsToTest.lmStudioApiKey);
        case 'local_openai_api':
            return localAiService.testConnection(settingsToTest.localApiUrl, settingsToTest.localModelName, settingsToTest.apiKey);
        default:
            return { success: false, message: `Testing not implemented for provider: ${(settingsToTest.provider as any)}`};
    }
  };


  const isRepoModeSingleFileAnalysisActive = inputMode === 'github' && (analysisType === 'review' || analysisType === 'insights' || analysisType === 'suggest_edits');
  const isRepoModeSequentialAnalysisActive = inputMode === 'github' && analysisType === 'sequential_file_analysis';

  const feedbackButtonText = () => {
    if (isLoading) return 'Processing...';
    if (analysisType === 'generate_code') return 'Generate Code';
    if (analysisType === 'suggest_edits') return 'Suggest Edits';
    if (analysisType === 'insights') return (inputMode === 'paste' || !currentFileName) ? 'Get Insights' : 'Get File Insights';
    return (inputMode === 'paste' || !currentFileName) ? 'Review Code' : 'Get File Review';
  };

  const analyzeNextFileButtonText = () => {
    if (isSequentialLoading) return "Analyzing...";
    const fileNumber = Math.min(currentRepoScanFileIndex + 1, repoScanFileList.length);
    const currentFileForButton = repoScanFileList[currentRepoScanFileIndex]?.name || '';
    const base = `(${fileNumber}/${repoScanFileList.length}): ${currentFileForButton}`;
    switch(sequentialFileAction) {
        case 'review': return `Review Next ${base}`;
        case 'insights': return `Get Insights for Next ${base}`;
        case 'suggest_edits': return `Suggest Edits for Next ${base}`;
        default: return `Analyze Next ${base}`;
    }
  };

  const showMainFeedbackButton = 
    (inputMode === 'paste') ||
    (isRepoModeSingleFileAnalysisActive && !!code) || 
    ((inputMode === 'gcs' || inputMode === 'drive') && !!code);

  const isMainFeedbackButtonDisabled = isLoading || isSequentialLoading || isLoadingRepoData || isLoadingGCSData || isLoadingDriveData || !code.trim();
  const showLoadRepoDataButton = inputMode === 'github' && repoUrl.trim();
  const loadRepoDataButtonText = analysisType === 'sequential_file_analysis' ? "Load Files for Scan" : "Load Repository Browser";
  const showLoadGCSButton = inputMode === 'gcs' && gcsUrl.trim();
  const showLoadDriveButton = inputMode === 'drive' && driveUrl.trim();


  const getFeedbackTitle = () => {
    let providerLabel = AI_PROVIDER_OPTIONS.find(p => p.value === aiSettings.provider)?.label || aiSettings.provider;
    let modelInUse = '';
    if (aiSettings.provider === 'openai') modelInUse = ` (${OPENAI_MODELS.find(m => m.value === aiSettings.openAiModel)?.label || aiSettings.openAiModel})`;
    if (aiSettings.provider === 'groq') modelInUse = ` (${GROQ_MODELS.find(m => m.value === aiSettings.groqModel)?.label || aiSettings.groqModel})`;
    if (aiSettings.provider === 'ollama' && aiSettings.ollamaModelName) modelInUse = ` (${aiSettings.ollamaModelName})`;
    if (aiSettings.provider === 'lm_studio' && aiSettings.lmStudioModelName) modelInUse = ` (${aiSettings.lmStudioModelName})`;
    if (aiSettings.provider === 'local_openai_api' && aiSettings.localModelName) modelInUse = ` (${aiSettings.localModelName})`;


    // Updated this for the new Output Panel header
    let baseTitle = '';
    if (isRepoModeSequentialAnalysisActive && currentFileName) { 
        const actionText = sequentialFileAction === 'review' ? 'Review' : sequentialFileAction === 'insights' ? 'Insights' : 'Suggested Edits';
        baseTitle = `${actionText} for: ${currentFileName}`;
    } else {
        baseTitle = analysisType === 'review' ? 'Review Feedback' : 
                     analysisType === 'insights' ? 'Code Insights' : 
                     analysisType === 'suggest_edits' ? 'AI Suggested Edits' :
                     analysisType === 'generate_code' ? 'Generated Code' : 'AI Output'; // Changed "Generated Code Explanation" to "Generated Code"
        if (currentFileName && analysisType !== 'generate_code') baseTitle += ` for ${currentFileName}`;
    }
    return `${baseTitle} (using ${providerLabel}${modelInUse})`;
  };

  const codeInputLabel = () => {
    if (analysisType === 'generate_code' && inputMode === 'paste') {
        return `Describe the code you want to generate in ${SUPPORTED_LANGUAGES.find(l=>l.value === language)?.label || language}:`;
    }
    if (currentFileName) return `Code for: ${currentFileName}`;
    if (inputMode === 'paste') return `Paste your ${SUPPORTED_LANGUAGES.find(l=>l.value === language)?.label || language} code:`;
    return 'Code Input';
  };

  const languageSelectorLabel = () => {
    if (analysisType === 'generate_code' && inputMode === 'paste') {
        return "Target Language for Generation:";
    }
    return "Select Language for File";
  }

  const isCodeInputReadOnly =
    (analysisType === 'generate_code' && inputMode === 'paste' && (isLoading || !!generatedCode)) || 
    (inputMode === 'github' && (!suggestedCodeEdit || analysisType !== 'suggest_edits')) || 
    (inputMode === 'gcs' && (!suggestedCodeEdit || analysisType !== 'suggest_edits')) || 
    (inputMode === 'drive' && (!suggestedCodeEdit || analysisType !== 'suggest_edits')) ||
    (isRepoModeSequentialAnalysisActive && (!suggestedCodeEdit || sequentialFileAction !== 'suggest_edits'));

  const showClearOutputButton = feedback || suggestedCodeEdit || generatedCode || error;

  const analysisOptionsForMode = () => {
    const baseOptions = [
        { value: "review", label: "Single File Review" },
        { value: "insights", label: "Single File Insights" },
        { value: "suggest_edits", label: "Single File Suggest Edits" },
    ];
    if (inputMode === 'github') {
        return [ ...baseOptions, { value: "sequential_file_analysis", label: "Sequential File Analysis" }];
    }
    if (inputMode === 'paste') {
        return [
            { value: "review", label: "Review Code" },
            { value: "insights", label: "Get Insights" },
            { value: "suggest_edits", label: "Suggest Edits" },
            { value: "generate_code", label: "Generate Code" },
        ];
    }
    return baseOptions.map(opt => ({...opt, label: opt.label.replace('Single File ', '')})); 
  }

  const codeInputPlaceholder = () => {
    if (analysisType === 'generate_code' && inputMode === 'paste') {
      return `e.g., A Python function that sorts a list of numbers and returns the median.
Or a React component for a simple counter button.`;
    }
    if (isCodeInputReadOnly) return "// Code loaded from external source";
    return `// Your ${language} code here...`;
  };

  const subHeaderTitle = () => {
    let title = '';
    if (inputMode === 'paste') {
      title = analysisType === 'generate_code' ? 'Generate Code' :
              analysisType === 'insights' ? 'Get Insights' : 
              analysisType === 'suggest_edits' ? 'Get AI Suggested Edits' : 'Review Code';
    } else if (inputMode === 'github') {
      title = analysisType === 'sequential_file_analysis' ? 
              `Sequential File Analysis (Action: ${sequentialFileAction.charAt(0).toUpperCase() + sequentialFileAction.slice(1)})` : 
              `GitHub File (${analysisType.charAt(0).toUpperCase() + analysisType.slice(1).replace('_', ' ')})`;
    } else if (inputMode === 'gcs') {
      title = `GCS Object (${analysisType.charAt(0).toUpperCase() + analysisType.slice(1).replace('_', ' ')})`;
    } else if (inputMode === 'drive') {
      title = `Drive File (${analysisType.charAt(0).toUpperCase() + analysisType.slice(1).replace('_', ' ')})`;
    }
    
    let providerLabel = AI_PROVIDER_OPTIONS.find(p => p.value === aiSettings.provider)?.label || aiSettings.provider;
    let modelInUse = '';
    if (aiSettings.provider === 'openai') modelInUse = ` - ${OPENAI_MODELS.find(m => m.value === aiSettings.openAiModel)?.label || aiSettings.openAiModel}`;
    if (aiSettings.provider === 'groq') modelInUse = ` - ${GROQ_MODELS.find(m => m.value === aiSettings.groqModel)?.label || aiSettings.groqModel}`;
    if (aiSettings.provider === 'ollama' && aiSettings.ollamaModelName) modelInUse = ` - ${aiSettings.ollamaModelName}`;
    if (aiSettings.provider === 'lm_studio' && aiSettings.lmStudioModelName) modelInUse = ` - ${aiSettings.lmStudioModelName}`;
    if (aiSettings.provider === 'local_openai_api' && aiSettings.localModelName) modelInUse = ` - ${aiSettings.localModelName}`;

    return `${title} (using ${providerLabel}${modelInUse})`;
  };


  return (
    <div className="min-h-screen bg-primary flex flex-col">
      <Header onToggleSettings={() => setShowSettingsModal(true)} />
      <main className="flex-grow container mx-auto px-2 sm:px-4 py-6 flex flex-col lg:flex-row lg:space-x-6">
        
        {/* Controls Panel (Left) */}
        <div className="lg:w-2/5 flex flex-col space-y-6 mb-6 lg:mb-0">
          <div className="flex space-x-1 sm:space-x-2 p-1 bg-primary-light rounded-lg self-start">
            {(['paste', 'github', 'gcs', 'drive'] as InputMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => handleInputModeChange(mode)}
                className={`px-3 py-2 sm:px-4 text-xs sm:text-sm font-medium rounded-md transition-colors duration-150
                  ${inputMode === mode ? 'bg-accent-action text-white' : 'text-accent-light hover:bg-secondary'}`}
                aria-pressed={inputMode === mode}
              >
                {mode === 'paste' ? 'Paste Code' : 
                 mode === 'github' ? 'GitHub Repo' : 
                 mode === 'gcs' ? 'GCS Object' : 
                 'Drive File'}
              </button>
            ))}
          </div>

          <div className="bg-primary-light p-4 sm:p-6 rounded-lg shadow-xl flex-grow flex flex-col"> {/* Added flex flex-col */}
             <h2 className="text-xl sm:text-2xl font-semibold text-accent mb-4">
                {subHeaderTitle()}
            </h2>

            {inputMode === 'github' && (
              <div className="mb-4 space-y-3">
                <div>
                  <label htmlFor="repoUrlInput" className="block text-sm font-medium text-accent-light mb-1">GitHub Repository URL:</label>
                  <div className="flex space-x-2">
                    <input type="url" id="repoUrlInput" value={repoUrl} onChange={handleRepoUrlChange} placeholder="e.g., https://github.com/owner/repo"
                      className="flex-grow p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action outline-none text-accent"
                      disabled={isLoadingRepoData || isLoading || isSequentialLoading} aria-label="GitHub Repository URL" />
                    {showLoadRepoDataButton && (
                      <button onClick={handleLoadRepositoryData} disabled={isLoadingRepoData || !repoUrl.trim() || isLoading || isSequentialLoading}
                        className="bg-accent-action hover:bg-accent-actionHover text-white font-semibold py-3 px-4 sm:px-6 rounded-lg shadow-md disabled:opacity-50 flex items-center">
                        {isLoadingRepoData && <LoadingSpinner size="sm" className="mr-2"/>} {loadRepoDataButtonText}
                      </button>
                    )}
                  </div>
                </div>
                {repoError && <ErrorMessage message={repoError} />}
                {isLoadingRepoData && !repoFiles.length && !repoScanFileList.length && <div className="text-accent-light flex items-center"><LoadingSpinner size="sm" className="mr-2" /> Loading repository data...</div>}
                
                {repoUrl.trim() && (
                  <div className="mt-3">
                      <label htmlFor="analysisTypeSelectGithub" className="block text-sm font-medium text-accent-light mb-1">Action Type:</label>
                      <select id="analysisTypeSelectGithub" value={analysisType} onChange={(e) => handleAnalysisTypeChange(e.target.value as AnalysisType)}
                          disabled={isLoadingRepoData || isLoading || isSequentialLoading}
                          className="w-full p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action text-accent">
                          {analysisOptionsForMode().map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                      </select>
                  </div>
                )}

                {isRepoModeSequentialAnalysisActive && repoScanFileList.length > 0 && !isLoadingRepoData && (
                  <div className="mt-4 p-3 bg-primary rounded-md border border-secondary space-y-3">
                      <div>
                          <label htmlFor="sequentialFileActionSelect" className="block text-sm font-medium text-accent-light mb-1">Action for Each File in Sequence:</label>
                          <select id="sequentialFileActionSelect" value={sequentialFileAction} 
                              onChange={(e) => setSequentialFileAction(e.target.value as SequentialFileActionType)}
                              disabled={isSequentialLoading || isLoading}
                              className="w-full p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action text-accent">
                              <option value="review">Review File</option>
                              <option value="insights">Get File Insights</option>
                              <option value="suggest_edits">Suggest Edits for File</option>
                          </select>
                      </div>
                    <p className="text-accent-light text-sm">Found {repoScanFileList.length} files for scan. 
                      {currentRepoScanFileIndex >= 0 && currentRepoScanFileIndex < repoScanFileList.length && ` Analyzing file ${currentRepoScanFileIndex + 1} of ${repoScanFileList.length}.`}
                    </p>
                    {currentRepoScanFileIndex < repoScanFileList.length && (
                      <button onClick={handleAnalyzeNextFile} disabled={isSequentialLoading || isLoading}
                          className="w-full md:w-auto bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md disabled:opacity-50 flex items-center justify-center">
                          {isSequentialLoading && <LoadingSpinner size="sm" className="mr-2" />}
                          {analyzeNextFileButtonText()}
                      </button>
                    )}
                    {currentRepoScanFileIndex >= repoScanFileList.length && currentRepoScanFileIndex > 0 && <p className="text-green-400 font-semibold">All files in sequence processed.</p>}
                  </div>
                )}

                {isRepoModeSingleFileAnalysisActive && repoFiles.length > 0 && !isLoadingRepoData && (
                   <div className="mt-4 p-3 bg-primary rounded-md border border-secondary">
                      <h4 className="text-md font-semibold text-accent-light mb-2 flex items-center">
                          <span className="mr-2">📁</span> Path: /<span className="font-mono">{currentGitHubPath || ''}</span>
                      </h4>
                      {currentGitHubPath && (
                          <button onClick={handleNavigateUp}
                              className="mb-2 text-sm text-accent-action hover:underline p-1 flex items-center"
                              disabled={isLoadingRepoData}>
                              <span className="text-lg mr-1">⤴️</span> Up one level (..)
                          </button>
                      )}
                      <ul className="space-y-1 max-h-60 overflow-y-auto border border-secondary-light p-2 rounded-md">
                          {repoFiles.map((item) => (
                          <li key={item.sha} 
                              className={`p-2 rounded-md hover:bg-secondary transition-colors duration-100 ease-in-out
                                          ${item.type === 'file' && selectedFilePath === item.url ? 'bg-accent-action text-white' : 'text-accent-light'}`}
                          >
                              {item.type === 'dir' ? (
                              <button onClick={() => handleDirectoryNavigation(item.path)}
                                  className="flex items-center w-full text-left disabled:opacity-50"
                                  aria-label={`Navigate to folder ${item.name}`} disabled={isLoadingRepoData}>
                                  <span className="text-lg mr-2">📁</span>
                                  <span className="font-medium">{item.name}</span>
                              </button>
                              ) : (
                              <button onClick={() => handleFileSelectedForSingleAnalysis(item)}
                                  className="flex items-center w-full text-left disabled:opacity-50"
                                  aria-label={`Select file ${item.name}`} disabled={isLoadingRepoData || isLoading}
                                  aria-pressed={selectedFilePath === item.url}>
                                  <span className="text-lg mr-2">📄</span>
                                  <span>{item.name}</span>
                              </button>
                              )}
                          </li>
                          ))}
                      </ul>
                  </div>
                )}
              </div>
            )}
            
            {inputMode === 'paste' && (
               <div className="mt-3">
                  <label htmlFor="analysisTypeSelectPaste" className="block text-sm font-medium text-accent-light mb-1">Action Type:</label>
                  <select id="analysisTypeSelectPaste" value={analysisType} onChange={(e) => handleAnalysisTypeChange(e.target.value as AnalysisType)}
                      disabled={isLoading || isSequentialLoading}
                      className="w-full p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action text-accent">
                      {analysisOptionsForMode().map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                  </select>
              </div>
            )}


            {inputMode === 'gcs' && (
              <div className="mb-4 space-y-3">
                <div>
                  <label htmlFor="gcsUrlInput" className="block text-sm font-medium text-accent-light mb-1">GCS Object URL:</label>
                  <div className="flex space-x-2">
                      <input type="url" id="gcsUrlInput" value={gcsUrl} onChange={handleGcsUrlChange} placeholder="e.g., https://storage.googleapis.com/bucket/object.js"
                          className="flex-grow p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action outline-none text-accent"
                          disabled={isLoadingGCSData || isLoading} aria-label="GCS Object URL" />
                      {showLoadGCSButton && (
                          <button onClick={handleLoadGCSObject} disabled={isLoadingGCSData || !gcsUrl.trim() || isLoading}
                          className="bg-accent-action hover:bg-accent-actionHover text-white font-semibold py-3 px-4 sm:px-6 rounded-lg shadow-md disabled:opacity-50 flex items-center">
                          {isLoadingGCSData && <LoadingSpinner size="sm" className="mr-2"/>} Load Object
                          </button>
                      )}
                  </div>
                </div>
                {gcsError && <ErrorMessage message={gcsError} />}
                {isLoadingGCSData && <div className="text-accent-light flex items-center"><LoadingSpinner size="sm" className="mr-2" /> Loading GCS object...</div>}

                {gcsUrl.trim() && (code || isLoadingGCSData) && (
                  <div className="mt-3">
                      <label htmlFor="analysisTypeSelectGCS" className="block text-sm font-medium text-accent-light mb-1">Action Type:</label>
                      <select id="analysisTypeSelectGCS" value={analysisType} onChange={(e) => handleAnalysisTypeChange(e.target.value as AnalysisType)}
                          disabled={isLoadingGCSData || isLoading || analysisType === 'sequential_file_analysis'}
                          className="w-full p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action text-accent">
                          {analysisOptionsForMode().map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                      </select>
                  </div>
                )}
              </div>
            )}

            {inputMode === 'drive' && (
              <div className="mb-4 space-y-3">
                <div>
                  <label htmlFor="driveUrlInput" className="block text-sm font-medium text-accent-light mb-1">Google Drive File URL:</label>
                  <div className="flex space-x-2">
                      <input type="url" id="driveUrlInput" value={driveUrl} onChange={handleDriveUrlChange} placeholder="e.g., https://drive.google.com/file/d/FILE_ID/view?usp=sharing"
                          className="flex-grow p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action outline-none text-accent"
                          disabled={isLoadingDriveData || isLoading} aria-label="Google Drive File URL" />
                      {showLoadDriveButton && (
                          <button onClick={handleLoadDriveFile} disabled={isLoadingDriveData || !driveUrl.trim() || isLoading}
                          className="bg-accent-action hover:bg-accent-actionHover text-white font-semibold py-3 px-4 sm:px-6 rounded-lg shadow-md disabled:opacity-50 flex items-center">
                          {isLoadingDriveData && <LoadingSpinner size="sm" className="mr-2"/>} Load File
                          </button>
                      )}
                  </div>
                </div>
                {driveError && <ErrorMessage message={driveError} />}
                {isLoadingDriveData && <div className="text-accent-light flex items-center"><LoadingSpinner size="sm" className="mr-2" /> Loading Google Drive file...</div>}

                {driveUrl.trim() && (code || isLoadingDriveData) && (
                  <div className="mt-3">
                      <label htmlFor="analysisTypeSelectDrive" className="block text-sm font-medium text-accent-light mb-1">Action Type:</label>
                      <select id="analysisTypeSelectDrive" value={analysisType} onChange={(e) => handleAnalysisTypeChange(e.target.value as AnalysisType)}
                          disabled={isLoadingDriveData || isLoading || analysisType === 'sequential_file_analysis'}
                          className="w-full p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action text-accent">
                          {analysisOptionsForMode().map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                      </select>
                  </div>
                )}
              </div>
            )}
            
            {((inputMode === 'paste' || (code && (isRepoModeSingleFileAnalysisActive || inputMode === 'gcs' || inputMode === 'drive'))) || (isRepoModeSequentialAnalysisActive && code) ) && (
               <LanguageSelector
                  languages={SUPPORTED_LANGUAGES}
                  selectedLanguage={language}
                  onChange={setLanguage}
                  disabled={isLoading || isSequentialLoading || isLoadingRepoData || isLoadingGCSData || isLoadingDriveData || (inputMode !== 'paste' && ((isRepoModeSingleFileAnalysisActive && analysisType === 'suggest_edits') || (isRepoModeSequentialAnalysisActive && sequentialFileAction === 'suggest_edits')) )}
                  label={languageSelectorLabel()}
                />
            )}
            
            {(inputMode === 'paste' || code || analysisType === 'generate_code') && ( 
              <CodeInput
                code={code} 
                onChange={setCode} 
                language={language}
                readOnly={isCodeInputReadOnly}
                ariaLabel={codeInputLabel()}
                placeholder={codeInputPlaceholder()}
              />
            )}

            {showMainFeedbackButton && (
              <div className="mt-6 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2">
                  {code && (
                    <button
                      onClick={handleDownloadCode}
                      disabled={!code && !(analysisType === 'generate_code' && generatedCode)}
                      className="w-full sm:w-auto bg-secondary hover:bg-secondary-light text-accent font-semibold py-3 px-6 rounded-lg shadow-md transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      aria-label="Download current code or generated code"
                    >
                      Download {analysisType === 'generate_code' ? "Generated " : ""}Code
                    </button>
                  )}
                  <button
                    onClick={handleAIFeedbackRequest}
                    disabled={isMainFeedbackButtonDisabled}
                    className="w-full sm:w-auto bg-accent-action hover:bg-accent-actionHover text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    aria-label={feedbackButtonText()}
                  >
                    {(isLoading && !isSequentialLoading && !isLoadingRepoData && !isLoadingGCSData && !isLoadingDriveData) && <LoadingSpinner size="sm" className="mr-2" />}
                    {feedbackButtonText()}
                  </button>
              </div>
            )}
          </div>
        </div>

        {/* Output Panel (Right) */}
        <div className={`lg:w-3/5 flex flex-col bg-primary-light rounded-lg shadow-xl relative
                         ${isOutputExpanded ? 'lg:h-auto' : 'lg:max-h-[70vh]'} 
                         scrollbar-thin scrollbar-thumb-secondary scrollbar-track-primary`}>
          {/* Sticky Header for Output Panel */}
          <div className="sticky top-0 bg-primary-light z-20 p-4 border-b border-secondary flex justify-between items-center">
            <h3 className="text-xl sm:text-2xl font-semibold text-accent">{getFeedbackTitle()}</h3>
            <button
              onClick={() => setIsOutputExpanded(!isOutputExpanded)}
              className="p-1.5 rounded-md text-accent-light hover:bg-secondary hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent-action"
              aria-label={isOutputExpanded ? "Collapse output panel" : "Expand output panel"}
            >
              {isOutputExpanded ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9M20.25 20.25h-4.5m4.5 0v-4.5m0-4.5L15 15" />
                </svg>
              )}
            </button>
          </div>

          {/* Scrollable Content Area */}
          <div className={`flex-grow p-4 space-y-6 ${!isOutputExpanded ? 'overflow-y-auto' : ''}`}>
              <div aria-live="assertive" className="w-full">
                  {error && <ErrorMessage message={error} />}
              </div>
              
              {( (isLoading && !isSequentialLoading) || isLoadingRepoData || isLoadingGCSData || isLoadingDriveData || isSequentialLoading) && !feedback && !error && !suggestedCodeEdit && !generatedCode && (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px]"> {/* Ensure some min height for spinner */}
                <LoadingSpinner />
                <p className="mt-4 text-accent-light">
                  {isSequentialLoading ? `Fetching AI ${sequentialFileAction} for ${currentFileName}...` :
                  (isLoadingRepoData ? `Loading GitHub path: ${currentGitHubPath || '/'}...` :
                  (isLoadingGCSData ? 'Loading GCS object data...' :
                  (isLoadingDriveData ? 'Loading Google Drive file data...' :
                  (isLoading ? `Fetching AI ${analysisType.replace('_', ' ')}...` : 'Loading...'))))}
                </p>
              </div>
              )}
            
            <div aria-live="polite" className="w-full space-y-6">
                {(feedback || suggestedCodeEdit || generatedCode) && (
                  <>
                      {feedback && !(isLoading || isSequentialLoading) && (
                          <div className="mb-6">
                              <h4 className="text-lg font-semibold text-accent-light mb-2">Explanation / Details:</h4>
                              <FeedbackDisplay 
                                  feedback={feedback} 
                                  title="" // Title is now part of the panel header
                              />
                          </div>
                      )}

                      {suggestedCodeEdit && !(isLoading || isSequentialLoading) && (
                          <div className="mb-6">
                              <h4 className="text-lg font-semibold text-accent-light mb-2">Suggested Code Modifications:</h4>
                              <pre className="font-mono text-sm bg-primary p-4 rounded-md overflow-x-auto whitespace-pre-wrap break-words">{suggestedCodeEdit}</pre>
                              <button
                                  onClick={handleApplyAIEdits}
                                  className="mt-4 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-150 ease-in-out"
                              >
                                  Apply These Edits to Editor
                              </button>
                          </div>
                      )}
                      {generatedCode && !(isLoading || isSequentialLoading) && (
                          <div>
                              <h4 className="text-lg font-semibold text-accent-light mb-2">Generated Code (Target: {SUPPORTED_LANGUAGES.find(l => l.value === language)?.label || language}):</h4>
                              <pre className="font-mono text-sm bg-primary p-4 rounded-md overflow-x-auto whitespace-pre-wrap break-words">{generatedCode}</pre>
                              <div className="mt-4 flex space-x-3">
                                  <button
                                      onClick={handleCopyGeneratedCode}
                                      className="bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-150 ease-in-out"
                                  >
                                      Copy Generated Code
                                  </button>
                                  <button
                                      onClick={handleLoadGeneratedCodeToEditor}
                                      className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-150 ease-in-out"
                                  >
                                      Load to Editor & Clear
                                  </button>
                              </div>
                          </div>
                      )}
                  </>
                )}
            </div>
          </div> {/* End Scrollable Content Area */}
          
          {/* Sticky Footer for Output Panel */}
          {showClearOutputButton && (
            <div className="sticky bottom-0 bg-primary-light z-20 p-4 border-t border-secondary mt-auto flex justify-end">
              <button
                onClick={handleClearOutput}
                className="bg-secondary hover:bg-secondary-light text-accent font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-150 ease-in-out"
                aria-label="Clear AI output and error messages"
              >
                Clear Output
              </button>
            </div>
          )}
        </div> {/* End Output Panel */}

      </main>
      <footer className="text-center py-4 text-secondary-light text-sm border-t border-secondary">
        Powered by configured AI Provider, GitHub API, GCS, Google Drive & React.
      </footer>

      {showSettingsModal && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          currentSettings={aiSettings}
          onSave={handleSaveSettings}
          providerOptions={AI_PROVIDER_OPTIONS}
          openAiModels={OPENAI_MODELS}
          groqModels={GROQ_MODELS}
          onTestConnection={handleTestProviderConnection}
        />
      )}
    </div>
  );
};

export default App;
