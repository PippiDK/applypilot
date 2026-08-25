const text=value=>String(value??'').trim()

export function getSupabaseConfig(env){
  const source=env??{
    NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  }
  const url=text(source.NEXT_PUBLIC_SUPABASE_URL)
  const publishableKey=text(source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)

  if(!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL.')
  if(!publishableKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.')

  return {url,publishableKey}
}
