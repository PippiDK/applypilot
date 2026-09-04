'use client'

import {usePathname} from 'next/navigation'
import NightFlightSettings from './night-flight-settings.js'

const controlStyle={
  border:'1px solid rgba(255,255,255,.14)',
  borderRadius:8,
  background:'rgba(15,15,15,.88)',
  color:'#cfcfcf',
  padding:'7px 10px',
  fontSize:12,
  fontWeight:700,
  cursor:'pointer',
  backdropFilter:'blur(8px)',
  textDecoration:'none',
  lineHeight:1.4
}

export default function SignOutButton(){
  const pathname=usePathname()
  if(pathname==='/login'||pathname.startsWith('/auth/')) return null

  return <div style={{position:'fixed',top:12,right:14,zIndex:1000,display:'flex',gap:8,alignItems:'center'}}>
    {pathname!=='/help'&&<a href="/help" target="_blank" rel="noopener noreferrer" style={controlStyle}>HELP</a>}
    {pathname!=='/help'&&<NightFlightSettings/>}
    <form action="/auth/signout" method="post" style={{margin:0}}>
      <button type="submit" style={controlStyle}>Sign out</button>
    </form>
  </div>
}
