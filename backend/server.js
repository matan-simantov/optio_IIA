/**
 * XRL Backend Server
 * Express server that acts as a proxy to n8n webhook
 * Solves CORS issues and normalizes responses for the frontend
 */

import express from "express";
import cors from "cors";

// Initialize Express app
const app = express();

// Get configuration from environment variables
const PORT = process.env.PORT || 3000;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

// Middleware: Enable CORS only for FRONTEND_ORIGIN
// If FRONTEND_ORIGIN is not set, CORS will be disabled (no origin allowed)
app.use(
  cors({
    origin: FRONTEND_ORIGIN || false, // false means no CORS
    credentials: true,
  })
);

// Middleware: Parse JSON request bodies
app.use(express.json());

/**
 * Basic GET / route
 * Returns simple OK status for sanity checking the service
 */
app.get("/", (req, res) => {
  res.json({ ok: true });
});

/**
 * Health check endpoint
 * Returns simple OK status for monitoring
 */
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/**
 * Chat API endpoint
 * Proxies requests to n8n webhook and normalizes the response for the frontend
 * 
 * Request body: { message: string, session_id?: string, vuk_id?: string }
 * Response: { ok: true, n8n_raw: object, assistant_text: string, assistant_json: object|null }
 */
app.post("/api/chat", async (req, res) => {
  try {
    // Validate that N8N_WEBHOOK_URL environment variable exists
    if (!N8N_WEBHOOK_URL) {
      return res.status(500).json({
        ok: false,
        error: "Missing N8N_WEBHOOK_URL",
      });
    }

    // Extract message and optional session_id/vuk_id from request body
    const { message, session_id, vuk_id } = req.body;

    // Validate that message is provided
    if (!message || typeof message !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Missing or invalid 'message' field in request body",
      });
    }

    // Prepare headers for n8n webhook request
    const n8nHeaders = {
      "Content-Type": "application/json",
    };

    // Add x-callback-secret header if N8N_CALLBACK_SECRET is set
    const n8nCallbackSecret = process.env.N8N_CALLBACK_SECRET;
    if (n8nCallbackSecret) {
      n8nHeaders["x-callback-secret"] = n8nCallbackSecret;
    }

    // Prepare payload for n8n webhook
    // Include message and optional session_id/vuk_id if provided
    const n8nPayload = {
      message,
      ...(session_id && { session_id }),
      ...(vuk_id && { vuk_id }),
    };

    // Forward request to n8n webhook
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: n8nHeaders,
      body: JSON.stringify(n8nPayload),
    });

    // Read response as text first (to handle non-JSON responses)
    const responseText = await n8nResponse.text();

    // Check if n8n returned a non-2xx status
    if (!n8nResponse.ok) {
      // Return 502 Bad Gateway with minimal debug info
      const textSnippet = responseText.length > 200 ? responseText.substring(0, 200) + "..." : responseText;
      return res.status(502).json({
        ok: false,
        error: `n8n returned ${n8nResponse.status} ${n8nResponse.statusText}`,
        status: n8nResponse.status,
        text_snippet: textSnippet,
      });
    }

    // Try to parse n8n response as JSON
    let n8nRaw;
    try {
      n8nRaw = JSON.parse(responseText);
    } catch (parseError) {
      // If parsing fails, return error
      return res.status(502).json({
        ok: false,
        error: "Invalid JSON response from n8n",
        text_snippet: responseText.substring(0, 200),
      });
    }

    // Extract assistant_text from n8n response structure
    // Expected structure: [{ output: [{ content: [{ type: "output_text", text: "..." }] }] }]
    let assistantText = "";

    // Check if response is an array and has the expected structure
    if (Array.isArray(n8nRaw) && n8nRaw.length > 0) {
      const firstItem = n8nRaw[0];
      
      // Check if output exists and is an array
      if (firstItem.output && Array.isArray(firstItem.output) && firstItem.output.length > 0) {
        const firstOutput = firstItem.output[0];
        
        // Check if content exists and is an array
        if (firstOutput.content && Array.isArray(firstOutput.content)) {
          // Find the first content item with type "output_text"
          const outputTextContent = firstOutput.content.find(
            (item) => item.type === "output_text" && item.text
          );
          
          if (outputTextContent && outputTextContent.text) {
            assistantText = outputTextContent.text;
          }
        }
      }
    }

    // Try to parse assistant_text as JSON if it looks like JSON
    let assistantJson = null;
    if (assistantText && (assistantText.trim().startsWith("{") || assistantText.trim().startsWith("["))) {
      try {
        assistantJson = JSON.parse(assistantText);
      } catch (parseError) {
        // If parsing fails, keep assistantJson as null and assistantText as-is
        assistantJson = null;
      }
    }

    // Return normalized response to frontend
    res.status(200).json({
      ok: true,
      n8n_raw: n8nRaw,
      assistant_text: assistantText,
      assistant_json: assistantJson,
    });
  } catch (error) {
    // Handle unexpected errors and return 500 status
    console.error("[POST /api/chat] Error proxying to n8n:", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * OPTIONS handler for CORS preflight requests
 * Allows the frontend to make preflight requests to /api/chat
 */
app.options("/api/chat", (req, res) => {
  res.status(204).end();
});

// Start the server
app.listen(PORT, () => {
  console.log(`XRL Backend server running on port ${PORT}`);
  console.log(`N8N Webhook URL: ${N8N_WEBHOOK_URL || "NOT SET"}`);
  console.log(`Frontend Origin: ${FRONTEND_ORIGIN || "NOT SET"}`);
});

