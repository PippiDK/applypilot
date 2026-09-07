'use client'
import React,{useEffect,useState} from 'react'
import MainSearchBase from './main-search-base.js'
import {NIGHT_FLIGHT_STATUS,resolveJobStatus} from './lib/job-statuses.js'
import {enrichSearchJobsWithNightFlight} from './lib/night-flight-main-search-bridge.js'

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

function transformMainSearchTree(node,index){
  if(Array.isArray(node)) return node.map(child=>transformMainSearchTree(child,index))
  if(!React.isValidElement(node)) return node
  if(node.props?.className==='jobWrap') return enrichStatusSelect(node,index)
  const children=React.Children.map(node.props?.children,child=>transformMainSearchTree(child,index))
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
  return transformMainSearchTree(tree,nightFlightIndex)
}
