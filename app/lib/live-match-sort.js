// Presentation-only ordering for evaluated Live Matches. Does not mutate matching scores or input arrays.
export function sortLiveMatchesByScore(items=[]){
  return [...items].sort((a,b)=>{
    const left=Number(a?.evaluation?.score)
    const right=Number(b?.evaluation?.score)
    const l=Number.isFinite(left)?left:-Infinity
    const r=Number.isFinite(right)?right:-Infinity
    if(r!==l)return r-l
    const at=Date.parse(a?.job?.publishedAt||'')
    const bt=Date.parse(b?.job?.publishedAt||'')
    const aTime=Number.isFinite(at)?at:-Infinity
    const bTime=Number.isFinite(bt)?bt:-Infinity
    return bTime-aTime
  })
}
export function formatLiveMatchScore(score){
  const value=Number(score)
  return Number.isFinite(value)?value.toFixed(1)+'/10':'N/A'
}
