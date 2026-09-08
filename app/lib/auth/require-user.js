import {NextResponse} from 'next/server'
import {createServerSupabaseClient} from '../supabase/server.js'
import {getUserRole} from './route-policy.js'

const PREVIEW_TEST_USER_ID='14141414-1414-4141-8141-141414141414'

export async function requireUser(){
  if(process.env.VERCEL_ENV==='preview'){
    return {
      user:{id:PREVIEW_TEST_USER_ID},
      role:'admin',
      response:null
    }
  }

  const supabase=await createServerSupabaseClient()
  const {data,error}=await supabase.auth.getUser()
  const user=data?.user??null

  if(error||!user){
    return {
      user:null,
      role:null,
      response:NextResponse.json({error:'Unauthorized'},{status:401})
    }
  }

  return {user,role:getUserRole(user),response:null}
}

export async function requireAdmin(){
  const auth=await requireUser()
  if(auth.response) return auth
  if(auth.role!=='admin'){
    return {
      user:null,
      role:auth.role,
      response:NextResponse.json({error:'Forbidden'},{status:403})
    }
  }
  return auth
}
