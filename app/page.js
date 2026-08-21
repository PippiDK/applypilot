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
 cvText:'',
 radiusKm:'',
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
  if(profile.savedAt && profile.radiusKm && profile.cvText) searchJobs(profile)
 },[profile.savedAt])

 const cvReady=Boolean(profile.cvText && profile.factBank?.length)
 const profileReady=Boolean(profile.savedAt && profile.radiusKm && cvReady)
 const jobKey=selected?`${selected.source||'job'}|${selected.id||selected.company}|${selected.role}`:''
 const activeJd=selected?(jobJds[jobKey]||selected.jd||''):''
 const jobAnalysis=useMemo(()=>analyseJob(activeJd,profile.factBank||[]),[activeJd,profile.factBank])
 const evidence=useMemo(()=>topEvidence(profile.factBank||[],jobAnalysis.reqs),[profile.factBank,jobAnalysis.reqs])
 const proposedChanges=tailor.jobKey===jobKey?tailor.changes:[]
 const reviewedCount=proposedChanges.filter(c=>decisions[`${jobKey}|${c.id}`]).length
 const combinedScore=selected?Number(selected.fitScore||0):0
 const fitLabel=combinedScore>=82?'STRONG FIT':combinedScore>=68?'GOOD FIT':'FIT'
 const whyReasons=selected?[selected.fitReason].filter(Boolean):[]

 async function searchJobs(activeProfile=profile){
  if(!activeProfile?.savedAt || !activeProfile?.radiusKm || !activeProfile?.cvText) return
  setSearchState({loading:true,error:'',meta:null})
  try{
   const res=await fetch('/api/company-search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({radiusKm:Number(activeProfile.radiusKm),cvText:activeProfile.cvText})})
   const data=await res.json()
   if(!res.ok) throw new Error(data.error||'Company search failed.')
   const list=Array.isArray(data.jobs)?data.jobs:[]
   setJobs(list)
   setSelected(prev=>list.find(j=>prev&&j.id===prev.id)||list[0]||null)
   setTailor({jobKey:'',loading:false,error:'',changes:[],priorities:[]})
   setSearchState({loading:false,error:'',meta:data.meta||null})
  }catch(e){setJobs([]);setSelected(null);setSearchState({loading:false,error:e.message||'Company search failed.',meta:null})}
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
 function startProfile(){setDraft({...defaultProfile,...profile});setOpen(true);setParseState({loading:false,error:''})}
 function close(){setOpen(false)}
 function saveProfile(){
  if(!draft.cvText || !draft.factBank?.length || !draft.radiusKm) return
  const saved={...draft,savedAt:new Date().toISOString()}
  localStorage.setItem('applypilot-profile',JSON.stringify(saved))
  setProfile(saved);setDraft(saved);setTailor({jobKey:'',loading:false,error:'',changes:[],priorities:[]});setOpen(false)
 }
 async function parseCv(file){
  if(!file) return
  setParseState({loading:true,error:''})
  setDraft(p=>({...p,cvName:file.name,cvText:'',factBank:[],skills:[],cvParsedAt:''}))
  try{
   const fd=new FormData();fd.append('file',file)
   const res=await fetch('/api/parse-cv',{method:'POST',body:fd})
   const data=await res.json()
   if(!res.ok) throw new Error(data.error||'CV parsing failed.')
   setDraft(p=>({...p,cvName:data.fileName,cvText:data.cvText||'',factBank:data.facts||[],skills:data.skills||[],cvParsedAt:new Date().toISOString()}))
   setParseState({loading:false,error:''})
  }catch(e){setParseState({loading:false,error:e.message})}
 }

 return <main>
  <header><div><div className="brand">ApplyPilot</div><div className="tag">Search less. Apply better.</div></div><button className="ghost profileBtn" onClick={startProfile}>{profileReady?'✓ Profile ready':'Search profile'}</button></header>

  <section className="hero"><div><p className="eyebrow">YOUR JOB SEARCH AUTOPILOT</p><h1>{profileReady?(searchState.loading?'Searching Danish companies…':`${jobs.length} matching ${jobs.length===1?'opportunity is':'opportunities are'} ready for review.`):'Choose a radius and use your Master CV.'}</h1><p>{profileReady?`Companies outside ${profile.radiusKm} km from Nærum are not considered.`:'ApplyPilot searches Danish companies, reads full job descriptions and shows only roles that fit your Master CV.'}</p></div><div className="metric"><b>{searchState.loading?'…':jobs.length}</b><span>matches</span></div></section>

  {profileReady&&<div className="profileStrip"><span>✓ Search active</span><span>Nærum</span><span>≤ {profile.radiusKm} km</span><button onClick={startProfile}>Edit</button><button onClick={()=>searchJobs(profile)} disabled={searchState.loading}>{searchState.loading?'Searching…':'Search now'}</button></div>}

  {searchState.error&&<div className="errorBox searchNotice"><b>Company search failed</b><span>{searchState.error}</span></div>}
  {profileReady&&searchState.meta&&<div className="searchMeta"><span><b>{searchState.meta.matchedCount}</b> matches</span><span>{searchState.meta.companiesInRadius} companies in radius</span><span>{searchState.meta.companiesAfterProfile} passed company profile</span><span>{searchState.meta.fullJdsChecked} full JDs checked</span></div>}

  <section className="grid"><div className="list"><div className="listHead"><h2>Matches</h2>{profileReady&&<small>Within {profile.radiusKm} km of Nærum</small>}</div>{searchState.loading&&<div className="emptyJobs">Searching Danish companies and reading full job descriptions…</div>}{!searchState.loading&&profileReady&&!jobs.length&&<div className="emptyJobs">No vacancies passed all search criteria.</div>}{jobs.map(j=><button key={j.id} onClick={()=>{setSelected(j);setTailor({jobKey:'',loading:false,error:'',changes:[],priorities:[]})}} className={'job '+(selected&&selected.id===j.id?'active':'')}><span className="score">{j.fitScore}%</span><span><b>{j.role}</b><small>{j.company} · {j.location}</small><small className="sourceLine">{j.distanceKm} km from Nærum · {j.sourceLabel}</small></span><span>→</span></button>)}</div>
  <div className="panel">{selected?<><div className="panelTop"><div><span className="pill">{fitLabel}</span><h2>{selected.role}</h2><p>{selected.company} · {selected.location}</p><small className="sourceLine">{selected.distanceKm} km from Nærum · Source: {selected.sourceLabel}</small></div><div className="bigScore">{combinedScore}%</div></div>
  <div className="section"><h3>Why this fits</h3>{whyReasons.length?whyReasons.map((x,i)=><p key={i}>✓ {x}</p>):null}</div>
  <div className="section"><h3>Gap / unknown</h3>{selected.gaps?.length?selected.gaps.map((x,i)=><p key={i}>⚠ {x}</p>):<p>No material gap returned by the fit gate.</p>}<a className="ghost jdButton" href={selected.url} target="_blank" rel="noreferrer">View vacancy ↗</a></div>
  <div className="section"><h3>Application pack</h3><div className="docs"><div>{cvReady?'✓':'○'} Tailored CV <span className={cvReady?'ready':'pending'}>{cvReady?'Evidence available':'Needs CV analysis'}</span></div><div>○ Cover letter <span className="pending">Not generated yet</span></div></div></div>
  <div className="actions"><button className="primary" onClick={()=>cvReady?openReview():startProfile()}>{cvReady?'Review CV changes':'Analyse CV first'}</button><a className="secondary openJob" href={selected.url} target="_blank" rel="noreferrer">Open job</a></div></>:<div className="emptyPanel"><h2>No selected vacancy</h2><p>{profileReady?'Run company search.':'Create a Search Profile first.'}</p></div>}</div></section>

  {profileReady&&selected&&<section className="cvReviewSummary"><div><p className="eyebrow">CV UPDATE REVIEW</p><h2>{cvReady?'Tailored CV ready for review':'Analyse your CV to prepare updates'}</h2><p>{cvReady?'See exactly what ApplyPilot proposes to change before anything is used in an application.':'Upload a master CV to create a reviewable tailored version.'}</p></div>{cvReady&&<div className="reviewStats"><div><b>{tailor.jobKey===jobKey&&!tailor.loading?proposedChanges.length:'AI'}</b><span>wording changes</span></div><div><b>{jobAnalysis.matched.length}</b><span>JD requirements matched</span></div><div><b>0</b><span>unsupported claims</span></div><button className="ghost" onClick={openReview}>Review CV changes</button></div>}</section>}

  <footer>Human-in-the-loop by design · ApplyPilot never submits an application without you.</footer>

  {open&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><div className="modal">
    <div className="modalHead"><div><p className="eyebrow">SEARCH PROFILE</p><h2>Company search</h2></div><button className="close" onClick={close}>×</button></div>
    <div className="wizard"><h3>Master CV</h3><label className="upload"><input type="file" accept=".pdf,.docx" onChange={e=>parseCv(e.target.files?.[0])}/><b>{parseState.loading?'Analysing CV…':draft.cvName?'✓ '+draft.cvName:'Choose CV file'}</b><span>PDF or DOCX · max 8 MB</span></label>{parseState.error&&<div className="errorBox">{parseState.error}</div>}{draft.factBank?.length>0&&<div className="successBox"><b>✓ CV analysed successfully</b><span>Master CV is ready for full-JD fit decisions.</span></div>}
    <h3 className="radiusHeading">Maximum distance from Nærum</h3><div className="radiusChoices">{[10,20,30,40,50].map(km=><button type="button" key={km} onClick={()=>setDraft(p=>({...p,radiusKm:km}))} className={Number(draft.radiusKm)===km?'choice selected':'choice'}>{km} km</button>)}</div></div>
    <div className="modalActions"><button className="secondary" onClick={close}>Cancel</button><button className="primary" disabled={parseState.loading||!draft.cvText||!draft.factBank?.length||!draft.radiusKm} onClick={saveProfile}>Save & search</button></div>
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
