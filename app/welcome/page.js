'use client'

import {useEffect} from 'react'
import SplashGate from '../components/splash-gate.js'
import {sanitizeNextPath} from '../lib/auth/route-policy.js'

function EnterApp(){
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search)
    const target=sanitizeNextPath(params.get('next'))
    window.location.replace(target)
  },[])
  return null
}

export default function WelcomePage(){
  return <SplashGate><EnterApp/></SplashGate>
}
