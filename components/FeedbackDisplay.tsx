
import React from 'react';

interface FeedbackDisplayProps {
  feedback: string;
  title?: string;
}

export const FeedbackDisplay: React.FC<FeedbackDisplayProps> = ({ feedback, title = "Review Feedback" }) => {
  return (
    <div className="bg-primary-light p-6 rounded-lg shadow-xl">
      <h2 className="text-2xl font-semibold text-accent mb-4">{title}</h2>
      <div className="prose prose-invert max-w-none bg-primary p-4 rounded-md overflow-x-auto">
        {/* Using a div with white-space: pre-wrap for better markdown rendering control if needed in future */}
        {/* For now, pre tag is fine for text output from Gemini which often includes markdown. */}
        <pre className="font-mono text-sm whitespace-pre-wrap break-words">{feedback}</pre>
      </div>
    </div>
  );
};
