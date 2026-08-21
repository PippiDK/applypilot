'use client'
import { useState } from 'react'

const WINDOWS=[1,3,7,14]

function dateText(value){ if(!value) return 'Date unavailable'; const d=new Date(value); if(!Number.isFinite(d.getTime())) return 'Date unavailable'; const days=Math.max(0,Math.floor((Date.now()-d.getTime())/86400000)); return days===0?'Today':days===1?'1 day ago':`${days} days ago` }
function salary(job){ if(job.salaryMinDkkMonth==null&&job.salaryMaxDkkMonth==null) return 'Insufficient data'; if(job.salaryMinDkkMonth!=null&&job.salaryMaxDkkMonth!=null) return `${job.salaryMinDkkMonth.toLocaleString('en-DK')}–${job.salaryMaxDkkMonth.toLocaleString('en-DK')} DKK/month`; return `${(job.salaryMinDkkMonth??job.salaryMaxDkkMonth).toLocaleString('en-DK')} DKK/month` }

export default function Home(){
  const [freshnessDays,setFreshnessDays]=useState(7)
  const [jobs,setJobs]=useState([])
  const [state,setState]=useState({loading:false,error:'',coverage:null,stats:null,fetchedAt:null})

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

    <section className="results">
      <div className="listHead"><div><p className="eyebrow">RESULTS</p><h2>Current matches</h2></div><small>Maximum 10 · Poor fit excluded</small></div>
      {!state.loading&&!state.error&&!state.stats&&<div className="empty">Run the LinkedIn search. No other source is used in this milestone.</div>}
      {state.loading&&<div className="empty">Searching LinkedIn public pages and reading full job descriptions…</div>}
      {!state.loading&&state.stats&&jobs.length===0&&<div className="empty">NO STRONG NEW MATCHES FOUND.</div>}
      {jobs.map(({job,evaluation},i)=><article className="jobCard" key={job.sourceJobId}>
        <div className="scoreBlock"><b>{evaluation.score.toFixed(1)}</b><span>/10</span><em>{evaluation.verdict}</em></div>
        <div className="jobMain">
          <div className="jobTop"><div><h3>{job.title}</h3><p>{job.company} · {job.location}</p></div><span className={`action ${evaluation.action.toLowerCase()}`}>{evaluation.action}</span></div>
          <div className="facts"><span>{dateText(job.publishedAt)}</span><span>{job.remoteType==='unknown'?'Work model unverified':job.remoteType}</span><span>{job.employmentType}</span><span>{salary(job)}</span></div>
          <div className="detailGrid"><div><small>MATCH</small>{evaluation.match.map((x,n)=><p key={n}>✓ {x}</p>)}</div><div><small>GAPS</small>{evaluation.gaps.length?evaluation.gaps.map((x,n)=><p key={n}>· {x}</p>):<p>· No material gap detected</p>}</div></div>
          <div className="breakdown"><span>Delivery <b>{evaluation.breakdown.responsibilitiesDelivery}</b></span><span>Experience/domain <b>{evaluation.breakdown.experienceDomain}</b></span><span>Geography <b>{evaluation.breakdown.geographyWorkModel}</b></span><span>Career/comp <b>{evaluation.breakdown.careerCompensation}</b></span></div>
          <div className="links"><a href={job.originalUrl} target="_blank" rel="noreferrer">Open LinkedIn vacancy ↗</a>{job.officialUrl&&<a href={job.officialUrl} target="_blank" rel="noreferrer">Employer link ↗</a>}</div>
        </div>
      </article>)}
    </section>
    <footer>Milestone: LinkedIn public search only · no CVR · no Jobnet · no additional sources</footer>
  </main>
}
