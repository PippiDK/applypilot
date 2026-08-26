'use client'
import {useEffect,useState} from 'react'
import styles from './search-profile-roles-step.module.css'

const cleanLines=value=>String(value??'').split(/\n|,/).map(item=>item.trim()).filter(Boolean)
const rolesText=roles=>(Array.isArray(roles)?roles:[]).join('\n')

export default function SearchProfileRolesStep({primaryRoles=[],adjacentRoles=[],status='idle',error='',source='ai',totalCount=0,analysedCount=0,failedCvs=[],onPrimaryChange,onAdjacentChange,onRetry}){
  const loading=status==='loading'
  const ready=status==='ready'
  const partial=status==='partial'
  const primaryValue=rolesText(primaryRoles)
  const adjacentValue=rolesText(adjacentRoles)
  const [primaryText,setPrimaryText]=useState(primaryValue)
  const [adjacentText,setAdjacentText]=useState(adjacentValue)
  const readyLabel=`${totalCount} ${totalCount===1?'CV':'CVs'}`
  const cached=source==='cache'||source==='saved'

  useEffect(()=>{setPrimaryText(primaryValue)},[primaryValue])
  useEffect(()=>{setAdjacentText(adjacentValue)},[adjacentValue])

  return <div className="wizard">
    <h3>Which roles should we search for?</h3>
    <p>ApplyPilot proposes credible target roles from all ready CVs. Review and edit the combined list before saving your Search Profile. The live LinkedIn search still keeps its existing logic unchanged in this step.</p>

    {loading&&<div className="successBox"><b>Analysing {readyLabel}…</b><span>Building independent role directions from each ready CV.</span></div>}
    {ready&&<div className="successBox"><b>✓ Generated from {readyLabel}{cached?' · Cached':''}</b><span>You can edit every role before saving.</span></div>}
    {partial&&<div className="warningBox"><b>⚠ Generated from {analysedCount} of {totalCount} CVs</b><span>{error||'Some CV role directions could not be generated. Successful CV results are preserved.'}</span>{failedCvs.length>0&&<span>Retry: {failedCvs.map(cv=>`CV ${cv.slot}`).join(' · ')}</span>}<button className="secondary" type="button" onClick={onRetry}>Retry missing CVs</button></div>}
    {status==='error'&&<div className="errorBox"><b>Search Profile generation failed safely</b><span>{error}</span><button className="secondary" type="button" onClick={onRetry}>Retry</button></div>}

    <div className={styles.grid}>
      <label className={styles.field}><small>PRIMARY ROLES</small><span>Direct targets supported by at least one ready CV.</span><textarea value={primaryText} onChange={event=>setPrimaryText(event.target.value)} onBlur={()=>onPrimaryChange(cleanLines(primaryText))} rows="6" disabled={loading}/></label>
      <label className={styles.field}><small>ADJACENT ROLES</small><span>Credible nearby roles supported by the uploaded CV evidence.</span><textarea value={adjacentText} onChange={event=>setAdjacentText(event.target.value)} onBlur={()=>onAdjacentChange(cleanLines(adjacentText))} rows="6" disabled={loading}/></label>
    </div>
  </div>
}
