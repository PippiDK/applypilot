'use client'
import React,{useEffect,useState} from 'react'
import MainSearchBase from './main-search-base.js'
import {NIGHT_FLIGHT_STATUS,resolveJobStatus} from './lib/job-statuses.js'
import {enrichSearchJobsWithNightFlight} from './lib/night-flight-main-search-bridge.js'
import {resolveNightFlightExpertise} from './lib/night-flight-expertise-reuse.js'

const NIGHT_FLIGHT_STATUS_STYLE={borderColor:'rgba(167,139,250,.72)',color:'#ddd6fe',background:'rgba(109,40,217,.22)'}

function elementText(node){
  if(node==null||typeof node==='boolean') return ''
  if(typeof node==='string'||typeof node==='number') return String(node)
  if(Array.isArray(node)) return node.map(elementText).join(' ')
  if(!React.isValidElement(node)) return ''
  return elementText(node.props?.children)
}

function sourceFromJobCard(node){
  const text=elementText(node).toLowerCase()
  if(text.includes('linkedin')) return 'linkedin'
  if(text.includes('jobindex')) return 'jobindex'
  if(text.includes('jobnet')) return 'jobnet'
  return ''
}

function visibleElementKey(value){
  return String(value??'').replace(/^\.\$/,'').replace(/^\$/,'').trim()
}

function enrichStatusSelect(jobWrap,index){
  const sourceJobId=String(jobWrap.key??'').trim()
  if(!sourceJobId) return jobWrap
  const children=React.Children.toArray(jobWrap.props.children)
  const selectIndex=children.findIndex(child=>React.isValidElement(child)&&child.type==='select'&&String(child.props?.className||'').includes('jobStatusSelect'))
  if(selectIndex<0) return jobWrap
  const select=children[selectIndex]
  const card=children.find(child=>React.isValidElement(child)&&child.type==='button')
  const source=sourceFromJobCard(card)
  const enriched=enrichSearchJobsWithNightFlight([{job:{source,sourceJobId}}],index)
  const job=enriched[0]?.job||{source,sourceJobId}
  const manualStatus=String(select.props.value||'')
  const displayStatus=resolveJobStatus({manualStatus,job})
  if(displayStatus!==NIGHT_FLIGHT_STATUS) return jobWrap
  const nightFlightOption=React.createElement('option',{value:NIGHT_FLIGHT_STATUS,key:'night-flight-derived'},'NIGHT FLIGHT')
  children[selectIndex]=React.cloneElement(select,{
    value:NIGHT_FLIGHT_STATUS,
    className:`jobStatusSelect status-${NIGHT_FLIGHT_STATUS}`,
    style:{...(select.props.style||{}),...NIGHT_FLIGHT_STATUS_STYLE},
  },[nightFlightOption,...React.Children.toArray(select.props.children)])
  return React.cloneElement(jobWrap,undefined,children)
}

function findActiveJobIdentity(node){
  if(Array.isArray(node)){
    for(const child of node){const found=findActiveJobIdentity(child);if(found)return found}
    return null
  }
  if(!React.isValidElement(node)) return null
  if(node.props?.className==='jobWrap'){
    const children=React.Children.toArray(node.props.children)
    const card=children.find(child=>React.isValidElement(child)&&child.type==='button')
    if(card&&String(card.props?.className||'').split(/\s+/).includes('active')){
      const sourceJobId=visibleElementKey(node.key)
      return sourceJobId?{source:sourceFromJobCard(card),sourceJobId}:null
    }
  }
  for(const child of React.Children.toArray(node.props?.children)){
    const found=findActiveJobIdentity(child)
    if(found) return found
  }
  return null
}

function analysisItems(values,prefix){
  const items=Array.isArray(values)?values:[]
  return items.map((item,index)=>React.createElement('p',{key:index},`${prefix} ${item}`))
}

function scoreText(value){return value==null?'N/A':`${value}%`}

