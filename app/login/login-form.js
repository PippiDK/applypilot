'use client'

import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {createBrowserSupabaseClient} from '../lib/supabase/client.js'

export default function LoginForm({testPasswordMode=false}){
  const router=useRouter()
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [loading,setLoading]=useState(false)
  const [notice,setNotice]=useState('')

  async function onSubmit(event){
    event.preventDefault()
    if(loading) return
    setLoading(true)
    setNotice('')
    try{
      const supabase=createBrowserSupabaseClient()
      if(testPasswordMode){
        const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password})
        if(error){
          setNotice('Sign-in failed. Check the TEST email and password.')
          return
        }
        router.replace('/')
        router.refresh()
        return
      }
      await supabase.auth.signInWithOtp({
        email:email.trim(),
        options:{
          shouldCreateUser:false,
          emailRedirectTo:`${window.location.origin}/auth/confirm`
        }
      })
      setNotice('If this email has access, a sign-in link will arrive shortly.')
    }catch{
      setNotice(testPasswordMode?'Sign-in failed. Please retry.':'If this email has access, a sign-in link will arrive shortly.')
    }finally{
      setLoading(false)
    }
  }

  const fieldStyle={height:44,borderRadius:10,border:'1px solid #343434',background:'#171717',color:'#fff',padding:'0 13px',fontSize:15,outline:'none'}
  return <form onSubmit={onSubmit} style={{display:'grid',gap:14}}>
    <label style={{display:'grid',gap:7,fontSize:13,color:'#c7c7c7'}}>Email
      <input type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@example.com" style={fieldStyle}/>
    </label>
    {testPasswordMode&&<label style={{display:'grid',gap:7,fontSize:13,color:'#c7c7c7'}}>TEST password
      <input type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)} style={fieldStyle}/>
    </label>}
    <button type="submit" disabled={loading} style={{height:44,border:0,borderRadius:10,background:'#f4c542',color:'#171717',fontWeight:800,fontSize:14,cursor:loading?'wait':'pointer',opacity:loading?.72:1}}>
      {loading?'Signing in…':testPasswordMode?'Sign in to TEST':'Send sign-in link'}
    </button>
    {notice&&<p role="status" style={{margin:0,fontSize:13,lineHeight:1.45,color:'#bdbdbd'}}>{notice}</p>}
  </form>
}
