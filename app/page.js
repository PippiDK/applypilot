'use client'
import {useEffect,useMemo,useState} from 'react'

const EMPTY_JOBS=[]


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
 preferredLocations:'Nærum, Hørsholm, Lyngby, Kongens Lyngby, Virum, Holte, Gentofte, Hellerup, Ballerup, Greater Copenhagen, Copenhagen',
 salary:'75000',
 freshnessDays:7,
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
 const score=reqs.length?Math.max(35,Math.min(98,Math.round(35+ratio*63))):50
 return {reqs,matched,gaps,score}
}
function relevance(fact,reqs){
 const t=cleanSource(fact.text)
 return reqs.reduce((n,r)=>n+(matchesAny(t,r.evidence)?3:0),0)+(/\b(led|managed|delivered|owned|drove|implemented)\b/i.test(t)?1:0)
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
 const [jobs,setJobs]=useState(EMPTY_JOBS)
 const [selected,setSelected]=useState(null)
 const [searchState,setSearchState]=useState({loading:false,error:'',meta:null})
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
 const [tailor,setTailor]=useState({jobKey:'',loading:false,error:'',changes:[],priorities:[]})

 useEffect(()=>{
  try{
   const saved=localStorage.getItem('applypilot-profile')
   if(saved){const parsed=JSON.parse(saved);setProfile({...defaultProfile,...parsed});setDraft({...defaultProfile,...parsed})}
   const savedJds=localStorage.getItem('applypilot-job-jds');if(savedJds)setJobJds(JSON.parse(savedJds))
  }catch(e){}
 },[])

 useEffect(()=>{
  if(profile.savedAt) searchJobs(profile)
 },[profile.savedAt])

 const profileReady=Boolean(profile.savedAt)
 const cvReady=Boolean(profile.factBank?.length)
 const completion=useMemo(()=>{
  const fields=[draft.cvName,draft.roles,draft.geography?.length,draft.salary,draft.exclusions]
  return Math.round(fields.filter(Boolean).length/fields.length*100)
 },[draft])
 const jobKey=selected?`${selected.source||'job'}|${selected.id||selected.company}|${selected.role}`:''
 const activeJd=selected?(jobJds[jobKey]||selected.jd||''):''
 const jobAnalysis=useMemo(()=>analyseJob(activeJd,profile.factBank||[]),[activeJd,profile.factBank])
 const evidence=useMemo(()=>topEvidence(profile.factBank||[],jobAnalysis.reqs),[profile.factBank,jobAnalysis.reqs])
 const proposedChanges=tailor.jobKey===jobKey?tailor.changes:[]
 const reviewedCount=proposedChanges.filter(c=>decisions[`${jobKey}|${c.id}`]).length
 const combinedScore=selected?Math.round((selected.searchScore||0)*(cvReady?0.68:1)+(cvReady?jobAnalysis.score*0.32:0)):0
 const fitLabel=combinedScore>=82?'STRONG FIT':combinedScore>=68?'GOOD FIT':'POSSIBLE FIT'
 const whyReasons=selected?[...(selected.reasons||[]),...jobAnalysis.matched.map(x=>x.label)].filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,7):[]

 async function searchJobs(activeProfile=profile){
  if(!activeProfile?.savedAt) return
  setSearchState({loading:true,error:'',meta:null})
  try{
   const res=await fetch('/api/search-jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roles:activeProfile.roles,geography:activeProfile.geography,preferredLocations:activeProfile.preferredLocations,salary:activeProfile.salary,exclusions:activeProfile.exclusions,freshnessDays:activeProfile.freshnessDays||7})})
   const data=await res.json()
   if(!res.ok) throw new Error(data.error||'Live job search failed.')
   const list=Array.isArray(data.jobs)?data.jobs:[]
   setJobs(list)
   setSelected(prev=>list.find(j=>prev&&j.source===prev.source&&j.id===prev.id)||list[0]||null)
   setTailor({jobKey:'',loading:false,error:'',changes:[],priorities:[]})
   setSearchState({loading:false,error:'',meta:data.meta||null})
  }catch(e){setJobs([]);setSelected(null);setSearchState({loading:false,error:e.message||'Live job search failed.',meta:null})}
 }

 function setDecision(id,value){setDecisions(p=>({...p,[`${jobKey}|${id}`]:value}))}
 function acceptAll(){
  const next={...decisions}
  proposedChanges.forEach(c=>{next[`${jobKey}|${c.id}`]='accepted'})
  setDecisions(next)
 }
 async function runTailoring(force=false){
  if(!cvReady||!selected) return
  if(!force && tailor.jobKey===jobKey && !tailor.error && (tailor.changes.length || tailor.priorities.length)) return
  setTailor({jobKey,loading:true,error:'',changes:[],priorities:[]})
  try{
   const res=await fetch('/api/tailor-cv',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jd:activeJd,role:selected.role,company:selected.company,facts:profile.factBank||[]})})
   const data=await res.json()
   if(!res.ok) throw new Error(data.error||'AI tailoring failed.')
   setDecisions(p=>Object.fromEntries(Object.entries(p).filter(([k])=>!k.startsWith(jobKey+'|'))))
   setTailor({jobKey,loading:false,error:'',changes:data.changes||[],priorities:data.priorities||[]})
  }catch(e){setTailor({jobKey,loading:false,error:e.message||'AI tailoring failed.',changes:[],priorities:[]})}
 }
 function openReview(){if(!selected)return;setReviewOpen(true);runTailoring(false)}
 function openJd(){if(!selected)return;setJdDraft(activeJd);setJdOpen(true)}
 function saveJd(){if(!selected)return;const next={...jobJds,[jobKey]:jdDraft};setJobJds(next);localStorage.setItem('applypilot-job-jds',JSON.stringify(next));setDecisions({});setTailor({jobKey:'',loading:false,error:'',changes:[],priorities:[]});setJdOpen(false)}
 function startProfile(){setDraft(profileReady?profile:defaultProfile);setStep(1);setOpen(true);setParseState({loading:false,error:''})}
 function close(){setOpen(false)}
 function toggleGeo(value){setDraft(p=>({...p,geography:p.geography.includes(value)?p.geography.filter(x=>x!==value):[...p.geography,value]}))}
 function saveProfile(){
  const saved={...draft,savedAt:new Date().toISOString()}
  localStorage.setItem('applypilot-profile',JSON.stringify(saved))
  setProfile(saved);setDraft(saved);setTailor({jobKey:'',loading:false,error:'',changes:[],priorities:[]});setOpen(false);setStep(1)
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

  <section className="hero"><div><p className="eyebrow">YOUR JOB SEARCH AUTOPILOT</p><h1>{profileReady?(searchState.loading?'Searching live vacancies…':`${jobs.length} matching ${jobs.length===1?'opportunity is':'opportunities are'} ready for review.`):'Build your search profile to start live job search.'}</h1><p>{profileReady?`Hard filters are active: target roles, geography, salary floor, exclusions and ${profile.freshnessDays||7}-day freshness.`:'ApplyPilot will search live sources and filter before showing a vacancy.'}</p></div><div className="metric"><b>{searchState.loading?'…':jobs.length}</b><span>live matches</span></div></section>

  {profileReady&&<div className="profileStrip"><span>✓ Search profile active</span><span>{profile.roles.split(',').slice(0,2).join(' · ')}</span><span>{profile.geography.join(' · ')}</span><span>≤ {profile.freshnessDays||7} days old</span><button onClick={startProfile}>Edit</button><button onClick={()=>searchJobs(profile)} disabled={searchState.loading}>{searchState.loading?'Searching…':'Search now'}</button></div>}

  {searchState.error&&<div className="errorBox searchNotice"><b>Live search failed</b><span>{searchState.error}</span></div>}
  {profileReady&&searchState.meta&&<div className="searchMeta"><span><b>{searchState.meta.matchedCount}</b> matched after hard filters</span><span>{searchState.meta.rawCount} fetched</span><span>Sources: {(searchState.meta.sources||[]).join(' · ')||'none'}</span>{searchState.meta.warnings?.length>0&&<span className="pending">{searchState.meta.warnings.join(' · ')}</span>}</div>}

  <section className="grid"><div className="list"><div className="listHead"><h2>Live matches</h2>{profileReady&&<small>Newest {profile.freshnessDays||7} days</small>}</div>{searchState.loading&&<div className="emptyJobs">Searching Jobnet and remote sources…</div>}{!searchState.loading&&profileReady&&!jobs.length&&<div className="emptyJobs">No vacancies passed the current hard filters. Nothing is padded with demo jobs.</div>}{jobs.map(j=>{const a=analyseJob(jobJds[`${j.source||'job'}|${j.id||j.company}|${j.role}`]||j.jd||'',profile.factBank||[]);const score=Math.round((j.searchScore||0)*(cvReady?0.68:1)+(cvReady?a.score*0.32:0));return <button key={`${j.source}-${j.id}`} onClick={()=>{setSelected(j);setTailor({jobKey:'',loading:false,error:'',changes:[],priorities:[]})}} className={'job '+(selected&&selected.source===j.source&&selected.id===j.id?'active':'')}><span className="score">{score}%</span><span><b>{j.role}</b><small>{j.company} · {j.location}</small><small className="sourceLine">{j.sourceLabel} · {new Date(j.postedAt).toLocaleDateString('en-DK')}</small></span><span>→</span></button>})}</div>
  <div className="panel">{selected?<><div className="panelTop"><div><span className="pill">{fitLabel}</span><h2>{selected.role}</h2><p>{selected.company} · {selected.location}</p><small className="sourceLine">Source: {selected.sourceLabel} · posted {new Date(selected.postedAt).toLocaleDateString('en-DK')}</small></div><div className="bigScore">{combinedScore}%</div></div>
  <div className="section"><h3>Why this fits</h3>{whyReasons.length?whyReasons.map((x,i)=><p key={i}>✓ {x}</p>):<p>Search-profile filters passed. Analyse CV to add experience-based reasons.</p>}</div>
  <div className="section"><h3>Gap / unknown</h3>{cvReady&&jobAnalysis.gaps.length?jobAnalysis.gaps.slice(0,3).map((x,i)=><p key={i}>⚠ {x.label} not confirmed in CV</p>):null}{selected.salaryStatus==='unknown'&&<p>⚠ Salary not stated in comparable DKK/month</p>}{selected.salaryStatus==='possible'&&<p>⚠ Salary range only partly confirms your floor</p>}{!selected.jd&&<p>⚠ Full job description was not returned by the source</p>}<button className="ghost jdButton" onClick={openJd}>View / edit job description</button></div>
  <div className="section"><h3>Application pack</h3><div className="docs"><div>{cvReady?'✓':'○'} Tailored CV <span className={cvReady?'ready':'pending'}>{cvReady?'Evidence available':'Needs CV analysis'}</span></div><div>○ Cover letter <span className="pending">Not generated yet</span></div></div></div>
  <div className="actions"><button className="primary" onClick={()=>cvReady?openReview():startProfile()}>{cvReady?'Review CV changes':'Analyse CV first'}</button><a className="secondary openJob" href={selected.url} target="_blank" rel="noreferrer">Open job</a></div></>:<div className="emptyPanel"><h2>No selected vacancy</h2><p>{profileReady?'Run live search or broaden the Search Profile.':'Create a Search Profile first.'}</p></div>}</div></section>

  {profileReady&&selected&&<section className="cvReviewSummary"><div><p className="eyebrow">CV UPDATE REVIEW</p><h2>{cvReady?'Tailored CV ready for review':'Analyse your CV to prepare updates'}</h2><p>{cvReady?'See exactly what ApplyPilot proposes to change before anything is used in an application.':'Upload a master CV to create a reviewable tailored version.'}</p></div>{cvReady&&<div className="reviewStats"><div><b>{tailor.jobKey===jobKey&&!tailor.loading?proposedChanges.length:'AI'}</b><span>wording changes</span></div><div><b>{jobAnalysis.matched.length}</b><span>JD requirements matched</span></div><div><b>0</b><span>unsupported claims</span></div><button className="ghost" onClick={openReview}>Review CV changes</button></div>}</section>}

  <footer>Human-in-the-loop by design · ApplyPilot never submits an application without you.</footer>

  {open&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><div className="modal">
    <div className="modalHead"><div><p className="eyebrow">BUILD YOUR SEARCH AGENT</p><h2>Search profile</h2></div><button className="close" onClick={close}>×</button></div>
    <div className="progress"><span style={{width:`${step/6*100}%`}}></span></div><div className="stepMeta"><span>Step {step} of 6</span><span>{completion}% profile data</span></div>
    {step===1&&<div className="wizard"><h3>Upload your master CV</h3><p>ApplyPilot reads your CV and creates a private evidence layer used to verify every proposed CV update. The evidence layer stays behind the scenes.</p><label className="upload"><input type="file" accept=".pdf,.docx" onChange={e=>parseCv(e.target.files?.[0])}/><b>{parseState.loading?'Analysing CV…':draft.cvName?'✓ '+draft.cvName:'Choose CV file'}</b><span>PDF or DOCX · max 8 MB</span></label>{parseState.error&&<div className="errorBox">{parseState.error}</div>}{draft.factBank?.length>0&&<div className="successBox"><b>✓ CV analysed successfully</b><span>{draft.skills?.length?`Detected signals: ${draft.skills.slice(0,8).join(' · ')}`:'Verified CV evidence is ready.'}</span></div>}</div>}
    {step===2&&<div className="wizard"><h3>Which roles should we search for?</h3><p>Use job titles you want, separated by commas. The live search expands common project/delivery title variants and then applies hard profile filters.</p><textarea value={draft.roles} onChange={e=>setDraft(p=>({...p,roles:e.target.value}))} rows="5"/></div>}
    {step===3&&<div className="wizard"><h3>Where can you work?</h3><p>Select valid work models. Denmark results inside your preferred locations are ranked higher, but other Capital Region matches can still survive.</p><div className="choiceGrid">{['Denmark hybrid','Denmark onsite','Remote EU/EMEA','Remote worldwide'].map(x=><button key={x} onClick={()=>toggleGeo(x)} className={draft.geography.includes(x)?'choice selected':'choice'}>{draft.geography.includes(x)?'✓ ':''}{x}</button>)}</div><label className="fieldLabel">Preferred Denmark locations</label><textarea value={draft.preferredLocations||''} onChange={e=>setDraft(p=>({...p,preferredLocations:e.target.value}))} rows="3"/></div>}
    {step===4&&<div className="wizard"><h3>Freshness & salary floor</h3><p>Search only recent vacancies. Salary is a hard filter only when a comparable DKK salary is actually stated; unknown salary is kept and flagged.</p><div className="freshness"><label>Maximum vacancy age</label><select value={draft.freshnessDays||7} onChange={e=>setDraft(p=>({...p,freshnessDays:Number(e.target.value)}))}><option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option></select></div><div className="salary"><input type="number" min="0" step="1000" value={draft.salary} onChange={e=>setDraft(p=>({...p,salary:e.target.value}))}/><span>DKK / month minimum</span></div></div>}
    {step===5&&<div className="wizard"><h3>What should ApplyPilot exclude?</h3><p>Describe hard no-go roles, industries, languages or working conditions.</p><textarea value={draft.exclusions} onChange={e=>setDraft(p=>({...p,exclusions:e.target.value}))} rows="6"/></div>}
    {step===6&&<div className="wizard review"><h3>Confirm your search profile</h3><p>This is what the matching engine will use.</p><div className="reviewRow"><span>CV</span><b>{draft.cvName||'Not uploaded yet'}</b></div><div className="reviewRow"><span>CV analysis</span><b>{draft.factBank?.length?'Ready — evidence verified':'CV not analysed'}</b></div><div className="reviewRow"><span>Target roles</span><b>{draft.roles||'Not set'}</b></div><div className="reviewRow"><span>Geography</span><b>{draft.geography.length?draft.geography.join(' · '):'Not set'}</b></div><div className="reviewRow"><span>Preferred locations</span><b>{draft.preferredLocations||'Not set'}</b></div><div className="reviewRow"><span>Freshness</span><b>Last {draft.freshnessDays||7} days only</b></div><div className="reviewRow"><span>Salary floor</span><b>{draft.salary?Number(draft.salary).toLocaleString('en-DK')+' DKK/month':'Not set'}</b></div><div className="reviewRow"><span>Exclude</span><b>{draft.exclusions||'None'}</b></div><div className="truth"><b>Truth rule</b><span>ApplyPilot may rephrase verified experience, but may never invent skills, achievements, employers or responsibilities.</span></div></div>}
    <div className="modalActions"><button className="secondary" onClick={()=>step===1?close():setStep(s=>s-1)}>{step===1?'Cancel':'Back'}</button>{step<6?<button className="primary" disabled={step===1&&parseState.loading} onClick={()=>setStep(s=>s+1)}>Continue</button>:<button className="primary" onClick={saveProfile}>Save & activate profile</button>}</div>
  </div></div>}


  {jdOpen&&selected&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setJdOpen(false)}}><div className="modal jdModal"><div className="modalHead"><div><p className="eyebrow">JOB DESCRIPTION</p><h2>{selected.role}</h2><p className="muted">{selected.company} · {selected.location}</p></div><button className="close" onClick={()=>setJdOpen(false)}>×</button></div><div className="wizard"><h3>Full job description</h3><p>Paste the complete vacancy text here. ApplyPilot uses this source JD for experience matching and, later, CV wording proposals. Search-profile hard filters are applied before the vacancy reaches this screen.</p><textarea value={jdDraft} onChange={e=>setJdDraft(e.target.value)} rows="14"/><div className="successBox"><b>{extractJobRequirements(jdDraft).length} JD requirements detected</b><span>{extractJobRequirements(jdDraft).map(r=>r.label).join(' · ')||'Add more detailed vacancy text to detect requirements.'}</span></div></div><div className="modalActions"><button className="secondary" onClick={()=>setJdOpen(false)}>Cancel</button><button className="primary" onClick={saveJd}>Save & analyse JD</button></div></div></div>}

  {reviewOpen&&selected&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setReviewOpen(false)}}><div className="modal reviewModal"><div className="modalHead"><div><p className="eyebrow">CV UPDATE REVIEW</p><h2>{selected.role}</h2><p className="muted">{selected.company} · {selected.location}</p></div><button className="close" onClick={()=>setReviewOpen(false)}>×</button></div>
   <div className="reviewDashboard"><div><b>{tailor.loading?'…':proposedChanges.length}</b><span>wording changes proposed</span></div><div><b>0</b><span>bullets reordered in this prototype</span></div><div><b>{jobAnalysis.matched.length}</b><span>JD requirements matched</span></div><div className="zeroClaims"><b>0</b><span>unsupported claims added</span></div></div>
   <div className="truth compact"><b>Truth Guard active</b><span>Updated wording may only restate evidence already present in your Master CV. Internal evidence IDs are hidden from the user interface.</span></div>
   <div className="jdFocus"><div><small>JOB DESCRIPTION FOCUS</small><p>{tailor.priorities?.length?tailor.priorities.join(' · '):(jobAnalysis.reqs.length?jobAnalysis.reqs.map(r=>r.label).join(' · '):'No known requirements detected — edit the JD to add more detail.')}</p></div><button className="secondary" onClick={openJd}>View JD</button></div>
   <div className="reviewToolbar"><div><h3>Proposed CV updates</h3><p>{tailor.loading?'AI is comparing the full JD with verified CV evidence…':`${reviewedCount} of ${proposedChanges.length} reviewed`}</p></div><div style={{display:'flex',gap:'10px'}}>{!tailor.loading&&<button className="secondary" onClick={()=>runTailoring(true)}>Re-run AI tailoring</button>}{proposedChanges.length>0&&<button className="secondary" onClick={acceptAll}>Accept all safe changes</button>}</div></div>
   {tailor.loading&&<div className="successBox noChangesBox"><b>AI tailoring in progress…</b><span>Reading the full job description, selecting supported CV evidence and generating only meaningful vacancy-specific rewrites.</span></div>}
   {tailor.error&&<div className="errorBox">{tailor.error}</div>}
   {!tailor.loading&&!tailor.error&&proposedChanges.map((c,i)=>{const decision=decisions[`${jobKey}|${c.id}`];return <div className={'changeCard '+(decision?'decided':'')} key={c.id}>
    <div className="changeHead"><span>CV change {i+1}</span><b>{decision==='accepted'?'Accepted':decision==='original'?'Original kept':'Review needed'}</b></div>
    <div className="compareGrid"><div className="compareBox"><small>ORIGINAL</small><p>{c.original}</p></div><div className="compareArrow">→</div><div className="compareBox updatedBox"><small>UPDATED</small><p>{c.updated}</p></div></div>
    <div className="changeWhy"><div><small>WHY CHANGED</small><p>{c.why}</p></div><div><small>SOURCE</small><p>Existing Master CV experience only · no new claim added</p></div></div>
    <div className="evidenceActions"><button className={'secondary '+(decision==='original'?'chosen':'')} onClick={()=>setDecision(c.id,'original')}>Keep original</button><button className={'primary smallPrimary '+(decision==='accepted'?'chosenPrimary':'')} onClick={()=>setDecision(c.id,'accepted')}>Accept change</button></div>
   </div>})}
   {!evidence.length&&<div className="errorBox">No usable CV evidence was found for this review. Re-analyse the Master CV.</div>}
   {!tailor.loading&&!tailor.error&&evidence.length>0&&proposedChanges.length===0&&<div className="successBox noChangesBox"><b>✓ No meaningful safe CV wording changes found</b><span>The AI compared this full job description with verified CV evidence and did not find a rewrite strong enough to show. Trivial edits are intentionally suppressed.</span></div>}
   <div className="reviewFooter"><span>Cover letter generation comes next, after CV updates are reviewed.</span><button className="secondary" onClick={()=>setReviewOpen(false)}>Close review</button></div>
  </div></div>}
 </main>
}
