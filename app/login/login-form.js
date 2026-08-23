'use client'

import {useState} from 'react'
import {createBrowserSupabaseClient} from '../lib/supabase/client.js'

const NOTICE='If this email has access, a sign-in link will arrive shortly.'

export default function LoginForm(){
  const [email,setEmail]=useState('')
  const [loading,setLoading]=useState(false)
  const [notice,setNotice]=useState('')

  async function onSubmit(event){
    event.preventDefault()
    if(loading) return
    setLoading(true)
    setNotice('')

    try{
      const supabase=createBrowserSupabaseClient()
      await supabase.auth.signInWithOtp({
        email:email.trim(),
        options:{
          shouldCreateUser:false,
          emailRedirectTo:window.location.origin
        }
      })
    }catch{
      // Keep the user-facing response non-enumerating for invite-only access.
    }finally{
      setNotice(NOTICE)
      setLoading(false)
    }
  }

  return <form onSubmit={onSubmit} style={{display:'grid',gap:14}}>
    <label style={{display:'grid',gap:7,fontSize:13,color:'#c7c7c7'}}>
      Email
      <input
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={event=>setEmail(event.target.value)}
        placeholder="you@example.com"
        style={{height:44,borderRadius:10,border:'1px solid #343434',background:'#171717',color:'#fff',padding:'0 13px',fontSize:15,outline:'none'}}
      />
    </label>
    <button
      type="submit"
      disabled={loading}
      style={{height:44,border:0,borderRadius:10,background:'#f4c542',color:'#171717',fontWeight:800,fontSize:14,cursor:loading?'wait':'pointer',opacity:loading ? .72 : 1}}
    >
      {loading?'Sending…':'Send sign-in link'}
    </button>
    {notice?<p role="status" style={{margin:0,fontSize:13,lineHeight:1.45,color:'#bdbdbd'}}>{notice}</p>:null}
  </form>
}
