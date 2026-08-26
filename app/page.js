'use client'
import { useEffect, useMemo, useState } from 'react'
import {DEFAULT_PROFILE,mergeProfile,resumeToProfile,buildReviewChanges,deriveReviewTerms,applicationPackState} from './lib/profile-review.js'
import {SOURCE_CV_STORAGE_KEY,LEGACY_CV_STORAGE_KEY,buildSourceCvRecord,normalizeStoredSourceCv,isSourceCvReady} from './lib/source-cv.js'
import {CV_LIBRARY_STORAGE_KEY,MAX_CVS,createCvLibrary,normalizeCvLibrary,upsertCvSlot,removeCvSlot,getPrimaryCv,readyCvCount} from './lib/cv-library.js'
import {requestSearchProfileRoles} from './lib/search-profile-client.js'
import {readSearchProfileCache,writeSearchProfileCache} from './lib/search-profile-cache.js'
import {normalizeSearchPreferences,legacyGeographyFromPreferences} from './lib/search-profile-preferences.js'
import {requestJobAnalysis} from './lib/jd-analysis-client.js'
import {readJobAnalysisCache,writeJobAnalysisCache} from './lib/job-analysis-cache.js'
import {requestExpertiseMatch} from './lib/expertise-match-client.js'
import {readExpertiseMatchCache,writeExpertiseMatchCache} from './lib/expertise-match-cache.js'
import {evaluateJobConditions} from './lib/job-conditions.js'
import {fitLabel} from './lib/fit-label.js'
import SearchAudit from './components/search-audit.js'
import CvLibraryStep from './components/cv-library-step.js'
import SearchProfileRolesStep from './components/search-profile-roles-step.js'
import SearchProfileLocationStep from './components/search-profile-location-step.js'

const WINDOWS=[1,3,7,14]

function dateText(value){ if(!value) return 'Date unavailable'; const d=new Date(value); if(!Number.isFinite(d.getTime())) return 'Date unavailable'; const days=Math.max(0,Math.floor((Date.now()-d.getTime())/86400000)); return days===0?'Today':days===1?'1 day ago':`${days} days ago` }
function salary(job){ if(job.salaryMinDkkMonth==null&&job.salaryMaxDkkMonth==null) return 'Insufficient data'; if(job.salaryMinDkkMonth!=null&&job.salaryMaxDkkMonth!=null) return `${job.salaryMinDkkMonth.toLocaleString('en-DK')}–${job.salaryMaxDkkMonth.toLocaleString('en-DK')} DKK/month`; return `${(job.salaryMinDkkMonth??job.salaryMaxDkkMonth).toLocaleString('en-DK')} DKK/month` }
function conditionScore(value){ return value==null?'N/A':`${value}%` }
function acceptedWorkModels(geography=[]){ const joined=(geography||[]).join(' ').toLowerCase(); return [joined.includes('hybrid')?'hybrid':'',joined.includes('remote')?'remote':'',joined.includes('onsite')?'onsite':''].filter(Boolean) }
function roleList(value){return Array.isArray(value)?value.map(item=>String(item??'').trim()).filter(Boolean):[]}
function legacyRoles(value=''){return String(value??'').split(',').map(item=>item.trim()).filter(Boolean)}
function combinedRoles(primary=[],adjacent=[]){return [...roleList(primary),...roleList(adjacent)].join(', ')}
function workModelText(values=[]){return values.map(value=>value==='onsite'?'On-site':value==='hybrid'?'Hybrid':'Remote').join(' · ')}

