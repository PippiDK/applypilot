'use client'
import {useEffect,useMemo,useState} from 'react'

const jobs=[
 {score:94,company:'Nordic Digital Bank',role:'Senior Delivery Manager',location:'Copenhagen · Hybrid',why:['Enterprise software delivery','FinTech priority match','Distributed engineering teams'],gap:'Salary not stated'},
 {score:89,company:'Cloud Platform Europe',role:'Technical Project Manager',location:'Remote · EMEA',why:['Platform implementation','Cross-functional delivery','Remote EMEA'],gap:'Industry match is neutral'},
 {score:82,company:'RegTech Systems',role:'Program Manager',location:'Copenhagen · Hybrid',why:['Regulated environment','Governance and risk','Senior ownership'],gap:'Release ownership not explicit'}
]

const defaultProfile={
 cvName:'',
 roles:'Senior Project Manager, Delivery Manager, Technical Project Manager, Program Manager',
 geography:['Denmark hybrid','Remote EU/EMEA'],
 salary:'75000',
 exclusions:'Construction; industrial hardware / manufacturing R&D; coordinator or assistant roles; mandatory Danish',
 savedAt:''
}

export default function Home(){
 const [selected,setSelected]=useState(jobs[0])
 const [profile,setProfile]=useState(defaultProfile)
 const [draft,setDraft]=useState(defaultProfile)
 const [open,setOpen]=useState(false)
 const [step,setStep]=useState(1)
 const [loaded,setLoaded]=useState(false)

 useEffect(()=>{
  try{
   const saved=localStorage.getItem('applypilot-profile')
   if(saved){const parsed=JSON.parse(saved);setProfile({...defaultProfile,...parsed});setDraft({...defaultProfile,...parsed})}
  }catch(e){}
  setLoaded(true)
 },[])

 const profileReady=Boolean(profile.savedAt)
 const completion=useMemo(()=>{
  const fields=[draft.cvName,draft.roles,draft.geography?.length,draft.salary,draft.exclusions]
  return Math.round(fields.filter(Boolean).length/fields.length*100)
 },[draft])

 function startProfile(){setDraft(profileReady?profile:defaultProfile);setStep(1);setOpen(true)}
 function close(){setOpen(false)}
 function toggleGeo(value){
  setDraft(p=>({...p,geography:p.geography.includes(value)?p.geography.filter(x=>x!==value):[...p.geography,value]}))
 }
 function saveProfile(){
  const saved={...draft,savedAt:new Date().toISOString()}
  localStorage.setItem('applypilot-profile',JSON.stringify(saved))
  setProfile(saved);setDraft(saved);setOpen(false);setStep(1)
 }

 return <main>
  <header><div><div className="brand">ApplyPilot</div><div className="tag">Search less. Apply better.</div></div><button className="ghost profileBtn" onClick={startProfile}>{profileReady?'✓ Profile ready':'Search profile'}</button></header>

  <section className="hero"><div><p className="eyebrow">YOUR JOB SEARCH AUTOPILOT</p><h1>3 new opportunities are ready for review.</h1><p>We found, filtered and prepared today’s strongest matches. You decide what gets submitted.</p></div><div className="metric"><b>3</b><span>new today</span></div></section>

  {profileReady&&<div className="profileStrip"><span>✓ Search profile active</span><span>{profile.roles.split(',').slice(0,2).join(' · ')}</span><span>{profile.geography.join(' · ')}</span><button onClick={startProfile}>Edit</button></div>}

  <section className="grid"><div className="list"><h2>Today</h2>{jobs.map((j,i)=><button key={i} onClick={()=>setSelected(j)} className={'job '+(selected===j?'active':'')}><span className="score">{j.score}%</span><span><b>{j.role}</b><small>{j.company} · {j.location}</small></span><span>→</span></button>)}</div>
  <div className="panel"><div className="panelTop"><div><span className="pill">STRONG FIT</span><h2>{selected.role}</h2><p>{selected.company} · {selected.location}</p></div><div className="bigScore">{selected.score}%</div></div>
  <div className="section"><h3>Why this fits</h3>{selected.why.map((x,i)=><p key={i}>✓ {x}</p>)}</div>
  <div className="section"><h3>Gap</h3><p>⚠ {selected.gap}</p></div>
  <div className="section"><h3>Application pack</h3><div className="docs"><div>✓ Tailored CV <span>Ready</span></div><div>✓ Cover letter <span>Ready</span></div></div></div>
  <div className="actions"><button className="primary">Review application</button><button className="secondary">Open job</button></div></div></section>
  <footer>Human-in-the-loop by design · ApplyPilot never submits an application without you.</footer>

  {open&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
   <div className="modal">
    <div className="modalHead"><div><p className="eyebrow">BUILD YOUR SEARCH AGENT</p><h2>Search profile</h2></div><button className="close" onClick={close}>×</button></div>
    <div className="progress"><span style={{width:`${step/6*100}%`}}></span></div>
    <div className="stepMeta"><span>Step {step} of 6</span><span>{completion}% profile data</span></div>

    {step===1&&<div className="wizard"><h3>Upload your master CV</h3><p>ApplyPilot will use this as the source of truth for your experience. Nothing may be invented.</p><label className="upload"><input type="file" accept=".pdf,.doc,.docx" onChange={e=>setDraft(p=>({...p,cvName:e.target.files?.[0]?.name||''}))}/><b>{draft.cvName?'✓ '+draft.cvName:'Choose CV file'}</b><span>PDF, DOC or DOCX</span></label></div>}

    {step===2&&<div className="wizard"><h3>Which roles should we search for?</h3><p>Use job titles you want, separated by commas. Matching will later also understand semantically similar titles.</p><textarea value={draft.roles} onChange={e=>setDraft(p=>({...p,roles:e.target.value}))} rows="5"/></div>}

    {step===3&&<div className="wizard"><h3>Where can you work?</h3><p>Select every geography that should count as a valid match.</p><div className="choiceGrid">{['Denmark hybrid','Denmark onsite','Remote EU/EMEA','Remote worldwide'].map(x=><button key={x} onClick={()=>toggleGeo(x)} className={draft.geography.includes(x)?'choice selected':'choice'}>{draft.geography.includes(x)?'✓ ':''}{x}</button>)}</div></div>}

    {step===4&&<div className="wizard"><h3>Minimum acceptable monthly salary</h3><p>For permanent roles. Leave blank if you do not want salary to influence matching yet.</p><div className="salary"><input type="number" min="0" step="1000" value={draft.salary} onChange={e=>setDraft(p=>({...p,salary:e.target.value}))}/><span>DKK / month</span></div></div>}

    {step===5&&<div className="wizard"><h3>What should ApplyPilot exclude?</h3><p>Describe hard no-go roles, industries, languages or working conditions.</p><textarea value={draft.exclusions} onChange={e=>setDraft(p=>({...p,exclusions:e.target.value}))} rows="6"/></div>}

    {step===6&&<div className="wizard review"><h3>Confirm your search profile</h3><p>This is what the matching engine will use.</p>
      <div className="reviewRow"><span>CV</span><b>{draft.cvName||'Not uploaded yet'}</b></div>
      <div className="reviewRow"><span>Target roles</span><b>{draft.roles||'Not set'}</b></div>
      <div className="reviewRow"><span>Geography</span><b>{draft.geography.length?draft.geography.join(' · '):'Not set'}</b></div>
      <div className="reviewRow"><span>Salary floor</span><b>{draft.salary?Number(draft.salary).toLocaleString('en-DK')+' DKK/month':'Not set'}</b></div>
      <div className="reviewRow"><span>Exclude</span><b>{draft.exclusions||'None'}</b></div>
      <div className="truth"><b>Truth rule</b><span>ApplyPilot may rephrase verified experience, but may never invent skills, achievements, employers or responsibilities.</span></div>
    </div>}

    <div className="modalActions"><button className="secondary" onClick={()=>step===1?close():setStep(s=>s-1)}>{step===1?'Cancel':'Back'}</button>{step<6?<button className="primary" onClick={()=>setStep(s=>s+1)}>Continue</button>:<button className="primary" onClick={saveProfile}>Save & activate profile</button>}</div>
   </div>
  </div>}
 </main>
}
