// Isolated persistence adapter. It never changes matching or returned search results.
export function savedMatchesProfileKey({profile={},cvLibrary={}}={}){
  const fingerprint=String(profile?.unionSearchPlanFingerprint||profile?.unionSearchPlan?.fingerprint||'')
  const cvs=(Array.isArray(cvLibrary?.cvs)?cvLibrary.cvs:[])
    .filter(Boolean).map(cv=>[String(cv.id||''),String(cv.sourceVersion||'')])
  if(!fingerprint||!cvs.length) return ''
  const input=JSON.stringify([fingerprint,cvs,profile?.exclusionRules||[],profile?.locations||[],profile?.workModels||[]])
  let hash=2166136261
  for(let i=0;i<input.length;i++){hash^=input.charCodeAt(i);hash=Math.imul(hash,16777619)}
  return 'saved-profile-v1-'+(hash>>>0).toString(16).padStart(8,'0')
}

export async function persistSavedMatches({items=[],profileKey='',fetchImpl=globalThis.fetch}={}){
  if(!profileKey||!Array.isArray(items)||!items.length) return {saved:0,skipped:true}
  const response=await fetchImpl('/api/saved-matches',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({profileKey,items})
  })
  const body=await response.json().catch(()=>({}))
  if(!response.ok) throw new Error(body.error||'Saved Matches persistence failed')
  return body
}
