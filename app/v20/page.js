'use client'
import {useEffect,useMemo,useState} from 'react'
import {parseBrowserExport,mergeBrowserJobs,V20_IMPORT_STORAGE_KEY,V20_STATUS_STORAGE_KEY} from '../lib/v20-browser-import.js'
import {CV_LIBRARY_STORAGE_KEY,normalizeCvLibrary} from '../lib/cv-library.js'
import {SOURCE_CV_STORAGE_KEY} from '../lib/source-cv.js'
import {JOB_STATUS_OPTIONS} from '../lib/job-statuses.js'

const pageStyle={maxWidth:1180,margin:'0 auto',padding:'40px 24px',color:'#F8F7F8',fontFamily:'inherit'}
const cardStyle={background:'#2A1B2E',border:'1px solid #3B2C3F',borderRadius:18,padding:20}
const btnStyle={background:'#F9738E',color:'#1A1120',padding:'12px 18px',border:0,borderRadius:12,cursor:'pointer',fontWeight:700}
const labelStyle={color:'#C7BACF',fontSize:13}
function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function getReadyCv(){
  const legacy=readJson(SOURCE_CV_STORAGE_KEY,null)
  const library=normalizeCvLibrary(readJson(CV_LIBRARY_STORAGE_KEY,null),legacy)
  return library.cvs.filter(item=>item?.status==='ready'&&item?.cvText?.length>=100)
}
function scoreText(analysis){const n=Number(analysis?.expertiseMatch);return Number.isFinite(n)?`${n}%`:'N/A'}
export default function BrowserImportV20(){
  const [jobs,setJobs]=useState([])
  const [statuses,setStatuses]=useState({})
  const [selected,setSelected]=useState('')
  const [cvs,setCvs]=useState([])
  const [cvVersion,setCvVersion]=useState('')
  const [message,setMessage]=useState('')
  const [running,setRunning]=useState(false)
  const [analysis,setAnalysis]=useState({})
  const [hydrated,setHydrated]=useState(false)
  const [showReview,setShowReview]=useState(false)
  useEffect(()=>{
    const storedJobs=readJson(V20_IMPORT_STORAGE_KEY,[])
    const storedStatuses=readJson(V20_STATUS_STORAGE_KEY,{})
    setJobs(Array.isArray(storedJobs)?storedJobs:[])
    setStatuses(storedStatuses&&typeof storedStatuses==='object'?storedStatuses:{})
    setSelected(Array.isArray(storedJobs)?storedJobs[0]?.sourceJobId||'':'')
    const ready=getReadyCv()
    setCvs(ready)
    setCvVersion(ready[0]?.sourceVersion||'')
    setHydrated(true)
  },[])
  const current=jobs.find(job=>job.sourceJobId===selected)||jobs[0]||null
  const reviewCount=jobs.filter(job=>job.needsJdReview).length
  const readyCount=jobs.length-reviewCount
  const visible=useMemo(()=>showReview?jobs.filter(job=>job.needsJdReview):jobs,[jobs,showReview])
  async function importFile(event){
    const file=event.target.files?.[0]
    if(!file) return
    event.target.value=''
    if(file.size>12*1024*1024){setMessage('JSON is over 12 MB; split the export before import.');return}
    try{
      const payload=JSON.parse(await file.text())
      const result=parseBrowserExport(payload)
      const merged=mergeBrowserJobs(jobs,result.jobs)
      // Persist first; never claim import succeeded if storage quota prevented it.
      localStorage.setItem(V20_IMPORT_STORAGE_KEY,JSON.stringify(merged))
      setJobs(merged)
      setSelected(old=>old||merged[0]?.sourceJobId||'')
      setMessage(`Imported ${result.jobs.length} distinct rows from this file · ${merged.length-jobs.length} new · ${result.errors.length} rejected · ${merged.length} total. ${result.pagesCollected??'Unknown'} collector pages reported.`)
    }catch(error){setMessage(`Import rejected: ${error?.message||'Invalid JSON'}`)}
  }
  function changeStatus(jobId,status){
    const next={...statuses}
    if(status) next[jobId]=status;else delete next[jobId]
    try{localStorage.setItem(V20_STATUS_STORAGE_KEY,JSON.stringify(next));setStatuses(next)}
    catch{setMessage('Cannot save v20 status in browser storage.')}
  }
  async function match(){
    if(!current||running)return
    const cv=cvs.find(item=>item.sourceVersion===cvVersion)
    if(!cv){setMessage('Upload a ready Source CV using Legacy Search Profile in this browser first.');return}
    if(current.needsJdReview){setMessage('This JD needs review before matching.');return}
    setRunning(true)
    setMessage('AI Matching selected job with Source CV...')
    try{
      const response=await fetch('/api/v20/expertise-match',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({job:current,cvText:cv.cvText})})
      const data=await response.json()
      if(!response.ok)throw new Error(data?.error||'Matching failed')
      setAnalysis(old=>({...old,[current.sourceJobId]:data.analysis}))
      setMessage('Matching returned a result for selected job. Result is session-only.')
    }catch(error){setMessage(error.message||'Matching failed')}
    finally{setRunning(false)}
  }
  function clear(){
    if(!window.confirm('Clear only v20 imported jobs and v20 statuses in this browser?'))return
    localStorage.removeItem(V20_IMPORT_STORAGE_KEY)
    localStorage.removeItem(V20_STATUS_STORAGE_KEY)
    setJobs([]);setStatuses({});setAnalysis({});setSelected('');setMessage('v20 browser collection cleared. Legacy was not changed.')
  }
  if(!hydrated)return <main style={pageStyle}>Loading Apply Pilot v20…</main>
  return <main style={pageStyle}>
    <header style={{marginBottom:24}}>
      <p style={{...labelStyle,letterSpacing:2}}>AUVRAEN PLATFORM · DEVELOPMENT</p>
      <h1 style={{fontSize:36,margin:'4px 0'}}>Apply Pilot v20</h1>
      <p style={{color:'#C7BACF'}}>Browser JSON Import · Manual LinkedIn Collector · Independent v20 workspace</p>
    </header>
    <section style={{...cardStyle,marginBottom:18}}>
      <h2 style={{fontSize:19,margin:'0 0 12px'}}>Import LinkedIn Jobs</h2>
      <label style={{...btnStyle,display:'inline-block'}}>
        <input type="file" accept=".json,application/json" onChange={importFile} style={{display:'none'}}/>
        ↑ Choose Collector JSON
      </label>
      <p style={{...labelStyle,marginTop:14}}>Collect pages manually in Edge, export one combined JSON, then select it here. Repeated Job IDs are merged.</p>
      {message&&<p role="status" style={{color:'#FBC6D1'}}>{message}</p>}
    </section>
    <section style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:18}}>
      <div style={{...cardStyle,minWidth:140}}><div style={labelStyle}>Imported jobs</div><strong style={{fontSize:28}}>{jobs.length}</strong></div>
      <div style={{...cardStyle,minWidth:140}}><div style={labelStyle}>JD ready (flagged)</div><strong style={{fontSize:28}}>{readyCount}</strong></div>
      <div style={{...cardStyle,minWidth:140}}><div style={labelStyle}>Needs JD review</div><strong style={{fontSize:28}}>{reviewCount}</strong></div>
    </section>
    <div style={{display:'grid',gridTemplateColumns:'minmax(240px,1fr) minmax(300px,1.5fr)',gap:16}}>
      <section style={cardStyle}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <h2 style={{fontSize:18,margin:0}}>Vacancies</h2>
          <label style={labelStyle}><input type="checkbox" checked={showReview} onChange={e=>setShowReview(e.target.checked)}/> Review only</label>
        </div>
        <div style={{maxHeight:570,overflowY:'auto',marginTop:12}}>
          {visible.map(job=><button key={job.sourceJobId} onClick={()=>setSelected(job.sourceJobId)}
            style={{display:'block',width:'100%',textAlign:'left',padding:'12px 10px',background:current?.sourceJobId===job.sourceJobId?'#47314B':'transparent',color:'#F8F7F8',border:'none',borderBottom:'1px solid #3B2C3F',cursor:'pointer'}}>
            <strong>{job.title}</strong><div style={labelStyle}>{job.company} · {job.location}</div>
            {job.needsJdReview&&<small style={{color:'#F59E0B'}}>JD review required</small>}
          </button>)}
          {!visible.length&&<p style={labelStyle}>No vacancies in this view.</p>}
        </div>
      </section>
      <section style={cardStyle}>
        {!current?<p style={labelStyle}>Select an exported Collector JSON to start.</p>:<>
          <h2 style={{fontSize:22,margin:'0 0 6px'}}>{current.title}</h2>
          <div style={labelStyle}>{current.company} · {current.location}</div>
          <p><a href={current.originalUrl} target="_blank" rel="noreferrer" style={{color:'#F9738E'}}>Open on LinkedIn ↗</a></p>
          <label style={{...labelStyle,display:'block'}}>Status
            <select value={statuses[current.sourceJobId]||''} onChange={e=>changeStatus(current.sourceJobId,e.target.value)}
              style={{display:'block',marginTop:6,padding:10,width:'100%',background:'#1A1120',color:'#F8F7F8',border:'1px solid #3B2C3F',borderRadius:10}}>
              {JOB_STATUS_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <h3 style={{marginBottom:6}}>Full job description</h3>
          {current.needsJdReview&&<p style={{color:'#F59E0B'}}>The Collector description may be incomplete. AI Matching disabled for this job.</p>}
          <div style={{whiteSpace:'pre-wrap',lineHeight:1.6,maxHeight:300,overflowY:'auto',background:'#1A1120',padding:14,borderRadius:12,fontSize:13}}>{current.fullJd||'No JD provided'}</div>
          <div style={{marginTop:18}}>
            <label style={{...labelStyle,display:'block',marginBottom:8}}>Source CV
              <select value={cvVersion} onChange={e=>setCvVersion(e.target.value)}
                style={{display:'block',marginTop:6,padding:10,width:'100%',background:'#1A1120',color:'#F8F7F8',border:'1px solid #3B2C3F',borderRadius:10}}>
                {!cvs.length&&<option value="">No ready Source CV in this browser</option>}
                {cvs.map(cv=><option value={cv.sourceVersion} key={cv.sourceVersion}>{cv.fileName}</option>)}
              </select>
            </label>
            <button style={{...btnStyle,opacity:(running||current.needsJdReview||!cvs.length)?0.5:1}} disabled={running||current.needsJdReview||!cvs.length} onClick={match}>{running?'Analyzing…':'AI Match selected vacancy'}</button>
            {analysis[current.sourceJobId]&&<div style={{marginTop:16}}>
              <h3>Expertise Match · {scoreText(analysis[current.sourceJobId])}</h3>
              {['whyYouFit','expertiseGaps'].map(key=><div key={key}><strong>{key==='whyYouFit'?'Why you fit':'Gaps'}</strong><ul>{(analysis[current.sourceJobId][key]||[]).map((item,i)=><li key={i}>{item}</li>)}</ul></div>)}
            </div>}
          </div>
        </>}
      </section>
    </div>
    <footer style={{paddingTop:28,display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}>
      <span style={labelStyle}>v20 local browser storage only. No Legacy Discovery, Night Pilot, Master Pool or Applied history writes.</span>
      <button onClick={clear} style={{...btnStyle,background:'transparent',border:'1px solid #F9738E',color:'#F9738E'}}>Clear v20 imports</button>
    </footer>
  </main>
}
