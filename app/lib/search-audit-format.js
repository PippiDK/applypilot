export function formatAuditScore(value){
  if(value==null||value==='') return '—'
  const score=Number(value)
  return Number.isFinite(score)?`${score}/10`:'—'
}
