'use client'
import { useState } from 'react'

const WINDOWS=[1,3,7,14]

function dateText(value){ if(!value) return 'Date unavailable'; const d=new Date(value); if(!Number.isFinite(d.getTime())) return 'Date unavailable'; const days=Math.max(0,Math.floor((Date.now()-d.getTime())/86400000)); return days===0?'Today':days===1?'1 day ago':`${days} days ago` }
function salary(job){ if(job.salaryMinDkkMonth==null&&job.salaryMaxDkkMonth==null) return 'Insufficient data'; if(job.salaryMinDkkMonth!=null&&job.salaryMaxDkkMonth!=null) return `${job.salaryMinDkkMonth.toLocaleString('en-DK')}–${job.salaryMaxDkkMonth.toLocaleString('en-DK')} DKK/month`; return `${(job.salaryMinDkkMonth??job.salaryMaxDkkMonth).toLocaleString('en-DK')} DKK/month` }

export default function Home(){
  const [freshnessDays,setFreshnessDays]=useState(7)
  const [jobs,setJobs]=useState([])
  const [selected,setSelected]=useState(null)
  const [state,setState]=useState({loading:false,error:'',coverage:null,stats:null,fetchedAt:null})
  const active=jobs.find(({job})=>job.sourceJobId===selected?.job?.sourceJobId)||jobs[0]||null

  async function search(){
    setJobs([]); setState({loading:true,error:'',coverage:null,stats:null,fetchedAt:null})
    try{
      const res=await fetch('/api/linkedin-search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({freshnessDays})})
      const data=await res.json()
      if(!res.ok) throw new Error(data.error||'LinkedIn search failed')
      setJobs(Array.isArray(data.jobs)?data.jobs:[])
      setState({loading:false,error:'',coverage:data.coverage||null,stats:data.stats||null,fetchedAt:data.fetchedAt||null})
    }catch(error){ setState({loading:false,error:error.message||'LinkedIn search failed',coverage:null,stats:null,fetchedAt:null}) }
  }

  return <main>
    <header><div><div className="brand">ApplyPilot</div><div className="tag">Search less. Apply better.</div></div><div className="sourceBadge">LINKEDIN · PUBLIC</div></header>

    <section className="hero">
      <div><p className="eyebrow">ONE SOURCE · END-TO-END</p><h1>Find Senior IT Project & Delivery roles in Denmark.</h1><p>LinkedIn public search → full job description → Master CV evaluation → worthwhile matches only.</p></div>
      <div className="metric"><b>{state.loading?'…':jobs.length}</b><span>matches</span></div>
    </section>

    <section className="controls">
      <div><small>POSTED WITHIN</small><div className="choices">{WINDOWS.map(days=><button key={days} className={freshnessDays===days?'choice selected':'choice'} onClick={()=>setFreshnessDays(days)}>{days} day{days===1?'':'s'}</button>)}</div></div>
      <button className="primary" onClick={search} disabled={state.loading}>{state.loading?'Reading LinkedIn JDs…':'Search LinkedIn'}</button>
    </section>

    <div className="profileStrip"><b>Profile loaded</b><span>Senior IT Project / Delivery · Master CV · Denmark</span><span>JD responsibilities 40% · experience/domain 25% · geography 20% · career/comp 15%</span></div>

    {state.error&&<div className="errorBox"><b>LinkedIn search failed</b><span>{state.error}</span></div>}
    {state.stats&&<div className="searchMeta"><span><b>{state.stats.discovered}</b> jobs discovered</span><span><b>{state.stats.fullJdVerified}</b> full JDs read</span><span><b>{state.stats.evaluated}</b> worthwhile after evaluation</span><span>Coverage: <b>{state.coverage?.status}</b></span></div>}
    {state.coverage?.detail&&<div className="warningBox">Partial source access: {state.coverage.detail}</div>}

    <section className="grid">
      <div className="list">
        <div className="listHead"><h2>Live matches</h2><small>Newest {freshnessDays} days</small></div>
        {!state.loading&&!state.error&&!state.stats&&<div className="empty">Run the LinkedIn search. No other source is used in this milestone.</div>}
        {state.loading&&<div className="empty">Searching LinkedIn public pages and reading full job descriptions…</div>}
        {!state.loading&&state.stats&&jobs.length===0&&<div className="empty">NO STRONG NEW MATCHES FOUND.</div>}
        {jobs.map(item=>{const {job,evaluation}=item; const score=Math.round(evaluation.score*10); return <button key={job.sourceJobId} onClick={()=>setSelected(item)} className={'job '+(active?.job.sourceJobId===job.sourceJobId?'active':'')}>
          <span className="score">{score}%</span>
          <span><b>{job.title}</b><small>{job.company} · {job.location}</small><small className="sourceLine">LinkedIn · {dateText(job.publishedAt)}</small></span>
          <span>→</span>
        </button>})}
      </div>

      <div className="panel">
        {active?(()=>{const {job,evaluation}=active; const score=Math.round(evaluation.score*10); return <>
          <div className="panelTop"><div><span className="pill">{evaluation.verdict.toUpperCase()}</span><h2>{job.title}</h2><p>{job.company} · {job.location}</p><small className="sourceLine">Source: LinkedIn · {dateText(job.publishedAt)}</small></div><div className="bigScore">{score}%</div></div>
          <div className="panelFacts"><span>{job.remoteType==='unknown'?'Work model unverified':job.remoteType}</span><span>{job.employmentType}</span><span>{salary(job)}</span></div>
          <div className="section"><h3>Why this fits</h3>{evaluation.match.length?evaluation.match.map((x,n)=><p key={n}>✓ {x}</p>):<p>✓ No additional match detail returned</p>}</div>
          <div className="section"><h3>Gap / unknown</h3>{evaluation.gaps.length?evaluation.gaps.map((x,n)=><p key={n}>⚠ {x}</p>):<p>✓ No material gap detected</p>}</div>
          <div className="section"><h3>Score breakdown</h3><div className="breakdown"><span>Delivery <b>{evaluation.breakdown.responsibilitiesDelivery}</b></span><span>Experience/domain <b>{evaluation.breakdown.experienceDomain}</b></span><span>Geography <b>{evaluation.breakdown.geographyWorkModel}</b></span><span>Career/comp <b>{evaluation.breakdown.careerCompensation}</b></span></div></div>
          <div className="actions"><a className="primary openLink" href={job.originalUrl} target="_blank" rel="noreferrer">Open LinkedIn vacancy</a>{job.officialUrl&&<a className="secondary openLink" href={job.officialUrl} target="_blank" rel="noreferrer">Employer link</a>}</div>
        </>})():<div className="emptyPanel"><h2>No selected vacancy</h2><p>{state.loading?'Searching LinkedIn public pages…':'Run the LinkedIn search to see matching vacancies.'}</p></div>}
      </div>
    </section>
    <footer>Milestone: LinkedIn public search only · no CVR · no Jobnet · no additional sources</footer>
  </main>
}
