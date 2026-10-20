'use client'
import {useState} from 'react'
import {parseBrowserExport} from '../lib/v20-browser-import.js'
import {collectorJobsToApplyPilotJobs} from '../lib/v20-browser-adapter.js'
import styles from './linkedin-json-import.module.css'

// Stage 2: import section only. Stage 3 connects accepted jobs to existing Live Matches.
export default function LinkedInJsonImport({onImported}){
  const [file,setFile]=useState(null)
  const [state,setState]=useState({status:'idle',message:'',stats:null})
  async function preview(){
    if(!file)return
    setState({status:'reading',message:'',stats:null})
    try{
      if(file.size>12*1024*1024) throw new Error('JSON file exceeds 12 MB')
      const payload=JSON.parse(await file.text())
      const result=parseBrowserExport(payload)
      const mappedJobs=collectorJobsToApplyPilotJobs(result.jobs)
      if(typeof onImported!=='function') throw new Error('Apply Pilot Live Matches is unavailable')
      const outcome=await onImported(mappedJobs)
      const stats={
        imported:mappedJobs.length,
        complete:mappedJobs.filter(job=>!job.needsJdReview).length,
        partial:mappedJobs.filter(job=>job.needsJdReview).length,
        duplicates:result.inputCount-result.jobs.length-result.errors.length,
        invalid:result.errors.length
      }
      setState({status:'preview',message:`Live Matches · ${outcome?.total??0} retained · ${outcome?.added??0} new. ${outcome?.excludedUndated??0} missing publication dates (not retained in ten-day list; keep your JSON backup).`,stats})
    }catch(error){
      setState({status:'error',message:error?.message||'Could not read JSON export',stats:null})
    }
  }
  function select(event){
    const next=event.target.files?.[0]||null
    setFile(next)
    setState({status:'idle',message:'',stats:null})
    event.target.value=''
  }
  function clear(){
    setFile(null)
    setState({status:'idle',message:'',stats:null})
  }
  return <section className={styles.section} aria-label="LinkedIn JSON Import">
    <div className={styles.icon} aria-hidden="true">▤</div>
    <div className={styles.main}>
      <h2>LinkedIn JSON Import</h2>
      <p>Import vacancies collected from the AUVRAEN LinkedIn Collector JSON export.</p>
      <div className={styles.actions}>
        <div className={styles.fileBox}>
          <label className={styles.choose}>
            Choose file
            <input aria-label="Choose LinkedIn Collector JSON file" type="file" accept=".json,application/json" onChange={select}/>
          </label>
          <span className={styles.fileName} title={file?.name||''}>{file?.name||'No file selected'}</span>
          {file&&<button className={styles.clear} aria-label="Remove selected JSON file" type="button" onClick={clear}>×</button>}
        </div>
        <button className={styles.import} type="button" onClick={preview} disabled={!file||state.status==='reading'}>{state.status==='reading'?'Checking…':'Import JSON'}</button>
      </div>
      {state.message&&<p className={state.status==='error'?styles.error:styles.notice} role="status">{state.message}</p>}
    </div>
    <aside className={styles.stats} aria-live="polite">
      <span className={styles.indicator}>{state.status==='preview'?'✓ File ready':state.status==='error'?'File error':'Awaiting JSON'}</span>
      <div><span>Imported:</span><b>{state.stats?.imported??'—'} vacancies</b></div>
      <div><span>JD complete:</span><b>{state.stats?.complete??'—'}</b></div>
      <div><span>Partial description:</span><b>{state.stats?.partial??'—'}</b></div>
      <div><span>Duplicates skipped:</span><b>{state.stats?.duplicates??'—'}</b></div>
      {state.stats?.invalid>0&&<div><span>Invalid rows:</span><b>{state.stats.invalid}</b></div>}
      <small>Only vacancies with a verified publication date within 10 days appear in Live Matches. Keep the JSON file for undated vacancies.</small>
    </aside>
  </section>
}
