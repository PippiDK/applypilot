// v20 display-only adapter: keeps undated browser imports visible for manual review.
import {filterItemsByFreshnessSelection,freshnessSelectionFromDays} from './freshness-selection.js'
export function v20VisibleByWindow(items=[],days=5,now=new Date()){
 const dated=filterItemsByFreshnessSelection(items,freshnessSelectionFromDays(days),now)
 const present=new Set(dated)
 return items.filter(item=>present.has(item)||item?.job?.importSource==='linkedin-json'&&!item?.job?.publishedAt)
}
export function v20SortedByScore(items=[]){
 return [...items].sort((a,b)=>{
  const left=Number.isFinite(a?.evaluation?.score)?a.evaluation.score:-Infinity
  const right=Number.isFinite(b?.evaluation?.score)?b.evaluation.score:-Infinity
  if(right!==left)return right-left
  const ta=Date.parse(a?.job?.publishedAt||'')
  const tb=Date.parse(b?.job?.publishedAt||'')
  return (Number.isFinite(tb)?tb:-Infinity)-(Number.isFinite(ta)?ta:-Infinity)
 })
}
export function v20ScoreLabel(evaluation){
 const score=evaluation?.score
 return Number.isFinite(score)?score.toFixed(1)+'/10':'N/A'
}
