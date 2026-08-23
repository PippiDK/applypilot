import {NextResponse} from 'next/server'
import {createServerSupabaseClient} from '../../lib/supabase/server.js'

export const dynamic='force-dynamic'

export async function POST(request){
  const supabase=await createServerSupabaseClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login',request.url),{status:303})
}
