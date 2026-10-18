'use client'
import {useEffect,useState} from 'react'
import {createBrowserClient} from '@supabase/ssr'

export default function SavedMatchesTestSignIn(){
  const [enabled,setEnabled]=useState(false)
  const [client,setClient]=useState(null)
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [signedIn,setSignedIn]=useState(false)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  useEffect(()=>{
    let alive=true
    fetch('/api/saved-matches',{method:'GET',cache:'no-store'}).then(r=>r.json()).then(result=>{
      if(!alive||!result.preview)return
      const url=process.env.NEXT_PUBLIC_SUPABASE_URL
      const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      if(!url||!key){setMessage('TEST Supabase configuration missing');setEnabled(true);return}
      const supabase=createBrowserClient(url,key)
      setClient(supabase)
      setSignedIn(Boolean(result.authenticated))
      setEnabled(true)
    }).catch(()=>{})
    return()=>{alive=false}
  },[])
  async function signIn(event){
    event.preventDefault()
    if(!client)return
    setBusy(true);setMessage('')
    try{
      const {error}=await client.auth.signInWithPassword({email:email.trim(),password})
      if(error)throw error
      setSignedIn(true);setPassword('');setMessage('Saved Matches TEST signed in. Run Search again.')
    }catch(error){setMessage(error?.message||'Sign-in failed')}
    finally{setBusy(false)}
  }
  async function signOut(){
    if(!client)return
    setBusy(true);setMessage('')
    try{
      await client.auth.signOut()
      setSignedIn(false)
    }finally{setBusy(false)}
  }
  if(!enabled)return null
  return <section aria-label="Saved Matches TEST authentication" style={{border:'1px solid #395568',borderRadius:10,padding:12,margin:'12px 0',background:'#12212b',color:'#d4ede5'}}>
    <strong>Saved Matches · TEST login</strong>{' '}
    {signedIn?<><span>Authenticated</span>{' '}<button type="button" onClick={signOut} disabled={busy}>Sign out from TEST</button></>:<form onSubmit={signIn} style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
      <input aria-label="TEST email" type="email" placeholder="TEST Supabase email" autoComplete="username" value={email} required onChange={e=>setEmail(e.target.value)}/>
      <input aria-label="TEST password" type="password" placeholder="TEST password" autoComplete="current-password" value={password} required onChange={e=>setPassword(e.target.value)}/>
      <button type="submit" disabled={busy||!client}>{busy?'Signing in...':'Sign in for Saved Matches'}</button>
    </form>}
    {message&&<p role="status" style={{margin:'6px 0 0'}}>{message}</p>}
  </section>
}
