'use client'
import {useEffect,useMemo,useState} from 'react'
import {isSourceCvReady} from '../lib/source-cv.js'
import {requestBestCv} from '../lib/best-cv-client.js'
import {readBestCvCache,writeBestCvCache} from '../lib/best-cv-cache.js'
import styles from './best-cv-panel.module.css'

const text=value=>String(value??'').trim()
function cvLabel(cv){return cv?.slot?`CV ${cv.slot}`:'CV'}

export default function BestCvPanel({job,cvLibrary}){
  const readyCvs=useMemo(()=>Array.isArray(cvLibrary?.cvs)?cvLibrary.cvs.filter(isSourceCvReady):[],[cvLibrary])
  const librarySignature=readyCvs.map(cv=>`${cv.id}:${cv.sourceVersion}`).join('|')
  const jobId=text(job?.sourceJobId)||`${text(job?.title)}|${text(job?.company)}`
  const description=text(job?.description)
  const [state,setState]=useState({loading:false,error:'',analysis:null,source:'idle'})

  useEffect(()=>{
    if(!jobId||!description||!readyCvs.length){
      setState({loading:false,error:'',analysis:null,source:'idle'})
      return
    }
    const args={storage:localStorage,jobId,description,cvs:readyCvs}
    const cached=readBestCvCache(args)
    setState({loading:false,error:'',analysis:cached,source:cached?'cache':'idle'})
  },[jobId,description,librarySignature])

  async function runBestCv(){
    if(state.loading||!jobId||!description) return
    if(!readyCvs.length){
      setState({loading:false,error:'Upload at least one CV before Best CV analysis.',analysis:null,source:'idle'})
      return
    }
    const cacheArgs={storage:localStorage,jobId,description,cvs:readyCvs}
    const cached=readBestCvCache(cacheArgs)
    if(cached){
      setState({loading:false,error:'',analysis:cached,source:'cache'})
      return
    }
    setState({loading:true,error:'',analysis:null,source:'idle'})
    try{
      const analysis=await requestBestCv({job,cvs:readyCvs})
      writeBestCvCache({...cacheArgs,analysis})
      setState({loading:false,error:'',analysis,source:'ai'})
    }catch(error){
      setState({loading:false,error:error.message||'Best CV analysis failed safely. Please try again.',analysis:null,source:'idle'})
    }
  }

  const analysis=state.analysis
  const winner=analysis?readyCvs.find(cv=>cv.id===analysis.recommendedCvId):null
  const ranked=analysis?analysis.rankedCvIds.map(id=>readyCvs.find(cv=>cv.id===id)).filter(Boolean):[]
  const advice=analysis?.recommendation==='update_recommended'?'UPDATE RECOMMENDED':'USE AS IS'

  return <section className={styles.card}>
    <div className={styles.head}>
      <div><p className="eyebrow">BEST CV FOR THIS JOB</p><p className={styles.intro}>Compare the ready CVs as they are written. No merging.</p></div>
      <span className={styles.status}>{state.loading?'Analysing…':analysis?(state.source==='cache'?'Cached':'Recommended'):'Not analysed'}</span>
    </div>

    {!analysis&&!state.loading&&<>
      <p className={styles.empty}>{readyCvs.length?`${readyCvs.length} CV${readyCvs.length===1?'':'s'} ready for recruiter-style comparison.`:'Upload at least one CV to compare it with this job.'}</p>
      <button className={`primary ${styles.action}`} onClick={runBestCv} disabled={!readyCvs.length}>Find best CV</button>
    </>}

    {state.loading&&<div className={styles.loading}>Comparing {readyCvs.map(cv=>cvLabel(cv)).join(' · ')} against the Full JD…</div>}
    {state.error&&<div className="errorBox"><b>Best CV analysis failed safely</b><span>{state.error}</span></div>}

    {analysis&&winner&&<>
      <div className={styles.winnerRow}>
        <div><small>RECOMMENDED</small><b>{cvLabel(winner)}</b><span>{winner.fileName}</span></div>
        <strong className={`${styles.advice} ${analysis.recommendation==='update_recommended'?styles.needsUpdate:''}`}>{advice}</strong>
      </div>
      <p className={styles.reason}>{analysis.reason}</p>
      <div className={styles.ranking}><small>RANKED</small><span>{ranked.map(cv=>cvLabel(cv)).join(' › ')}</span></div>
      {analysis.recommendation==='update_recommended'&&analysis.updateFocus?.length>0&&<div className={styles.focus}><small>UPDATE FOCUS</small>{analysis.updateFocus.map((item,index)=><p key={index}>• {item}</p>)}</div>}
    </>}
  </section>
}
