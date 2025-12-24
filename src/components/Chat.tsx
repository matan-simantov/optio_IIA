/**
 * Main chat component
 * Handles message display, input, and webhook integration
 */

import { useState, useEffect, useRef } from "react";
import type { Message, ConnectionStatus } from "../types";
import { MessageBubble } from "./MessageBubble";
import { ResponseModal } from "./ResponseModal";
import { callWebhook, checkWebhookStatus } from "../services/api";
import { loadChatHistory, saveChatHistory, clearChatHistory } from "../lib/storage";

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [isSending, setIsSending] = useState(false);
  const [lastResponse, setLastResponse] = useState<unknown>(null); // Store last n8n response
  const [allResponses, setAllResponses] = useState<unknown[]>([]); // Store all responses received
  const [isModalOpen, setIsModalOpen] = useState(false); // Control modal visibility
  const [isPolling, setIsPolling] = useState(false); // Track if polling is active
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const pollingTimeoutRef = useRef<number | null>(null);

  // Load chat history from localStorage on mount
  useEffect(() => {
    const history = loadChatHistory();
    if (history.length > 0) {
      setMessages(history);
    }
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Generate unique ID for messages
  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Format status message from webhook response
  const formatStatusMessage = (response: any): string => {
    const sessionId = response.session_id || "N/A";
    const vukId = response.vuk_id || "N/A";
    const status = response.status || "unknown";
    const responseMessage = response.message || "";

    if (status === "error" || responseMessage.toLowerCase().includes("error")) {
      return `❌ Run failed. Reason: ${responseMessage || "Unknown error"}`;
    }

    if (status === "partial" || responseMessage.toLowerCase().includes("partial")) {
      return `⚠️ Run partially completed. Session: ${sessionId}${vukId !== "N/A" ? ` VUK: ${vukId}` : ""}. ${responseMessage || ""}`;
    }

    return `✅ Run completed. Session: ${sessionId}${vukId !== "N/A" ? ` VUK: ${vukId}` : ""}. Data saved.`;
  };

  // Handle sending a message
  const handleSend = async () => {
    if (!input.trim() || isSending) return;

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: input.trim(),
      createdAt: new Date().toISOString(),
      status: "sending",
    };

    // Add user message immediately
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    saveChatHistory(updatedMessages);
    setInput("");
    setIsSending(true);
    setConnectionStatus("sending");

    // Create thinking message (temporary)
    const thinkingId = generateId();
    const thinkingMessage: Message = {
      id: thinkingId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      status: "sending",
    };

    setMessages([...updatedMessages, thinkingMessage]);

    try {
      // Call webhook
      const { response, debug } = await callWebhook(userMessage.content);

      // Store the raw response for the response panel
      setLastResponse(response);
      setAllResponses([response]); // Initialize with first response

      // Update user message status
      const userMessageUpdated: Message = {
        ...userMessage,
        status: response.status === "error" ? "error" : "success",
      };

      // Create final assistant message
      const assistantMessage: Message = {
        id: thinkingId,
        role: "assistant",
        content: formatStatusMessage(response),
        createdAt: new Date().toISOString(),
        debug: {
          rawResponse: debug.rawResponse,
          duration: debug.duration,
          httpStatus: debug.httpStatus,
          error: debug.error,
        },
      };

      // Replace thinking message with final message and update user message
      const finalMessages = updatedMessages
        .map((m) => (m.id === userMessage.id ? userMessageUpdated : m))
        .map((m) => (m.id === thinkingId ? assistantMessage : m));

      setMessages(finalMessages);
      saveChatHistory(finalMessages);
      setConnectionStatus(response.status === "error" ? "failed" : "success");

      // Start polling if we got a session_id
      if (response.session_id && response.status !== "error") {
        startPolling(response.session_id);
      }
    } catch (error) {
      // Store error response for the response panel
      setLastResponse({ error: String(error), status: "error" });

      // Handle unexpected errors
      const errorMessage: Message = {
        id: thinkingId,
        role: "assistant",
        content: `❌ Run failed. Reason: ${error instanceof Error ? error.message : "Unknown error"}`,
        createdAt: new Date().toISOString(),
        debug: {
          rawResponse: {},
          duration: 0,
          error: String(error),
        },
      };

      const userMessageUpdated: Message = {
        ...userMessage,
        status: "error",
      };

      const finalMessages = updatedMessages
        .map((m) => (m.id === userMessage.id ? userMessageUpdated : m))
        .map((m) => (m.id === thinkingId ? errorMessage : m));

      setMessages(finalMessages);
      saveChatHistory(finalMessages);
      setConnectionStatus("failed");
    } finally {
      setIsSending(false);
      // Reset connection status after a delay
      setTimeout(() => {
        if (connectionStatus !== "idle") {
          setConnectionStatus("idle");
        }
      }, 3000);
    }
  };

  // Handle Enter key (Shift+Enter for newline, Enter to send)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Start polling for updates from n8n
  const startPolling = (sessionId: string) => {
    // Stop any existing polling
    stopPolling();

    setIsPolling(true);
    const startTime = Date.now();
    const POLLING_INTERVAL = 3000; // 3 seconds
    const POLLING_DURATION = 30000; // 30 seconds
    
    // Store last response string for comparison
    const lastResponseRef = { value: JSON.stringify(allResponses[allResponses.length - 1] || {}) };

    // Poll every 3 seconds
    pollingIntervalRef.current = window.setInterval(async () => {
      try {
        const { response } = await checkWebhookStatus(sessionId);

        // Check if this is a new/different response
        const currentResponseString = JSON.stringify(response);
        const isNewResponse = currentResponseString !== lastResponseRef.value;

        if (isNewResponse) {
          // Add new response to the list
          setAllResponses((prev) => {
            const updated = [...prev, response];
            lastResponseRef.value = currentResponseString;
            return updated;
          });
          setLastResponse(response); // Update last response
        }
      } catch (error) {
        console.error("Polling error:", error);
      }

      // Stop polling after 30 seconds
      if (Date.now() - startTime >= POLLING_DURATION) {
        stopPolling();
      }
    }, POLLING_INTERVAL);

    // Set timeout to stop polling after 30 seconds
    pollingTimeoutRef.current = window.setTimeout(() => {
      stopPolling();
    }, POLLING_DURATION);
  };

  // Stop polling
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    setIsPolling(false);
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  // Handle clear chat
  const handleClearChat = () => {
    if (confirm("Are you sure you want to clear the chat history?")) {
      stopPolling(); // Stop any active polling
      setMessages([]);
      clearChatHistory();
      setConnectionStatus("idle");
      setLastResponse(null); // Clear response
      setAllResponses([]); // Clear all responses
      setIsModalOpen(false); // Close modal if open
    }
  };

  // Handle opening response modal
  const handleOpenResponseModal = () => {
    if (lastResponse) {
      setIsModalOpen(true);
    }
  };

  // Connection status badge styling
  const getStatusBadgeClass = (status: ConnectionStatus): string => {
    switch (status) {
      case "idle":
        return "bg-gray-200 text-gray-700";
      case "sending":
        return "bg-yellow-200 text-yellow-800";
      case "success":
        return "bg-green-200 text-green-800";
      case "failed":
        return "bg-red-200 text-red-800";
      default:
        return "bg-gray-200 text-gray-700";
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <h1 className="text-xl font-semibold text-gray-800">Optio</h1>
        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(
              connectionStatus
            )}`}
          >
            {connectionStatus.toUpperCase()}
          </div>
          <button
            onClick={handleClearChat}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
          >
            Clear Chat
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>Start a conversation by typing a message below.</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Shift+Enter for newline)"
            disabled={isSending}
            rows={1}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            style={{
              minHeight: "44px",
              maxHeight: "120px",
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>

        {/* Response button - appears after successful send */}
        {lastResponse !== null && (
          <div className="mt-3 flex justify-center">
            <button
              onClick={handleOpenResponseModal}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              View n8n Response
            </button>
          </div>
        )}
      </div>

      {/* Response Modal - shows all n8n responses in a modal */}
      <ResponseModal
        responses={allResponses}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isPolling={isPolling}
      />
    </div>
  );
}

