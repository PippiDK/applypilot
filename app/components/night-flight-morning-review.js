'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './night-flight-morning-review.module.css'

function formatDay(value){
  if(!value) return '—'
  const date=new Date(`${value}T12:00:00Z`)
  if(!Number.isFinite(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Copenhagen'}).format(date)
}

function list(value){
  return Array.isArray(value)?value.map(item=>String(item??'').trim()).filter(Boolean):[]
}

function ReviewList({title,items}){
  if(!items.length) return null
  return <section className={styles.section}><h3>{title}</h3><ul>{items.map((item,index)=><li key={`${title}-${index}`}>{item}</li>)}</ul></section>
}

export default function NightFlightMorningReview(){
  const [host,setHost]=useState(null)
  const [review,setReview]=useState(null)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [open,setOpen]=useState(false)
  const [selectedKey,setSelectedKey]=useState('')

  useEffect(()=>{
    setHost(document.querySelector('.profileStrip'))
  },[])

  useEffect(()=>{
    if(!host) return
    let active=true
    setLoading(true)
    setError('')
    fetch('/api/night-flight-review')
      .then(async response=>{
        const data=await response.json()
        if(!response.ok) throw new Error(data?.error||'Night Flight review could not be loaded.')
        return data?.review||null
      })
      .then(next=>{
        if(!active) return
        setReview(next)
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

  if(!host) return null

  const counts=review?.counts||{ready:0,failed:0}
  const selected=review?.jobs?.find(item=>item.key===selectedKey)||review?.jobs?.[0]||null
  const analysis=selected?.analysis||null
  const card=createPortal(
    <div className={styles.card} aria-label="Night Flight Morning Review">
      <div>
        <div className={styles.eyebrow}>NIGHT FLIGHT</div>
        <div className={styles.meta}>
          <span>Last completed day · {formatDay(review?.run?.targetDate)}</span>
          <span className={styles.counts}>{counts.ready} READY · {counts.failed} FAILED</span>
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
            {(review.jobs||[]).map(item=><button type="button" key={item.key} className={`${styles.job} ${selected?.key===item.key?styles.selected:''}`} onClick={()=>setSelectedKey(item.key)}>
              <span className={styles.jobTitle}>{item.job?.title||'Untitled role'}</span>
              <span className={styles.jobMeta}>{item.job?.company||'Company unavailable'} · {item.job?.location||item.source||'Location unavailable'}</span>
              <span className={item.status==='READY'?styles.ready:styles.failed}>{item.status==='READY'?'READY':'FAILED'}</span>
            </button>)}
          </aside>
          <section className={styles.match} aria-label="Profile Match">
            <h2>Profile Match</h2>
            {!selected&&<p className={styles.muted}>No review jobs for this run.</p>}
            {selected?.status==='FAILED'&&<>
              <div className={styles.failure}>{selected.lastError||'Automatic Profile Match failed.'}</div>
              <button type="button" className={styles.retry} disabled>Run Match</button>
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
