// src/server.ts
// Comments in English as requested, no semicolons

import express from "express"
import cors from "cors"
import multer from "multer"

const app = express()

// Configure multer for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }) // 10MB limit

app.use(express.json({ limit: "2mb" }))

// Allow your static frontend to call the backend
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173"
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-callback-secret"],
  })
)

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || ""
const N8N_CALLBACK_SECRET = process.env.N8N_CALLBACK_SECRET || ""
const N8N_UPLOAD_WEBHOOK_URL = process.env.N8N_UPLOAD_WEBHOOK_URL || "https://optio-xrl.app.n8n.cloud/webhook/webhook/xrl/document/upload"

// Small health route so you won't see "Cannot GET /"
app.get("/", (_req, res) => {
  res.status(200).send("OK")
})

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true })
})

function stripCodeFences(s) {
  // Removes ```json ... ``` or ``` ... ``` wrappers if present
  return s
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim()
}

function tryParseJsonFromText(text) {
  const cleaned = stripCodeFences(text)
  try {
    return { ok: true, json: JSON.parse(cleaned), cleaned }
  } catch {
    return { ok: false, json: null, cleaned }
  }
}

function extractTextFromChatStyle(n8nRaw) {
  // Handles shape like: [{ output: [{ content: [{ text: "..." }] }] }]
  const first = Array.isArray(n8nRaw) ? n8nRaw[0] : n8nRaw
  const out = first?.output?.[0]
  const text = out?.content?.[0]?.text
  return typeof text === "string" ? text : ""
}

function buildAssistantPayload(n8nRaw) {
  // 1) Prefer explicit llm.confirmation_question when available
  const llm = n8nRaw?.llm
  if (llm && typeof llm === "object") {
    const assistant_text =
      llm.confirmation_question || llm.why || llm.technology_guess || ""
    return {
      ok: true,
      n8n_raw: n8nRaw,
      assistant_text,
      assistant_json: llm,
    }
  }

  // 2) Otherwise try to read the "Chat-style" payload text and parse JSON from it
  const text = extractTextFromChatStyle(n8nRaw)
  const parsed = text ? tryParseJsonFromText(text) : { ok: false, json: null, cleaned: "" }

  const assistant_json = parsed.ok ? parsed.json : null
  const assistant_text =
    (assistant_json?.confirmation_question) ||
    (assistant_json?.why) ||
    text ||
    ""

  return {
    ok: true,
    n8n_raw: n8nRaw,
    assistant_text,
    assistant_json,
  }
}

app.post("/api/chat", async (req, res) => {
  if (!N8N_WEBHOOK_URL) {
    return res.status(500).json({ ok: false, error: "Missing N8N_WEBHOOK_URL" })
  }

  try {
    const upstream = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(N8N_CALLBACK_SECRET ? { "x-callback-secret": N8N_CALLBACK_SECRET } : {}),
      },
      body: JSON.stringify(req.body || {}),
    })

    const contentType = upstream.headers.get("content-type") || ""
    const raw = contentType.includes("application/json")
      ? await upstream.json()
      : await upstream.text()

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        ok: false,
        error: "n8n_error",
        status: upstream.status,
        n8n_raw: raw,
      })
    }

    const payload = buildAssistantPayload(raw)
    return res.status(200).json(payload)
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "backend_error",
      message: err?.message || String(err),
    })
  }
})

// PDF upload endpoint - proxies file upload to n8n webhook
app.post("/api/upload", upload.single("file"), async (req, res) => {
  console.log("[POST /api/upload] Request received")
  
  if (!N8N_UPLOAD_WEBHOOK_URL) {
    console.error("[POST /api/upload] Missing N8N_UPLOAD_WEBHOOK_URL")
    return res.status(500).json({ ok: false, error: "Missing N8N_UPLOAD_WEBHOOK_URL" })
  }

  try {
    // Validate file was uploaded
    if (!req.file) {
      console.log("[POST /api/upload] No file in request")
      return res.status(400).json({ ok: false, error: "No file provided" })
    }

    console.log("[POST /api/upload] File received:", {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    })

    // Validate file type
    if (req.file.mimetype !== "application/pdf") {
      console.log("[POST /api/upload] Invalid file type:", req.file.mimetype)
      return res.status(400).json({ ok: false, error: "Only PDF files are supported" })
    }

    // Create FormData for forwarding to n8n
    // Use FormData API available in Node.js 18+
    const formData = new FormData()
    
    // Create a Blob from the file buffer
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype })
    formData.append("file", blob, req.file.originalname)
    formData.append("filename", req.file.originalname)
    
    // Include session_id if provided in request body
    if (req.body.session_id) {
      formData.append("session_id", req.body.session_id)
    }

    // Prepare headers for n8n request
    const headers = {}
    if (N8N_CALLBACK_SECRET) {
      headers["x-callback-secret"] = N8N_CALLBACK_SECRET
    }

    // Forward upload to n8n webhook
    console.log("[POST /api/upload] Forwarding to n8n:", N8N_UPLOAD_WEBHOOK_URL)
    const upstream = await fetch(N8N_UPLOAD_WEBHOOK_URL, {
      method: "POST",
      headers,
      body: formData,
    })

    console.log("[POST /api/upload] n8n response status:", upstream.status)

    // Handle non-OK responses
    if (!upstream.ok) {
      const errorText = await upstream.text()
      console.error("[POST /api/upload] n8n error:", upstream.status, errorText.substring(0, 200))
      return res.status(upstream.status).json({
        ok: false,
        error: "n8n_upload_error",
        status: upstream.status,
        message: errorText,
      })
    }

    // Parse JSON response from n8n
    let uploadResponse
    try {
      uploadResponse = await upstream.json()
    } catch (parseError) {
      return res.status(502).json({
        ok: false,
        error: "invalid_response",
        message: "Invalid JSON response from n8n",
      })
    }

    // Validate response includes doc_id
    if (!uploadResponse.doc_id || typeof uploadResponse.doc_id !== "string") {
      return res.status(502).json({
        ok: false,
        error: "invalid_response",
        message: "Response missing doc_id",
        response: uploadResponse,
      })
    }

    // Return success with uploaded document info
    console.log("[POST /api/upload] Upload successful, doc_id:", uploadResponse.doc_id)
    return res.status(200).json({
      ok: true,
      doc_id: uploadResponse.doc_id,
      bucket: uploadResponse.bucket,
      path: uploadResponse.path,
      status: uploadResponse.status,
    })
  } catch (err) {
    console.error("[POST /api/upload] Error:", err)
    return res.status(500).json({
      ok: false,
      error: "backend_error",
      message: err?.message || String(err),
    })
  }
})

const PORT = Number(process.env.PORT || 3000)
app.listen(PORT, () => {
  console.log(`Backend listening on ${PORT}`)
  console.log(`N8N Webhook URL: ${N8N_WEBHOOK_URL || "NOT SET"}`)
  console.log(`N8N Upload Webhook URL: ${N8N_UPLOAD_WEBHOOK_URL || "NOT SET"}`)
  console.log(`Frontend Origin: ${FRONTEND_ORIGIN || "NOT SET"}`)
  console.log(`Available endpoints: GET /, GET /health, POST /api/chat, POST /api/upload`)
})
