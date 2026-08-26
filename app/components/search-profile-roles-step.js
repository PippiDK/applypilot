'use client'
import {useEffect,useState} from 'react'
import styles from './search-profile-roles-step.module.css'

const cleanLines=value=>String(value??'').split(/\n|,/).map(item=>item.trim()).filter(Boolean)
const rolesText=roles=>(Array.isArray(roles)?roles:[]).join('\n')

export default function SearchProfileRolesStep({primaryRoles=[],adjacentRoles=[],status='idle',error='',source='ai',onPrimaryChange,onAdjacentChange,onRetry}){
  const loading=status==='loading'
  const ready=status==='ready'
  const primaryValue=rolesText(primaryRoles)
  const adjacentValue=rolesText(adjacentRoles)
  const [primaryText,setPrimaryText]=useState(primaryValue)
  const [adjacentText,setAdjacentText]=useState(adjacentValue)

  useEffect(()=>{setPrimaryText(primaryValue)},[primaryValue])
  useEffect(()=>{setAdjacentText(adjacentValue)},[adjacentValue])

  return <div className="wizard">
    <h3>Which roles should we search for?</h3>
    <p>ApplyPilot proposes credible target roles from CV 1. Review and edit them before saving your Search Profile. The live LinkedIn search still keeps its existing logic unchanged in this step.</p>

    {loading&&<div className="successBox"><b>Analysing CV 1…</b><span>Building a role proposal from your current Search CV.</span></div>}
    {ready&&<div className="successBox"><b>✓ Generated from CV 1{source==='cache'?' · Cached':''}</b><span>You can edit every role before saving.</span></div>}
    {error&&<div className="errorBox"><b>Search Profile generation failed safely</b><span>{error}</span><button className="secondary" type="button" onClick={onRetry}>Retry</button></div>}

    <div className={styles.grid}>
      <label className={styles.field}><small>PRIMARY ROLES</small><span>Direct targets based on your strongest recent positioning.</span><textarea value={primaryText} onChange={event=>setPrimaryText(event.target.value)} onBlur={()=>onPrimaryChange(cleanLines(primaryText))} rows="4" disabled={loading}/></label>
      <label className={styles.field}><small>ADJACENT ROLES</small><span>Credible nearby roles with transferable fit.</span><textarea value={adjacentText} onChange={event=>setAdjacentText(event.target.value)} onBlur={()=>onAdjacentChange(cleanLines(adjacentText))} rows="4" disabled={loading}/></label>
    </div>
  </div>
}
