import {createServerClient} from '@supabase/ssr'
import {NextResponse} from 'next/server'
import {getSupabaseConfig} from './config.js'
import {isApiPath,isPublicPagePath,isStaticAssetPath} from '../auth/route-policy.js'

export async function updateSession(request){
  const pathname=request.nextUrl.pathname

  // Private APIs authenticate inside each Route Handler so anonymous callers
  // receive a real 401 instead of a page redirect.
  if(isApiPath(pathname)){
    return NextResponse.next({request})
  }

  if(isStaticAssetPath(pathname)||pathname==='/auth/confirm'||pathname.startsWith('/auth/confirm/')){
    return NextResponse.next({request})
  }

  const {url,publishableKey}=getSupabaseConfig()
  let response=NextResponse.next({request})

  const supabase=createServerClient(url,publishableKey,{
    cookies:{
      getAll(){
        return request.cookies.getAll()
      },
      setAll(cookiesToSet){
        for(const {name,value} of cookiesToSet){
          request.cookies.set(name,value)
        }
        response=NextResponse.next({request})
        for(const {name,value,options} of cookiesToSet){
          response.cookies.set(name,value,options)
        }
      }
    }
  })

  const {data:{user}}=await supabase.auth.getUser()

  if(!user&&!isPublicPagePath(pathname)){
    const loginUrl=request.nextUrl.clone()
    loginUrl.pathname='/login'
    loginUrl.search=''
    return NextResponse.redirect(loginUrl)
  }

  if(user&&pathname==='/login'){
    const homeUrl=request.nextUrl.clone()
    homeUrl.pathname='/'
    homeUrl.search=''
    return NextResponse.redirect(homeUrl)
  }

  return response
}
