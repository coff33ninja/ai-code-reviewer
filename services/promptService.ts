export interface PromptContent {
  system: string; // System message or initial context
  user: string;   // User's direct query or code block
}

export const getReviewPromptContent = (code: string, language: string): PromptContent => ({
  system: `You are an expert code reviewer. Your task is to provide a comprehensive and constructive review of the provided code snippet. Focus on correctness, best practices, readability, performance, and security. Provide feedback in markdown, starting with a brief overall summary.`,
  user: `Language: ${language}\n\nCode to review:\n\`\`\`${language}\n${code}\n\`\`\`\n\nReview:`
});

export const getInsightsPromptContent = (code: string, language: string): PromptContent => ({
  system: `You are an expert code analyst. Your task is to provide high-level insights about the provided code snippet (single file). Focus on main purpose, key components, notable patterns, and high-level observations. Provide insights in markdown. Be concise.`,
  user: `Language: ${language}\n\nCode to analyze:\n\`\`\`${language}\n${code}\n\`\`\`\n\nInsights:`
});

export const getSuggestEditsPromptContent = (code: string, language: string): PromptContent => ({
  system: `You are an AI assistant that helps improve code.
Review the provided code, identify areas for improvement, and provide the complete, edited version of the code that incorporates your suggestions.
Instructions:
1. First, provide a clear, concise explanation of the changes you are suggesting and why. Use markdown for this explanation.
2. After your explanation, provide the complete, modified code block. Enclose the modified code block within triple backticks, specifying the language (e.g., \`\`\`${language} ...code... \`\`\`).
Ensure no other text follows the final triple backticks of the code block.`,
  user: `Language: ${language}\n\nOriginal Code:\n\`\`\`${language}\n${code}\n\`\`\`\n\nExplanation of Changes:\n[Your explanation here]\n\nModified Code:`
});

export const getGenerateCodePromptContent = (description: string, targetLanguage: string): PromptContent => ({
  system: `You are an AI code generation assistant. Your task is to generate a functional code snippet based on the user's description in the specified target language.
Instructions:
1. First, provide a brief explanation of the generated code and how it addresses the user's request. Use markdown for this explanation.
2. After your explanation, provide the complete, generated code block. Enclose the generated code block within triple backticks, specifying the language (e.g., \`\`\`${targetLanguage} ...code... \`\`\`).
Ensure no other text follows the final triple backticks of the code block.
If the request is too complex for a single snippet, generate the core functionality and suggest how it could be expanded.`,
  user: `Target Language: ${targetLanguage}\n\nDescription of code to generate:\n${description}\n\nExplanation of Generated Code:\n[Your explanation here]\n\nGenerated Code:`
});


export const parseSuggestedEdits = (responseText: string, language: string): { explanation: string, modifiedCode: string | null } => {
  // Regex to find the code block, trying to be flexible with language specifier (or lack thereof for plain text)
  const langPattern = language.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape special characters in language name
  const codeBlockRegex = new RegExp("```(?:[a-zA-Z0-9_\\-]*" + langPattern + "[a-zA-Z0-9_\\-]*)?\\s*([\\s\\S]*?)\\s*```", "s");
  const match = responseText.match(codeBlockRegex);
  
  let explanation = responseText;
  let modifiedCode = null;

  if (match && typeof match[1] === 'string') { // Check if match[1] exists and is a string
    modifiedCode = match[1].trim();
    // Attempt to extract explanation occurring before the code block
    explanation = responseText.substring(0, match.index).trim();
    
    // Clean up common preamble phrases if they are very close to the code block start
    const modifiedCodePreambleIndex = explanation.toLowerCase().lastIndexOf("modified code:");
    const generatedCodePreambleIndex = explanation.toLowerCase().lastIndexOf("generated code:");
    const explanationPreambleIndex = explanation.toLowerCase().lastIndexOf("explanation of changes:");
    const explanationGeneratedPreambleIndex = explanation.toLowerCase().lastIndexOf("explanation of generated code:");


    if (modifiedCodePreambleIndex > -1 && explanation.substring(modifiedCodePreambleIndex).length < 25) { 
        explanation = explanation.substring(0, modifiedCodePreambleIndex).trim();
    } else if (generatedCodePreambleIndex > -1 && explanation.substring(generatedCodePreambleIndex).length < 25) {
        explanation = explanation.substring(0, generatedCodePreambleIndex).trim();
    }

    if (explanationPreambleIndex > -1 && explanation.substring(explanationPreambleIndex).length < 30) { 
        explanation = explanation.substring(0, explanationPreambleIndex).trim();
    } else if (explanationGeneratedPreambleIndex > -1 && explanation.substring(explanationGeneratedPreambleIndex).length < 40) {
        explanation = explanation.substring(0, explanationGeneratedPreambleIndex).trim();
    }

    // If explanation is empty after trying to clean preambles, check if there's text after the code block
    if (!explanation.trim() && responseText.length > (match.index || 0) + match[0].length) {
        const potentialExplanationAfter = responseText.substring((match.index || 0) + match[0].length).trim();
        if (potentialExplanationAfter.length > 20) { // Arbitrary threshold to consider it an explanation
            explanation = potentialExplanationAfter;
        }
    }

  } else {
    console.warn("Could not find a clearly formatted code block in AI response. The full response will be used as explanation.");
  }
  
  if (explanation === responseText && !modifiedCode) {
    // No specific code block found.
  } else if (!explanation.trim() && modifiedCode) {
    explanation = "(AI provided code without a separate explanation, or explanation parsing failed.)";
  } else if (!explanation.trim() && !modifiedCode) {
    explanation = "(AI response was empty or not in the expected format.)";
  }

  return { explanation, modifiedCode };
};