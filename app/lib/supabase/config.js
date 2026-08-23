const text=value=>String(value??'').trim()

export function getSupabaseConfig(env=process.env){
  const url=text(env.NEXT_PUBLIC_SUPABASE_URL)
  const publishableKey=text(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)

  if(!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL.')
  if(!publishableKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.')

  return {url,publishableKey}
}
