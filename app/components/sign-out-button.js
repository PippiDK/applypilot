'use client'

import {usePathname} from 'next/navigation'

export default function SignOutButton(){
  const pathname=usePathname()
  if(pathname==='/login'||pathname.startsWith('/auth/')) return null

  return <form action="/auth/signout" method="post" style={{position:'fixed',top:12,right:14,zIndex:1000}}>
    <button type="submit" style={{border:'1px solid rgba(255,255,255,.14)',borderRadius:8,background:'rgba(15,15,15,.88)',color:'#cfcfcf',padding:'7px 10px',fontSize:12,fontWeight:700,cursor:'pointer',backdropFilter:'blur(8px)'}}>Sign out</button>
  </form>
}
