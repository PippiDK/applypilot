'use client'

import {useEffect,useState} from 'react'
import {useRouter} from 'next/navigation'
import {createBrowserSupabaseClient} from '../../lib/supabase/client.js'

export default function ResetPasswordPage(){
  const router=useRouter()
  const [ready,setReady]=useState(false)
  const [message,setMessage]=useState('Verifying your password reset link…')
  const [password,setPassword]=useState('')
  const [busy,setBusy]=useState(false)

  useEffect(()=>{
    let active=true
    async function verify(){
      try{
        const params=new URLSearchParams(window.location.search)
        const supabase=createBrowserSupabaseClient()
        if(params.get('error')) throw new Error('Supabase rejected the recovery link.')
        // @supabase/ssr createBrowserClient processes the PKCE callback URL during
        // auth initialization. Explicit exchangeCodeForSession would consume the
        // one-time code twice and can incorrectly reject an already valid session.
        const {data:{session},error:sessionError}=await supabase.auth.getSession()
        if(sessionError||!session) throw new Error('No recovery session available.')
        const {data:{user},error:userError}=await supabase.auth.getUser()
        if(userError||!user) throw new Error('Recovery session could not be verified.')
        window.history.replaceState(null,'','/auth/reset-password')
        if(active){setReady(true);setMessage('Choose a new TEST password (at least 12 characters).')}
      }catch(error){
        if(active)setMessage('Could not establish a TEST recovery session: '+(error?.message||'Unknown error')+'. Return to TEST login if a fresh recovery email is required.')
      }
    }
    void verify()
    return ()=>{active=false}
  },[])

  async function save(event){
    event.preventDefault()
    if(busy||!ready||password.length<12)return
    setBusy(true)
    try{
      const supabase=createBrowserSupabaseClient()
      const {error}=await supabase.auth.updateUser({password})
      if(error){setMessage('Password could not be saved. Please try again.');return}
      setMessage('TEST password saved. Opening Apply Pilot…')
      router.replace('/')
      router.refresh()
    }catch{
      setMessage('Password could not be saved. Please try again.')
    }finally{setBusy(false)}
  }

  return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#0b0b0b',color:'#fff',padding:24}}>
    <section style={{width:'min(420px,100%)',border:'1px solid #262626',borderRadius:18,background:'#111',padding:28}}>
      <h1 style={{fontSize:25}}>Set TEST password</h1>
      <p role="status" style={{color:'#c7c7c7',fontSize:14}}>{message}</p>
      {ready&&<form onSubmit={save} style={{display:'grid',gap:14}}>
        <label>New TEST password
          <input type="password" value={password} minLength={12} required autoComplete="new-password" onChange={e=>setPassword(e.target.value)} style={{display:'block',width:'100%',height:44,marginTop:7,boxSizing:'border-box'}}/>
        </label>
        <button disabled={busy||password.length<12} type="submit" style={{height:44,background:'#f4c542',border:0,borderRadius:8,fontWeight:700}}>Save TEST password</button>
      </form>}
      <p style={{fontSize:12,color:'#888'}}>This page is for the isolated TEST deployment only.</p>
    </section>
  </main>
}
