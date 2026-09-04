'use client'

import {useEffect} from 'react'

const REPLACEMENTS=new Map([
  ['MULTI-SOURCE + COMPANY WATCH · TEST','MULTI-SOURCE + COMPANY WATCH'],
  ['TEST · LinkedIn + Jobindex + Jobnet multi-source search','LinkedIn + Jobindex + Jobnet multi-source search'],
])

export default function NeutralizeLegacyTestLabels(){
  useEffect(()=>{
    const replaceLegacyLabels=()=>{
      document.querySelectorAll('.sourceBadge, footer').forEach(node=>{
        const replacement=REPLACEMENTS.get(node.textContent?.trim()||'')
        if(replacement) node.textContent=replacement
      })
    }

    replaceLegacyLabels()
    const observer=new MutationObserver(replaceLegacyLabels)
    observer.observe(document.body,{childList:true,subtree:true})
    return ()=>observer.disconnect()
  },[])

  return null
}
