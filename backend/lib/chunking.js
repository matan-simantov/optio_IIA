/**
 * Text Chunking Helper
 * Splits text into overlapping chunks for embedding and retrieval
 */

/**
 * Split text into chunks with overlap
 * 
 * @param {string} text - Text to chunk
 * @param {number} chunkSizeChars - Maximum characters per chunk (default: 1200)
 * @param {number} overlapChars - Number of overlapping characters between chunks (default: 200)
 * @returns {Array<{content: string, char_start: number, char_end: number}>} Array of chunks with metadata
 */
export function splitIntoChunks(text, chunkSizeChars = 1200, overlapChars = 200) {
  if (!text || text.length === 0) {
    return []
  }

  const chunks = []
  let startIndex = 0

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSizeChars, text.length)
    const chunkContent = text.substring(startIndex, endIndex)

    // Only add non-empty chunks
    if (chunkContent.trim().length > 0) {
      chunks.push({
        content: chunkContent,
        char_start: startIndex,
        char_end: endIndex,
      })
    }

    // Move start index forward by chunk size minus overlap
    startIndex = endIndex - overlapChars

    // Prevent infinite loop if overlap is too large
    if (startIndex <= chunks[chunks.length - 1]?.char_start || startIndex < 0) {
      startIndex = endIndex
    }
  }

  return chunks
}

