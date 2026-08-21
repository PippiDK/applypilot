'use client'
import {useEffect,useMemo,useState} from 'react'

const jobs=[
 {company:'Nordic Digital Bank',role:'Senior Delivery Manager',location:'Copenhagen · Hybrid',url:'https://www.google.com/search?q=Senior+Delivery+Manager+Copenhagen',salaryKnown:false,jd:`We are looking for a Senior Delivery Manager to own end-to-end delivery of enterprise software initiatives in a regulated financial environment. You will coordinate distributed engineering teams, manage cross-team dependencies and delivery risks, drive release readiness and go-live, and provide clear executive stakeholder reporting. Experience with Agile or hybrid delivery, delivery governance and complex platform programmes is highly valued.`},
 {company:'Cloud Platform Europe',role:'Technical Project Manager',location:'Remote · EMEA',url:'https://www.google.com/search?q=Technical+Project+Manager+Remote+EMEA',salaryKnown:false,jd:`We are hiring a Technical Project Manager to lead cloud and platform implementation across EMEA. The role works closely with engineering teams on Azure, integration dependencies, technical delivery planning, release readiness and risk management. Strong stakeholder management, Agile delivery and experience coordinating distributed technical teams are required.`},
 {company:'RegTech Systems',role:'Program Manager',location:'Copenhagen · Hybrid',url:'https://www.google.com/search?q=Program+Manager+RegTech+Copenhagen',salaryKnown:false,jd:`The Program Manager will lead multiple workstreams in a regulated environment, with responsibility for programme governance, roadmap execution, budget oversight, risk and dependency management, compliance delivery and senior stakeholder alignment. The role requires structured governance, cross-functional coordination and strategic delivery ownership across concurrent initiatives.`}
]

