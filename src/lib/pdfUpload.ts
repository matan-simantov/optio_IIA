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

  // Get webhook URL from environment variable or use default
  // Can be swapped to backend proxy later by changing this URL
  const webhookUrl =
    import.meta.env.VITE_WEBHOOK_UPLOAD_URL ||
    "https://optio-xrl.app.n8n.cloud/webhook/webhook/xrl/document/upload";

  // Create FormData for multipart/form-data upload
  const formData = new FormData();
  formData.append("file", file);
  formData.append("filename", file.name);
  if (sessionId) {
    formData.append("session_id", sessionId);
  }

  // Upload file to n8n webhook
  const response = await fetch(webhookUrl, {
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

