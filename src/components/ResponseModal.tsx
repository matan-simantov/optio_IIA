/**
 * Response Modal component
 * Displays the raw response from n8n in a modal dialog
 */

interface ResponseModalProps {
  responses: unknown[]; // All responses from n8n
  isOpen: boolean; // Whether the modal is open
  onClose: () => void; // Callback to close the modal
  isPolling?: boolean; // Whether polling is active
}

/**
 * Format response for display (pretty-print JSON)
 */
function formatResponse(response: unknown): string {
  if (response === null || response === undefined) {
    return "No response data";
  }
  try {
    return JSON.stringify(response, null, 2);
  } catch {
    return String(response);
  }
}

export function ResponseModal({ responses, isOpen, onClose, isPolling = false }: ResponseModalProps) {
  if (!isOpen || responses.length === 0) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-800">
                n8n Responses ({responses.length})
              </h2>
              {isPolling && (
                <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                  Polling...
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4 bg-gray-50">
            <div className="space-y-4">
              {responses.map((response, index) => (
                <div key={index} className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">
                      Response #{index + 1}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date().toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="text-sm font-mono text-gray-800 whitespace-pre-wrap break-words">
                    {formatResponse(response)}
                  </pre>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 bg-white">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

