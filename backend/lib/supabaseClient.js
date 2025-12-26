/**
 * Supabase Client Helper
 * Creates and exports a Supabase client instance using service role key
 * This client has admin privileges and can bypass RLS (Row Level Security)
 * 
 * Note: Client is created lazily to avoid errors during module load if env vars are missing
 */

import { createClient } from "@supabase/supabase-js"

// Lazy initialization - create client only when needed
let supabaseInstance = null

/**
 * Get or create Supabase client instance
 * Validates environment variables only when client is first accessed
 * 
 * @returns {import("@supabase/supabase-js").SupabaseClient} Supabase client instance
 * @throws {Error} If required environment variables are missing
 */
function getSupabaseClient() {
  if (supabaseInstance) {
    return supabaseInstance
  }

  // Get Supabase configuration from environment variables
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Validate required environment variables
  if (!SUPABASE_URL) {
    throw new Error("Missing SUPABASE_URL environment variable. Please set it in your environment variables.")
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Please set it in your environment variables.")
  }

  // Create Supabase client with service role key (admin privileges)
  // This allows the backend to bypass RLS and perform admin operations
  supabaseInstance = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return supabaseInstance
}

// Export a getter function that creates the client on first access
export default getSupabaseClient

