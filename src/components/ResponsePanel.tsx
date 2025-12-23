/**
 * Response Panel component
 * Displays the raw response received from n8n webhook
 * Small panel at the bottom of the platform
 */

import { useState } from "react";

interface ResponsePanelProps {
  response: unknown | null; // The raw response from n8n
  isVisible: boolean; // Whether the panel should be visible
}

/**
 * Format response for display (pretty-print JSON)
 */
function formatResponse(response: unknown): string {
  if (response === null || response === undefined) {
    return "No response yet";
  }
  try {
    return JSON.stringify(response, null, 2);
  } catch {
    return String(response);
  }
}

export function ResponsePanel({ response, isVisible }: ResponsePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isVisible || !response) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 shadow-lg z-40 max-w-full">
      {/* Header - always visible */}
      <div
        className="px-4 py-2 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              n8n Response
            </span>
            <span className="text-xs text-gray-500">
              (Click to {isExpanded ? "collapse" : "expand"})
            </span>
          </div>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {/* Content - visible when expanded */}
      {isExpanded && (
        <div className="p-4 max-h-64 overflow-auto bg-gray-50">
          <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap break-words">
            {formatResponse(response)}
          </pre>
        </div>
      )}
    </div>
  );
}