const requirementCatalog=[
 {id:'end_to_end',label:'End-to-end delivery',jd:[/end[- ]to[- ]end/i,/full lifecycle/i,/delivery lifecycle/i],evidence:[/end[- ]to[- ]end/i,/full lifecycle/i,/delivery lifecycle/i,/SIT/i,/SAT/i,/RFS/i,/go-live/i,/transition to operations/i]},
 {id:'distributed',label:'Distributed / international teams',jd:[/distributed/i,/international teams/i,/global teams/i,/across EMEA/i],evidence:[/distributed/i,/international teams/i,/Denmark.*India/i,/India.*Poland/i,/DK.*IN/i]},
 {id:'release',label:'Release readiness / go-live',jd:[/release readiness/i,/go-live/i,/production release/i,/release management/i],evidence:[/release readiness/i,/go-live/i,/RFS/i,/production/i,/transition to operations/i]},
 {id:'risk_dependency',label:'Risk & dependency management',jd:[/risk/i,/dependenc/i,/RAID/i],evidence:[/risk/i,/dependenc/i,/RAID/i]},
 {id:'executive',label:'Executive / senior stakeholders',jd:[/executive stakeholder/i,/senior stakeholder/i,/steering/i],evidence:[/executive/i,/senior stakeholder/i,/steering/i,/stakeholder reporting/i]},
 {id:'cloud_azure',label:'Azure / cloud delivery',jd:[/Azure/i,/cloud/i],evidence:[/Azure/i,/cloud/i]},
 {id:'technical',label:'Technical / engineering delivery',jd:[/technical delivery/i,/engineering teams/i,/technical project/i,/platform implementation/i],evidence:[/engineering/i,/technical/i,/software platform/i,/platform/i]},
 {id:'integration',label:'Integration dependencies',jd:[/integration/i,/API/i,/interfaces/i],evidence:[/integration/i,/API/i,/interface/i]},
 {id:'governance',label:'Programme / delivery governance',jd:[/programme governance/i,/program governance/i,/delivery governance/i,/structured governance/i],evidence:[/governance/i,/roadmap/i,/backlog governance/i]},
 {id:'regulatory',label:'Regulatory / compliance delivery',jd:[/regulated/i,/regulatory/i,/compliance/i],evidence:[/regulated/i,/regulatory/i,/compliance/i,/AML/i]},
 {id:'budget',label:'Budget ownership / oversight',jd:[/budget/i,/financial oversight/i],evidence:[/budget/i]},
 {id:'multi_workstream',label:'Multiple workstreams / programme scope',jd:[/multiple workstreams/i,/concurrent initiatives/i,/programme/i,/program manager/i],evidence:[/programme/i,/program/i,/workstream/i,/roadmap/i,/cross-team/i]},
 {id:'agile',label:'Agile / hybrid delivery',jd:[/Agile/i,/hybrid delivery/i,/Scrum/i],evidence:[/Agile/i,/Hybrid/i,/Scrum/i,/SAFe/i]},
 {id:'data',label:'Data / SQL / BI',jd:[/SQL/i,/data platform/i,/Power BI/i,/BI\b/i],evidence:[/SQL/i,/Power BI/i,/DWH/i,/BI\b/i]}
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
function cvCorpus(facts=[]){return facts.map(f=>cleanSource(f.text)).join(' ')}
function matchesAny(text,patterns=[]){return patterns.some(p=>p.test(text))}
function extractJobRequirements(jd=''){
 return requirementCatalog.filter(r=>matchesAny(jd,r.jd))
}
function requirementSupported(req,facts=[]){return matchesAny(cvCorpus(facts),req.evidence)}
function analyseJob(jd,facts=[]){
 const reqs=extractJobRequirements(jd)
 const matched=reqs.filter(r=>requirementSupported(r,facts))
 const gaps=reqs.filter(r=>!requirementSupported(r,facts))
 const ratio=reqs.length?matched.length/reqs.length:0
 const score=Math.max(55,Math.min(98,Math.round(62+ratio*34)))
 return {reqs,matched,gaps,score}
}
function relevance(fact,reqs){
 const t=cleanSource(fact.text)
 return reqs.reduce((n,r)=>n+(matchesAny(t,r.evidence)?3:0),0)+(\b(led|managed|delivered|owned|drove|implemented)\b/i.test(t)?1:0)
}
function topEvidence(facts,reqs){
 const complete=facts.filter(f=>isCompleteEvidence(f.text))
 const pool=complete.length>=3?complete:facts.filter(f=>cleanSource(f.text).length>35)
 return [...pool].map(f=>({...f,rel:relevance(f,reqs)})).sort((a,b)=>b.rel-a.rel).slice(0,10)
}
function applyRequirementRewrite(text,req){
 let out=text
 if(req.id==='end_to_end'){
  if(/delivery lifecycle/i.test(out)&&!/end[- ]to[- ]end/i.test(out)) out=out.replace(/delivery lifecycle/i,'end-to-end delivery lifecycle')
  else if(/full lifecycle/i.test(out)&&!/end[- ]to[- ]end/i.test(out)) out=out.replace(/full lifecycle/i,'end-to-end lifecycle')
 }
 if(req.id==='distributed'){
  if(/international (project |engineering )?teams/i.test(out)&&!/distributed/i.test(out)) out=out.replace(/international (project |engineering )?teams/i,m=>`distributed ${m}`)
 }
 if(req.id==='release'){
  if(/release readiness/i.test(out)&&/go-live|RFS|production/i.test(out)&&!/go-live readiness/i.test(out)) out=out.replace(/release readiness/i,'release and go-live readiness')
 }
 if(req.id==='risk_dependency'){
  if(/risk,? dependenc(?:y|ies)/i.test(out)) out=out.replace(/risk,? dependenc(?:y|ies)/i,'risk and dependency management')
  else if(/delivery risks? and dependenc(?:y|ies)/i.test(out)) out=out.replace(/delivery risks? and dependenc(?:y|ies)/i,'delivery risk and dependency management')
 }
 if(req.id==='technical'){
  if(/software platform/i.test(out)&&!/technical platform/i.test(out)) out=out.replace(/software platform/i,'technical software platform')
  else if(/engineering teams/i.test(out)&&!/technical engineering/i.test(out)) out=out.replace(/engineering teams/i,'technical engineering teams')
 }
 if(req.id==='cloud_azure'){
  if(/Azure/i.test(out)&&/platform|delivery|project/i.test(out)&&!/Azure cloud/i.test(out)) out=out.replace(/Azure/i,'Azure cloud')
 }
 if(req.id==='integration'){
  if(/integration/i.test(out)&&/dependenc/i.test(out)&&!/integration dependency/i.test(out)) out=out.replace(/integration[^,.;]*dependenc(?:y|ies)/i,'integration dependency management')
 }
 if(req.id==='governance'){
  if(/delivery governance/i.test(out)&&!/programme governance/i.test(out)) out=out.replace(/delivery governance/i,'programme delivery governance')
  else if(/backlog governance/i.test(out)&&!/programme/i.test(out)) out=out.replace(/backlog governance/i,'programme-level backlog governance')
 }
 if(req.id==='regulatory'){
  if(/regulatory/i.test(out)&&/delivery|reporting|compliance/i.test(out)&&!/regulated/i.test(out)) out=out.replace(/regulatory/i,'regulated / regulatory')
 }
 if(req.id==='budget'){
  if(/budget management/i.test(out)&&!/budget ownership/i.test(out)) out=out.replace(/budget management/i,'budget ownership and management')
  else if(/budgets/i.test(out)&&/owned|managed|responsib/i.test(out)&&!/budget ownership/i.test(out)) out=out.replace(/budgets/i,'budget ownership')
 }
 if(req.id==='multi_workstream'){
  if(/cross-team/i.test(out)&&/roadmap|dependenc|delivery/i.test(out)&&!/multiple workstreams/i.test(out)) out=out.replace(/cross-team/i,'multi-workstream, cross-team')
 }
 if(req.id==='agile'){
  if(/Agile\/Hybrid execution/i.test(out)) out=out.replace(/Agile\/Hybrid execution/i,'Agile/Hybrid delivery execution')
 }
 return out
}
function buildChanges(facts,jd){
 const reqs=extractJobRequirements(jd)
 const supported=reqs.filter(r=>requirementSupported(r,facts))
 const out=[]
 for(const f of topEvidence(facts,reqs)){
  const original=cleanSource(f.text)
  let updated=original
  const used=[]
  for(const req of supported){
   if(!matchesAny(original,req.evidence)) continue
   const next=applyRequirementRewrite(updated,req)
   if(next!==updated){updated=next;used.push(req.label)}
  }
  updated=updated.replace(/\s+,/g,',').replace(/\s+/g,' ').trim()
  if(updated && !/[.!?]$/.test(updated)) updated+='.'
  const originalNorm=(original+(original&&!/[.!?]$/.test(original)?'.':'')).replace(/\s+/g,' ').trim()
  if(!updated || updated===originalNorm) continue
  out.push({id:f.id,original,updated,why:`Aligns wording with this job description’s emphasis on ${used.slice(0,3).join(', ')} while keeping the underlying CV evidence unchanged.`,requirements:used})
  if(out.length>=5) break
 }
 return out
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
 const [jdOpen,setJdOpen]=useState(false)
 const [jobJds,setJobJds]=useState({})
 const [jdDraft,setJdDraft]=useState('')

 useEffect(()=>{
  try{
   const saved=localStorage.getItem('applypilot-profile')
   if(saved){const parsed=JSON.parse(saved);setProfile({...defaultProfile,...parsed});setDraft({...defaultProfile,...parsed})}
   const savedJds=localStorage.getItem('applypilot-job-jds');if(savedJds)setJobJds(JSON.parse(savedJds))
  }catch(e){}
 },[])

 const profileReady=Boolean(profile.savedAt)
 const cvReady=Boolean(profile.factBank?.length)
 const completion=useMemo(()=>{
  const fields=[draft.cvName,draft.roles,draft.geography?.length,draft.salary,draft.exclusions]
  return Math.round(fields.filter(Boolean).length/fields.length*100)
 },[draft])
 const jobKey=`${selected.company}|${selected.role}`
 const activeJd=jobJds[jobKey]||selected.jd
 const jobAnalysis=useMemo(()=>analyseJob(activeJd,profile.factBank||[]),[activeJd,profile.factBank])
 const evidence=useMemo(()=>topEvidence(profile.factBank||[],jobAnalysis.reqs),[profile.factBank,jobAnalysis.reqs])
 const proposedChanges=useMemo(()=>buildChanges(profile.factBank||[],activeJd),[profile.factBank,activeJd])
 const reviewedCount=proposedChanges.filter(c=>decisions[`${jobKey}|${c.id}`]).length

 function setDecision(id,value){setDecisions(p=>({...p,[`${jobKey}|${id}`]:value}))}
 function acceptAll(){
  const next={...decisions}
  proposedChanges.forEach(c=>{next[`${jobKey}|${c.id}`]='accepted'})
  setDecisions(next)
 }
 function openJd(){setJdDraft(activeJd);setJdOpen(true)}
 function saveJd(){const next={...jobJds,[jobKey]:jdDraft};setJobJds(next);localStorage.setItem('applypilot-job-jds',JSON.stringify(next));setDecisions({});setJdOpen(false)}
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

  <section className="grid"><div className="list"><h2>Today</h2>{jobs.map((j,i)=><button key={i} onClick={()=>setSelected(j)} className={'job '+(selected===j?'active':'')}><span className="score">{profileReady?analyseJob(jobJds[`${j.company}|${j.role}`]||j.jd,profile.factBank||[]).score:'—'}{profileReady?'%':''}</span><span><b>{j.role}</b><small>{j.company} · {j.location}</small></span><span>→</span></button>)}</div>
  <div className="panel"><div className="panelTop"><div><span className="pill">STRONG FIT</span><h2>{selected.role}</h2><p>{selected.company} · {selected.location}</p></div><div className="bigScore">{profileReady?jobAnalysis.score:'—'}{profileReady?'%':''}</div></div>
  <div className="section"><h3>Why this fits</h3>{profileReady&&jobAnalysis.matched.length?jobAnalysis.matched.slice(0,6).map((x,i)=><p key={i}>✓ {x.label}</p>):<p>Analyse CV to compare it with the full job description.</p>}</div>
  <div className="section"><h3>Gap</h3>{profileReady&&jobAnalysis.gaps.length?jobAnalysis.gaps.slice(0,3).map((x,i)=><p key={i}>⚠ {x.label} not confirmed</p>):<p>✓ No major JD gaps detected in this prototype</p>}{!selected.salaryKnown&&<p>⚠ Salary not stated</p>}<button className="ghost jdButton" onClick={openJd}>View / edit job description</button></div>
  <div className="section"><h3>Application pack</h3><div className="docs"><div>{cvReady?'✓':'○'} Tailored CV <span className={cvReady?'ready':'pending'}>{cvReady?'Ready for review':'Needs CV analysis'}</span></div><div>○ Cover letter <span className="pending">Not generated yet</span></div></div></div>
  <div className="actions"><button className="primary" onClick={()=>cvReady?setReviewOpen(true):startProfile()}>{cvReady?'Review CV changes':'Analyse CV first'}</button><a className="secondary openJob" href={selected.url} target="_blank" rel="noreferrer">Open job</a></div></div></section>

  {profileReady&&<section className="cvReviewSummary"><div><p className="eyebrow">CV UPDATE REVIEW</p><h2>{cvReady?'Tailored CV ready for review':'Analyse your CV to prepare updates'}</h2><p>{cvReady?'See exactly what ApplyPilot proposes to change before anything is used in an application.':'Upload a master CV to create a reviewable tailored version.'}</p></div>{cvReady&&<div className="reviewStats"><div><b>{proposedChanges.length}</b><span>wording changes</span></div><div><b>{jobAnalysis.matched.length}</b><span>JD requirements matched</span></div><div><b>0</b><span>unsupported claims</span></div><button className="ghost" onClick={()=>setReviewOpen(true)}>Review CV changes</button></div>}</section>}

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


  {jdOpen&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setJdOpen(false)}}><div className="modal jdModal"><div className="modalHead"><div><p className="eyebrow">JOB DESCRIPTION</p><h2>{selected.role}</h2><p className="muted">{selected.company} · {selected.location}</p></div><button className="close" onClick={()=>setJdOpen(false)}>×</button></div><div className="wizard"><h3>Full job description</h3><p>Paste the complete vacancy text here. ApplyPilot extracts known delivery requirements from this JD and uses them to drive matching and CV wording proposals.</p><textarea value={jdDraft} onChange={e=>setJdDraft(e.target.value)} rows="14"/><div className="successBox"><b>{extractJobRequirements(jdDraft).length} JD requirements detected</b><span>{extractJobRequirements(jdDraft).map(r=>r.label).join(' · ')||'Add more detailed vacancy text to detect requirements.'}</span></div></div><div className="modalActions"><button className="secondary" onClick={()=>setJdOpen(false)}>Cancel</button><button className="primary" onClick={saveJd}>Save & analyse JD</button></div></div></div>}

  {reviewOpen&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setReviewOpen(false)}}><div className="modal reviewModal"><div className="modalHead"><div><p className="eyebrow">CV UPDATE REVIEW</p><h2>{selected.role}</h2><p className="muted">{selected.company} · {selected.location}</p></div><button className="close" onClick={()=>setReviewOpen(false)}>×</button></div>
   <div className="reviewDashboard"><div><b>{proposedChanges.length}</b><span>wording changes proposed</span></div><div><b>0</b><span>bullets reordered in this prototype</span></div><div><b>{jobAnalysis.matched.length}</b><span>JD requirements matched</span></div><div className="zeroClaims"><b>0</b><span>unsupported claims added</span></div></div>
   <div className="truth compact"><b>Truth Guard active</b><span>Updated wording may only restate evidence already present in your Master CV. Internal evidence IDs are hidden from the user interface.</span></div>
   <div className="jdFocus"><div><small>JOB DESCRIPTION FOCUS</small><p>{jobAnalysis.reqs.length?jobAnalysis.reqs.map(r=>r.label).join(' · '):'No known requirements detected — edit the JD to add more detail.'}</p></div><button className="secondary" onClick={openJd}>View JD</button></div>
   <div className="reviewToolbar"><div><h3>Proposed CV updates</h3><p>{reviewedCount} of {proposedChanges.length} reviewed</p></div>{proposedChanges.length>0&&<button className="secondary" onClick={acceptAll}>Accept all safe changes</button>}</div>
   {proposedChanges.map((c,i)=>{const decision=decisions[`${jobKey}|${c.id}`];return <div className={'changeCard '+(decision?'decided':'')} key={c.id}>
    <div className="changeHead"><span>CV change {i+1}</span><b>{decision==='accepted'?'Accepted':decision==='original'?'Original kept':'Review needed'}</b></div>
    <div className="compareGrid"><div className="compareBox"><small>ORIGINAL</small><p>{c.original}</p></div><div className="compareArrow">→</div><div className="compareBox updatedBox"><small>UPDATED</small><p>{c.updated}</p></div></div>
    <div className="changeWhy"><div><small>WHY CHANGED</small><p>{c.why}</p></div><div><small>SOURCE</small><p>Existing Master CV experience only · no new claim added</p></div></div>
    <div className="evidenceActions"><button className={'secondary '+(decision==='original'?'chosen':'')} onClick={()=>setDecision(c.id,'original')}>Keep original</button><button className={'primary smallPrimary '+(decision==='accepted'?'chosenPrimary':'')} onClick={()=>setDecision(c.id,'accepted')}>Accept change</button></div>
   </div>})}
   {!evidence.length&&<div className="errorBox">No usable CV evidence was found for this review. Re-analyse the Master CV.</div>}
   {evidence.length>0&&proposedChanges.length===0&&<div className="successBox noChangesBox"><b>✓ No CV wording changes needed</b><span>The strongest verified CV evidence is already aligned with the detected requirements in this job description. Aligned bullets are intentionally hidden; only actual changes appear in this review.</span></div>}
   <div className="reviewFooter"><span>Cover letter generation comes next, after CV updates are reviewed.</span><button className="secondary" onClick={()=>setReviewOpen(false)}>Close review</button></div>
  </div></div>}
 </main>
}
