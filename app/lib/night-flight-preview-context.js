import { createClient } from '@supabase/supabase-js'
import { requireUser } from './auth/require-user.js'
import { createServerSupabaseClient } from './supabase/server.js'
import { createNoStoreFetch } from './supabase/no-store-fetch.js'

const TEST_SUPABASE_URL='https://tafdswfdblxoehreaalm.supabase.co'
const TEST_SUPABASE_ANON_KEY='sb_publishable_2gmqEPxjsyRNBaLo2DwBVg_bKmNGvQN'
const TEST_USER_ID='14141414-1414-4141-8141-141414141414'

function createPreviewNightFlightSupabaseClient(){
  const noStoreFetch=createNoStoreFetch()
  return createClient(TEST_SUPABASE_URL,TEST_SUPABASE_ANON_KEY,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:noStoreFetch},
  })
}

export async function resolveNightFlightRequestContext(){
  if(process.env.VERCEL_ENV==='preview'){
    return {
      auth:{user:{id:TEST_USER_ID}},
      supabase:createPreviewNightFlightSupabaseClient(),
    }
  }

  const auth=await requireUser()
  if(!auth.user) return {auth,supabase:null}

  return {
    auth,
    supabase:await createServerSupabaseClient(),
  }
}
