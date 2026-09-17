import {createClient} from '@supabase/supabase-js'
import {createNoStoreFetch} from './supabase/no-store-fetch.js'

const TEST_SUPABASE_URL='https://tafdswfdblxoehreaalm.supabase.co'
const TEST_SUPABASE_ANON_KEY='sb_publishable_ZMPE4l7R9vEuJ2dfX3TX3Q_drCByKsJ'

export const APPLIED_JOBS_PREVIEW_USER_ID='14141414-1414-4141-8141-141414141414'

export function createPreviewAppliedJobsSupabaseClient(){
  const noStoreFetch=createNoStoreFetch()
  return createClient(TEST_SUPABASE_URL,TEST_SUPABASE_ANON_KEY,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:noStoreFetch},
  })
}
