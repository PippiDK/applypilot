'use client'

import {useEffect} from 'react'
import {canonicalAppRedirectUrl} from '../lib/canonical-origin.js'

export default function StablePreviewOrigin({environment,branchUrl}){
  useEffect(()=>{
    const redirectUrl=canonicalAppRedirectUrl({
      vercelEnv:environment,
      branchUrl,
      requestUrl:window.location.href,
      method:'GET',
      accept:'text/html',
    })
    if(redirectUrl) window.location.replace(redirectUrl)
  },[environment,branchUrl])

  return null
}
