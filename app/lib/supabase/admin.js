import {createClient} from '@supabase/supabase-js'

export function createAdminSupabaseClient(){
  const url=String(process.env.NEXT_PUBLIC_SUPABASE_URL||'').trim()
  const serviceRoleKey=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim()
  if(!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL.')
  if(!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.')
  return createClient(url,serviceRoleKey,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  })
}
