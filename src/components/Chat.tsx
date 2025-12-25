/**
 * Main chat component
 * Handles message display, input, and webhook integration
 */

import { useState, useEffect, useRef } from "react";
import type { Message, ConnectionStatus } from "../types";
import { MessageBubble } from "./MessageBubble";
import { ResponseModal } from "./ResponseModal";
import { callN8nWebhook, type BackendResponse } from "../lib/n8n";
import { loadChatHistory, saveChatHistory, clearChatHistory } from "../lib/storage";

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [isSending, setIsSending] = useState(false);
  const [allResponses, setAllResponses] = useState<unknown[]>([]); // Store all responses received
  const [isModalOpen, setIsModalOpen] = useState(false); // Control modal visibility
  // Store session_id and vuk_id in state for later use (not implemented yet)
  const [_sessionId, setSessionId] = useState<string | null>(null); // Store session_id from n8n response (for later use)
  const [_vukId, setVukId] = useState<string | null>(null); // Store vuk_id from n8n response (for later use)
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  // Debug flag for console logs (set to false to disable)
  const DEBUG = true;

  /**
   * Extract assistant text from backend response with fallback chain
   * Priority: assistant_text > n8n_raw.llm.confirmation_question > n8n_raw.llm_raw > generic message
   * 
   * @param data Backend response object
   * @returns Extracted assistant text string
   */
  const extractAssistantText = (data: BackendResponse): string => {
    // 1. Prefer assistant_text if non-empty
    if (data.assistant_text && typeof data.assistant_text === "string" && data.assistant_text.trim() !== "") {
      if (DEBUG) {
        console.log("[Chat] Using assistant_text:", data.assistant_text.substring(0, 100));
      }
      return data.assistant_text;
    }

    // 2. Fallback to n8n_raw.llm.confirmation_question if present
    if (data.n8n_raw && typeof data.n8n_raw === "object") {
      try {
        const n8nRaw = data.n8n_raw as any;
        if (DEBUG) {
          console.log("[Chat] n8n_raw structure:", {
            hasLlm: !!n8nRaw.llm,
            llmKeys: n8nRaw.llm ? Object.keys(n8nRaw.llm) : [],
          });
        }
        if (n8nRaw.llm && typeof n8nRaw.llm === "object") {
          const confirmationQuestion = n8nRaw.llm.confirmation_question;
          if (confirmationQuestion && typeof confirmationQuestion === "string" && confirmationQuestion.trim() !== "") {
            if (DEBUG) {
              console.log("[Chat] Using n8n_raw.llm.confirmation_question:", confirmationQuestion.substring(0, 100));
            }
            return confirmationQuestion;
          }
        }
      } catch (e) {
        if (DEBUG) {
          console.error("[Chat] Error accessing n8n_raw.llm:", e);
        }
      }
    }

    // 3. Fallback to n8n_raw.llm_raw if present
    if (data.n8n_raw && typeof data.n8n_raw === "object") {
      try {
        const n8nRaw = data.n8n_raw as any;
        if (n8nRaw.llm_raw && typeof n8nRaw.llm_raw === "string" && n8nRaw.llm_raw.trim() !== "") {
          if (DEBUG) {
            console.log("[Chat] Using n8n_raw.llm_raw:", n8nRaw.llm_raw.substring(0, 100));
          }
          return n8nRaw.llm_raw;
        }
      } catch (e) {
        if (DEBUG) {
          console.error("[Chat] Error accessing n8n_raw.llm_raw:", e);
        }
      }
    }

    // 4. Last resort: generic message
    if (DEBUG) {
      console.warn("[Chat] No assistant text found, using fallback message");
    }
    return "(No assistant text returned)";
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

    // Create thinking message (temporary) with "Thinking..." text
    const thinkingId = `pending-${Date.now()}`;
    const thinkingMessage: Message = {
      id: thinkingId,
      role: "assistant",
      content: "Thinking…",
      createdAt: new Date().toISOString(),
      status: "sending",
    };

    // Add thinking message immediately
    setMessages([...updatedMessages, thinkingMessage]);

    // Log request URL (no secrets)
    const API_URL = import.meta.env.VITE_API_URL;
    const requestUrl = `${API_URL}/api/chat`;
    console.log("[Chat] Request URL:", requestUrl);

    try {
      // Call backend API (which proxies to n8n)
      // Pass session_id and vuk_id if we have them in state
      const backendResponse = await callN8nWebhook(userMessage.content, _sessionId, _vukId);

      // Log response status
      console.log("[Chat] Response status: ok =", backendResponse.ok);
      
      // Debug: Log raw JSON response
      if (DEBUG) {
        console.log("[Chat] Raw JSON response:", JSON.stringify(backendResponse, null, 2));
      }

      // Extract assistant text using helper function
      const displayText = extractAssistantText(backendResponse);

      // Debug: Log chosen display text
      if (DEBUG) {
        console.log("[Chat] Chosen displayText:", displayText);
      }

      // Store the raw response for the response panel
      setAllResponses([backendResponse.n8n_raw || backendResponse]);

      // Update user message status
      const userMessageUpdated: Message = {
        ...userMessage,
        status: "success",
      };

      // Format the final message content
      // If we have assistant_json with confirmation_question, format it nicely
      // Otherwise, check n8n_raw.llm for formatted display
      // Otherwise, use the extracted display text directly
      let finalContent = displayText;
      
      // Check assistant_json first
      if (backendResponse.assistant_json && backendResponse.assistant_json.confirmation_question) {
        const json = backendResponse.assistant_json;
        const technology_guess = json.technology_guess || "Unknown";
        const confidence = json.confidence || 0;
        const confidencePercent = Math.round(confidence * 100);
        finalContent = `Technology: ${technology_guess}\nConfidence: ${confidencePercent}%\n\n${json.confirmation_question}`;
      }
      // Fallback: check n8n_raw.llm for formatted display
      else if (backendResponse.n8n_raw && typeof backendResponse.n8n_raw === "object") {
        try {
          const n8nRaw = backendResponse.n8n_raw as any;
          if (n8nRaw.llm && typeof n8nRaw.llm === "object" && n8nRaw.llm.confirmation_question) {
            const technology_guess = n8nRaw.llm.technology_guess || "Unknown";
            const confidence = n8nRaw.llm.confidence || 0;
            const confidencePercent = Math.round(confidence * 100);
            finalContent = `Technology: ${technology_guess}\nConfidence: ${confidencePercent}%\n\n${n8nRaw.llm.confirmation_question}`;
          }
        } catch (e) {
          // If formatting fails, use displayText as-is
          if (DEBUG) {
            console.error("[Chat] Error formatting from n8n_raw.llm:", e);
          }
        }
      }

      // Debug: Log final content that will be displayed
      if (DEBUG) {
        console.log("[Chat] Final content to display:", finalContent.substring(0, 200));
      }

      // Create final assistant message with formatted content
      // Make sure status is not "sending" so MessageBubble doesn't show thinking indicator
      const assistantMessage: Message = {
        id: thinkingId,
        role: "assistant",
        content: finalContent,
        createdAt: new Date().toISOString(),
        status: undefined, // Explicitly set to undefined to ensure it's not "sending"
      };

      // Debug: Log the assistant message before replacing
      if (DEBUG) {
        console.log("[Chat] Assistant message to replace thinking:", {
          id: assistantMessage.id,
          contentLength: assistantMessage.content.length,
          contentPreview: assistantMessage.content.substring(0, 100),
        });
      }

      // Replace thinking message with final message and update user message
      // First, find the index of the thinking message
      const thinkingIndex = updatedMessages.findIndex((m) => m.id === thinkingId);
      
      if (DEBUG) {
        console.log("[Chat] Thinking message index:", thinkingIndex);
        console.log("[Chat] Total messages before replacement:", updatedMessages.length);
        console.log("[Chat] Thinking message before replacement:", {
          id: updatedMessages[thinkingIndex]?.id,
          content: updatedMessages[thinkingIndex]?.content,
          status: updatedMessages[thinkingIndex]?.status,
        });
      }

      // Create new array with replaced messages
      const finalMessages = updatedMessages.map((m) => {
        if (m.id === userMessage.id) {
          return userMessageUpdated;
        }
        if (m.id === thinkingId) {
          return assistantMessage;
        }
        return m;
      });

      // Debug: Verify the replacement worked
      if (DEBUG) {
        const replacedMessage = finalMessages.find((m) => m.id === thinkingId);
        console.log("[Chat] After replacement, message found:", {
          id: replacedMessage?.id,
          contentLength: replacedMessage?.content?.length || 0,
          contentPreview: replacedMessage?.content?.substring(0, 100) || "NOT FOUND",
          status: replacedMessage?.status,
        });
        console.log("[Chat] Total messages after replacement:", finalMessages.length);
      }

      setMessages(finalMessages);
      saveChatHistory(finalMessages);
      setConnectionStatus("success");
    } catch (error) {
      // Log error for debugging
      console.error("[Chat] Error calling backend:", error);
      
      // Handle errors - replace thinking message with error message
      const errorMessage: Message = {
        id: thinkingId,
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
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
        setConnectionStatus("idle");
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


  // Handle clear chat
  const handleClearChat = () => {
    if (confirm("Are you sure you want to clear the chat history?")) {
      setMessages([]);
      clearChatHistory();
      setConnectionStatus("idle");
      setAllResponses([]); // Clear all responses
      setSessionId(null); // Clear session_id
      setVukId(null); // Clear vuk_id
      setIsModalOpen(false); // Close modal if open
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
      </div>

      {/* Response Modal - shows all n8n responses in a modal */}
      <ResponseModal
        responses={allResponses}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isPolling={false}
      />
    </div>
  );
}

