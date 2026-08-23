import {EXPERTISE_CATEGORIES,EXPERTISE_IMPORTANCE} from './expertise-requirements.js'
import {EXPERTISE_EVALUATION_STATUSES} from './expertise-evaluator.js'

const IMPORTANCE_WEIGHT={critical:3,core:2,supporting:1}
const STATUS_CREDIT={MATCHED:1,TRANSFERABLE:.75,PARTIAL:.4,NOT_EVIDENCED:0}
const FIT_STATUS_RANK={MATCHED:0,TRANSFERABLE:1,PARTIAL:2,NOT_EVIDENCED:3}
const GAP_STATUS_RANK={NOT_EVIDENCED:0,PARTIAL:1,TRANSFERABLE:2,MATCHED:3}

function scoreFor(items=[]){
  const possible=items.reduce((sum,item)=>sum+(IMPORTANCE_WEIGHT[item.importance]||0),0)
  if(!possible) return null
  const earned=items.reduce((sum,item)=>sum+(IMPORTANCE_WEIGHT[item.importance]||0)*(STATUS_CREDIT[item.status]??0),0)
  return Math.round(earned/possible*100)
}

function importanceRank(value){
  const rank=EXPERTISE_IMPORTANCE.indexOf(value)
  return rank<0?EXPERTISE_IMPORTANCE.length:rank
}

function evaluationMap(requirements,evaluations){
  if(!Array.isArray(requirements)||!requirements.length) throw new Error('Structured JD requirements are required for Expertise Match.')
  if(!Array.isArray(evaluations)||evaluations.length!==requirements.length) throw new Error('Semantic evaluations must cover every requirement exactly once.')
  const map=new Map()
  for(const evaluation of evaluations){
    const id=String(evaluation?.id||'').trim()
    if(!id||map.has(id)||!EXPERTISE_EVALUATION_STATUSES.includes(evaluation?.status)) throw new Error('Invalid semantic Expertise Match evaluation.')
    map.set(id,evaluation)
  }
  for(const requirement of requirements) if(!map.has(String(requirement?.id||'').trim())) throw new Error('Semantic evaluation is missing a JD requirement.')
  return map
}

export function evaluateExpertiseFromJudgements(requirements=[],evaluations=[]){
  const byId=evaluationMap(requirements,evaluations)
  const evaluated=requirements.map(requirement=>({...requirement,...byId.get(String(requirement.id).trim())}))
  const breakdown={}
  for(const category of EXPERTISE_CATEGORIES){
    const items=evaluated.filter(item=>item.category===category)
    breakdown[category]={
      score:scoreFor(items),
      matched:items.filter(x=>x.status==='MATCHED').length,
      transferable:items.filter(x=>x.status==='TRANSFERABLE').length,
      partial:items.filter(x=>x.status==='PARTIAL').length,
      notEvidenced:items.filter(x=>x.status==='NOT_EVIDENCED').length,
      total:items.length
    }
  }

  const expertiseMatch=scoreFor(evaluated)??0
  const fit=[...evaluated]
    .filter(x=>x.status==='MATCHED'||x.status==='TRANSFERABLE')
    .sort((a,b)=>importanceRank(a.importance)-importanceRank(b.importance)||(FIT_STATUS_RANK[a.status]??9)-(FIT_STATUS_RANK[b.status]??9))
  const gaps=[...evaluated]
    .filter(x=>x.status!=='MATCHED')
    .sort((a,b)=>importanceRank(a.importance)-importanceRank(b.importance)||(GAP_STATUS_RANK[a.status]??9)-(GAP_STATUS_RANK[b.status]??9))

  const whyYouFit=fit.slice(0,5).map(item=>item.capability)
  const expertiseGaps=gaps.slice(0,5).map(item=>{
    if(item.status==='TRANSFERABLE') return `${item.capability} — transferable evidence only in Source CV`
    if(item.status==='PARTIAL') return `${item.capability} — partially evidenced in Source CV`
    return `${item.capability} — not evidenced in Source CV`
  })

  return {expertiseMatch,whyYouFit,expertiseGaps,breakdown,requirements:evaluated}
}
