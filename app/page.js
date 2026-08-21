'use client'
import {useState} from 'react'
const jobs=[
 {score:94,company:'Nordic Digital Bank',role:'Senior Delivery Manager',location:'Copenhagen · Hybrid',why:['Enterprise software delivery','FinTech priority match','Distributed engineering teams'],gap:'Salary not stated'},
 {score:89,company:'Cloud Platform Europe',role:'Technical Project Manager',location:'Remote · EMEA',why:['Platform implementation','Cross-functional delivery','Remote EMEA'],gap:'Industry match is neutral'},
 {score:82,company:'RegTech Systems',role:'Program Manager',location:'Copenhagen · Hybrid',why:['Regulated environment','Governance and risk','Senior ownership'],gap:'Release ownership not explicit'}
]
export default function Home(){
 const [selected,setSelected]=useState(jobs[0])
 return <main>
  <header><div><div className="brand">ApplyPilot</div><div className="tag">Search less. Apply better.</div></div><button className="ghost">Search profile</button></header>
  <section className="hero"><div><p className="eyebrow">YOUR JOB SEARCH AUTOPILOT</p><h1>3 new opportunities are ready for review.</h1><p>We found, filtered and prepared today’s strongest matches. You decide what gets submitted.</p></div><div className="metric"><b>3</b><span>new today</span></div></section>
  <section className="grid"><div className="list"><h2>Today</h2>{jobs.map((j,i)=><button key={i} onClick={()=>setSelected(j)} className={'job '+(selected===j?'active':'')}><span className="score">{j.score}%</span><span><b>{j.role}</b><small>{j.company} · {j.location}</small></span><span>→</span></button>)}</div>
  <div className="panel"><div className="panelTop"><div><span className="pill">STRONG FIT</span><h2>{selected.role}</h2><p>{selected.company} · {selected.location}</p></div><div className="bigScore">{selected.score}%</div></div>
  <div className="section"><h3>Why this fits</h3>{selected.why.map((x,i)=><p key={i}>✓ {x}</p>)}</div>
  <div className="section"><h3>Gap</h3><p>⚠ {selected.gap}</p></div>
  <div className="section"><h3>Application pack</h3><div className="docs"><div>✓ Tailored CV <span>Ready</span></div><div>✓ Cover letter <span>Ready</span></div></div></div>
  <div className="actions"><button className="primary">Review application</button><button className="secondary">Open job</button></div></div></section>
  <footer>Human-in-the-loop by design · ApplyPilot never submits an application without you.</footer>
 </main>
}
