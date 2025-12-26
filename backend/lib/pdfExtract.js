/**
 * PDF Text Extraction Helper
 * Extracts text content from PDF files using pdf-parse library
 * 
 * Note: pdf-parse is a CommonJS module, so we use dynamic import for ESM compatibility
 */

import { createRequire } from "module"
const require = createRequire(import.meta.url)
const pdfParse = require("pdf-parse")

/**
 * Extract text content from a PDF buffer
 * 
 * @param {Buffer} pdfBuffer - PDF file as Buffer
 * @returns {Promise<string>} Extracted text content
 * @throws {Error} If PDF parsing fails
 */
export async function extractTextFromPdf(pdfBuffer) {
  try {
    // pdf-parse returns a promise that resolves to { text, ... }
    const data = await pdfParse(pdfBuffer)
    return data.text || ""
  } catch (error) {
    throw new Error(`Failed to extract text from PDF: ${error.message}`)
  }
}

