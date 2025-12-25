// src/server.ts
// Comments in English as requested, no semicolons

import express from "express"
import cors from "cors"

const app = express()

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

const PORT = Number(process.env.PORT || 3000)
app.listen(PORT, () => {
  console.log(`Backend listening on ${PORT}`)
})
