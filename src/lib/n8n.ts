/**
 * n8n Webhook Integration
 * Helper function to send chat messages to n8n webhook
 */

/**
 * Response item structure from n8n webhook
 * The response can be in two formats:
 * 1. Direct format with llm fields at root level
 * 2. Nested format with session_id, vuk_id, and llm object
 */
export interface N8nResponseItem {
  // Optional fields (may not be present in all responses)
  session_id?: string;
  vuk_id?: string;
  llm_raw?: string;
  
  // LLM fields (can be at root level or nested in llm object)
  technology_guess?: string;
  confidence?: number;
  why?: string;
  confirmation_question?: string;
  
  // Nested llm object (alternative format)
  llm?: {
    technology_guess: string;
    confidence: number;
    why: string;
    confirmation_question: string;
  };
}

/**
 * Call n8n webhook with user message
 * 
 * The webhook URL is read from VITE_API_URL environment variable.
 * The response can be either an array with one object or a single object.
 * This function normalizes it to a single object.
 * 
 * @param userText The user's message text
 * @returns Promise resolving to the normalized response item
 * @throws Error if the webhook URL is not configured or request fails
 */
export async function callN8nWebhook(userText: string): Promise<N8nResponseItem> {
  // Read webhook URL from environment variable (required, no default)
  const API_URL = import.meta.env.VITE_API_URL;

  if (!API_URL) {
    throw new Error("Missing VITE_API_URL environment variable");
  }

  // Dev-only: Log the resolved webhook URL
  if (import.meta.env.DEV) {
    console.log("[DEV] Using webhook URL:", API_URL);
  }

  // Prepare the payload as specified
  const payload = {
    message: userText,
    source: "web",
  };

  // Make POST request to webhook
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  // Dev-only: Log HTTP status
  if (import.meta.env.DEV) {
    console.log("[DEV] HTTP Status:", response.status, response.statusText);
  }

  // Check if request was successful
  if (!response.ok) {
    // Try to get error message from response body
    let errorBody = "";
    try {
      const text = await response.text();
      errorBody = text ? ` Response body: ${text}` : "";
    } catch {
      // Ignore errors reading error body
    }
    throw new Error(`Webhook request failed: ${response.status} ${response.statusText}${errorBody}`);
  }

  // Get response text first to handle empty responses
  const responseText = await response.text();

  // Dev-only: Log raw response text
  if (import.meta.env.DEV) {
    console.log("[DEV] Raw response text:", responseText);
  }

  // Check if response is empty
  if (!responseText || responseText.trim() === "") {
    throw new Error("Webhook returned empty response");
  }

  // Parse JSON response
  let rawResponse: unknown;
  try {
    rawResponse = JSON.parse(responseText);
  } catch (parseError) {
    // Log the problematic response for debugging
    if (import.meta.env.DEV) {
      console.error("[DEV] Failed to parse JSON response:", responseText);
    }
    throw new Error(`Invalid JSON response from webhook: ${parseError instanceof Error ? parseError.message : "Unknown parse error"}. Response: ${responseText.substring(0, 200)}`);
  }

  // Dev-only: Log parsed JSON response
  if (import.meta.env.DEV) {
    console.log("[DEV] Parsed JSON response:", rawResponse);
  }

  // Normalize response: handle both array and single object cases
  let item: N8nResponseItem;
  if (Array.isArray(rawResponse)) {
    // If response is an array, take the first item
    if (rawResponse.length === 0) {
      throw new Error("Webhook returned empty array");
    }
    item = rawResponse[0] as N8nResponseItem;
  } else {
    // If response is a single object, use it directly
    item = rawResponse as N8nResponseItem;
  }

  // Normalize the response structure
  // If llm fields are at root level, we need to check if we have the required fields
  // If llm is nested, use the nested structure
  
  // Check if we have llm data (either at root or nested)
  const hasLlmAtRoot = item.technology_guess !== undefined || item.confirmation_question !== undefined;
  const hasLlmNested = item.llm !== undefined && item.llm.confirmation_question !== undefined;

  // Validate that we have at least some LLM data
  if (!hasLlmAtRoot && !hasLlmNested) {
    if (import.meta.env.DEV) {
      console.warn("[DEV] Response structure:", item);
    }
    throw new Error(`Webhook response missing LLM data. Expected either root-level fields (technology_guess, confirmation_question) or nested llm object. Full response: ${JSON.stringify(item)}`);
  }

  // Dev-only: Log validation info
  if (import.meta.env.DEV) {
    if (item.session_id) console.log("[DEV] session_id:", item.session_id);
    if (item.vuk_id) console.log("[DEV] vuk_id:", item.vuk_id);
    if (hasLlmAtRoot) console.log("[DEV] LLM data at root level");
    if (hasLlmNested) console.log("[DEV] LLM data nested in llm object");
  }

  return item;
}

