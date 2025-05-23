import React from 'react';

interface CodeInputProps {
  code: string;
  onChange: (code: string) => void;
  language: string;
  readOnly?: boolean;
  ariaLabel?: string;
  placeholder?: string; // New optional placeholder prop
}

export const CodeInput: React.FC<CodeInputProps> = ({ 
  code, 
  onChange, 
  language, 
  readOnly = false, 
  ariaLabel,
  placeholder 
}) => {
  const defaultLabelText = ariaLabel || (readOnly ? `Viewing code (${language})` : `Edit your ${language.charAt(0).toUpperCase() + language.slice(1)} code below:`);
  
  // Determine the placeholder text
  const effectivePlaceholder = placeholder || 
                              (readOnly ? "// Code loaded from external source" : `// Your ${language} code here...`);

  return (
    <div className="mt-4">
      <label htmlFor="codeInput" className="block text-sm font-medium text-accent-light mb-1">
        {defaultLabelText}
      </label>
      <textarea
        id="codeInput"
        value={code}
        onChange={(e) => onChange(e.target.value)}
        placeholder={effectivePlaceholder} // Use the determined placeholder
        className={`w-full h-96 p-4 font-mono text-sm bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action focus:border-accent-action outline-none transition-colors duration-150 ${readOnly ? 'bg-secondary/30 cursor-default' : ''}`}
        spellCheck="false"
        readOnly={readOnly}
        aria-readonly={readOnly}
        aria-label={defaultLabelText}
      />
    </div>
  );
};