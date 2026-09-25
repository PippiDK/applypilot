'use client'
import {useCallback,useEffect,useState} from 'react'
import Link from 'next/link'
import styles from './manual-progress.module.css'

const frame={maxWidth:960,margin:'32px auto',padding:'0 18px',fontFamily:'system-ui,sans-serif',color:'#e5e7eb'}
const panel={background:'#201928',border:'1px solid #554366',borderRadius:12,padding:18,marginTop:16}
const button={padding:'9px 14px',borderRadius:8,border:'1px solid #ab84cf',background:'#3c2a4b',color:'white',cursor:'pointer',marginRight:10,marginTop:8}
const muted={color:'#b2a8bb',fontSize:13}
const rowStyle={padding:'10px 0',borderTop:'1px solid #44374f'}

function Progress({label,elapsed}){
  return <span className={styles.progress} role="status" aria-live="polite">
    <span className={styles.spinner} aria-hidden="true"/>
    <span>{label} · {elapsed}s elapsed</span>
  </span>
}
export default function NightFlightControl(){
  const [runs,setRuns]=useState([])
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [activeRequest,setActiveRequest]=useState(null)
  const [elapsed,setElapsed]=useState(0)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')

  const refresh=useCallback(async()=>{
    try{
      const response=await fetch('/api/night-flight-manual',{cache:'no-store'})
      const body=await response.json()
      if(!response.ok) throw new Error(body.error||'Could not load Night Flight')
      setRuns(Array.isArray(body.runs)?body.runs:[])
    }catch(e){setError(e.message||'Could not load Night Flight')}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{refresh()},[refresh])
  useEffect(()=>{
    if(!activeRequest) return
    const tick=()=>setElapsed(Math.floor((Date.now()-activeRequest.startedAt)/1000))
    tick()
    const timer=setInterval(tick,1000)
    return ()=>clearInterval(timer)
  },[activeRequest])

  async function execute(mode,runId,jobKey){
    if(busy) return
    if(mode==='retry'&&!window.confirm('Retry this FAILED job using the original frozen CV and JD?')) return
    setActiveRequest({mode,runId:runId||null,jobKey:jobKey||null,startedAt:Date.now()})
    setElapsed(0)
    setBusy(true);setMessage('');setError('')
    try{
      const response=await fetch('/api/night-flight-manual',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({mode,runId,jobKey}),cache:'no-store',
      })
      const body=await response.json()
      if(!response.ok) throw new Error(body.error||'Manual run failed')
      setMessage(`${mode.toUpperCase()}: ${body.targetDate||''} · ${body.status||'finished'} · READY ${body.jobsReady??'—'} · FAILED ${body.jobsFailed??'—'}. Refresh or resume if processing remains.`)
    }catch(e){setError(e.message||'Request failed; refresh to inspect current status')}
    finally{await refresh();setBusy(false);setActiveRequest(null)}
  }

  return <main style={frame}>
    <p><Link href="/" style={{color:'#f9a8d4'}}>← ApplyPilot</Link></p>
    <h1>Night Flight · Manual Control</h1>
    <p style={muted}>Run at any time. Start uses the previous Copenhagen calendar day; Resume and Retry use an existing frozen run. Each invocation processes at most three jobs. READY results are preserved.</p>
    <div style={panel}>
      <button style={button} disabled={busy} onClick={()=>execute('start')}>Start / resume yesterday</button>
      <button style={button} disabled={busy} onClick={refresh}>Refresh status</button>
      {activeRequest?.mode==='start'&&<Progress label="Starting Night Flight" elapsed={elapsed}/>}
      {message&&<p role="status" style={{color:'#86efac'}}>{message}</p>}
      {error&&<p role="alert" style={{color:'#fca5a5'}}>{error}</p>}
    </div>
    {loading?<p>Loading runs…</p>:runs.map(run=><section key={run.id} style={panel}>
      <h2>{run.targetDate} · {run.status}</h2>
      <p style={muted}>READY {run.jobsReady??0} · FAILED {run.jobsFailed??0} · discovered {run.jobsDiscovered??0}</p>
      <button style={button} disabled={busy} onClick={()=>execute('resume',run.id)}>Resume existing run</button>
      {activeRequest?.mode==='resume'&&activeRequest.runId===run.id&&<Progress label="Resuming this run" elapsed={elapsed}/>} 
      {run.jobs.map(job=><div key={job.jobKey} style={rowStyle}>
        <strong>{job.title||job.jobKey}</strong> · {job.company||'Unknown company'}
        <p style={muted}>{job.status} · attempts {job.attempts}{job.lastError?` · ${job.lastError}`:''}</p>
        {job.status==='FAILED'&&<button style={button} disabled={busy} onClick={()=>execute('retry',run.id,job.jobKey)}>Retry only this FAILED job</button>}
        {activeRequest?.mode==='retry'&&activeRequest.runId===run.id&&activeRequest.jobKey===job.jobKey&&<Progress label="Retrying this job" elapsed={elapsed}/>}
      </div>)}
    </section>)}
    {!loading&&!runs.length&&<p>No retained runs.</p>}
  </main>
}
