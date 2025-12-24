/**
 * n8n Webhook Integration
 * Helper function to send chat messages to n8n webhook
 */

/**
 * Response item structure from n8n webhook
 */
export interface N8nResponseItem {
  session_id: string;
  vuk_id: string;
  llm: {
    technology_guess: string;
    confidence: number;
    why: string;
    confirmation_question: string;
  };
  llm_raw: string;
}

/**
 * Call n8n webhook with user message
 * 
 * The webhook URL is read from VITE_N8N_WEBHOOK_URL environment variable.
 * The response can be either an array with one object or a single object.
 * This function normalizes it to a single object.
 * 
 * @param userText The user's message text
 * @returns Promise resolving to the normalized response item
 * @throws Error if the webhook URL is not configured or request fails
 */
export async function callN8nWebhook(userText: string): Promise<N8nResponseItem> {
  // Read webhook URL from environment variable
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error("VITE_N8N_WEBHOOK_URL environment variable is not set");
  }

  // Prepare the payload as specified
  const payload = {
    message: userText,
    source: "web",
  };

  // Make POST request to webhook
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  // Check if request was successful
  if (!response.ok) {
    throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
  }

  // Parse JSON response
  const rawResponse = await response.json();

  // Log raw response for debugging
  console.log("n8n webhook raw response:", rawResponse);

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

  // Validate that required fields are present
  if (!item.session_id || !item.vuk_id || !item.llm) {
    throw new Error("Webhook response missing required fields");
  }

  return item;
}

