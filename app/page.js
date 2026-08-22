'use client'
import { useEffect, useMemo, useState } from 'react'
import {DEFAULT_PROFILE,mergeProfile,resumeToProfile,buildReviewChanges,deriveReviewTerms,applicationPackState} from './lib/profile-review.js'
import {SOURCE_CV_STORAGE_KEY,LEGACY_CV_STORAGE_KEY,buildSourceCvRecord,normalizeStoredSourceCv,isSourceCvReady} from './lib/source-cv.js'
import {requestJobAnalysis} from './lib/jd-analysis-client.js'

const WINDOWS=[1,3,7,14]

function dateText(value){ if(!value) return 'Date unavailable'; const d=new Date(value); if(!Number.isFinite(d.getTime())) return 'Date unavailable'; const days=Math.max(0,Math.floor((Date.now()-d.getTime())/86400000)); return days===0?'Today':days===1?'1 day ago':`${days} days ago` }
function salary(job){ if(job.salaryMinDkkMonth==null&&job.salaryMaxDkkMonth==null) return 'Insufficient data'; if(job.salaryMinDkkMonth!=null&&job.salaryMaxDkkMonth!=null) return `${job.salaryMinDkkMonth.toLocaleString('en-DK')}–${job.salaryMaxDkkMonth.toLocaleString('en-DK')} DKK/month`; return `${(job.salaryMinDkkMonth??job.salaryMaxDkkMonth).toLocaleString('en-DK')} DKK/month` }

