/**
 * PDF Text Extraction Helper
 * Extracts text content from PDF files using pdf-parse library
 * 
 * Note: pdf-parse is a CommonJS module, so we use createRequire for ESM compatibility
 */

import { createRequire } from "module"
const require = createRequire(import.meta.url)

/**
 * Extract text content from a PDF buffer
 * 
 * @param {Buffer} pdfBuffer - PDF file as Buffer
 * @returns {Promise<string>} Extracted text content (empty string if extraction fails)
 */
export async function extractTextFromPdf(pdfBuffer) {
  try {
    // Dynamically require pdf-parse to avoid module load issues
    const pdfParse = require("pdf-parse")
    
    // pdf-parse returns a promise that resolves to { text, ... }
    const data = await pdfParse(pdfBuffer)
    return data.text || ""
  } catch (error) {
    // Return empty string instead of throwing - allows PDF upload without text extraction
    console.warn("[pdfExtract] Failed to extract text from PDF:", error.message)
    return ""
  }
}

