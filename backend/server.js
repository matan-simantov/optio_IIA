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
const PORT = process.env.PORT || 10000;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || "https://optio-xrl.app.n8n.cloud/webhook/xrl/session/create";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";

// Middleware: Enable CORS with configurable origin
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);

// Middleware: Parse JSON request bodies
app.use(express.json());

/**
 * Health check endpoint
 * Returns simple OK status for monitoring
 */
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/**
 * Chat API endpoint
 * Proxies requests to n8n webhook and returns the response as-is
 * 
 * Request body: { message: string, session_id?: string }
 * Response: n8n webhook response (JSON)
 */
app.post("/api/chat", async (req, res) => {
  try {
    // Optional shared secret verification
    // Only check if N8N_CALLBACK_SECRET environment variable is set
    const expectedSecret = process.env.N8N_CALLBACK_SECRET;
    if (expectedSecret) {
      const providedSecret = req.headers["x-callback-secret"];
      if (providedSecret !== expectedSecret) {
        console.log("Unauthorized request: secret mismatch");
        return res.status(401).json({
          ok: false,
          error: "Unauthorized: invalid callback secret",
        });
      }
    }

    // Extract message and optional session_id from request body
    const { message, session_id } = req.body;

    // Validate that message is provided
    if (!message || typeof message !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Missing or invalid 'message' field in request body",
      });
    }

    // Log incoming message (truncated for privacy)
    const truncatedMessage = message.length > 100 ? message.substring(0, 100) + "..." : message;
    console.log(`[POST /api/chat] Incoming message: ${truncatedMessage}${session_id ? ` (session_id: ${session_id})` : ""}`);

    // Prepare payload for n8n webhook
    // Forward message and session_id if provided
    const n8nPayload = {
      message,
      source: "web",
      ...(session_id && { session_id }),
    };

    // Forward request to n8n webhook
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(n8nPayload),
    });

    // Log n8n response status
    console.log(`[POST /api/chat] n8n status: ${n8nResponse.status} ${n8nResponse.statusText}`);

    // Read response as text first (to handle non-JSON responses)
    const responseText = await n8nResponse.text();

    // Try to parse as JSON
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch (parseError) {
      // If parsing fails, return error with raw text
      console.error("[POST /api/chat] Failed to parse n8n response:", responseText.substring(0, 200));
      return res.status(502).json({
        ok: false,
        error: "Invalid JSON response from n8n",
        raw: responseText.substring(0, 200),
      });
    }

    // Log truncated response for debugging
    const truncatedResponse = JSON.stringify(parsedData).substring(0, 200);
    console.log(`[POST /api/chat] n8n response (truncated): ${truncatedResponse}...`);

    // Return n8n response as-is to frontend
    // Forward the HTTP status code from n8n
    res.status(n8nResponse.status).json(parsedData);
  } catch (error) {
    // Handle errors and return 500 status
    console.error("[POST /api/chat] Error proxying to n8n:", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`XRL Backend server running on port ${PORT}`);
  console.log(`N8N Webhook URL: ${N8N_WEBHOOK_URL}`);
  console.log(`Frontend Origin: ${FRONTEND_ORIGIN}`);
});

