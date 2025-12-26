/**
 * Chunk Retrieval Helper
 * Retrieves relevant document chunks based on message keywords (MVP without embeddings)
 */

import getSupabaseClient from "./supabaseClient.js"

/**
 * Tokenize message into keywords (words with length >= 4, lowercase, unique)
 * 
 * @param {string} message - User message to tokenize
 * @returns {string[]} Array of unique keywords
 */
function tokenizeMessage(message) {
  if (!message || typeof message !== "string") {
    return []
  }

  // Extract words, filter by length >= 4, convert to lowercase, get unique
  const words = message
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length >= 4)
    .filter((word, index, arr) => arr.indexOf(word) === index) // Get unique

  return words
}

/**
 * Score a chunk based on keyword occurrences
 * 
 * @param {string} chunkContent - Chunk text content
 * @param {string[]} keywords - Array of keywords to search for
 * @returns {number} Score (number of keyword matches)
 */
function scoreChunk(chunkContent, keywords) {
  if (!chunkContent || !keywords || keywords.length === 0) {
    return 0
  }

  const lowerContent = chunkContent.toLowerCase()
  let score = 0

  for (const keyword of keywords) {
    // Count occurrences of keyword in chunk
    const regex = new RegExp(keyword, "gi")
    const matches = lowerContent.match(regex)
    if (matches) {
      score += matches.length
    }
  }

  return score
}

/**
 * Retrieve top chunks from documents based on message keywords
 * MVP implementation without embeddings - uses keyword matching
 * 
 * @param {Object} params - Retrieval parameters
 * @param {string[]} params.docIds - Array of document IDs to search in
 * @param {string} params.message - User message to match against
 * @param {number} params.topK - Number of top chunks to return (default: 12)
 * @returns {Promise<Array<{doc_id: string, chunk_index: number, content: string, metadata_json: object}>>} Array of retrieved chunks
 */
export async function retrieveTopChunks({ docIds, message, topK = 12 }) {
  if (!docIds || docIds.length === 0) {
    return []
  }

  if (!message || typeof message !== "string") {
    return []
  }

  // Tokenize message into keywords
  const keywords = tokenizeMessage(message)

  // If no keywords found, return empty array
  if (keywords.length === 0) {
    return []
  }

  try {
    // Get Supabase client (lazy initialization)
    const supabase = getSupabaseClient()
    
    // Fetch all chunks for the given document IDs
    const { data: allChunks, error } = await supabase
      .from("document_chunks")
      .select("chunk_pk, doc_id, chunk_index, content, metadata_json")
      .in("doc_id", docIds)
      .order("chunk_index", { ascending: true })

    if (error) {
      console.error("[chunkRetrieval] Error fetching chunks:", error)
      throw new Error(`Failed to fetch chunks: ${error.message}`)
    }

    if (!allChunks || allChunks.length === 0) {
      return []
    }

    // Score each chunk based on keyword matches
    const scoredChunks = allChunks.map((chunk) => ({
      ...chunk,
      score: scoreChunk(chunk.content, keywords),
    }))

    // Sort by score descending, then by chunk_index ascending
    scoredChunks.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score
      }
      return a.chunk_index - b.chunk_index
    })

    // Take top K chunks
    const topChunks = scoredChunks.slice(0, topK)

    // If we don't have enough chunks with scores > 0, fill with remaining chunks by chunk_index
    if (topChunks.length < topK && scoredChunks.length > topChunks.length) {
      const remainingChunks = scoredChunks
        .slice(topK)
        .filter((chunk) => !topChunks.some((tc) => tc.chunk_pk === chunk.chunk_pk))
        .slice(0, topK - topChunks.length)

      topChunks.push(...remainingChunks)
    }

    // Return chunks in the format expected by the API
    return topChunks.map((chunk) => ({
      doc_id: chunk.doc_id,
      chunk_index: chunk.chunk_index,
      content: chunk.content,
      metadata_json: chunk.metadata_json || {},
    }))
  } catch (error) {
    console.error("[chunkRetrieval] Error retrieving chunks:", error)
    throw error
  }
}

