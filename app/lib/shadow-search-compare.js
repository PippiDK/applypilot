const cleanId=value=>String(value??'').trim()
const candidateId=value=>cleanId(value?.jobId||value?.sourceJobId)

export function compareShadowToLegacy({candidates=[],legacyAudit=[]}={}){
  const cleanCandidates=(Array.isArray(candidates)?candidates:[]).filter(candidate=>candidateId(candidate))
  const legacyIds=new Set((Array.isArray(legacyAudit)?legacyAudit:[]).map(candidateId).filter(Boolean))
  let alreadyDiscovered=0
  let newFromPrimary=0
  let newFromAdjacent=0
  const newCandidates=[]

  for(const candidate of cleanCandidates){
    const id=candidateId(candidate)
    if(legacyIds.has(id)){
      alreadyDiscovered++
      continue
    }
    newCandidates.push(candidate)
    const foundBy=Array.isArray(candidate?.foundBy)?candidate.foundBy:[]
    if(foundBy.some(direction=>direction?.tier==='primary')) newFromPrimary++
    else newFromAdjacent++
  }

  return {
    totalCandidates:cleanCandidates.length,
    alreadyDiscovered,
    newCount:newCandidates.length,
    newFromPrimary,
    newFromAdjacent,
    newCandidates
  }
}
