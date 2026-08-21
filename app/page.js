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

function cleanSource(text=''){
 return text.replace(/^[•\-–—▪◦*]+\s*/,'').replace(/\s+/g,' ').trim()
}
function isCompleteEvidence(text=''){
 const t=cleanSource(text)
 if(t.length<42 || t.length>360) return false
 if(/\b(and|with|a|an|the|to|for|of|in|across|through|including)\s*[,;:]?$/i.test(t)) return false
 return /\b(led|managed|delivered|owned|drove|implemented|built|launched|improved|reduced|created|supported|developed|oversaw|planned|executed|established|introduced|collaborated|experience|experienced)\b/i.test(t)
}
function relevance(fact,job){
 const t=cleanSource(fact.text).toLowerCase()
 return job.keywords.reduce((n,k)=>n+(t.includes(k.toLowerCase())?2:0),0)+(t.includes('managed')||t.includes('led')||t.includes('delivered')?1:0)
}
function topEvidence(facts,job){
 const complete=facts.filter(f=>isCompleteEvidence(f.text))
 const pool=complete.length>=3?complete:facts.filter(f=>cleanSource(f.text).length>35)
 return [...pool].map(f=>({...f,rel:relevance(f,job)})).sort((a,b)=>b.rel-a.rel).slice(0,6)
}
function conservativeRewrite(text=''){
 let out=cleanSource(text)
 if(!out) return out
 out=out
  .replace(/\bLed the delivery of\b/i,'Led delivery of')
  .replace(/\bworked closely with\b/ig,'collaborated with')
  .replace(/\bhelping to maintain\b/ig,'supporting')
  .replace(/\bhelping maintain\b/ig,'supporting')
  .replace(/\bin order to\b/ig,'to')
  .replace(/\s+,/g,',')
 if(!/[.!?]$/.test(out)) out+='.'
 return out
}
function matchedTerms(text,job){
 const lower=text.toLowerCase()
 return job.keywords.filter(k=>lower.includes(k.toLowerCase()))
}
function buildChanges(facts,job){
 // Review contains ONLY genuine wording changes. Already-aligned evidence is never returned here.
 return topEvidence(facts,job).map((f,index)=>{
  const original=cleanSource(f.text)
  const updated=conservativeRewrite(original)
  const normalizedOriginal=`${original}${/[.!?]$/.test(original)?'':'.'}`.replace(/\s+/g,' ').trim()
  const normalizedUpdated=updated.replace(/\s+/g,' ').trim()
  if(normalizedUpdated===normalizedOriginal) return null
  const terms=matchedTerms(original,job)
  const why=terms.length
   ?`Keeps the verified experience intact and brings ${terms.slice(0,3).join(', ')} wording into clearer focus for this role.`
   :'Keeps verified experience intact while making the wording cleaner for this role.'
  return {id:f.id,original,updated,why,terms,rank:index}
 }).filter(Boolean)
}

