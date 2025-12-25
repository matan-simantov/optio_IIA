/**
 * n8n Webhook Integration
 * Helper function to send chat messages to n8n webhook
 */

/**
 * Backend API response structure
 * The backend normalizes n8n responses and returns a stable format
 */
export interface BackendResponse {
  ok: boolean;
  assistant_text: string;
  assistant_json: {
    technology_guess?: string;
    confidence?: number;
    why?: string;
    confirmation_question?: string;
    [key: string]: unknown;
  } | null;
  n8n_raw?: unknown;
  error?: string;
}

/**
 * Call backend API endpoint for chat
 * 
 * The API URL is read from VITE_API_URL environment variable (should be https://xrl.onrender.com).
 * This function calls the backend which proxies to n8n and normalizes the response.
 * 
 * @param userText The user's message text
 * @param sessionId Optional session ID if available in state
 * @param vukId Optional VUK ID if available in state
 * @returns Promise resolving to the normalized backend response
 * @throws Error if the API URL is not configured or request fails
 */
export async function callN8nWebhook(
  userText: string,
  sessionId?: string | null,
  vukId?: string | null
): Promise<BackendResponse> {
  // Read API URL from environment variable (required, no default)
  const API_URL = import.meta.env.VITE_API_URL;

  if (!API_URL) {
    throw new Error("Missing VITE_API_URL environment variable");
  }

  // Construct the backend endpoint URL
  const backendUrl = `${API_URL}/api/chat`;

  // Dev-only: Log the resolved backend URL and request details
  if (import.meta.env.DEV) {
    console.log("[DEV] Request URL:", backendUrl);
    if (sessionId) {
      console.log("[DEV] Including session_id:", sessionId);
    }
    if (vukId) {
      console.log("[DEV] Including vuk_id:", vukId);
    }
  }

  // Prepare the payload for backend
  const payload: { message: string; session_id?: string; vuk_id?: string } = {
    message: userText,
  };
  
  // Include session_id and vuk_id if provided
  if (sessionId) {
    payload.session_id = sessionId;
  }
  if (vukId) {
    payload.vuk_id = vukId;
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

  // Log HTTP status code (always, not just in dev)
  console.log("[Chat] HTTP Status:", response.status, response.statusText);

  // Parse JSON response from backend
  let backendResponse: BackendResponse;
  try {
    backendResponse = await response.json();
  } catch (parseError) {
    // If JSON parsing fails, try to get text for error message
    const responseText = await response.text();
    if (import.meta.env.DEV) {
      console.error("[DEV] Failed to parse backend JSON response:", responseText);
    }
    throw new Error(`Invalid JSON response from backend: ${parseError instanceof Error ? parseError.message : "Unknown parse error"}. Response: ${responseText.substring(0, 200)}`);
  }

  // Dev-only: Log backend response keys (not secrets)
  if (import.meta.env.DEV) {
    console.log("[DEV] Backend response keys:", Object.keys(backendResponse));
    console.log("[DEV] Backend response ok:", backendResponse.ok);
    if (backendResponse.ok) {
      console.log("[DEV] Has assistant_text:", !!backendResponse.assistant_text);
      console.log("[DEV] Has assistant_json:", !!backendResponse.assistant_json);
    }
  }

  // Check if request was successful
  if (!response.ok || !backendResponse.ok) {
    const errorMessage = backendResponse.error || `Backend request failed: ${response.status} ${response.statusText}`;
    if (import.meta.env.DEV) {
      console.error("[DEV] Backend error:", response.status, errorMessage);
    }
    throw new Error(errorMessage);
  }

  return backendResponse;
}

