export default function SearchPlanPreview({plan}){
  const directions=Array.isArray(plan?.directions)?plan.directions:[]
  const primaryCount=Number(plan?.primaryCount)||0
  const adjacentCount=Number(plan?.adjacentCount)||0
  const sourceLabel=direction=>direction.origin==='manual'
    ?'MANUAL'
    :(Array.isArray(direction.cvSlots)&&direction.cvSlots.length?direction.cvSlots.map(slot=>`CV ${slot}`).join(' · '):'CV')

  return <details className="truth searchPlanPreview">
    <summary><b>Search plan details</b><span>{directions.length} directions · {primaryCount} primary · {adjacentCount} adjacent</span></summary>
    <div className="searchPlanDirections">
      {directions.map(direction=><div className="reviewRow" key={`${direction.tier}:${direction.key}`}>
        <span>{direction.role}</span>
        <b>{direction.tier==='primary'?'PRIMARY':'ADJACENT'} · {sourceLabel(direction)}</b>
      </div>)}
    </div>
  </details>
}
