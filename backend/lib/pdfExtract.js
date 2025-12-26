/**
 * PDF Text Extraction Helper
 * Extracts text content from PDF files using pdf-parse library
 * 
 * Note: pdf-parse is a CommonJS module, so we use dynamic import for ESM compatibility
 */

/**
 * Extract text content from a PDF buffer
 * 
 * @param {Buffer} pdfBuffer - PDF file as Buffer
 * @returns {Promise<string>} Extracted text content (empty string if extraction fails)
 */
export async function extractTextFromPdf(pdfBuffer) {
  try {
    // Use dynamic import to load pdf-parse (CommonJS module) in ESM context
    const pdfParseModule = await import("pdf-parse")
    // pdf-parse exports a default function, access it via .default
    const pdfParse = pdfParseModule.default || pdfParseModule
    
    // pdf-parse returns a promise that resolves to { text, ... }
    const data = await pdfParse(pdfBuffer)
    return data.text || ""
  } catch (error) {
    // Return empty string instead of throwing - allows PDF upload without text extraction
    console.warn("[pdfExtract] Failed to extract text from PDF:", error.message)
    return ""
  }
}

