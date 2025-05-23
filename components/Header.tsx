
import React from 'react';
import { SettingsIcon } from './SettingsIcon'; // Import the new icon

interface HeaderProps {
  onToggleSettings: () => void; // Add prop to handle settings toggle
}

export const Header: React.FC<HeaderProps> = ({ onToggleSettings }) => {
  return (
    <header className="bg-secondary p-4 shadow-lg">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-accent-action mr-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
          </svg>
          <h1 className="text-3xl font-bold text-accent">AI Code Reviewer</h1>
        </div>
        <SettingsIcon onToggleSettings={onToggleSettings} />
      </div>
    </header>
  );
};