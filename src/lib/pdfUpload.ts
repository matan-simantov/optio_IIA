/**
 * PDF Upload Helper
 * Handles uploading PDF files to n8n webhook
 */

// Upload state types
export type UploadState = "idle" | "uploading" | "uploaded" | "error";

// Uploaded document structure returned from n8n
export interface UploadedDoc {
  doc_id: string;
  bucket?: string;
  path?: string;
  status?: string;
}

// Upload response from n8n webhook
interface UploadResponse {
  doc_id: string;
  bucket?: string;
  path?: string;
  status?: string;
  [key: string]: unknown;
}

/**
 * Upload PDF file to n8n webhook
 * 
 * @param file PDF file to upload
 * @param sessionId Optional session ID to include in the upload
 * @returns Promise resolving to uploaded document info with doc_id
 * @throws Error if upload fails or response is invalid
 */
export async function uploadPdfToN8n(
  file: File,
  sessionId?: string | null
): Promise<UploadedDoc> {
  // Validate file type
  if (file.type !== "application/pdf") {
    throw new Error("Only PDF files are supported");
  }

  // Get backend API URL (use backend proxy to avoid CORS issues)
  const API_URL = import.meta.env.VITE_API_URL;
  if (!API_URL) {
    throw new Error("Missing VITE_API_URL environment variable");
  }

  // Use backend proxy endpoint instead of direct n8n webhook
  // This avoids CORS issues and allows us to add authentication/validation later
  const uploadUrl = `${API_URL}/api/upload`;

  // Create FormData for multipart/form-data upload
  const formData = new FormData();
  formData.append("file", file);
  formData.append("filename", file.name);
  if (sessionId) {
    formData.append("session_id", sessionId);
  }

  // Upload file via backend proxy
  const response = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
  });

  // Handle non-OK responses
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Upload failed: ${response.status} ${response.statusText}. ${errorText}`
    );
  }

  // Parse JSON response
  let uploadResponse: UploadResponse;
  try {
    uploadResponse = await response.json();
  } catch (parseError) {
    throw new Error(
      `Invalid JSON response from upload endpoint: ${parseError instanceof Error ? parseError.message : "Unknown error"}`
    );
  }

  // Validate response includes doc_id
  if (!uploadResponse.doc_id || typeof uploadResponse.doc_id !== "string") {
    throw new Error(
      `Invalid upload response: missing doc_id. Response: ${JSON.stringify(uploadResponse)}`
    );
  }

  // Return uploaded document info
  return {
    doc_id: uploadResponse.doc_id,
    bucket: uploadResponse.bucket,
    path: uploadResponse.path,
    status: uploadResponse.status,
  };
}

/**
 * Format file size for display
 * 
 * @param bytes File size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

