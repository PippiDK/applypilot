import {createClient} from '@supabase/supabase-js'

const clean=value=>String(value??'').trim()

export function createAdminSupabaseClient(env=process.env){
  const url=clean(env.NEXT_PUBLIC_SUPABASE_URL)
  const serviceRoleKey=clean(env.SUPABASE_SERVICE_ROLE_KEY)
  if(!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL.')
  if(!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.')

  return createClient(url,serviceRoleKey,{
    auth:{
      persistSession:false,
      autoRefreshToken:false,
      detectSessionInUrl:false,
    },
  })
}
