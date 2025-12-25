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
 * Health check endpoint
 * Returns simple OK status for monitoring
 */
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/**
 * Chat API endpoint
 * Proxies requests to n8n webhook
 * 
 * Request body: { message: string, session_id?: string|null }
 * Response: { ok: true, n8n_status: number, n8n: object|{raw: string} }
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

    // Extract message and optional session_id from request body
    const { message, session_id } = req.body;

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
    // Send only message and session_id (if provided)
    const n8nPayload = {
      message,
      ...(session_id && { session_id }),
    };

    // Forward request to n8n webhook
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: n8nHeaders,
      body: JSON.stringify(n8nPayload),
    });

    // Read response as text first (to handle non-JSON responses)
    const responseText = await n8nResponse.text();

    // Try to parse as JSON
    let n8nData;
    try {
      n8nData = JSON.parse(responseText);
    } catch (parseError) {
      // If parsing fails, wrap as { raw: "<text>" }
      n8nData = { raw: responseText };
    }

    // Return success response with n8n status and data
    res.status(200).json({
      ok: true,
      n8n_status: n8nResponse.status,
      n8n: n8nData,
    });
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
  console.log(`N8N Webhook URL: ${N8N_WEBHOOK_URL || "NOT SET"}`);
  console.log(`Frontend Origin: ${FRONTEND_ORIGIN || "NOT SET"}`);
});

