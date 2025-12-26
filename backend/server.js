// src/server.ts
// Comments in English as requested, no semicolons

// Load environment variables from .env file
import "dotenv/config"

import express from "express"
import cors from "cors"
import multer from "multer"
import { randomUUID } from "crypto"
import getSupabaseClient from "./lib/supabaseClient.js"
import { extractTextFromPdf } from "./lib/pdfExtract.js"
import { splitIntoChunks } from "./lib/chunking.js"
import { retrieveTopChunks } from "./lib/chunkRetrieval.js"

const app = express()

// Configure multer for file uploads (memory storage)
// Max file size: 100MB (as per requirements)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    // Accept only PDF files
    if (file.mimetype === "application/pdf") {
      cb(null, true)
    } else {
      cb(new Error("Only PDF files are allowed"), false)
    }
  },
})

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

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || "https://optio-xrl.app.n8n.cloud/webhook/xrl/session/create"
const N8N_CALLBACK_SECRET = process.env.X_CALLBACK_SECRET || process.env.N8N_CALLBACK_SECRET || ""
const N8N_UPLOAD_WEBHOOK_URL = process.env.N8N_UPLOAD_WEBHOOK_URL || "https://optio-xrl.app.n8n.cloud/webhook/webhook/xrl/document/upload"
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "raw-ingest"

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

/**
 * Chat Endpoint
 * Handles chat messages, retrieves relevant document chunks if attachments are provided,
 * and forwards enriched payload to n8n webhook
 */
app.post("/api/chat", async (req, res) => {
  if (!N8N_WEBHOOK_URL) {
    return res.status(500).json({ ok: false, error: "Missing N8N_WEBHOOK_URL" })
  }

  try {
    // Extract request body fields
    const { session_id, message, attachments } = req.body || {}

    // Validate message exists
    if (!message || typeof message !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Missing or invalid message field",
      })
    }

    // Prepare payload for n8n
    let n8nPayload = {
      session_id: session_id || null,
      user_message: message,
    }

    // If attachments include PDF doc_ids, retrieve relevant chunks
    if (attachments && Array.isArray(attachments)) {
      const pdfAttachments = attachments.filter((att) => att.type === "pdf" && att.doc_id)
      const docIds = pdfAttachments.map((att) => att.doc_id)

      if (docIds.length > 0) {
        console.log("[POST /api/chat] Retrieving chunks for doc_ids:", docIds)

        try {
          // Retrieve top chunks based on message keywords
          const retrievedChunks = await retrieveTopChunks({
            docIds,
            message,
            topK: 12,
          })

          console.log("[POST /api/chat] Retrieved", retrievedChunks.length, "chunks")

          // Add attachments and retrieved chunks to payload
          n8nPayload.attachments = attachments
          n8nPayload.retrieved_chunks = retrievedChunks
        } catch (chunkError) {
          console.error("[POST /api/chat] Error retrieving chunks:", chunkError)
          // Continue without chunks - don't fail the request
          n8nPayload.attachments = attachments
          n8nPayload.retrieved_chunks = []
        }
      } else {
        // No PDF attachments, include attachments as-is
        n8nPayload.attachments = attachments
      }
    }

    // Forward enriched payload to n8n webhook
    console.log("[POST /api/chat] Sending to n8n:", {
      session_id: n8nPayload.session_id,
      message_length: n8nPayload.user_message.length,
      has_attachments: !!n8nPayload.attachments,
      chunks_count: n8nPayload.retrieved_chunks?.length || 0,
    })

    const upstream = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(N8N_CALLBACK_SECRET ? { "x-callback-secret": N8N_CALLBACK_SECRET } : {}),
      },
      body: JSON.stringify(n8nPayload),
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
    console.error("[POST /api/chat] Error:", err)
    return res.status(500).json({
      ok: false,
      error: "backend_error",
      message: err?.message || String(err),
    })
  }
})

/**
 * PDF Upload Handler
 * Handles PDF upload, stores in Supabase Storage, extracts text, chunks it, and stores in Postgres
 * 
 * Steps:
 * 1. Validate file (PDF, max 100MB)
 * 2. Generate doc_id (UUID)
 * 3. Upload to Supabase Storage
 * 4. Insert document record in Postgres
 * 5. Extract text from PDF
 * 6. Chunk the text
 * 7. Insert chunks into Postgres
 * 8. Update document status
 */
