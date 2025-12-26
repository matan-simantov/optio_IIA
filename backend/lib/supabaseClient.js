/**
 * Supabase Client Helper
 * Creates and exports a Supabase client instance using service role key
 * This client has admin privileges and can bypass RLS (Row Level Security)
 */

import { createClient } from "@supabase/supabase-js"

// Get Supabase configuration from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Validate required environment variables
if (!SUPABASE_URL) {
  throw new Error("Missing SUPABASE_URL environment variable")
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable")
}

// Create Supabase client with service role key (admin privileges)
// This allows the backend to bypass RLS and perform admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export default supabase

