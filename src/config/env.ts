/**
 * Environment configuration
 * Centralized management of environment variables
 */

// Default webhook URL (can be overridden via environment variable)
const DEFAULT_WEBHOOK_URL = "https://optio-xrl.app.n8n.cloud/webhook/xrl/session/create";

// Default status poll URL (can be overridden via environment variable)
// If not set, uses the webhook URL for status checks
const DEFAULT_STATUS_POLL_URL = DEFAULT_WEBHOOK_URL;

/**
 * Get the webhook URL from environment variable or use default
 * @returns Webhook URL string
 */
export function getWebhookUrl(): string {
  return import.meta.env.VITE_N8N_WEBHOOK_URL || DEFAULT_WEBHOOK_URL;
}

/**
 * Get the status poll URL from environment variable or use default
 * @returns Status poll URL string
 */
export function getStatusPollUrl(): string {
  return import.meta.env.VITE_N8N_STATUS_POLL_URL || DEFAULT_STATUS_POLL_URL;
}

