'use client'
import {useEffect,useMemo,useState} from 'react'

const jobs=[
 {score:94,company:'Nordic Digital Bank',role:'Senior Delivery Manager',location:'Copenhagen · Hybrid',why:['Enterprise software delivery','FinTech priority match','Distributed engineering teams'],gap:'Salary not stated',keywords:['delivery','software','fintech','bank','team','stakeholder','release','risk'],url:'https://www.google.com/search?q=Senior+Delivery+Manager+Copenhagen'},
 {score:89,company:'Cloud Platform Europe',role:'Technical Project Manager',location:'Remote · EMEA',why:['Platform implementation','Cross-functional delivery','Remote EMEA'],gap:'Industry match is neutral',keywords:['platform','project','delivery','azure','engineering','stakeholder','risk'],url:'https://www.google.com/search?q=Technical+Project+Manager+Remote+EMEA'},
 {score:82,company:'RegTech Systems',role:'Program Manager',location:'Copenhagen · Hybrid',why:['Regulated environment','Governance and risk','Senior ownership'],gap:'Release ownership not explicit',keywords:['program','regulatory','compliance','risk','governance','delivery','stakeholder'],url:'https://www.google.com/search?q=Program+Manager+RegTech+Copenhagen'}
]

const defaultProfile={
 cvName:'',
 roles:'Senior Project Manager, Delivery Manager, Technical Project Manager, Program Manager',
 geography:['Denmark hybrid','Remote EU/EMEA'],
 salary:'75000',
 exclusions:'Construction; industrial hardware / manufacturing R&D; coordinator or assistant roles; mandatory Danish',
 savedAt:'',
 factBank:[],
 skills:[],
 cvParsedAt:''
}

function relevance(fact,job){
 const t=fact.text.toLowerCase()
 return job.keywords.reduce((n,k)=>n+(t.includes(k.toLowerCase())?2:0),0)+(t.includes('managed')||t.includes('led')||t.includes('delivered')?1:0)
}
function topEvidence(facts,job){
 return [...facts].map(f=>({...f,rel:relevance(f,job)})).sort((a,b)=>b.rel-a.rel).slice(0,5)
}
function safeTailor(text,role){
 const clean=text.replace(/^[•\-–—▪◦*]+\s*/,'').trim()
 if(!clean) return clean
 return `${clean}${/[.!?]$/.test(clean)?'':'.'} Relevant evidence for ${role}.`
}

