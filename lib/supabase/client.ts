import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    
    if (!supabaseUrl || !supabasePublishableKey) {
      throw new Error('Missing Supabase environment variables')
    }
    
    supabaseInstance = createClient(supabaseUrl, supabasePublishableKey)
  }
  return supabaseInstance
}

export function createServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  
  if (!url || !secretKey) {
    throw new Error('Missing Supabase environment variables')
  }
  
  // Validar que la URL sea válida
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('Invalid Supabase URL: Must start with http:// or https://')
  }
  
  // Validar formato de las nuevas claves
  if (!secretKey.startsWith('sb_secret_') && !secretKey.startsWith('eyJ')) {
    console.error('Invalid Secret Key format. Expected sb_secret_... or JWT format')
    throw new Error('Invalid Supabase Secret Key format')
  }
  
  return createClient(url, secretKey)
}
