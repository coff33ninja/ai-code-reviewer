
import React from 'react';
import { LanguageOption } from '../types';

interface LanguageSelectorProps {
  languages: LanguageOption[];
  selectedLanguage: string;
  onChange: (language: string) => void;
  disabled?: boolean;
  // Fix: Added optional label prop to allow custom labels for the language selector.
  label?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ languages, selectedLanguage, onChange, disabled = false, label }) => {
  return (
    <div>
      <label htmlFor="languageSelect" className="block text-sm font-medium text-accent-light mb-1">
        {/* Use the provided label or a default value */}
        {label || "Select Language for File"}
      </label>
      <select
        id="languageSelect"
        value={selectedLanguage}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full p-3 bg-primary border border-secondary rounded-lg focus:ring-2 focus:ring-accent-action focus:border-accent-action outline-none transition-colors duration-150 text-accent disabled:opacity-70 disabled:cursor-not-allowed"
        aria-disabled={disabled}
      >
        {languages.map((lang) => (
          <option key={lang.value} value={lang.value} className="bg-primary text-accent">
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
};
