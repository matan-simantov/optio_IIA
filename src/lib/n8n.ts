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
 * Call backend API endpoint for chat
 * 
 * The API URL is read from VITE_API_URL environment variable.
 * This function calls the backend which proxies to n8n.
 * 
 * @param userText The user's message text
 * @param sessionId Optional session ID if available in state
 * @returns Promise resolving to the response from backend (which proxies n8n)
 * @throws Error if the API URL is not configured or request fails
 */
export async function callN8nWebhook(userText: string, sessionId?: string | null): Promise<N8nResponseItem> {
  // Read API URL from environment variable (required, no default)
  const API_URL = import.meta.env.VITE_API_URL;

  if (!API_URL) {
    throw new Error("Missing VITE_API_URL environment variable");
  }

  // Construct the backend endpoint URL
  const backendUrl = `${API_URL}/api/chat`;

  // Dev-only: Log the resolved backend URL
  if (import.meta.env.DEV) {
    console.log("[DEV] Calling backend endpoint:", backendUrl);
    if (sessionId) {
      console.log("[DEV] Including session_id:", sessionId);
    }
  }

  // Prepare the payload for backend
  const payload: { message: string; session_id?: string } = {
    message: userText,
  };
  
  // Include session_id if provided
  if (sessionId) {
    payload.session_id = sessionId;
  }

  // Make POST request to backend
  let response: Response;
  try {
    response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (fetchError) {
    // Network error or fetch failed
    console.error("[DEV] Fetch error:", fetchError);
    throw new Error(`Failed to connect to backend: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}`);
  }

  // Dev-only: Log HTTP status
  if (import.meta.env.DEV) {
    console.log("[DEV] HTTP Status:", response.status, response.statusText);
  }

  // Get response text first to handle empty responses
  const responseText = await response.text();

  // Dev-only: Log raw response text and status code for debugging
  if (import.meta.env.DEV) {
    console.log("[DEV] Response status code:", response.status);
    console.log("[DEV] Raw response body:", responseText);
  }

  // Check if request was successful
  if (!response.ok) {
    // Try to parse error response
    let errorBody = responseText;
    try {
      const errorJson = JSON.parse(responseText);
      errorBody = errorJson.error || JSON.stringify(errorJson);
    } catch {
      // Use raw text if not JSON
    }
    throw new Error(`Backend request failed: ${response.status} ${response.statusText}. ${errorBody}`);
  }

  // Check if response is empty
  if (!responseText || responseText.trim() === "") {
    throw new Error("Backend returned empty response");
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
    throw new Error(`Invalid JSON response from backend: ${parseError instanceof Error ? parseError.message : "Unknown parse error"}. Response: ${responseText.substring(0, 200)}`);
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
      throw new Error("Backend returned empty array");
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
    throw new Error(`Backend response missing LLM data. Expected either root-level fields (technology_guess, confirmation_question) or nested llm object. Full response: ${JSON.stringify(item)}`);
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

