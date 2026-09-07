'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './night-flight-morning-review.module.css'

const POLL_INTERVAL_MS=45000
const ACTIVE_RUN_STATUSES=new Set(['PENDING','RUNNING'])
const TERMINAL_RUN_STATUSES=new Set(['READY','READY_WITH_ERRORS','NO_JOBS','FAILED'])

function formatDay(value){
  if(!value) return '—'
  const date=new Date(`${value}T12:00:00Z`)
  if(!Number.isFinite(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Copenhagen'}).format(date)
}

function list(value){
  return Array.isArray(value)?value.map(item=>String(item??'').trim()).filter(Boolean):[]
}

function progressFromReview(review){
  const jobs=Array.isArray(review?.jobs)?review.jobs:[]
  const ready=jobs.filter(item=>item?.status==='READY').length
  const failed=jobs.filter(item=>item?.status==='FAILED').length
  return {ready,failed,total:jobs.length,remaining:Math.max(0,jobs.length-ready-failed)}
}

async function readJson(url,fallback){
  const response=await fetch(url)
  const data=await response.json()
  if(!response.ok) throw new Error(data?.error||fallback)
  return data
}

async function fetchNightFlightReview(){
  const data=await readJson('/api/night-flight-review','Night Flight review could not be loaded.')
  return data?.review||null
}

async function fetchNightFlightStatus(){
  const data=await readJson('/api/night-flight-status','Night Flight status could not be loaded.')
  return data?.status||null
}

function ReviewList({title,items}){
  if(!items.length) return null
  return <section className={styles.section}><h3>{title}</h3><ul>{items.map((item,index)=><li key={`${title}-${index}`}>{item}</li>)}</ul></section>
}

export default function NightFlightMorningReview(){
  const [host,setHost]=useState(null)
  const [review,setReview]=useState(null)
  const [progress,setProgress]=useState(null)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [open,setOpen]=useState(false)
  const [selectedKey,setSelectedKey]=useState('')
  const [recoveringKey,setRecoveringKey]=useState('')
  const [recoveryError,setRecoveryError]=useState('')

  useEffect(()=>{
    setHost(document.querySelector('#nightFlightReviewHost'))
  },[])

  useEffect(()=>{
    if(!host) return
    let active=true
    setLoading(true)
    setError('')
    fetchNightFlightReview()
      .then(next=>{
        if(!active) return
        setReview(next)
        setProgress(progressFromReview(next))
        setSelectedKey(next?.jobs?.[0]?.key||'')
        setLoading(false)
      })
      .catch(fetchError=>{
        if(!active) return
        setError(fetchError?.message||'Night Flight review could not be loaded.')
        setLoading(false)
      })
    return ()=>{active=false}
  },[host])

  useEffect(()=>{
    if(!host||!ACTIVE_RUN_STATUSES.has(review?.run?.status)) return
    let active=true
    let timer=null

    const schedule=()=>{
      timer=setTimeout(poll,POLL_INTERVAL_MS)
    }

    const poll=async()=>{
      try{
        const status=await fetchNightFlightStatus()
        if(!active) return
        if(!status||status.run?.id!==review?.run?.id){
          schedule()
          return
        }

        setProgress(status.progress||null)
        if(TERMINAL_RUN_STATUSES.has(status.run?.status)){
          const refreshed=await fetchNightFlightReview()
          if(!active) return
          setReview(refreshed)
          setProgress(progressFromReview(refreshed))
          setSelectedKey(current=>refreshed?.jobs?.some(item=>item.key===current)?current:(refreshed?.jobs?.[0]?.key||''))
          return
        }
        schedule()
      }catch{
        if(active) schedule()
      }
    }

    schedule()
    return ()=>{
      active=false
      if(timer) clearTimeout(timer)
    }
  },[host,review?.run?.id,review?.run?.status])

  if(!host) return null

  const counts=review?.counts||{ready:0,failed:0}
  const activeRun=ACTIVE_RUN_STATUSES.has(review?.run?.status)
  const visibleProgress=progress||progressFromReview(review)
  const selected=review?.jobs?.find(item=>item.key===selectedKey)||review?.jobs?.[0]||null
  const analysis=selected?.analysis||null
  const vacancyUrl=selected?.job?.originalUrl||selected?.job?.detailUrl||selected?.job?.applicationUrl||''

  async function recoverNightFlightMatch(){
    if(!review?.run?.id||selected?.status!=='FAILED'||!selected?.key||recoveringKey) return
    const selectedJobKey=selected.key
    setRecoveringKey(selectedJobKey)
    setRecoveryError('')
    try{
      const response=await fetch('/api/night-flight-review',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({runId:review.run.id,jobKey:selected.key}),
        cache:'no-store',
      })
      const payload=await response.json().catch(()=>({}))
      if(!response.ok) throw new Error(payload?.error||'Night Flight Match recovery failed.')
      const next=payload?.review||null
      setReview(next)
      setProgress(progressFromReview(next))
      setSelectedKey(selected.key)
    }catch(recoveryFailure){
      setRecoveryError(recoveryFailure?.message||'Night Flight Match recovery failed.')
    }finally{
      setRecoveringKey('')
    }
  }

  const card=createPortal(
    <div className={styles.card} aria-label="Night Flight Morning Review">
      <div>
        <div className={styles.eyebrow}>NIGHT FLIGHT</div>
        <div className={styles.meta}>
          <span>Last completed day · {formatDay(review?.run?.targetDate)}</span>
          <span className={styles.counts}>{activeRun?`${visibleProgress.ready} / ${visibleProgress.total} ready`:`${counts.ready} READY · ${counts.failed} FAILED`}</span>
          {error&&<span className={styles.error}>{error}</span>}
        </div>
      </div>
      <button type="button" className={styles.open} disabled={loading||!review} onClick={()=>setOpen(true)}>{loading?'Loading…':'Open Night Flight'}</button>
    </div>,
    host
  )

  const dialog=open&&review?createPortal(
    <div className={styles.backdrop} onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="night-flight-review-title">
        <div className={styles.heading}>
          <div><div className={styles.eyebrow}>NIGHT FLIGHT</div><h2 id="night-flight-review-title">Last completed day · {formatDay(review.run?.targetDate)}</h2></div>
          <button type="button" className={styles.close} aria-label="Close Night Flight review" onClick={()=>setOpen(false)}>×</button>
        </div>
        <div className={styles.body}>
          <aside className={styles.list} aria-label="Night Flight jobs">
            {(review.jobs||[]).map(item=><button type="button" key={item.key} className={`${styles.job} ${selected?.key===item.key?styles.selected:''}`} onClick={()=>{setSelectedKey(item.key);setRecoveryError('')}}>
              <span className={styles.jobTitle}>{item.job?.title||'Untitled role'}</span>
              <span className={styles.jobMeta}>{item.job?.company||'Company unavailable'} · {item.job?.location||item.source||'Location unavailable'}</span>
              <span className={item.status==='READY'?styles.ready:styles.failed}>{item.status==='READY'?'READY':'FAILED'}</span>
            </button>)}
          </aside>
          <section className={styles.match} aria-label="Profile Match">
            <div className={styles.matchHeader}>
              <h2>Profile Match</h2>
              {vacancyUrl&&<a className={`secondary openLink ${styles.vacancyLink}`} href={vacancyUrl} target="_blank" rel="noreferrer">Open vacancy</a>}
            </div>
            {!selected&&<p className={styles.muted}>No review jobs for this run.</p>}
            {selected?.status==='FAILED'&&<>
              <div className={styles.failure}>{selected.lastError||'Automatic Profile Match failed.'}</div>
              {recoveryError&&<div className={styles.failure}>{recoveryError}</div>}
              <button type="button" className={styles.retry} onClick={recoverNightFlightMatch} disabled={recoveringKey===selected.key}>{recoveringKey===selected.key?'Running…':'Run Match'}</button>
            </>}
            {selected?.status==='READY'&&analysis&&<>
              <div className={styles.score}><b>{Number.isFinite(Number(analysis.expertiseMatch))?Math.round(Number(analysis.expertiseMatch)):'—'}%</b><span>Expertise Match</span></div>
              <ReviewList title="Why you fit" items={list(analysis.whyYouFit)}/>
              <ReviewList title="Expertise gaps" items={list(analysis.expertiseGaps)}/>
            </>}
            {selected?.status==='READY'&&!analysis&&<p className={styles.muted}>Saved Profile Match is not available for this role.</p>}
          </section>
        </div>
      </section>
    </div>,
    document.body
  ):null

  return <>{card}{dialog}</>
}