export default function Home(){
  const [freshnessDays,setFreshnessDays]=useState(7)
  const [jobs,setJobs]=useState([])
  const [selected,setSelected]=useState(null)
  const [state,setState]=useState({loading:false,error:'',coverage:null,stats:null,fetchedAt:null,audit:[]})
  const [cvData,setCvData]=useState(null)
  const [cvLibrary,setCvLibrary]=useState(()=>createCvLibrary())
  const [cvState,setCvState]=useState({loadingSlot:null,error:''})
  const [profile,setProfile]=useState(DEFAULT_PROFILE)
  const [draft,setDraft]=useState(DEFAULT_PROFILE)
  const [profileOpen,setProfileOpen]=useState(false)
  const [profileStep,setProfileStep]=useState(1)
  const [profileRoleState,setProfileRoleState]=useState({status:'idle',error:'',source:''})
  const [reviewOpen,setReviewOpen]=useState(false)
  const [jdAnalysisState,setJdAnalysisState]=useState({loading:false,error:'',analysis:null,token:'',jobKey:''})
  const [expertiseState,setExpertiseState]=useState({loading:false,error:'',analysis:null,jobKey:''})
  const [decisions,setDecisions]=useState({})
  const active=jobs.find(({job})=>job.sourceJobId===selected?.job?.sourceJobId)||jobs[0]||null

  useEffect(()=>{
    try{
      const savedLibraryRaw=localStorage.getItem(CV_LIBRARY_STORAGE_KEY)
      const savedSourceRaw=localStorage.getItem(SOURCE_CV_STORAGE_KEY)
      const legacyCvRaw=savedSourceRaw?null:localStorage.getItem(LEGACY_CV_STORAGE_KEY)
      const storedCvRaw=savedSourceRaw||legacyCvRaw
      const savedCv=normalizeStoredSourceCv(storedCvRaw?JSON.parse(storedCvRaw):null)
      const library=normalizeCvLibrary(savedLibraryRaw?JSON.parse(savedLibraryRaw):null,savedCv)
      const primaryCv=getPrimaryCv(library)
      const savedProfileRaw=localStorage.getItem('applypilot-profile')
      const savedProfile=mergeProfile(savedProfileRaw?JSON.parse(savedProfileRaw):{})
      const preferences=normalizeSearchPreferences(savedProfile)
      const hydrated={...resumeToProfile(savedProfile,primaryCv),...preferences,geography:legacyGeographyFromPreferences(preferences.locations,preferences.workModels)}

      setCvLibrary(library)
      if(readyCvCount(library)>0) localStorage.setItem(CV_LIBRARY_STORAGE_KEY,JSON.stringify(library))
      if(primaryCv){
        setCvData(primaryCv)
        localStorage.setItem(SOURCE_CV_STORAGE_KEY,JSON.stringify(primaryCv))
        localStorage.removeItem(LEGACY_CV_STORAGE_KEY)
      }
      setProfile(hydrated)
      setDraft(hydrated)
    }catch{}
  },[])

  const profileReady=Boolean(profile.savedAt)
  const resumeLoaded=isSourceCvReady(cvData)
  const cvReadyCount=readyCvCount(cvLibrary)
  const draftPrimaryRoles=roleList(draft.primaryRoles).length?roleList(draft.primaryRoles):(profileReady?legacyRoles(draft.roles):[])
  const draftAdjacentRoles=roleList(draft.adjacentRoles)
  const draftPreferences=normalizeSearchPreferences(draft)
  const draftLocations=draftPreferences.locations
  const draftWorkModels=draftPreferences.workModels
  const pack=applicationPackState(resumeLoaded?cvData:null)
  const reviewFacts=useMemo(()=>Array.isArray(cvData?.facts)?cvData.facts.filter(f=>f&&f.verified!==false):[],[cvData])
  const proposedChanges=useMemo(()=>resumeLoaded&&active?buildReviewChanges(cvData,active):[],[cvData,active,resumeLoaded])
  const alignedTerms=useMemo(()=>active?deriveReviewTerms(active):[],[active])
  const jobKey=active?.job?.sourceJobId||''
  const conditionProfile=useMemo(()=>({...profile,acceptedWorkModels:acceptedWorkModels(profile.geography)}),[profile])
  const jobConditions=useMemo(()=>active?evaluateJobConditions(active.job,conditionProfile):null,[active,conditionProfile])
  const reviewedCount=proposedChanges.filter(change=>decisions[`${jobKey}|${change.id}`]).length
  const profileCompletion=useMemo(()=>{
    const fields=[resumeLoaded,draft.roles,(draftLocations.length&&draftWorkModels.length),draft.exclusions]
    return Math.round(fields.filter(Boolean).length/fields.length*100)
  },[draft,resumeLoaded,draftLocations.length,draftWorkModels.length])

  useEffect(()=>{
    if(!active||!resumeLoaded){ setExpertiseState({loading:false,error:'',analysis:null,jobKey:''}); return }
    const runKey=active.job.sourceJobId||`${active.job.title}|${active.job.company}`
    const cached=readExpertiseMatchCache({storage:localStorage,jobId:active.job.sourceJobId,sourceVersion:cvData?.sourceVersion})
    setExpertiseState({loading:false,error:'',analysis:cached,jobKey:runKey})
  },[jobKey,resumeLoaded,cvData?.sourceVersion])

  async function parseCv(file,slot=1){
    if(!file) return
    setCvState({loadingSlot:slot,error:''})
    try{
      const form=new FormData()
      form.append('file',file)
      const res=await fetch('/api/parse-cv',{method:'POST',body:form})
      const data=await res.json()
      if(!res.ok) throw new Error(data.error||'CV parsing failed.')
      const saved=buildSourceCvRecord(data,new Date().toISOString())
      const nextLibrary=upsertCvSlot(cvLibrary,slot,saved)
      localStorage.setItem(CV_LIBRARY_STORAGE_KEY,JSON.stringify(nextLibrary))
      setCvLibrary(nextLibrary)

      if(slot===1){
        const primaryCv=getPrimaryCv(nextLibrary)
        localStorage.setItem(SOURCE_CV_STORAGE_KEY,JSON.stringify(primaryCv))
        localStorage.removeItem(LEGACY_CV_STORAGE_KEY)
        setCvData(primaryCv)
        setProfileRoleState({status:'idle',error:'',source:''})
        setDecisions({})
        setReviewOpen(false)
        setProfile(current=>{
          const next=resumeToProfile(current,primaryCv)
          if(current.savedAt) localStorage.setItem('applypilot-profile',JSON.stringify(next))
          return next
        })
        setDraft(current=>resumeToProfile(current,primaryCv))
      }
      setCvState({loadingSlot:null,error:''})
    }catch(error){
      setCvState({loadingSlot:null,error:error.message||'CV parsing failed. Please try another PDF or DOCX.'})
    }
  }

  function removeCv(slot){
    const nextLibrary=removeCvSlot(cvLibrary,slot)
    localStorage.setItem(CV_LIBRARY_STORAGE_KEY,JSON.stringify(nextLibrary))
    setCvLibrary(nextLibrary)
    setCvState({loadingSlot:null,error:''})
    if(slot!==1) return

    localStorage.removeItem(SOURCE_CV_STORAGE_KEY)
    localStorage.removeItem(LEGACY_CV_STORAGE_KEY)
    setCvData(null)
    setProfileRoleState({status:'idle',error:'',source:''})
    setDecisions({})
    setReviewOpen(false)
    setProfile(current=>{
      const next={...current,cvName:'',factBank:[],skills:[],cvParsedAt:''}
      if(current.savedAt) localStorage.setItem('applypilot-profile',JSON.stringify(next))
      return next
    })
    setDraft(current=>({...current,cvName:'',factBank:[],skills:[],cvParsedAt:''}))
  }

  async function search(){
    if(!resumeLoaded){
      setState({loading:false,error:'Please Upload Your CV',coverage:null,stats:null,fetchedAt:null,audit:[]})
      return
    }
    setJobs([]); setState({loading:true,error:'',coverage:null,stats:null,fetchedAt:null,audit:[]})
    try{
      const res=await fetch('/api/linkedin-search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({freshnessDays,cvText:cvData.cvText})})
      const data=await res.json()
      if(!res.ok) throw new Error(data.error||'LinkedIn search failed')
      setJobs(Array.isArray(data.jobs)?data.jobs:[])
      setState({loading:false,error:'',coverage:data.coverage||null,stats:data.stats||null,fetchedAt:data.fetchedAt||null,audit:Array.isArray(data.audit)?data.audit:[]})
    }catch(error){ setState({loading:false,error:error.message||'LinkedIn search failed',coverage:null,stats:null,fetchedAt:null,audit:[]}) }
  }

  function startProfile(){
    const base=resumeToProfile(profile,cvData)
    const preferences=normalizeSearchPreferences(base)
    setDraft({...base,...preferences,geography:legacyGeographyFromPreferences(preferences.locations,preferences.workModels)})
    setProfileStep(1)
    setProfileRoleState({status:'idle',error:'',source:''})
    setProfileOpen(true)
    setCvState({loadingSlot:null,error:''})
  }

  function closeProfile(){setProfileOpen(false)}

  function applyProfileRoles(roles,source='ai'){
    const primaryRoles=roleList(roles?.primaryRoles)
    const adjacentRoles=roleList(roles?.adjacentRoles)
    setDraft(current=>({...current,primaryRoles,adjacentRoles,roles:combinedRoles(primaryRoles,adjacentRoles),rolesSourceVersion:cvData?.sourceVersion||current.rolesSourceVersion||''}))
    setProfileRoleState({status:'ready',error:'',source})
  }

  async function buildProfileRoles({force=false}={}){
    if(!resumeLoaded||!cvData?.sourceVersion) return
    const sourceVersion=cvData.sourceVersion
    if(!force&&profile.savedAt&&profile.rolesSourceVersion===sourceVersion&&roleList(profile.primaryRoles).length){
      applyProfileRoles({primaryRoles:profile.primaryRoles,adjacentRoles:profile.adjacentRoles},'saved')
      return
    }
    if(!force){
      const cached=readSearchProfileCache({storage:localStorage,sourceVersion})
      if(cached){
        applyProfileRoles(cached,'cache')
        return
      }
    }
    setProfileRoleState({status:'loading',error:'',source:''})
    try{
      const roles=await requestSearchProfileRoles({cvText:cvData.cvText})
      writeSearchProfileCache({storage:localStorage,sourceVersion,roles})
      applyProfileRoles(roles,'ai')
    }catch(error){
      setProfileRoleState({status:'error',error:error.message||'Search Profile generation failed safely. Please try again.',source:''})
    }
  }

  function updateDraftRoles(field,roles){
    setDraft(current=>{
      const primaryRoles=field==='primaryRoles'?roleList(roles):(roleList(current.primaryRoles).length?roleList(current.primaryRoles):(profileReady?legacyRoles(current.roles):[]))
      const adjacentRoles=field==='adjacentRoles'?roleList(roles):roleList(current.adjacentRoles)
      return {...current,[field]:roleList(roles),primaryRoles,adjacentRoles,roles:combinedRoles(primaryRoles,adjacentRoles),rolesSourceVersion:cvData?.sourceVersion||current.rolesSourceVersion||''}
    })
  }

  function nextProfileStep(){
    if(profileStep===1){
      setProfileStep(2)
      void buildProfileRoles()
      return
    }
    setProfileStep(step=>step+1)
  }

  function togglePreference(field,value){
    setDraft(current=>{
      const preferences=normalizeSearchPreferences(current)
      const currentValues=preferences[field]
      const nextValues=currentValues.includes(value)?currentValues.filter(item=>item!==value):[...currentValues,value]
      const locations=field==='locations'?nextValues:preferences.locations
      const workModels=field==='workModels'?nextValues:preferences.workModels
      return {...current,locations,workModels,geography:legacyGeographyFromPreferences(locations,workModels)}
    })
  }

  function saveProfile(){
    const primaryRoles=roleList(draft.primaryRoles).length?roleList(draft.primaryRoles):legacyRoles(draft.roles)
    const adjacentRoles=roleList(draft.adjacentRoles)
    const {locations,workModels}=normalizeSearchPreferences(draft)
    const geography=legacyGeographyFromPreferences(locations,workModels)
    const saved={...resumeToProfile(draft,cvData),primaryRoles,adjacentRoles,roles:combinedRoles(primaryRoles,adjacentRoles),rolesSourceVersion:cvData?.sourceVersion||draft.rolesSourceVersion||'',locations,workModels,geography,savedAt:new Date().toISOString()}
    localStorage.setItem('applypilot-profile',JSON.stringify(saved))
    setProfile(saved)
    setDraft(saved)
    setProfileOpen(false)
    setProfileStep(1)
  }

  async function runExpertiseMatch(){
    if(!active||!resumeLoaded) return
    const runKey=active.job.sourceJobId||`${active.job.title}|${active.job.company}`
    const cacheArgs={storage:localStorage,jobId:active.job.sourceJobId,sourceVersion:cvData?.sourceVersion}
    const cached=readExpertiseMatchCache(cacheArgs)
    if(cached){
      setExpertiseState({loading:false,error:'',analysis:cached,jobKey:runKey})
      return
    }
    setExpertiseState({loading:true,error:'',analysis:null,jobKey:runKey})
    try{
      const analysis=await requestExpertiseMatch({job:active.job,cvText:cvData.cvText})
      writeExpertiseMatchCache({...cacheArgs,analysis})
      setExpertiseState({loading:false,error:'',analysis,jobKey:runKey})
    }catch(error){
      setExpertiseState({loading:false,error:error.message||'Expertise Match analysis failed safely. Please try again.',analysis:null,jobKey:runKey})
    }
  }

  async function runJobAnalysis(){
    if(!active||!resumeLoaded) return
    const runKey=active.job.sourceJobId||`${active.job.title}|${active.job.company}`
    const cacheArgs={storage:localStorage,jobId:active.job.sourceJobId,sourceVersion:cvData?.sourceVersion}
    setReviewOpen(true)
    const cached=readJobAnalysisCache(cacheArgs)
    if(cached){
      setJdAnalysisState({loading:false,error:'',analysis:cached.analysis,token:cached.token||'',jobKey:runKey})
      return
    }
    setJdAnalysisState({loading:true,error:'',analysis:null,token:'',jobKey:runKey})
    try{
      const result=await requestJobAnalysis({sourceVersion:cvData.sourceVersion,job:active.job})
      writeJobAnalysisCache({...cacheArgs,analysis:result.analysis,token:result.token||''})
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

    <div className="profileStrip"><span>{profileReady?profile.roles.split(',').slice(0,2).join(' · '):'Senior IT Project / Delivery · Denmark'}</span><span>JD responsibilities 40% · experience/domain 25% · geography 20% · career/comp 15%</span><button className="profileEditButton" onClick={startProfile}>{profileReady?'Edit profile':'Search profile'}</button><button className="cvButton" onClick={startProfile}>{cvReadyCount?`✓ CVs ${cvReadyCount}/${MAX_CVS}`:'Upload CVs'}</button></div>

    <section className="controls">
      <div><small>POSTED WITHIN</small><div className="choices">{WINDOWS.map(days=><button key={days} className={freshnessDays===days?'choice selected':'choice'} onClick={()=>setFreshnessDays(days)}>{days} day{days===1?'':'s'}</button>)}</div></div>
      <button className="primary" onClick={search} disabled={state.loading}>{state.loading?'Reading LinkedIn JDs…':'Search LinkedIn'}</button>
    </section>

    {state.error&&<div className="errorBox"><b>{state.error==='Please Upload Your CV'?'Please Upload Your CV':'LinkedIn search failed'}</b>{state.error!=='Please Upload Your CV'&&<span>{state.error}</span>}</div>}
    {state.stats&&<div className="searchMeta"><span><b>{state.stats.discovered}</b> jobs discovered</span><span><b>{state.stats.fullJdVerified}</b> full JDs read</span><span><b>{state.stats.evaluated}</b> worthwhile after evaluation</span><span>Coverage: <b>{state.coverage?.status}</b></span></div>}
    <SearchAudit audit={state.audit}/>
    {state.coverage?.detail&&<div className="warningBox">Partial source access: {state.coverage.detail}</div>}

    <section className="grid">
      <div className="list">
        <div className="listHead"><h2>Live matches</h2><small>Newest {freshnessDays} days</small></div>
        {!state.loading&&!state.error&&!state.stats&&<div className="empty">Run the LinkedIn search. No other source is used in this milestone.</div>}
        {state.loading&&<div className="empty">Searching LinkedIn public pages and reading full job descriptions…</div>}
        {!state.loading&&state.stats&&jobs.length===0&&<div className="empty">NO STRONG NEW MATCHES FOUND.</div>}
        {jobs.map(item=>{const {job,evaluation}=item; const score=Math.round(evaluation.score*10); return <button key={job.sourceJobId} onClick={()=>setSelected(item)} className={'job '+(active?.job.sourceJobId===job.sourceJobId?'active':'')}>
          <span className="score">{fitLabel(score)}</span>
          <span><b>{job.title}</b><small>{job.company} · {job.location}</small><small className="sourceLine">LinkedIn · {dateText(job.publishedAt)}</small></span>
          <span>→</span>
        </button>})}
      </div>

      <div className="panel">
        {active?(()=>{const {job}=active; const expertise=expertiseState.jobKey===jobKey?expertiseState.analysis:null; return <>
          <div className="panelTop expertiseHeader"><div><h2>{job.title}</h2><p>{job.company} · {job.location}</p><small className="sourceLine">Source: LinkedIn · {dateText(job.publishedAt)}</small></div></div>

          <div className="expertiseHero">
            <div className="expertiseHeroHead"><div><p className="eyebrow">EXPERTISE MATCH</p><p className="expertiseIntro">Full JD ↔ Source CV professional expertise only</p></div><div className="expertiseScore">{expertiseState.loading&&expertiseState.jobKey===jobKey?'…':expertise?`${expertise.expertiseMatch}%`:'N/A'}</div></div>
            {expertiseState.loading&&expertiseState.jobKey===jobKey&&<div className="expertiseLoading">Analysing professional requirements and Source CV evidence…</div>}
            {expertiseState.error&&expertiseState.jobKey===jobKey&&<div className="errorBox"><b>Expertise Match analysis failed safely</b><span>{expertiseState.error}</span></div>}
            {!expertise&&!expertiseState.loading&&<button className="primary" onClick={runExpertiseMatch}>Run Expertise Match</button>}
            {expertise&&<>
              <div className="expertiseSection"><h3>Why you fit</h3>{expertise.whyYouFit.length?expertise.whyYouFit.map((item,index)=><p key={index}>✓ {item}</p>):<p className="muted">No direct professional match evidence returned.</p>}</div>
              <div className="expertiseSection"><h3>Expertise gaps</h3>{expertise.expertiseGaps.length?expertise.expertiseGaps.map((item,index)=><p key={index}>⚠ {item}</p>):<p>✓ No material expertise gap detected in the analysed requirements.</p>}</div>
              <div className="expertiseSection"><h3>Expertise breakdown</h3><div className="expertiseBreakdown">
                <div><span>Delivery / execution</span><b>{conditionScore(expertise.breakdown.delivery_execution?.score)}</b></div>
                <div><span>Domain & functional expertise</span><b>{conditionScore(expertise.breakdown.domain_functional_expertise?.score)}</b></div>
                <div><span>Technical / platform capabilities</span><b>{conditionScore(expertise.breakdown.technical_platform_capabilities?.score)}</b></div>
                <div><span>Leadership & stakeholder scope</span><b>{conditionScore(expertise.breakdown.leadership_stakeholder_scope?.score)}</b></div>
                <div><span>Required experience / qualifications</span><b>{conditionScore(expertise.breakdown.required_experience_qualifications?.score)}</b></div>
              </div></div>
            </>}
          </div>

          <div className="conditionGrid">
            <div className="conditionCard"><small>Area</small><b>{conditionScore(jobConditions?.area.score)}</b><span>{jobConditions?.area.value||'Not stated'}</span></div>
            <div className="conditionCard"><small>Salary</small><b>{conditionScore(jobConditions?.salary.score)}</b><span>{jobConditions?.salary.value||'Not stated'}</span></div>
            <div className="conditionCard"><small>Employment type</small><b>{conditionScore(jobConditions?.employmentType.score)}</b><span>{jobConditions?.employmentType.value||'Not stated'}</span></div>
            <div className="conditionCard"><small>Work model</small><b>{conditionScore(jobConditions?.workModel.score)}</b><span>{jobConditions?.workModel.value||'Not stated'}</span></div>
          </div>

          <div className="section"><h3>Application pack</h3><div className="docs"><div>{pack.cvReady?'✓':'○'} Tailored CV <span className={pack.cvReady?'ready':'pending'}>{pack.tailoredCvLabel}</span></div><div>○ Cover letter <span className="pending">{pack.coverLetterLabel}</span></div></div></div>
          <div className="actions reviewActions">{pack.cvReady?<button className="primary" onClick={runJobAnalysis}>Review CV changes</button>:<button className="primary" onClick={startProfile}>Upload CV</button>}<a className="secondary openLink" href={job.originalUrl} target="_blank" rel="noreferrer">Open LinkedIn vacancy</a>{job.officialUrl&&<a className="secondary openLink" href={job.officialUrl} target="_blank" rel="noreferrer">Employer link</a>}</div>
        </>})():<div className="emptyPanel"><h2>No selected vacancy</h2><p>{state.loading?'Searching LinkedIn public pages…':'Run the LinkedIn search to see matching vacancies.'}</p></div>}
      </div>
    </section>

    <footer>Milestone: LinkedIn public search only · no CVR · no Jobnet · no additional sources</footer>

    {profileOpen&&<div className="overlay" onMouseDown={event=>{if(event.target===event.currentTarget)closeProfile()}}><div className="modal profileModal">
      <div className="modalHead"><div><p className="eyebrow">BUILD YOUR SEARCH AGENT</p><h2>Search profile</h2></div><button className="close" onClick={closeProfile}>×</button></div>
      <div className="progress"><span style={{width:`${profileStep/5*100}%`}}></span></div><div className="stepMeta"><span>Step {profileStep} of 5</span><span>{profileCompletion}% profile data</span></div>
      {profileStep===1&&<CvLibraryStep library={cvLibrary} loadingSlot={cvState.loadingSlot} error={cvState.error} primarySkills={draft.skills} onUpload={parseCv} onRemove={removeCv}/>} 
      {profileStep===2&&<SearchProfileRolesStep primaryRoles={draftPrimaryRoles} adjacentRoles={draftAdjacentRoles} status={profileRoleState.status} error={profileRoleState.error} source={profileRoleState.source} onPrimaryChange={roles=>updateDraftRoles('primaryRoles',roles)} onAdjacentChange={roles=>updateDraftRoles('adjacentRoles',roles)} onRetry={()=>buildProfileRoles({force:true})}/>} 
      {profileStep===3&&<SearchProfileLocationStep locations={draftLocations} workModels={draftWorkModels} onToggleLocation={value=>togglePreference('locations',value)} onToggleWorkModel={value=>togglePreference('workModels',value)}/>} 
      {profileStep===4&&<div className="wizard"><h3>What should ApplyPilot exclude?</h3><p>Save hard no-go roles, industries, languages or working conditions in your Search Profile.</p><textarea value={draft.exclusions} onChange={event=>setDraft(current=>({...current,exclusions:event.target.value}))} rows="6"/></div>}
      {profileStep===5&&<div className="wizard review"><h3>Confirm your search profile</h3><p>This saves your Search Profile for the next product step. The current LinkedIn search engine remains unchanged in this milestone.</p><div className="reviewRow"><span>CV</span><b>{resumeLoaded?cvData.fileName:cvData?.fileName?'Re-upload required':'Not uploaded yet'}</b></div><div className="reviewRow"><span>CV preparation</span><b>{resumeLoaded?'Ready — complete Source CV prepared':'CV not ready'}</b></div><div className="reviewRow"><span>Target roles</span><b>{draft.roles||'Not set'}</b></div><div className="reviewRow"><span>Where</span><b>{draftLocations.length?draftLocations.join(' · '):'Not set'}</b></div><div className="reviewRow"><span>Work model</span><b>{draftWorkModels.length?workModelText(draftWorkModels):'Not set'}</b></div><div className="reviewRow"><span>Exclude</span><b>{draft.exclusions||'None'}</b></div><div className="truth"><b>Truth rule</b><span>ApplyPilot may rephrase verified experience, but may never invent skills, achievements, employers or responsibilities.</span></div></div>}
      <div className="modalActions"><button className="secondary" onClick={()=>profileStep===1?closeProfile():setProfileStep(step=>step-1)}>{profileStep===1?'Cancel':'Back'}</button>{profileStep<5?<button className="primary" disabled={(profileStep===1&&(Boolean(cvState.loadingSlot)||cvReadyCount===0))||(profileStep===2&&profileRoleState.status==='loading')} onClick={nextProfileStep}>Continue</button>:<button className="primary" onClick={saveProfile}>Save profile</button>}</div>
    </div></div>}

    {reviewOpen&&active&&<div className="overlay" onMouseDown={event=>{if(event.target===event.currentTarget)setReviewOpen(false)}}><div className="modal reviewModal"><div className="modalHead"><div><p className="eyebrow">CV UPDATE REVIEW</p><h2>{active.job.title}</h2><p className="muted">{active.job.company} · {active.job.location}</p></div><button className="close" onClick={()=>setReviewOpen(false)}>×</button></div>
      <div className="jdPretest"><p className="eyebrow">JD ANALYSIS PRETEST · OPENAI</p>
        {jdAnalysisState.jobKey!==jobKey?<div className="muted">Select Review CV changes to analyse this vacancy.</div>:jdAnalysisState.loading?<div className="jdLoading">Reading job description with OpenAI…</div>:jdAnalysisState.error?<div className="errorBox"><b>JD analysis failed safely</b><span>{jdAnalysisState.error}</span></div>:jdAnalysisState.analysis?<>
          <div className="jdGrid"><div><small>Role mission</small><p>{jdAnalysisState.analysis.roleMission}</p></div><div><small>Candidate positioning</small><p>{jdAnalysisState.analysis.candidatePositioning}</p></div></div>
          <div className="jdSection"><h3>Hiring priorities</h3>{jdAnalysisState.analysis.priorities.map(priority=><details className="jdPriority" key={priority.id}><summary><span>{priority.rank}. {priority.requirement}</span><b>{priority.kind.replace('_',' ')}</b></summary><p>{priority.why}</p><div className="jdEvidence"><small>View JD evidence</small>{priority.jdEvidence.map((evidence,index)=><blockquote key={index}>{evidence}</blockquote>)}</div></details>)}</div>
          <div className="jdSection"><h3>Must-haves</h3>{jdAnalysisState.analysis.mustHaves?.length?jdAnalysisState.analysis.mustHaves.map(mustHave=><details className="jdMustHave" key={mustHave.id}><summary>✓ {mustHave.requirement}</summary><div className="jdEvidence"><small>View JD evidence</small>{mustHave.jdEvidence.map((evidence,index)=><blockquote key={index}>{evidence}</blockquote>)}</div></details>):<p className="muted">No explicit candidate qualification gate was found in the JD.</p>}</div>
        </>:null}
      </div>
      <div className="muted">✓ Truth Guard active · 0 unsupported claims</div>
      <div className="reviewToolbar"><div><h3>CV Summary update</h3></div>{proposedChanges.some(change=>change.changed)&&<button className="secondary" onClick={acceptAll}>Accept all safe changes</button>}</div>
      {proposedChanges.map((change,index)=>{const decision=decisions[`${jobKey}|${change.id}`];return <div className={'changeCard '+(decision?'decided':'')} key={change.id}>
        <div className="changeHead"><span>SUMMARY</span><b>{decision==='accepted'?'Accepted':decision==='original'?'Original kept':change.changed?'Review needed':'Already aligned'}</b></div>
        <div className="compareGrid"><div className="compareBox"><small>ORIGINAL</small><p>{change.original}</p></div><div className="compareArrow">→</div><div className="compareBox updatedBox"><small>UPDATED</small><p>{change.updated}</p></div></div>
        <div className="changeWhy"><div><small>WHY CHANGED</small><p>{change.why}</p></div></div>
        <div className="evidenceActions"><button className={'secondary '+(decision==='original'?'chosen':'')} onClick={()=>setDecision(change.id,'original')}>Keep original</button><button className={'primary smallPrimary '+(decision==='accepted'?'chosenPrimary':'')} onClick={()=>setDecision(change.id,'accepted')} disabled={!change.changed}>{change.changed?'Accept change':'No change needed'}</button></div>
      </div>})}
      {!proposedChanges.length&&<div className="muted">No Summary change proposed.</div>}
      <div className="reviewFooter"><button className="secondary" onClick={()=>setReviewOpen(false)}>Close review</button></div>
    </div></div>}
  </main>
}