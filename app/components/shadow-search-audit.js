'use client'

function provenance(direction={}){
  const slots=Array.isArray(direction?.cvSlots)?direction.cvSlots:[]
  if(direction?.origin==='cv'&&slots.length) return slots.map(slot=>`CV ${slot}`).join(' · ')
  if(direction?.origin==='manual') return 'MANUAL'
  return ''
}

export default function ShadowSearchAudit({shadowState}){
  const status=shadowState?.status||'idle'
  if(status==='idle'||status==='skipped') return null

  const stats=shadowState?.stats||{}
  const comparison=shadowState?.comparison||{}
  const newCandidates=Array.isArray(comparison?.newCandidates)?comparison.newCandidates:[]

  return (
    <details className="audit">
      <summary><strong>SHADOW SEARCH</strong> · profile-driven diagnostic · no effect on Live matches</summary>
      {status==='error'?(
        <div className="muted" style={{marginTop:10}}>{shadowState?.error||'Shadow discovery failed.'}</div>
      ):(
        <div style={{marginTop:10}}>
          <div>Directions: <strong>{stats.directions??0}</strong> · Primary: <strong>{stats.primaryDirections??0}</strong> · Adjacent: <strong>{stats.adjacentDirections??0}</strong></div>
          <div>Candidates: <strong>{comparison.totalCandidates??0}</strong> · Already discovered by legacy: <strong>{comparison.alreadyDiscovered??0}</strong></div>
          <div>New candidates: <strong>{comparison.newCount??0}</strong> · Primary: <strong>{comparison.newFromPrimary??0}</strong> · Adjacent-only: <strong>{comparison.newFromAdjacent??0}</strong></div>
          {shadowState?.coverage?.detail&&<div className="muted" style={{marginTop:8}}>{shadowState.coverage.detail}</div>}
          {newCandidates.map(candidate=>(
            <div key={candidate.jobId} style={{marginTop:10}}>
              <strong>{candidate.title||'Untitled role'}</strong>{candidate.company?` · ${candidate.company}`:''}
              <div className="muted">
                FOUND BY: {(Array.isArray(candidate.foundBy)?candidate.foundBy:[]).map(direction=>{
                  const source=provenance(direction)
                  return `${direction.role} [${String(direction.tier||'').toUpperCase()}]${source?` · ${source}`:''}`
                }).join(' | ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </details>
  )
}
