/**
 * Type definitions for the XRL Chat UI
 */

// Message roles: user or assistant
export type MessageRole = "user" | "assistant";

// Connection status for the webhook
export type ConnectionStatus = "idle" | "sending" | "success" | "failed";

// Status of a message (for user messages that trigger webhooks)
export type MessageStatus = "sending" | "success" | "error";

// Debug information attached to assistant messages
export interface DebugInfo {
  rawResponse: string | object; // Raw response from webhook (JSON string or parsed object)
  duration: number; // Request duration in milliseconds
  httpStatus?: number; // HTTP status code if available
  error?: string; // Error message if request failed
}

// Chat message structure
export interface Message {
  id: string; // Unique identifier for the message
  role: MessageRole; // Whether it's from user or assistant
  content: string; // Message text content
  createdAt: string; // ISO timestamp
  status?: MessageStatus; // Status for user messages (sending/success/error)
  debug?: DebugInfo; // Debug information (only for assistant messages with webhook responses)
}

// Webhook request payload
export interface WebhookPayload {
  message: string; // User's message text
  source: string; // Source identifier (e.g., "local-ui")
  client_ts: string; // ISO timestamp from client
}

// Webhook response structure (what we expect from n8n)
export interface WebhookResponse {
  session_id?: string; // Session ID if created
  vuk_id?: string; // VUK ID if created
  status?: string; // Status of the operation
  message?: string; // Response message from n8n
  [key: string]: unknown; // Allow additional fields
}

