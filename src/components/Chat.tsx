/**
 * Main chat component
 * Handles message display, input, and webhook integration
 */

import { useState, useEffect, useRef } from "react";
import type { Message, ConnectionStatus } from "../types";
import { MessageBubble } from "./MessageBubble";
import { ResponseModal } from "./ResponseModal";
import { callN8nWebhook } from "../lib/n8n";
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

  // Format assistant message from n8n response
  const formatN8nResponseMessage = (item: { llm: { technology_guess: string; confidence: number; confirmation_question: string } }): string => {
    const { technology_guess, confidence, confirmation_question } = item.llm;
    const confidencePercent = Math.round(confidence * 100);
    
    return `Technology: ${technology_guess}\nConfidence: ${confidencePercent}%\n\n${confirmation_question}`;
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
      // Call n8n webhook
      const item = await callN8nWebhook(userMessage.content);

      // Store session_id and vuk_id in state for later use
      setSessionId(item.session_id);
      setVukId(item.vuk_id);

      // Store the raw response for the response panel
      setAllResponses([item]); // Initialize with first response

      // Update user message status
      const userMessageUpdated: Message = {
        ...userMessage,
        status: "success",
      };

      // Create final assistant message with formatted content
      const assistantMessage: Message = {
        id: thinkingId,
        role: "assistant",
        content: formatN8nResponseMessage(item),
        createdAt: new Date().toISOString(),
      };

      // Replace thinking message with final message and update user message
      const finalMessages = updatedMessages
        .map((m) => (m.id === userMessage.id ? userMessageUpdated : m))
        .map((m) => (m.id === thinkingId ? assistantMessage : m));

      setMessages(finalMessages);
      saveChatHistory(finalMessages);
      setConnectionStatus("success");
    } catch (error) {
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

