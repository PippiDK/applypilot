import {createServerClient} from '@supabase/ssr'
import {cookies} from 'next/headers'
import {getSupabaseConfig} from './config.js'
import {createServerCookieAdapter} from './cookies.js'

export async function createServerSupabaseClient(){
  const {url,publishableKey}=getSupabaseConfig()
  const cookieStore=await cookies()
  return createServerClient(url,publishableKey,{
    cookies:createServerCookieAdapter(cookieStore)
  })
}
