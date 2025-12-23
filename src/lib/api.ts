/**
 * Webhook API integration for n8n
 */

import type { WebhookPayload, WebhookResponse, DebugInfo } from "../types";

// Default webhook URL (can be overridden via environment variable)
const DEFAULT_WEBHOOK_URL = "https://optio-xrl.app.n8n.cloud/webhook/xrl/session/create";

// Request timeout in milliseconds (20 seconds as specified)
const REQUEST_TIMEOUT = 20000;

/**
 * Get the webhook URL from environment variable or use default
 * @returns Webhook URL string
 */
function getWebhookUrl(): string {
  return import.meta.env.VITE_N8N_WEBHOOK_URL || DEFAULT_WEBHOOK_URL;
}

/**
 * Call the n8n webhook with the user's message
 * @param message User's message text
 * @returns Promise with response data and debug info
 */
export async function callWebhook(
  message: string
): Promise<{ response: WebhookResponse; debug: DebugInfo }> {
  const startTime = Date.now();
  const webhookUrl = getWebhookUrl();

  // Prepare the payload
  const payload: WebhookPayload = {
    message,
    source: "local-ui",
    client_ts: new Date().toISOString(),
  };

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    // Make the POST request
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    // Try to parse response as JSON
    let responseData: WebhookResponse;
    let rawResponseText = "";

    try {
      rawResponseText = await response.text();
      responseData = rawResponseText ? JSON.parse(rawResponseText) : {};
    } catch (parseError) {
      // If JSON parsing fails, treat as text response
      responseData = { message: rawResponseText };
    }

    // Check if response is successful (2xx status)
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${response.statusText || "Request failed"}`
      );
    }

    // Return successful response
    return {
      response: responseData,
      debug: {
        rawResponse: rawResponseText ? JSON.parse(rawResponseText) : {},
        duration,
        httpStatus: response.status,
      },
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    // Handle different error types
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        errorMessage = "Request timeout (20 seconds)";
      } else {
        errorMessage = error.message;
      }
    }

    // Return error response
    return {
      response: {
        status: "error",
        message: errorMessage,
      },
      debug: {
        rawResponse: {},
        duration,
        error: errorMessage,
      },
    };
  }
}

/**
 * Check for updates from n8n by calling the webhook again with session_id
 * This is used for polling to check if there are new responses
 * @param sessionId Session ID from the initial response
 * @returns Promise with response data and debug info
 */
export async function checkWebhookStatus(
  sessionId: string
): Promise<{ response: WebhookResponse; debug: DebugInfo }> {
  const startTime = Date.now();
  const webhookUrl = getWebhookUrl();

  // Prepare the payload with session_id to check status
  const payload = {
    session_id: sessionId,
    action: "check_status",
    source: "local-ui",
    client_ts: new Date().toISOString(),
  };

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    // Make the POST request
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    // Try to parse response as JSON
    let responseData: WebhookResponse;
    let rawResponseText = "";

    try {
      rawResponseText = await response.text();
      responseData = rawResponseText ? JSON.parse(rawResponseText) : {};
    } catch (parseError) {
      // If JSON parsing fails, treat as text response
      responseData = { message: rawResponseText };
    }

    // Return response (even if not 2xx, we want to see it)
    return {
      response: responseData,
      debug: {
        rawResponse: rawResponseText ? JSON.parse(rawResponseText) : {},
        duration,
        httpStatus: response.status,
      },
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    // Handle different error types
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        errorMessage = "Request timeout (20 seconds)";
      } else {
        errorMessage = error.message;
      }
    }

    // Return error response
    return {
      response: {
        status: "error",
        message: errorMessage,
      },
      debug: {
        rawResponse: {},
        duration,
        error: errorMessage,
      },
    };
  }
}