async function handlePdfUpload(req, res) {
  console.log("[POST /api/upload] Request received")

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

    // Validate file type (multer already filters, but double-check)
    if (req.file.mimetype !== "application/pdf") {
      console.log("[POST /api/upload] Invalid file type:", req.file.mimetype)
      return res.status(400).json({ ok: false, error: "Only PDF files are supported" })
    }

    // Generate unique document ID
    const docId = randomUUID()
    const sessionId = req.body.session_id || null
    const fileName = req.body.filename || req.file.originalname || "document.pdf"
    const storagePath = `${docId}/original.pdf`

    console.log("[POST /api/upload] Generated doc_id:", docId)

    // Step 1: Upload PDF to Supabase Storage
    console.log("[POST /api/upload] Uploading to Supabase Storage...")
    const supabase = getSupabaseClient()
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(storagePath, req.file.buffer, {
        contentType: "application/pdf",
        upsert: true,
      })

    if (uploadError) {
      console.error("[POST /api/upload] Storage upload error:", uploadError)
      return res.status(500).json({
        ok: false,
        error: "storage_error",
        message: uploadError.message,
      })
    }

    console.log("[POST /api/upload] File uploaded to storage:", storagePath)

    // Step 2: Insert document record in Postgres
    console.log("[POST /api/upload] Inserting document record...")
    const documentRecord = {
      doc_id: docId,
      source: "upload",
      file_name: fileName,
      mime_type: "application/pdf",
      storage_path: storagePath,
      status: "uploaded",
      metadata_json: {
        session_id: sessionId,
        size_bytes: req.file.size,
        original_filename: req.file.originalname,
      },
    }

    const { error: insertError } = await supabase.from("documents").insert(documentRecord)

    if (insertError) {
      console.error("[POST /api/upload] Document insert error:", insertError)
      return res.status(500).json({
        ok: false,
        error: "database_error",
        message: insertError.message,
      })
    }

    console.log("[POST /api/upload] Document record inserted")

    // Step 3: Extract text from PDF (optional - continue even if extraction fails)
    let extractedText = ""
    console.log("[POST /api/upload] Extracting text from PDF...")
    extractedText = await extractTextFromPdf(req.file.buffer)
    
    if (extractedText.length === 0) {
      console.log("[POST /api/upload] No text extracted from PDF (may be image-based or encrypted)")
      // Update metadata to indicate no text was extracted
      await supabase
        .from("documents")
        .update({
          metadata_json: {
            ...documentRecord.metadata_json,
            text_extraction: "failed_or_empty",
          },
        })
        .eq("doc_id", docId)
    } else {
      console.log("[POST /api/upload] Extracted text length:", extractedText.length)
    }

    // Step 4: Chunk the extracted text
    console.log("[POST /api/upload] Chunking text...")
    const chunks = splitIntoChunks(extractedText, 1200, 200)
    console.log("[POST /api/upload] Created", chunks.length, "chunks")

    // Step 5: Insert chunks into Postgres in batches of 200
    if (chunks.length > 0) {
      console.log("[POST /api/upload] Inserting chunks into database...")
      const chunkRecords = chunks.map((chunk, index) => ({
        doc_id: docId,
        chunk_index: index,
        content: chunk.content,
        metadata_json: {
          source: "pdf",
          file_name: fileName,
          char_start: chunk.char_start,
          char_end: chunk.char_end,
        },
        embedding: null, // No embeddings in MVP
      }))

      // Insert in batches of 200
      const batchSize = 200
      for (let i = 0; i < chunkRecords.length; i += batchSize) {
        const batch = chunkRecords.slice(i, i + batchSize)
        const { error: chunkError } = await supabase.from("document_chunks").insert(batch)

        if (chunkError) {
          console.error("[POST /api/upload] Chunk insert error:", chunkError)
          // Update document status to failed
          await supabase
            .from("documents")
            .update({
              status: "failed",
              metadata_json: {
                ...documentRecord.metadata_json,
                error: chunkError.message,
              },
            })
            .eq("doc_id", docId)

          return res.status(500).json({
            ok: false,
            error: "chunk_insert_error",
            message: chunkError.message,
            doc_id: docId,
          })
        }
      }

      console.log("[POST /api/upload] All chunks inserted")
    }

    // Step 6: Update document status to "chunked"
    console.log("[POST /api/upload] Updating document status to 'chunked'...")
    const { error: updateError } = await supabase
      .from("documents")
      .update({ status: "chunked" })
      .eq("doc_id", docId)

    if (updateError) {
      console.error("[POST /api/upload] Status update error:", updateError)
      // Don't fail the request, chunks are already inserted
    }

    // Return success response
    console.log("[POST /api/upload] Upload successful, doc_id:", docId)
    return res.status(200).json({
      doc_id: docId,
      status: "chunked",
      chunks_count: chunks.length,
      file_name: fileName,
      storage_path: storagePath,
    })
  } catch (err) {
    console.error("[POST /api/upload] Unexpected error:", err)
    return res.status(500).json({
      ok: false,
      error: "backend_error",
      message: err?.message || String(err),
    })
  }
}

// PDF upload endpoints (both /api/upload and /api/documents/upload)
app.post("/api/upload", upload.single("file"), handlePdfUpload)
app.post("/api/documents/upload", upload.single("file"), handlePdfUpload)

const PORT = Number(process.env.PORT || 3000)
app.listen(PORT, () => {
  console.log(`Backend listening on ${PORT}`)
  console.log(`N8N Webhook URL: ${N8N_WEBHOOK_URL || "NOT SET"}`)
  console.log(`N8N Upload Webhook URL: ${N8N_UPLOAD_WEBHOOK_URL || "NOT SET"}`)
  console.log(`Frontend Origin: ${FRONTEND_ORIGIN || "NOT SET"}`)
  console.log(`Supabase Storage Bucket: ${SUPABASE_STORAGE_BUCKET || "NOT SET"}`)
  console.log(`Available endpoints: GET /, GET /health, POST /api/chat, POST /api/upload, POST /api/documents/upload`)
})
