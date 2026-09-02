export default function SearchPlanPreview({plan}){
  const directions=Array.isArray(plan?.directions)?plan.directions:[]
  const primaryCount=Number(plan?.primaryCount)||0
  const adjacentCount=Number(plan?.adjacentCount)||0
  const sourceLabel=direction=>direction.origin==='manual'
    ?'MANUAL'
    :(Array.isArray(direction.cvSlots)&&direction.cvSlots.length?direction.cvSlots.map(slot=>`CV ${slot}`).join(' · '):'CV')

  return <details className="truth searchPlanPreview">
    <summary>
      <span><b>SEARCH PLAN PREVIEW · {directions.length} DIRECTIONS</b><small>{primaryCount} primary · {adjacentCount} adjacent</small></span>
    </summary>
    <div className="searchPlanPreviewBody">
      {directions.map(direction=><div className="reviewRow" key={`${direction.tier}:${direction.key}`}>
        <span>{direction.role}</span>
        <b>{direction.tier==='primary'?'PRIMARY':'ADJACENT'} · {sourceLabel(direction)}</b>
      </div>)}
    </div>
  </details>
}