function nightFlightExpertiseHero(analysis){
  const why=Array.isArray(analysis?.whyYouFit)?analysis.whyYouFit:[]
  const transferable=Array.isArray(analysis?.transferableStrengths)?analysis.transferableStrengths:[]
  const gaps=Array.isArray(analysis?.expertiseGaps)?analysis.expertiseGaps:[]
  const breakdown=analysis?.breakdown&&typeof analysis.breakdown==='object'?analysis.breakdown:{}
  const breakdownRows=[
    ['Delivery / execution',breakdown.delivery_execution?.score],
    ['Domain & functional expertise',breakdown.domain_functional_expertise?.score],
    ['Technical / platform capabilities',breakdown.technical_platform_capabilities?.score],
    ['Leadership & stakeholder scope',breakdown.leadership_stakeholder_scope?.score],
    ['Required experience / qualifications',breakdown.required_experience_qualifications?.score],
  ]
  return React.createElement('div',{className:'expertiseHero'},
    React.createElement('div',{className:'expertiseHeroHead'},
      React.createElement('div',null,
        React.createElement('p',{className:'eyebrow'},'EXPERTISE MATCH'),
        React.createElement('p',{className:'expertiseIntro'},'Full JD ↔ Source CV professional expertise only')
      ),
      React.createElement('div',{className:'expertiseScore'},scoreText(analysis?.expertiseMatch))
    ),
    React.createElement('div',{className:'expertiseSection'},
      React.createElement('h3',null,'Why you fit'),
      ...(why.length?analysisItems(why,'✓'):[React.createElement('p',{className:'muted',key:'empty-fit'},'No direct professional match evidence returned.')])
    ),
    ...(transferable.length?[React.createElement('div',{className:'expertiseSection',key:'transferable'},
      React.createElement('h3',null,'Transferable strengths'),...analysisItems(transferable,'↔'))]:[]),
    React.createElement('div',{className:'expertiseSection'},
      React.createElement('h3',null,'Expertise gaps'),
      ...(gaps.length?analysisItems(gaps,'⚠'):[React.createElement('p',{key:'no-gaps'},'✓ No material expertise gap detected in the analysed requirements.')])
    ),
    React.createElement('div',{className:'expertiseSection'},
      React.createElement('h3',null,'Expertise breakdown'),
      React.createElement('div',{className:'expertiseBreakdown'},...breakdownRows.map(([label,score])=>React.createElement('div',{key:label},React.createElement('span',null,label),React.createElement('b',null,scoreText(score)))))
    )
  )
}

function transformMainSearchTree(node,index,cachedNightFlightAnalysis){
  if(Array.isArray(node)) return node.map(child=>transformMainSearchTree(child,index,cachedNightFlightAnalysis))
  if(!React.isValidElement(node)) return node
  if(node.props?.className==='jobWrap') return enrichStatusSelect(node,index)
  if(cachedNightFlightAnalysis&&node.props?.className==='expertiseHero') return nightFlightExpertiseHero(cachedNightFlightAnalysis)
  const children=React.Children.map(node.props?.children,child=>transformMainSearchTree(child,index,cachedNightFlightAnalysis))
  return React.cloneElement(node,undefined,children)
}

export default function Home(){
  const [nightFlightIndex,setNightFlightIndex]=useState({jobs:{}})
  useEffect(()=>{
    let active=true
    ;(async()=>{
      try{
        const response=await fetch('/api/night-flight-index')
        if(!response.ok) return
        const index=await response.json()
        if(active) setNightFlightIndex(index)
      }catch{}
    })()
    return()=>{active=false}
  },[])
  const tree=MainSearchBase()
  const activeNightFlightJob=findActiveJobIdentity(tree)
  const cachedNightFlightAnalysis=resolveNightFlightExpertise({job:activeNightFlightJob,index:nightFlightIndex})
  return transformMainSearchTree(tree,nightFlightIndex,cachedNightFlightAnalysis)
}
