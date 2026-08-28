const text=value=>String(value??'').trim()

export const ADAPTATION_DECISION=Object.freeze({
  ORIGINAL:'original',
  ACCEPTED:'accepted'
})

const REVIEW_BLOCKS=Object.freeze([
  {key:'professionalSummary',blockId:'professional_summary',label:'Professional Summary'},
  {key:'latestRoleOverview',blockId:'latest_role_overview',label:'Latest role overview'},
  {key:'previousRoleOverview',blockId:'previous_role_overview',label:'Previous role overview'}
])

function required(value,label){
  const normalized=text(value)
  if(!normalized) throw new Error(`${label} is required for an adaptation decision.`)
  return normalized
}

export function adaptationDecisionKey({jobId,cvId,sourceVersion,blockId}={}){
  return [
    required(jobId,'jobId'),
    required(cvId,'cvId'),
    required(sourceVersion,'sourceVersion'),
    required(blockId,'blockId')
  ].map(value=>encodeURIComponent(value)).join('|')
}

export function setAdaptationDecision(current={},identity={},decision){
  if(decision!==ADAPTATION_DECISION.ORIGINAL&&decision!==ADAPTATION_DECISION.ACCEPTED){
    throw new Error('Adaptation decision must be original or accepted.')
  }
  return {...(current||{}),[adaptationDecisionKey(identity)]:decision}
}

export function readAdaptationDecision(current={},identity={}){
  try{
    const value=current?.[adaptationDecisionKey(identity)]
    return value===ADAPTATION_DECISION.ORIGINAL||value===ADAPTATION_DECISION.ACCEPTED?value:null
  }catch{
    return null
  }
}

export function safeAdaptationReviewBlocks({blocks={},truthGuard={}}={}){
  const review=[]
  for(const definition of REVIEW_BLOCKS){
    const block=blocks?.[definition.key]
    const guard=truthGuard?.[definition.key]
    if(block?.status!=='generated'||text(block?.blockId)!==definition.blockId) continue
    if(guard?.verdict!=='PASS'||text(guard?.blockId)!==definition.blockId) continue

    const original=text(block.originalText)
    const updated=text(guard.safeText)
    if(!original||!updated||original===updated) continue

    review.push({
      blockId:definition.blockId,
      label:definition.label,
      original,
      updated,
      why:text(block.why)||'Repositioned for this vacancy using verified evidence from the selected CV.'
    })
  }
  return review
}