export default function Home(){
  const [freshnessDays,setFreshnessDays]=useState(7)
  const [jobs,setJobs]=useState([])
  const [selected,setSelected]=useState(null)
  const [state,setState]=useState({loading:false,error:'',coverage:null,stats:null,fetchedAt:null})
  const [cvData,setCvData]=useState(null)
  const [cvState,setCvState]=useState({loading:false,error:''})
  const [profile,setProfile]=useState(DEFAULT_PROFILE)
  const [draft,setDraft]=useState(DEFAULT_PROFILE)
  const [profileOpen,setProfileOpen]=useState(false)
  const [profileStep,setProfileStep]=useState(1)
  const [reviewOpen,setReviewOpen]=useState(false)
  const [jdAnalysisState,setJdAnalysisState]=useState({loading:false,error:'',analysis:null,token:'',jobKey:''})
  const [decisions,setDecisions]=useState({})
  const active=jobs.find(({job})=>job.sourceJobId===selected?.job?.sourceJobId)||jobs[0]||null

  useEffect(()=>{
    try{
      const savedSourceRaw=localStorage.getItem(SOURCE_CV_STORAGE_KEY)
      const legacyCvRaw=savedSourceRaw?null:localStorage.getItem(LEGACY_CV_STORAGE_KEY)
      const storedCvRaw=savedSourceRaw||legacyCvRaw
      const savedCv=normalizeStoredSourceCv(storedCvRaw?JSON.parse(storedCvRaw):null)
      const savedProfileRaw=localStorage.getItem('applypilot-profile')
      const savedProfile=mergeProfile(savedProfileRaw?JSON.parse(savedProfileRaw):{})
      const hydrated=resumeToProfile(savedProfile,savedCv)
      if(savedCv){
        setCvData(savedCv)
        if(!savedSourceRaw&&isSourceCvReady(savedCv)){
          localStorage.setItem(SOURCE_CV_STORAGE_KEY,JSON.stringify(savedCv))
          localStorage.removeItem(LEGACY_CV_STORAGE_KEY)
        }
      }
      setProfile(hydrated)
      setDraft(hydrated)
    }catch{}
  },[])

  const profileReady=Boolean(profile.savedAt)
  const resumeLoaded=isSourceCvReady(cvData)
  const pack=applicationPackState(resumeLoaded?cvData:null)
  const reviewFacts=useMemo(()=>Array.isArray(cvData?.facts)?cvData.facts.filter(f=>f&&f.verified!==false):[],[cvData])
  const proposedChanges=useMemo(()=>resumeLoaded&&active?buildReviewChanges(cvData,active):[],[cvData,active,resumeLoaded])
  const alignedTerms=useMemo(()=>active?deriveReviewTerms(active):[],[active])
  const jobKey=active?.job?.sourceJobId||''
  const reviewedCount=proposedChanges.filter(change=>decisions[`${jobKey}|${change.id}`]).length
  const profileCompletion=useMemo(()=>{
    const fields=[resumeLoaded,draft.roles,draft.geography?.length,draft.salary,draft.exclusions]
    return Math.round(fields.filter(Boolean).length/fields.length*100)
  },[draft,resumeLoaded])

  async function parseCv(file){
    if(!file) return
    setCvState({loading:true,error:''})
    try{
      const form=new FormData()
      form.append('file',file)
      const res=await fetch('/api/parse-cv',{method:'POST',body:form})
      const data=await res.json()
      if(!res.ok) throw new Error(data.error||'CV parsing failed.')
      const saved=buildSourceCvRecord(data,new Date().toISOString())
      localStorage.setItem(SOURCE_CV_STORAGE_KEY,JSON.stringify(saved))
      localStorage.removeItem(LEGACY_CV_STORAGE_KEY)
      setCvData(saved)
      setDecisions({})
      setReviewOpen(false)
      setProfile(current=>{
        const next=resumeToProfile(current,saved)
        if(current.savedAt) localStorage.setItem('applypilot-profile',JSON.stringify(next))
        return next
      })
      setDraft(current=>resumeToProfile(current,saved))
      setCvState({loading:false,error:''})
    }catch(error){
      setCvState({loading:false,error:error.message||'CV parsing failed. Please try another PDF or DOCX.'})
    }
  }

  async function search(){
    if(!resumeLoaded){
      setState({loading:false,error:'Please Upload Your CV',coverage:null,stats:null,fetchedAt:null})
      return
    }
    setJobs([]); setState({loading:true,error:'',coverage:null,stats:null,fetchedAt:null})
    try{
      const res=await fetch('/api/linkedin-search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({freshnessDays,cvText:cvData.cvText})})
      const data=await res.json()
      if(!res.ok) throw new Error(data.error||'LinkedIn search failed')
      setJobs(Array.isArray(data.jobs)?data.jobs:[])
      setState({loading:false,error:'',coverage:data.coverage||null,stats:data.stats||null,fetchedAt:data.fetchedAt||null})
    }catch(error){ setState({loading:false,error:error.message||'LinkedIn search failed',coverage:null,stats:null,fetchedAt:null}) }
  }

  function startProfile(){
    setDraft(resumeToProfile(profile,cvData))
    setProfileStep(1)
    setProfileOpen(true)
    setCvState({loading:false,error:''})
  }

  function closeProfile(){setProfileOpen(false)}

  function toggleGeo(value){
    setDraft(current=>({...current,geography:current.geography.includes(value)?current.geography.filter(item=>item!==value):[...current.geography,value]}))
  }

  function saveProfile(){
    const saved={...resumeToProfile(draft,cvData),savedAt:new Date().toISOString()}
    localStorage.setItem('applypilot-profile',JSON.stringify(saved))
    setProfile(saved)
    setDraft(saved)
    setProfileOpen(false)
    setProfileStep(1)
  }

  async function runJobAnalysis(){
    if(!active||!resumeLoaded) return
    const runKey=active.job.sourceJobId||`${active.job.title}|${active.job.company}`
    setReviewOpen(true)
    setJdAnalysisState({loading:true,error:'',analysis:null,token:'',jobKey:runKey})
    try{
      const result=await requestJobAnalysis({sourceVersion:cvData.sourceVersion,job:active.job})
      setJdAnalysisState({loading:false,error:'',analysis:result.analysis,token:result.token||'',jobKey:runKey})
    }catch(error){
      setJdAnalysisState({loading:false,error:error.message||'Job analysis failed safely. Please try again.',analysis:null,token:'',jobKey:runKey})
    }
  }

  function setDecision(id,value){setDecisions(current=>({...current,[`${jobKey}|${id}`]:value}))}

  function acceptAll(){
    const next={...decisions}
    proposedChanges.filter(change=>change.changed).forEach(change=>{next[`${jobKey}|${change.id}`]='accepted'})
    setDecisions(next)
  }

  return <main>
    <header><div><div className="brand">ApplyPilot</div><div className="tag">Search less. Apply better.</div></div><div className="headerActions"><div className={`sourceBadge profileStatus ${resumeLoaded?'statusReady':'statusEmpty'}`}>{resumeLoaded?'Profile ready':'Profile empty'}</div><div className="sourceBadge">LINKEDIN · PUBLIC</div></div></header>

    <section className="hero">
      <div><p className="eyebrow">ONE SOURCE · END-TO-END</p><h1>Find Senior IT Project & Delivery roles in Denmark.</h1><p>LinkedIn public search → full job description → CV evaluation → worthwhile matches only.</p></div>
      <div className="metric"><b>{state.loading?'…':jobs.length}</b><span>matches</span></div>
    </section>

    <div className="profileStrip"><span>{profileReady?profile.roles.split(',').slice(0,2).join(' · '):'Senior IT Project / Delivery · Denmark'}</span><span>JD responsibilities 40% · experience/domain 25% · geography 20% · career/comp 15%</span><button className="profileEditButton" onClick={startProfile}>{profileReady?'Edit profile':'Search profile'}</button><button className="cvButton" onClick={startProfile}>{resumeLoaded?`✓ ${cvData.fileName}`:cvData?.fileName?'Re-upload CV':'Upload CV'}</button></div>

    <section className="controls">
      <div><small>POSTED WITHIN</small><div className="choices">{WINDOWS.map(days=><button key={days} className={freshnessDays===days?'choice selected':'choice'} onClick={()=>setFreshnessDays(days)}>{days} day{days===1?'':'s'}</button>)}</div></div>
      <button className="primary" onClick={search} disabled={state.loading}>{state.loading?'Reading LinkedIn JDs…':'Search LinkedIn'}</button>
    </section>

    {state.error&&<div className="errorBox"><b>{state.error==='Please Upload Your CV'?'Please Upload Your CV':'LinkedIn search failed'}</b>{state.error!=='Please Upload Your CV'&&<span>{state.error}</span>}</div>}
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
          <div className="section"><h3>Application pack</h3><div className="docs"><div>{pack.cvReady?'✓':'○'} Tailored CV <span className={pack.cvReady?'ready':'pending'}>{pack.tailoredCvLabel}</span></div><div>○ Cover letter <span className="pending">{pack.coverLetterLabel}</span></div></div></div>
          <div className="actions reviewActions">{pack.cvReady?<button className="primary" onClick={runJobAnalysis}>Review CV changes</button>:<button className="primary" onClick={startProfile}>Upload CV</button>}<a className="secondary openLink" href={job.originalUrl} target="_blank" rel="noreferrer">Open LinkedIn vacancy</a>{job.officialUrl&&<a className="secondary openLink" href={job.officialUrl} target="_blank" rel="noreferrer">Employer link</a>}</div>
        </>})():<div className="emptyPanel"><h2>No selected vacancy</h2><p>{state.loading?'Searching LinkedIn public pages…':'Run the LinkedIn search to see matching vacancies.'}</p></div>}
      </div>
    </section>

    <footer>Milestone: LinkedIn public search only · no CVR · no Jobnet · no additional sources</footer>

    {profileOpen&&<div className="overlay" onMouseDown={event=>{if(event.target===event.currentTarget)closeProfile()}}><div className="modal profileModal">
      <div className="modalHead"><div><p className="eyebrow">BUILD YOUR SEARCH AGENT</p><h2>Search profile</h2></div><button className="close" onClick={closeProfile}>×</button></div>
      <div className="progress"><span style={{width:`${profileStep/6*100}%`}}></span></div><div className="stepMeta"><span>Step {profileStep} of 6</span><span>{profileCompletion}% profile data</span></div>
      {profileStep===1&&<div className="wizard"><h3>Upload your CV</h3><p>ApplyPilot reads the complete CV and prepares it as the active Source CV for later CV analysis. The uploaded source remains unchanged.</p><label className="upload"><input type="file" accept=".pdf,.docx" onChange={event=>parseCv(event.target.files?.[0])} disabled={cvState.loading}/><b>{cvState.loading?'Analysing CV…':resumeLoaded?'✓ '+cvData.fileName:cvData?.fileName?'Re-upload CV':'Choose CV file'}</b><span>PDF or DOCX · max 8 MB</span></label>{cvState.error&&<div className="errorBox"><b>CV parsing failed</b><span>{cvState.error}</span></div>}{resumeLoaded&&<div className="successBox"><b>✓ Source CV ready</b><span>{draft.skills?.length?`Detected signals: ${draft.skills.slice(0,8).join(' · ')}`:'Complete CV text is prepared for later analysis.'}</span></div>}</div>}
      {profileStep===2&&<div className="wizard"><h3>Which roles should we search for?</h3><p>Save the job titles you want your Search Profile to remember. In this milestone, the live LinkedIn engine keeps its existing search logic unchanged.</p><textarea value={draft.roles} onChange={event=>setDraft(current=>({...current,roles:event.target.value}))} rows="5"/></div>}
      {profileStep===3&&<div className="wizard"><h3>Where can you work?</h3><p>Save the work models that belong in your Search Profile.</p><div className="choiceGrid">{['Denmark hybrid','Denmark onsite','Remote EU/EMEA','Remote worldwide'].map(value=><button key={value} onClick={()=>toggleGeo(value)} className={draft.geography.includes(value)?'choice selected':'choice'}>{draft.geography.includes(value)?'✓ ':''}{value}</button>)}</div></div>}
      {profileStep===4&&<div className="wizard"><h3>Minimum acceptable monthly salary</h3><p>Save your permanent-role salary floor in the Search Profile.</p><div className="salary"><input type="number" min="0" step="1000" value={draft.salary} onChange={event=>setDraft(current=>({...current,salary:event.target.value}))}/><span>DKK / month</span></div></div>}
      {profileStep===5&&<div className="wizard"><h3>What should ApplyPilot exclude?</h3><p>Save hard no-go roles, industries, languages or working conditions in your Search Profile.</p><textarea value={draft.exclusions} onChange={event=>setDraft(current=>({...current,exclusions:event.target.value}))} rows="6"/></div>}
      {profileStep===6&&<div className="wizard review"><h3>Confirm your search profile</h3><p>This saves your Search Profile for the next product step. The current LinkedIn search engine remains unchanged in this milestone.</p><div className="reviewRow"><span>CV</span><b>{resumeLoaded?cvData.fileName:cvData?.fileName?'Re-upload required':'Not uploaded yet'}</b></div><div className="reviewRow"><span>CV preparation</span><b>{resumeLoaded?'Ready — complete Source CV prepared':'CV not ready'}</b></div><div className="reviewRow"><span>Target roles</span><b>{draft.roles||'Not set'}</b></div><div className="reviewRow"><span>Geography</span><b>{draft.geography.length?draft.geography.join(' · '):'Not set'}</b></div><div className="reviewRow"><span>Salary floor</span><b>{draft.salary?Number(draft.salary).toLocaleString('en-DK')+' DKK/month':'Not set'}</b></div><div className="reviewRow"><span>Exclude</span><b>{draft.exclusions||'None'}</b></div><div className="truth"><b>Truth rule</b><span>ApplyPilot may rephrase verified experience, but may never invent skills, achievements, employers or responsibilities.</span></div></div>}
      <div className="modalActions"><button className="secondary" onClick={()=>profileStep===1?closeProfile():setProfileStep(step=>step-1)}>{profileStep===1?'Cancel':'Back'}</button>{profileStep<6?<button className="primary" disabled={profileStep===1&&cvState.loading} onClick={()=>setProfileStep(step=>step+1)}>Continue</button>:<button className="primary" onClick={saveProfile}>Save profile</button>}</div>
    </div></div>}

    {reviewOpen&&active&&<div className="overlay" onMouseDown={event=>{if(event.target===event.currentTarget)setReviewOpen(false)}}><div className="modal reviewModal"><div className="modalHead"><div><p className="eyebrow">CV UPDATE REVIEW</p><h2>{active.job.title}</h2><p className="muted">{active.job.company} · {active.job.location}</p></div><button className="close" onClick={()=>setReviewOpen(false)}>×</button></div>
      <div className="jdPretest"><p className="eyebrow">JD ANALYSIS PRETEST · OPENAI</p>
        {jdAnalysisState.jobKey!==jobKey?<div className="muted">Select Review CV changes to analyse this vacancy.</div>:jdAnalysisState.loading?<div className="jdLoading">Reading job description with OpenAI…</div>:jdAnalysisState.error?<div className="errorBox"><b>JD analysis failed safely</b><span>{jdAnalysisState.error}</span></div>:jdAnalysisState.analysis?<>
          <div className="jdGrid"><div><small>Role mission</small><p>{jdAnalysisState.analysis.roleMission}</p></div><div><small>Candidate positioning</small><p>{jdAnalysisState.analysis.candidatePositioning}</p></div></div>
          <div className="jdSection"><h3>Hiring priorities</h3>{jdAnalysisState.analysis.priorities.map(priority=><div className="jdPriority" key={priority.id}><div className="jdPriorityHead"><b>{priority.rank}. {priority.requirement}</b><span>{priority.kind.replace('_',' ')}</span></div><p>{priority.why}</p><small>JD evidence</small>{priority.jdEvidence.map((evidence,index)=><blockquote key={index}>{evidence}</blockquote>)}</div>)}</div>
          <div className="jdSection"><h3>Must-haves</h3>{jdAnalysisState.analysis.priorities.filter(priority=>priority.kind==='must_have').length?jdAnalysisState.analysis.priorities.filter(priority=>priority.kind==='must_have').map(priority=><p key={priority.id}>✓ {priority.requirement}</p>):<p className="muted">No priority was classified as a hard must-have.</p>}</div>
        </>:null}
      </div>
      <div className="reviewDashboard"><div><b>{proposedChanges.filter(change=>change.changed).length}</b><span>summary change proposed</span></div><div><b>0</b><span>bullets reordered · Step 2</span></div><div><b>{alignedTerms.length}</b><span>role terms already supported</span></div><div className="zeroClaims"><b>0</b><span>unsupported claims added</span></div></div>
      <div className="truth compact"><b>Truth Guard active</b><span>Updated wording may only restate evidence already present in your Master CV. Internal evidence IDs are hidden from the user interface.</span></div>
      <div className="reviewToolbar"><div><h3>Tailored Summary — Legacy Summary preview · not Task 3</h3><p>{reviewedCount} of {proposedChanges.length} reviewed</p></div>{proposedChanges.some(change=>change.changed)&&<button className="secondary" onClick={acceptAll}>Accept all safe changes</button>}</div>
      {proposedChanges.map((change,index)=>{const decision=decisions[`${jobKey}|${change.id}`];return <div className={'changeCard '+(decision?'decided':'')} key={change.id}>
        <div className="changeHead"><span>SUMMARY</span><b>{decision==='accepted'?'Accepted':decision==='original'?'Original kept':change.changed?'Review needed':'Already aligned'}</b></div>
        <div className="compareGrid"><div className="compareBox"><small>ORIGINAL</small><p>{change.original}</p></div><div className="compareArrow">→</div><div className="compareBox updatedBox"><small>UPDATED</small><p>{change.updated}</p></div></div>
        <div className="changeWhy"><div><small>WHY CHANGED</small><p>{change.why}</p></div><div><small>SOURCE</small><p>Existing Master CV experience only · no new claim added</p></div></div>
        <div className="evidenceActions"><button className={'secondary '+(decision==='original'?'chosen':'')} onClick={()=>setDecision(change.id,'original')}>Keep original</button><button className={'primary smallPrimary '+(decision==='accepted'?'chosenPrimary':'')} onClick={()=>setDecision(change.id,'accepted')} disabled={!change.changed}>{change.changed?'Accept change':'No change needed'}</button></div>
      </div>})}
      {!proposedChanges.length&&<div className="muted">No Summary change proposed.</div>}
      <div className="reviewFooter"><span>Step 1 updates Summary only. Bullet reordering comes next in Step 2.</span><button className="secondary" onClick={()=>setReviewOpen(false)}>Close review</button></div>
    </div></div>}
  </main>
}
