import {NextResponse} from 'next/server'
import {createServerSupabaseClient} from '../../lib/supabase/server.js'
import {normalizeOtpType,sanitizeNextPath} from '../../lib/auth/route-policy.js'

export const dynamic='force-dynamic'

function loginRedirect(origin,code){
  const target=new URL('/login',origin)
  target.searchParams.set('error',code)
  return NextResponse.redirect(target,{status:303})
}

export async function GET(request){
  const url=new URL(request.url)
  const token_hash=String(url.searchParams.get('token_hash')??'').trim()
  const type=normalizeOtpType(url.searchParams.get('type'))
  const next=sanitizeNextPath(url.searchParams.get('next'))

  if(!token_hash||!type) return loginRedirect(url.origin,'invalid_link')

  const supabase=await createServerSupabaseClient()
  const {error}=await supabase.auth.verifyOtp({token_hash,type})
  if(error) return loginRedirect(url.origin,'invalid_or_expired_link')

  return NextResponse.redirect(new URL(next,url.origin),{status:303})
}