export default function Home(){
 const [selected,setSelected]=useState(jobs[0])
 const [profile,setProfile]=useState(defaultProfile)
 const [draft,setDraft]=useState(defaultProfile)
 const [open,setOpen]=useState(false)
 const [reviewOpen,setReviewOpen]=useState(false)
 const [step,setStep]=useState(1)
 const [parseState,setParseState]=useState({loading:false,error:''})
 const [decisions,setDecisions]=useState({})

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
 const changes=useMemo(()=>buildChanges(profile.factBank||[],selected),[profile.factBank,selected])
 // `changes` is already guaranteed to contain only real diffs.
 const proposedChanges=changes
 const alignedTerms=useMemo(()=>[...new Set(evidence.flatMap(f=>matchedTerms(cleanSource(f.text),selected)))],[evidence,selected])
 const jobKey=`${selected.company}|${selected.role}`
 const reviewedCount=proposedChanges.filter(c=>decisions[`${jobKey}|${c.id}`]).length

 function setDecision(id,value){setDecisions(p=>({...p,[`${jobKey}|${id}`]:value}))}
 function acceptAll(){
  const next={...decisions}
  proposedChanges.forEach(c=>{next[`${jobKey}|${c.id}`]='accepted'})
  setDecisions(next)
 }
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
  <div className="section"><h3>Application pack</h3><div className="docs"><div>{cvReady?'✓':'○'} Tailored CV <span className={cvReady?'ready':'pending'}>{cvReady?'Ready for review':'Needs CV analysis'}</span></div><div>○ Cover letter <span className="pending">Not generated yet</span></div></div></div>
  <div className="actions"><button className="primary" onClick={()=>cvReady?setReviewOpen(true):startProfile()}>{cvReady?'Review CV changes':'Analyse CV first'}</button><a className="secondary openJob" href={selected.url} target="_blank" rel="noreferrer">Open job</a></div></div></section>

  {profileReady&&<section className="cvReviewSummary"><div><p className="eyebrow">CV UPDATE REVIEW</p><h2>{cvReady?'Tailored CV ready for review':'Analyse your CV to prepare updates'}</h2><p>{cvReady?'See exactly what ApplyPilot proposes to change before anything is used in an application.':'Upload a master CV to create a reviewable tailored version.'}</p></div>{cvReady&&<div className="reviewStats"><div><b>{proposedChanges.length}</b><span>wording changes</span></div><div><b>{alignedTerms.length}</b><span>role terms aligned</span></div><div><b>0</b><span>unsupported claims</span></div><button className="ghost" onClick={()=>setReviewOpen(true)}>Review CV changes</button></div>}</section>}

  <footer>Human-in-the-loop by design · ApplyPilot never submits an application without you.</footer>

  {open&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><div className="modal">
    <div className="modalHead"><div><p className="eyebrow">BUILD YOUR SEARCH AGENT</p><h2>Search profile</h2></div><button className="close" onClick={close}>×</button></div>
    <div className="progress"><span style={{width:`${step/6*100}%`}}></span></div><div className="stepMeta"><span>Step {step} of 6</span><span>{completion}% profile data</span></div>
    {step===1&&<div className="wizard"><h3>Upload your master CV</h3><p>ApplyPilot reads your CV and creates a private evidence layer used to verify every proposed CV update. The evidence layer stays behind the scenes.</p><label className="upload"><input type="file" accept=".pdf,.docx" onChange={e=>parseCv(e.target.files?.[0])}/><b>{parseState.loading?'Analysing CV…':draft.cvName?'✓ '+draft.cvName:'Choose CV file'}</b><span>PDF or DOCX · max 8 MB</span></label>{parseState.error&&<div className="errorBox">{parseState.error}</div>}{draft.factBank?.length>0&&<div className="successBox"><b>✓ CV analysed successfully</b><span>{draft.skills?.length?`Detected signals: ${draft.skills.slice(0,8).join(' · ')}`:'Verified CV evidence is ready.'}</span></div>}</div>}
    {step===2&&<div className="wizard"><h3>Which roles should we search for?</h3><p>Use job titles you want, separated by commas. Matching will later also understand semantically similar titles.</p><textarea value={draft.roles} onChange={e=>setDraft(p=>({...p,roles:e.target.value}))} rows="5"/></div>}
    {step===3&&<div className="wizard"><h3>Where can you work?</h3><p>Select every geography that should count as a valid match.</p><div className="choiceGrid">{['Denmark hybrid','Denmark onsite','Remote EU/EMEA','Remote worldwide'].map(x=><button key={x} onClick={()=>toggleGeo(x)} className={draft.geography.includes(x)?'choice selected':'choice'}>{draft.geography.includes(x)?'✓ ':''}{x}</button>)}</div></div>}
    {step===4&&<div className="wizard"><h3>Minimum acceptable monthly salary</h3><p>For permanent roles. Leave blank if you do not want salary to influence matching yet.</p><div className="salary"><input type="number" min="0" step="1000" value={draft.salary} onChange={e=>setDraft(p=>({...p,salary:e.target.value}))}/><span>DKK / month</span></div></div>}
    {step===5&&<div className="wizard"><h3>What should ApplyPilot exclude?</h3><p>Describe hard no-go roles, industries, languages or working conditions.</p><textarea value={draft.exclusions} onChange={e=>setDraft(p=>({...p,exclusions:e.target.value}))} rows="6"/></div>}
    {step===6&&<div className="wizard review"><h3>Confirm your search profile</h3><p>This is what the matching engine will use.</p><div className="reviewRow"><span>CV</span><b>{draft.cvName||'Not uploaded yet'}</b></div><div className="reviewRow"><span>CV analysis</span><b>{draft.factBank?.length?'Ready — evidence verified':'CV not analysed'}</b></div><div className="reviewRow"><span>Target roles</span><b>{draft.roles||'Not set'}</b></div><div className="reviewRow"><span>Geography</span><b>{draft.geography.length?draft.geography.join(' · '):'Not set'}</b></div><div className="reviewRow"><span>Salary floor</span><b>{draft.salary?Number(draft.salary).toLocaleString('en-DK')+' DKK/month':'Not set'}</b></div><div className="reviewRow"><span>Exclude</span><b>{draft.exclusions||'None'}</b></div><div className="truth"><b>Truth rule</b><span>ApplyPilot may rephrase verified experience, but may never invent skills, achievements, employers or responsibilities.</span></div></div>}
    <div className="modalActions"><button className="secondary" onClick={()=>step===1?close():setStep(s=>s-1)}>{step===1?'Cancel':'Back'}</button>{step<6?<button className="primary" disabled={step===1&&parseState.loading} onClick={()=>setStep(s=>s+1)}>Continue</button>:<button className="primary" onClick={saveProfile}>Save & activate profile</button>}</div>
  </div></div>}

  {reviewOpen&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setReviewOpen(false)}}><div className="modal reviewModal"><div className="modalHead"><div><p className="eyebrow">CV UPDATE REVIEW</p><h2>{selected.role}</h2><p className="muted">{selected.company} · {selected.location}</p></div><button className="close" onClick={()=>setReviewOpen(false)}>×</button></div>
   <div className="reviewDashboard"><div><b>{proposedChanges.length}</b><span>wording changes proposed</span></div><div><b>0</b><span>bullets reordered in this prototype</span></div><div><b>{alignedTerms.length}</b><span>role terms already supported</span></div><div className="zeroClaims"><b>0</b><span>unsupported claims added</span></div></div>
   <div className="truth compact"><b>Truth Guard active</b><span>Updated wording may only restate evidence already present in your Master CV. Internal evidence IDs are hidden from the user interface.</span></div>
   <div className="reviewToolbar"><div><h3>Proposed CV updates</h3><p>{reviewedCount} of {proposedChanges.length} reviewed</p></div>{proposedChanges.length>0&&<button className="secondary" onClick={acceptAll}>Accept all safe changes</button>}</div>
   {proposedChanges.map((c,i)=>{const decision=decisions[`${jobKey}|${c.id}`];return <div className={'changeCard '+(decision?'decided':'')} key={c.id}>
    <div className="changeHead"><span>CV change {i+1}</span><b>{decision==='accepted'?'Accepted':decision==='original'?'Original kept':'Review needed'}</b></div>
    <div className="compareGrid"><div className="compareBox"><small>ORIGINAL</small><p>{c.original}</p></div><div className="compareArrow">→</div><div className="compareBox updatedBox"><small>UPDATED</small><p>{c.updated}</p></div></div>
    <div className="changeWhy"><div><small>WHY CHANGED</small><p>{c.why}</p></div><div><small>SOURCE</small><p>Existing Master CV experience only · no new claim added</p></div></div>
    <div className="evidenceActions"><button className={'secondary '+(decision==='original'?'chosen':'')} onClick={()=>setDecision(c.id,'original')}>Keep original</button><button className={'primary smallPrimary '+(decision==='accepted'?'chosenPrimary':'')} onClick={()=>setDecision(c.id,'accepted')}>Accept change</button></div>
   </div>})}
   {!evidence.length&&<div className="errorBox">No usable CV evidence was found for this review. Re-analyse the Master CV.</div>}
   {evidence.length>0&&proposedChanges.length===0&&<div className="successBox noChangesBox"><b>✓ No CV wording changes needed</b><span>The strongest verified CV evidence is already aligned with this role. Aligned bullets are intentionally hidden; only actual changes appear in this review.</span></div>}
   <div className="reviewFooter"><span>Cover letter generation comes next, after CV updates are reviewed.</span><button className="secondary" onClick={()=>setReviewOpen(false)}>Close review</button></div>
  </div></div>}
 </main>
}