export default function Home(){
 const [selected,setSelected]=useState(jobs[0])
 const [profile,setProfile]=useState(defaultProfile)
 const [draft,setDraft]=useState(defaultProfile)
 const [open,setOpen]=useState(false)
 const [reviewOpen,setReviewOpen]=useState(false)
 const [factOpen,setFactOpen]=useState(false)
 const [step,setStep]=useState(1)
 const [parseState,setParseState]=useState({loading:false,error:''})

 useEffect(()=>{
  try{
   const saved=localStorage.getItem('applypilot-profile')
   if(saved){const parsed=JSON.parse(saved);setProfile({...defaultProfile,...parsed});setDraft({...defaultProfile,...parsed})}
  }catch(e){}
 },[])

 const profileReady=Boolean(profile.savedAt)
 const cvReady=Boolean(profile.factBank?.length)
 const completion=useMemo(()=>{
  const fields=[draft.cvName,draft.roles,draft.geography?.length,draft.salary,draft.exclusions]
  return Math.round(fields.filter(Boolean).length/fields.length*100)
 },[draft])
 const evidence=useMemo(()=>topEvidence(profile.factBank||[],selected),[profile.factBank,selected])

 function startProfile(){setDraft(profileReady?profile:defaultProfile);setStep(1);setOpen(true);setParseState({loading:false,error:''})}
 function close(){setOpen(false)}
 function toggleGeo(value){setDraft(p=>({...p,geography:p.geography.includes(value)?p.geography.filter(x=>x!==value):[...p.geography,value]}))}
 function saveProfile(){
  const saved={...draft,savedAt:new Date().toISOString()}
  localStorage.setItem('applypilot-profile',JSON.stringify(saved))
  setProfile(saved);setDraft(saved);setOpen(false);setStep(1)
 }
 async function parseCv(file){
  if(!file) return
  setParseState({loading:true,error:''})
  setDraft(p=>({...p,cvName:file.name,factBank:[],skills:[],cvParsedAt:''}))
  try{
   const fd=new FormData();fd.append('file',file)
   const res=await fetch('/api/parse-cv',{method:'POST',body:fd})
   const data=await res.json()
   if(!res.ok) throw new Error(data.error||'CV parsing failed.')
   setDraft(p=>({...p,cvName:data.fileName,factBank:data.facts||[],skills:data.skills||[],cvParsedAt:new Date().toISOString()}))
   setParseState({loading:false,error:''})
  }catch(e){setParseState({loading:false,error:e.message})}
 }

 return <main>
  <header><div><div className="brand">ApplyPilot</div><div className="tag">Search less. Apply better.</div></div><button className="ghost profileBtn" onClick={startProfile}>{profileReady?'✓ Profile ready':'Search profile'}</button></header>

  <section className="hero"><div><p className="eyebrow">YOUR JOB SEARCH AUTOPILOT</p><h1>3 new opportunities are ready for review.</h1><p>We found, filtered and prepared today’s strongest matches. You decide what gets submitted.</p></div><div className="metric"><b>3</b><span>new today</span></div></section>

  {profileReady&&<div className="profileStrip"><span>✓ Search profile active</span><span>{profile.roles.split(',').slice(0,2).join(' · ')}</span><span>{profile.geography.join(' · ')}</span><button onClick={startProfile}>Edit</button></div>}

  <section className="grid"><div className="list"><h2>Today</h2>{jobs.map((j,i)=><button key={i} onClick={()=>setSelected(j)} className={'job '+(selected===j?'active':'')}><span className="score">{j.score}%</span><span><b>{j.role}</b><small>{j.company} · {j.location}</small></span><span>→</span></button>)}</div>
  <div className="panel"><div className="panelTop"><div><span className="pill">STRONG FIT</span><h2>{selected.role}</h2><p>{selected.company} · {selected.location}</p></div><div className="bigScore">{selected.score}%</div></div>
  <div className="section"><h3>Why this fits</h3>{selected.why.map((x,i)=><p key={i}>✓ {x}</p>)}</div>
  <div className="section"><h3>Gap</h3><p>⚠ {selected.gap}</p></div>
  <div className="section"><h3>Application pack</h3><div className="docs"><div>{cvReady?'✓':'○'} Tailored CV <span className={cvReady?'ready':'pending'}>{cvReady?'Evidence ready':'Needs CV analysis'}</span></div><div>○ Cover letter <span className="pending">Not generated yet</span></div></div></div>
  <div className="actions"><button className="primary" onClick={()=>cvReady?setReviewOpen(true):startProfile()}>{cvReady?'Review application':'Analyse CV first'}</button><a className="secondary openJob" href={selected.url} target="_blank" rel="noreferrer">Open job</a></div></div></section>

  {profileReady&&<section className="factSummary"><div><p className="eyebrow">CAREER FACT BANK</p><h2>{profile.factBank?.length||0} verified CV facts</h2><p>Only these source facts may be used to tailor applications. Nothing new may be invented.</p></div><button className="ghost" onClick={()=>setFactOpen(true)}>View fact bank</button></section>}

  <footer>Human-in-the-loop by design · ApplyPilot never submits an application without you.</footer>

  {open&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><div className="modal">
    <div className="modalHead"><div><p className="eyebrow">BUILD YOUR SEARCH AGENT</p><h2>Search profile</h2></div><button className="close" onClick={close}>×</button></div>
    <div className="progress"><span style={{width:`${step/6*100}%`}}></span></div><div className="stepMeta"><span>Step {step} of 6</span><span>{completion}% profile data</span></div>
    {step===1&&<div className="wizard"><h3>Upload your master CV</h3><p>ApplyPilot reads your CV and builds a Career Fact Bank. Those facts become the source of truth for every tailored application.</p><label className="upload"><input type="file" accept=".pdf,.docx" onChange={e=>parseCv(e.target.files?.[0])}/><b>{parseState.loading?'Analysing CV…':draft.cvName?'✓ '+draft.cvName:'Choose CV file'}</b><span>PDF or DOCX · max 8 MB</span></label>{parseState.error&&<div className="errorBox">{parseState.error}</div>}{draft.factBank?.length>0&&<div className="successBox"><b>✓ {draft.factBank.length} verified facts extracted</b><span>{draft.skills?.length?`Detected: ${draft.skills.slice(0,8).join(' · ')}`:'Career Fact Bank is ready for review.'}</span></div>}</div>}
    {step===2&&<div className="wizard"><h3>Which roles should we search for?</h3><p>Use job titles you want, separated by commas. Matching will later also understand semantically similar titles.</p><textarea value={draft.roles} onChange={e=>setDraft(p=>({...p,roles:e.target.value}))} rows="5"/></div>}
    {step===3&&<div className="wizard"><h3>Where can you work?</h3><p>Select every geography that should count as a valid match.</p><div className="choiceGrid">{['Denmark hybrid','Denmark onsite','Remote EU/EMEA','Remote worldwide'].map(x=><button key={x} onClick={()=>toggleGeo(x)} className={draft.geography.includes(x)?'choice selected':'choice'}>{draft.geography.includes(x)?'✓ ':''}{x}</button>)}</div></div>}
    {step===4&&<div className="wizard"><h3>Minimum acceptable monthly salary</h3><p>For permanent roles. Leave blank if you do not want salary to influence matching yet.</p><div className="salary"><input type="number" min="0" step="1000" value={draft.salary} onChange={e=>setDraft(p=>({...p,salary:e.target.value}))}/><span>DKK / month</span></div></div>}
    {step===5&&<div className="wizard"><h3>What should ApplyPilot exclude?</h3><p>Describe hard no-go roles, industries, languages or working conditions.</p><textarea value={draft.exclusions} onChange={e=>setDraft(p=>({...p,exclusions:e.target.value}))} rows="6"/></div>}
    {step===6&&<div className="wizard review"><h3>Confirm your search profile</h3><p>This is what the matching engine will use.</p><div className="reviewRow"><span>CV</span><b>{draft.cvName||'Not uploaded yet'}</b></div><div className="reviewRow"><span>Career facts</span><b>{draft.factBank?.length?`${draft.factBank.length} verified facts`:'CV not analysed'}</b></div><div className="reviewRow"><span>Target roles</span><b>{draft.roles||'Not set'}</b></div><div className="reviewRow"><span>Geography</span><b>{draft.geography.length?draft.geography.join(' · '):'Not set'}</b></div><div className="reviewRow"><span>Salary floor</span><b>{draft.salary?Number(draft.salary).toLocaleString('en-DK')+' DKK/month':'Not set'}</b></div><div className="reviewRow"><span>Exclude</span><b>{draft.exclusions||'None'}</b></div><div className="truth"><b>Truth rule</b><span>ApplyPilot may rephrase verified experience, but may never invent skills, achievements, employers or responsibilities.</span></div></div>}
    <div className="modalActions"><button className="secondary" onClick={()=>step===1?close():setStep(s=>s-1)}>{step===1?'Cancel':'Back'}</button>{step<6?<button className="primary" disabled={step===1&&parseState.loading} onClick={()=>setStep(s=>s+1)}>Continue</button>:<button className="primary" onClick={saveProfile}>Save & activate profile</button>}</div>
  </div></div>}

  {reviewOpen&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setReviewOpen(false)}}><div className="modal reviewModal"><div className="modalHead"><div><p className="eyebrow">APPLICATION REVIEW</p><h2>{selected.role}</h2><p className="muted">{selected.company} · {selected.location}</p></div><button className="close" onClick={()=>setReviewOpen(false)}>×</button></div><div className="truth compact"><b>Truth Guard active</b><span>Every suggestion below is anchored to a fact extracted from your Master CV.</span></div><h3 className="reviewTitle">Best matching CV evidence</h3>{evidence.map((f,i)=><div className="evidence" key={f.id}><div className="evidenceHead"><span>{f.id}</span><b>{i===0?'Highest relevance':'Verified evidence'}</b></div><p className="original">{f.text}</p><div className="suggestion"><small>SAFE TAILORING PREVIEW</small><p>{safeTailor(f.text,selected.role)}</p></div><div className="evidenceActions"><button className="secondary">Keep original</button><button className="primary smallPrimary">Accept wording</button></div></div>)}{!evidence.length&&<div className="errorBox">No Career Fact Bank found. Analyse your CV first.</div>}<div className="reviewFooter"><span>Cover letter generation comes next, after CV wording is approved.</span><button className="secondary" onClick={()=>setReviewOpen(false)}>Close review</button></div></div></div>}

  {factOpen&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setFactOpen(false)}}><div className="modal"><div className="modalHead"><div><p className="eyebrow">SOURCE OF TRUTH</p><h2>Career Fact Bank</h2></div><button className="close" onClick={()=>setFactOpen(false)}>×</button></div><p className="muted">Extracted from {profile.cvName}. Review these before relying on them for application tailoring.</p><div className="facts">{(profile.factBank||[]).map(f=><div key={f.id} className="fact"><span>{f.id}</span><p>{f.text}</p><b>Verified from CV</b></div>)}</div></div></div>}
 </main>
}
