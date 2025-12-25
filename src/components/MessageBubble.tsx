/**
 * Message bubble component for displaying chat messages
 * Supports user and assistant messages with different styling
 * Includes debug panel for assistant messages with webhook responses
 */

import { useState } from "react";
import type { Message } from "../types";
import { ThinkingDots } from "./ThinkingDots";
import { useTypewriter } from "../hooks/useTypewriter";

interface MessageBubbleProps {
  message: Message;
}

/**
 * Format a timestamp to a readable time string
 */
function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/**
 * Pretty-print JSON for debug display
 */
function formatDebugResponse(rawResponse: string | object): string {
  try {
    if (typeof rawResponse === "string") {
      const parsed = JSON.parse(rawResponse);
      return JSON.stringify(parsed, null, 2);
    }
    return JSON.stringify(rawResponse, null, 2);
  } catch {
    return String(rawResponse);
  }
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [showDebug, setShowDebug] = useState(false);
  const isUser = message.role === "user";
  // Show thinking indicator if it's an assistant message with "Thinking…" content and sending status
  const isThinking = !isUser && (message.content === "Thinking…" || message.content === "") && message.status === "sending";
  const hasDebug = message.debug !== undefined;

  // Use typewriter effect for assistant messages (only when content exists and not thinking)
  const shouldType = !isUser && !isThinking && message.content.length > 0;
  const { displayedText, isTyping } = useTypewriter({
    text: message.content,
    speed: 30,
    enabled: shouldType,
  });

  return (
    <div
      className={`flex w-full mb-4 ${
        isUser ? "justify-start" : "justify-end"
      }`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? "bg-gray-100 text-gray-900 border border-gray-200"
            : "bg-blue-500 text-white"
        }`}
      >
        {/* Message content */}
        <div className="whitespace-pre-wrap break-words">
          {isThinking ? (
            <ThinkingDots />
          ) : isUser ? (
            message.content
          ) : (
            <>
              {displayedText}
              {isTyping && (
                <span className="inline-block w-2 h-4 bg-gray-600 ml-1 animate-pulse" />
              )}
            </>
          )}
        </div>

        {/* Timestamp */}
        <div
          className={`text-xs mt-2 ${
            isUser ? "text-gray-500" : "text-blue-100"
          }`}
        >
          {formatTime(message.createdAt)}
        </div>

        {/* Debug panel for assistant messages with webhook responses */}
        {!isUser && hasDebug && (
          <div className="mt-3 pt-3 border-t border-gray-300">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="text-xs text-gray-600 hover:text-gray-800 underline"
            >
              {showDebug ? "Hide" : "Show"} Debug
            </button>
            {showDebug && message.debug && (
              <div className="mt-2 text-xs">
                <div className="mb-2">
                  <strong>Duration:</strong> {message.debug.duration}ms
                </div>
                {message.debug.httpStatus && (
                  <div className="mb-2">
                    <strong>HTTP Status:</strong> {message.debug.httpStatus}
                  </div>
                )}
                {message.debug.error && (
                  <div className="mb-2 text-red-600">
                    <strong>Error:</strong> {message.debug.error}
                  </div>
                )}
                <div className="mt-2">
                  <strong>Raw Response:</strong>
                  <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-auto max-h-48">
                    {formatDebugResponse(message.debug.rawResponse)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

