import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://tstiurvqmtodpzgouwvg.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzdGl1cnZxbXRvZHB6Z291d3ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NjAzMTQsImV4cCI6MjA4NjMzNjMxNH0.v92ZH2c8KrUTAcEnORy1oQNZowFm8LrISM3PhqDxbdE"

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
