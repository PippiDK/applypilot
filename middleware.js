import {NextResponse} from 'next/server'
import {stablePreviewRedirectUrl} from './app/lib/preview-stable-origin.js'
import {updateSession} from './app/lib/supabase/middleware.js'

export async function middleware(request){
  const redirectUrl=stablePreviewRedirectUrl({
    vercelEnv:process.env.VERCEL_ENV,
    branchUrl:process.env.VERCEL_BRANCH_URL,
    requestUrl:request.url,
    method:request.method,
    accept:request.headers.get('accept')||'',
  })
  if(redirectUrl) return NextResponse.redirect(redirectUrl,307)
  return updateSession(request)
}

export const config={
  matcher:[
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
}
