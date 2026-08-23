import {NextResponse} from 'next/server'
import {createServerSupabaseClient} from '../supabase/server.js'

export async function requireUser(){
  const supabase=await createServerSupabaseClient()
  const {data,error}=await supabase.auth.getUser()
  const user=data?.user??null

  if(error||!user){
    return {
      user:null,
      response:NextResponse.json({error:'Unauthorized'},{status:401})
    }
  }

  return {user,response:null}
}
