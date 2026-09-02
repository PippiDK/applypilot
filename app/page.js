'use client'
import { useEffect, useMemo, useState } from 'react'
import {DEFAULT_PROFILE,mergeProfile,resumeToProfile,applicationPackState} from './lib/profile-review.js'
import {SOURCE_CV_STORAGE_KEY,LEGACY_CV_STORAGE_KEY,buildSourceCvRecord,normalizeStoredSourceCv,isSourceCvReady} from './lib/source-cv.js'
import {CV_LIBRARY_STORAGE_KEY,MAX_CVS,createCvLibrary,normalizeCvLibrary,upsertCvSlot,removeCvSlot,getPrimaryCv,readyCvCount} from './lib/cv-library.js'
import {requestSearchProfileRoles,requestSearchProfileExclusions} from './lib/search-profile-client.js'
import {SEARCH_PROFILE_BUILDER_VERSION,readSearchProfileCache,writeSearchProfileCache,resolveSearchProfileExclusions} from './lib/search-profile-cache.js'
import {buildCvRoleProfile,combineCvRoleProfiles,searchProfileLibraryFingerprint} from './lib/search-profile-library.js'
import {buildUnionSearchPlan,UNION_SEARCH_PLAN_VERSION} from './lib/union-search-plan.js'
import {normalizeSearchPreferences,legacyGeographyFromPreferences} from './lib/search-profile-preferences.js'
import {SEARCH_AREAS,WORK_MODELS,JOB_STATUS_FILTERS,DEFAULT_JOB_STATUS_FILTERS,classifySearchArea,classifyWorkModel,classifyJobStatus,filterJobItems,filterJobItemsByStatus} from './lib/job-list-filters.js'
import {selectAdaptationCv,selectedAdaptationCv} from './lib/cv-adaptation-selection.js'
import {buildAdaptationBaseline,baselineKey,baselineMatches} from './lib/cv-adaptation-baseline.js'
import {requestCvAdaptation} from './lib/cv-adaptation-client.js'
import {ADAPTATION_DECISION,readAdaptationDecision,setAdaptationDecision,adaptationReviewBlocks} from './lib/cv-adaptation-decisions.js'
import {requestExpertiseMatch} from './lib/expertise-match-client.js'
import {readExpertiseMatchCache,writeExpertiseMatchCache} from './lib/expertise-match-cache.js'
import {evaluateJobConditions} from './lib/job-conditions.js'
import {fitLabel} from './lib/fit-label.js'
import {compareShadowToLegacy} from './lib/shadow-search-compare.js'
import {JOB_STATUS_OPTIONS,readJobStatuses,writeJobStatus} from './lib/job-statuses.js'
import {readLinkedInMasterPool,writeLinkedInMasterPool} from './lib/linkedin-master-pool-cache.js'
import SearchAudit from './components/search-audit.js'
import ShadowSearchAudit from './components/shadow-search-audit.js'
import CvLibraryStep from './components/cv-library-step.js'
import SearchProfileRolesStep from './components/search-profile-roles-step.js'
import SearchPlanPreview from './components/search-plan-preview.js'
import BestCvPanel from './components/best-cv-panel.js'
import filterStyles from './components/job-filters.module.css'

const WINDOWS=[1,3,7,14]
const EMPTY_SEARCH_PROFILE={...DEFAULT_PROFILE,exclusions:''}
const EMPTY_ROLE_STATE={status:'idle',error:'',source:'',totalCount:0,analysedCount:0,failedCvs:[]}

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
  const [selectedAreas,setSelectedAreas]=useState(()=>SEARCH_AREAS.map(({id})=>id))
  const [selectedWorkModels,setSelectedWorkModels]=useState(()=>WORK_MODELS.map(({id})=>id))
  const [selectedStatuses,setSelectedStatuses]=useState(()=>[...DEFAULT_JOB_STATUS_FILTERS])
  const allFiltersSelected=SEARCH_AREAS.every(({id})=>selectedAreas.includes(id))&&WORK_MODELS.every(({id})=>selectedWorkModels.includes(id))
  const someFiltersSelected=selectedAreas.length>0||selectedWorkModels.length>0
  const [selected,setSelected]=useState(null)
  const [jobStatuses,setJobStatuses]=useState({})
  const [state,setState]=useState({loading:false,error:'',coverage:null,stats:null,fetchedAt:null,audit:[]})
  const [shadowState,setShadowState]=useState({status:'idle',error:'',stats:null,coverage:null,comparison:null})
  const [cvData,setCvData]=useState(null)
  const [cvLibrary,setCvLibrary]=useState(()=>createCvLibrary())
  const [cvState,setCvState]=useState({loadingSlot:null,error:''})
  const [profile,setProfile]=useState(EMPTY_SEARCH_PROFILE)
  const [draft,setDraft]=useState(EMPTY_SEARCH_PROFILE)
  const [profileOpen,setProfileOpen]=useState(false)
  const [profileStep,setProfileStep]=useState(1)
  const [profileRoleState,setProfileRoleState]=useState(EMPTY_ROLE_STATE)
  const [profileSaveState,setProfileSaveState]=useState({loading:false,error:''})
  const [reviewOpen,setReviewOpen]=useState(false)
  const [adaptationSelections,setAdaptationSelections]=useState({})
  const [adaptationBaselines,setAdaptationBaselines]=useState({})
  const [adaptationResults,setAdaptationResults]=useState({})
  const [adaptationRun,setAdaptationRun]=useState({loading:false,error:'',jobKey:'',baselineKey:''})
  const [expertiseState,setExpertiseState]=useState({loading:false,error:'',analysis:null,jobKey:''})
  const [decisions,setDecisions]=useState({})
  const [editedUpdates,setEditedUpdates]=useState({})
  const [sourceDocxFiles,setSourceDocxFiles]=useState({})
  const [exportState,setExportState]=useState({loading:false,error:'',baselineKey:''})
  const visibleJobs=useMemo(()=>filterJobItemsByStatus(filterJobItems(jobs,selectedAreas,selectedWorkModels),jobStatuses,selectedStatuses),[jobs,selectedAreas,selectedWorkModels,jobStatuses,selectedStatuses])
  const active=visibleJobs.find(({job})=>job.sourceJobId===selected?.job?.sourceJobId)||visibleJobs[0]||null

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
      const savedProfile=mergeProfile(savedProfileRaw?JSON.parse(savedProfileRaw):{exclusions:''})
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

  useEffect(()=>{
    setJobStatuses(readJobStatuses(localStorage))
  },[])

  const profileReady=Boolean(profile.savedAt)
  const resumeLoaded=isSourceCvReady(cvData)
  const readyCvs=useMemo(()=>Array.isArray(cvLibrary?.cvs)?cvLibrary.cvs.filter(isSourceCvReady):[],[cvLibrary])
  const cvReadyCount=readyCvs.length
  const areaCounts=useMemo(()=>Object.fromEntries(SEARCH_AREAS.map(({id})=>[id,jobs.filter(item=>classifySearchArea(item.job)===id).length])),[jobs])
  const workModelCounts=useMemo(()=>Object.fromEntries(WORK_MODELS.map(({id})=>[id,jobs.filter(item=>classifyWorkModel(item.job)===id).length])),[jobs])
  const statusCounts=useMemo(()=>Object.fromEntries(JOB_STATUS_FILTERS.map(({id})=>[id,jobs.filter(item=>classifyJobStatus(item?.job?.sourceJobId,jobStatuses)===id).length])),[jobs,jobStatuses])
  const savedUnionSearchPlan=profile?.unionSearchPlan
  const profileSearchPlanSummary=profileReady&&Array.isArray(savedUnionSearchPlan?.directions)&&savedUnionSearchPlan.directions.length
    ? `${savedUnionSearchPlan.directions.length} search directions · ${Number(savedUnionSearchPlan.primaryCount)||0} primary · ${Number(savedUnionSearchPlan.adjacentCount)||0} adjacent`
    : 'Search profile not configured'
  const rolesLibraryFingerprint=searchProfileLibraryFingerprint(readyCvs,SEARCH_PROFILE_BUILDER_VERSION)
  const draftCvRoleProfiles=Array.isArray(draft.cvRoleProfiles)?draft.cvRoleProfiles:[]
  const analysedRoleProfileCount=draftCvRoleProfiles.filter(roleProfile=>readyCvs.some(cv=>cv.id===roleProfile.cvId&&cv.sourceVersion===roleProfile.sourceVersion)).length
  const draftPrimaryRoles=roleList(draft.primaryRoles).length?roleList(draft.primaryRoles):(profileReady?legacyRoles(draft.roles):[])
  const draftAdjacentRoles=roleList(draft.adjacentRoles)
  const draftUnionSearchPlan=useMemo(()=>buildUnionSearchPlan({primaryRoles:draftPrimaryRoles,adjacentRoles:draftAdjacentRoles,roleSources:Array.isArray(draft.roleSources)?draft.roleSources:[],cvRoleProfiles:Array.isArray(draft.cvRoleProfiles)?draft.cvRoleProfiles:[]}),[draftPrimaryRoles,draftAdjacentRoles,draft.roleSources,draft.cvRoleProfiles])
  const draftPreferences=normalizeSearchPreferences(draft)
  const draftLocations=draftPreferences.locations
  const draftWorkModels=draftPreferences.workModels
  const pack=applicationPackState(resumeLoaded?cvData:null)
  const jobKey=active?.job?.sourceJobId||''
  const selectedAdaptationCvRecord=selectedAdaptationCv(adaptationSelections,jobKey,readyCvs)
  const storedAdaptationBaseline=adaptationBaselines[jobKey]||null
  const activeAdaptationBaseline=storedAdaptationBaseline&&selectedAdaptationCvRecord&&baselineMatches({baseline:storedAdaptationBaseline,job:active?.job,cv:selectedAdaptationCvRecord})?storedAdaptationBaseline:null
  const activeBaselineKey=activeAdaptationBaseline?baselineKey(activeAdaptationBaseline):''
  const currentAdaptationResult=activeBaselineKey?adaptationResults[activeBaselineKey]||null:null
  const reviewChanges=adaptationReviewBlocks({blocks:currentAdaptationResult?.blocks})
  const conditionProfile=useMemo(()=>({...profile,acceptedWorkModels:acceptedWorkModels(profile.geography)}),[profile])
  const jobConditions=useMemo(()=>active?evaluateJobConditions(active.job,conditionProfile):null,[active,conditionProfile])
  const reviewedCount=activeAdaptationBaseline?reviewChanges.filter(change=>readAdaptationDecision(decisions,{jobId:activeAdaptationBaseline.jobId,cvId:activeAdaptationBaseline.cvId,sourceVersion:activeAdaptationBaseline.sourceVersion,blockId:change.blockId})).length:0
  const allReviewDecisionsMade=Boolean(currentAdaptationResult)&&reviewedCount===reviewChanges.length
  const selectedSourceDocx=activeAdaptationBaseline?sourceDocxFiles[activeAdaptationBaseline.sourceVersion]||null:null
  const profileCompletion=useMemo(()=>{
    const fields=[resumeLoaded,draft.roles,(draftLocations.length&&draftWorkModels.length)]
    return Math.round(fields.filter(Boolean).length/fields.length*100)
  },[draft.roles,resumeLoaded,draftLocations.length,draftWorkModels.length])

  useEffect(()=>{
    if(!active||!resumeLoaded){ setExpertiseState({loading:false,error:'',analysis:null,jobKey:''}); return }
    const runKey=active.job.sourceJobId||`${active.job.title}|${active.job.company}`
    const cached=readExpertiseMatchCache({storage:localStorage,jobId:active.job.sourceJobId,sourceVersion:cvData?.sourceVersion})
    setExpertiseState({loading:false,error:'',analysis:cached,jobKey:runKey})
  },[jobKey,resumeLoaded,cvData?.sourceVersion])

  async function parseCv(file,slot=1){
    if(!file) return
    if(!String(file.name||'').toLowerCase().endsWith('.docx')){ setCvState({loadingSlot:null,error:'Please upload a Word DOCX file.'}); return }
    setCvState({loadingSlot:slot,error:''})
    try{
      const form=new FormData()
      form.append('file',file)
      const res=await fetch('/api/parse-cv',{method:'POST',body:form})
      const data=await res.json()
      if(!res.ok) throw new Error(data.error||'CV parsing failed.')
      const saved=buildSourceCvRecord(data,new Date().toISOString())
      const nextLibrary=upsertCvSlot(cvLibrary,slot,saved)
      setSourceDocxFiles(current=>({...current,[saved.sourceVersion]:file}))
      localStorage.setItem(CV_LIBRARY_STORAGE_KEY,JSON.stringify(nextLibrary))
      setCvLibrary(nextLibrary)
      setProfileRoleState(EMPTY_ROLE_STATE)

      if(slot===1){
        const primaryCv=getPrimaryCv(nextLibrary)
        localStorage.setItem(SOURCE_CV_STORAGE_KEY,JSON.stringify(primaryCv))
        localStorage.removeItem(LEGACY_CV_STORAGE_KEY)
        setCvData(primaryCv)
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
      setCvState({loadingSlot:null,error:error.message||'CV parsing failed. Please try another DOCX.'})
    }
  }

  function removeCv(slot){
    const nextLibrary=removeCvSlot(cvLibrary,slot)
    localStorage.setItem(CV_LIBRARY_STORAGE_KEY,JSON.stringify(nextLibrary))
    setCvLibrary(nextLibrary)
    setCvState({loadingSlot:null,error:''})
    setProfileRoleState(EMPTY_ROLE_STATE)
    const removed=cvLibrary?.cvs?.[slot-1]||null
    if(removed?.sourceVersion) setSourceDocxFiles(current=>{const next={...current};delete next[removed.sourceVersion];return next})
    if(slot!==1) return

    localStorage.removeItem(SOURCE_CV_STORAGE_KEY)
    localStorage.removeItem(LEGACY_CV_STORAGE_KEY)
    setCvData(null)
    setDecisions({})
    setReviewOpen(false)
    setProfile(current=>{
      const next={...current,cvName:'',factBank:[],skills:[],cvParsedAt:''}
      if(current.savedAt) localStorage.setItem('applypilot-profile',JSON.stringify(next))
      return next
    })
    setDraft(current=>({...current,cvName:'',factBank:[],skills:[],cvParsedAt:''}))
  }

  function changeJobStatus(jobId,status){
    setJobStatuses(current=>writeJobStatus({storage:localStorage,statuses:current,jobId,status}))
  }

  function toggleJobFilter(setter,id){
    setter(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id])
  }

  function toggleAllJobFilters(event){
    const checked=event.target.checked
    setSelectedAreas(checked?SEARCH_AREAS.map(({id})=>id):[])
    setSelectedWorkModels(checked?WORK_MODELS.map(({id})=>id):[])
  }

  async function search(){
  if(!resumeLoaded){
    setState({loading:false,error:'Please Upload Your CV',coverage:null,stats:null,fetchedAt:null,audit:[]})
    return
  }
  setJobs([]); setState({loading:true,error:'',coverage:null,stats:null,fetchedAt:null,audit:[]})
  setShadowState({status:'skipped',error:'',stats:null,coverage:null,comparison:null})
  const hasProfilePlan=Array.isArray(profile?.unionSearchPlan?.directions)&&profile.unionSearchPlan.directions.length>0
  try{
    let res
    if(hasProfilePlan){
      const fingerprint=profile.unionSearchPlanFingerprint||profile.unionSearchPlan?.fingerprint
      const previousCandidates=readLinkedInMasterPool({storage:localStorage,fingerprint})
      res=await fetch('/api/linkedin-profile-search',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          freshnessDays,
          unionSearchPlan:profile.unionSearchPlan,
          exclusionRules:Array.isArray(profile.exclusionRules)?profile.exclusionRules:[],
          previousCandidates,
        }),
      })
    }else{
      res=await fetch('/api/linkedin-search',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({freshnessDays,cvText:cvData.cvText}),
      })
    }
    const data=await res.json()
    if(!res.ok) throw new Error(data.error||'LinkedIn search failed')
    setJobs(Array.isArray(data.jobs)?data.jobs:[])
    if(hasProfilePlan&&Array.isArray(data.masterCandidates)) writeLinkedInMasterPool({storage:localStorage,fingerprint:profile.unionSearchPlanFingerprint||profile.unionSearchPlan?.fingerprint,candidates:data.masterCandidates})
    setState({loading:false,error:'',coverage:data.coverage||null,stats:data.stats||null,fetchedAt:data.fetchedAt||null,audit:Array.isArray(data.audit)?data.audit:[]})
  }catch(error){ setState({loading:false,error:error.message||'LinkedIn search failed',coverage:null,stats:null,fetchedAt:null,audit:[]}) }
}
  function startProfile(){
    const base=resumeToProfile(profile,cvData)
    const preferences=normalizeSearchPreferences(base)
    setDraft({...base,...preferences,geography:legacyGeographyFromPreferences(preferences.locations,preferences.workModels)})
    setProfileStep(1)
    setProfileRoleState(EMPTY_ROLE_STATE)
    setProfileSaveState({loading:false,error:''})
    setProfileOpen(true)
    setCvState({loadingSlot:null,error:''})
  }

  function closeProfile(){setProfileOpen(false)}

  function applyProfileRoleLibrary({profiles=[],combined={},source='ai',failedCvs=[],totalCount=readyCvs.length,fingerprint=rolesLibraryFingerprint}={}){
    const primaryRoles=roleList(combined.primaryRoles)
    const adjacentRoles=roleList(combined.adjacentRoles)
    const roleSources=Array.isArray(combined.roleSources)?combined.roleSources:[]
    const status=failedCvs.length?'partial':'ready'
    const error=failedCvs.length?`Could not analyse ${failedCvs.map(cv=>`CV ${cv.slot} (${cv.fileName})`).join(' · ')}. Successful CV role directions are preserved.`:''
    setDraft(current=>({...current,primaryRoles,adjacentRoles,roles:combinedRoles(primaryRoles,adjacentRoles),rolesSourceVersion:cvData?.sourceVersion||current.rolesSourceVersion||'',cvRoleProfiles:profiles,roleSources,rolesLibraryFingerprint:fingerprint,rolesBuilderVersion:SEARCH_PROFILE_BUILDER_VERSION}))
    setProfileRoleState({status,error,source,totalCount,analysedCount:profiles.length,failedCvs})
  }

  async function buildProfileRoles({forceCvIds=[]}={}){
    if(!readyCvs.length) return
    const forceSet=new Set(Array.isArray(forceCvIds)?forceCvIds:[])
    const savedProfiles=Array.isArray(profile.cvRoleProfiles)?profile.cvRoleProfiles:[]
    const savedProfilesCurrent=savedProfiles.length===readyCvs.length&&readyCvs.every(cv=>savedProfiles.some(roleProfile=>roleProfile.cvId===cv.id&&roleProfile.sourceVersion===cv.sourceVersion))

    if(!forceSet.size&&profile.savedAt&&profile.rolesLibraryFingerprint===rolesLibraryFingerprint&&savedProfilesCurrent&&roleList(profile.primaryRoles).length){
      const roleSources=Array.isArray(profile.roleSources)?profile.roleSources:combineCvRoleProfiles(savedProfiles).roleSources
      applyProfileRoleLibrary({profiles:savedProfiles,combined:{primaryRoles:profile.primaryRoles,adjacentRoles:profile.adjacentRoles,roleSources},source:'saved'})
      return
    }

    setProfileRoleState({status:'loading',error:'',source:'',totalCount:readyCvs.length,analysedCount:0,failedCvs:[]})
    const profiles=[]
    const failedCvs=[]
    let aiCount=0
    let cacheCount=0

    for(const cv of readyCvs){
      try{
        let roles=forceSet.has(cv.id)?null:readSearchProfileCache({storage:localStorage,sourceVersion:cv.sourceVersion})
        if(roles){
          cacheCount++
        }else{
          roles=await requestSearchProfileRoles({cvText:cv.cvText})
          writeSearchProfileCache({storage:localStorage,sourceVersion:cv.sourceVersion,roles})
          aiCount++
        }
        profiles.push(buildCvRoleProfile(cv,roles))
      }catch(error){
        failedCvs.push({cvId:cv.id,slot:cv.slot,fileName:cv.fileName,error:error.message||'Search Profile generation failed safely.'})
      }
    }

    if(!profiles.length){
      setProfileRoleState({status:'error',error:failedCvs.map(cv=>`CV ${cv.slot}: ${cv.error}`).join(' · ')||'Search Profile generation failed safely. Please try again.',source:'',totalCount:readyCvs.length,analysedCount:0,failedCvs})
      return
    }

    const combined=combineCvRoleProfiles(profiles)
    const source=aiCount&&cacheCount?'mixed':aiCount?'ai':'cache'
    applyProfileRoleLibrary({profiles,combined,source,failedCvs})
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

  async function saveProfile(){
    setProfileSaveState({loading:true,error:''})
    try{
      const primaryRoles=roleList(draft.primaryRoles).length?roleList(draft.primaryRoles):legacyRoles(draft.roles)
      const adjacentRoles=roleList(draft.adjacentRoles)
      const {locations,workModels}=normalizeSearchPreferences(draft)
      const geography=legacyGeographyFromPreferences(locations,workModels)
      const compiledExclusions=await resolveSearchProfileExclusions({storage:localStorage,exclusionsText:draft.exclusions,savedProfile:profile,parse:requestSearchProfileExclusions})
      const exclusions=String(draft.exclusions??'').replace(/\s+/g,' ').trim()
      const saved={...resumeToProfile(draft,cvData),primaryRoles,adjacentRoles,roles:combinedRoles(primaryRoles,adjacentRoles),rolesSourceVersion:cvData?.sourceVersion||draft.rolesSourceVersion||'',cvRoleProfiles:Array.isArray(draft.cvRoleProfiles)?draft.cvRoleProfiles:[],roleSources:Array.isArray(draft.roleSources)?draft.roleSources:[],rolesLibraryFingerprint:draft.rolesLibraryFingerprint||rolesLibraryFingerprint,rolesBuilderVersion:SEARCH_PROFILE_BUILDER_VERSION,unionSearchPlan:draftUnionSearchPlan,unionSearchPlanVersion:UNION_SEARCH_PLAN_VERSION,unionSearchPlanFingerprint:draftUnionSearchPlan.fingerprint,locations,workModels,geography,exclusions,exclusionRules:compiledExclusions.rules,exclusionsFingerprint:compiledExclusions.fingerprint,exclusionsParserVersion:compiledExclusions.parserVersion,exclusionsParsedAt:exclusions?new Date().toISOString():'',savedAt:new Date().toISOString()}
      localStorage.setItem('applypilot-profile',JSON.stringify(saved))
      setProfile(saved)
      setDraft(saved)
      setProfileSaveState({loading:false,error:''})
      setProfileOpen(false)
      setProfileStep(1)
    }catch(error){
      setProfileSaveState({loading:false,error:error.message||'Search Profile exclusions processing failed. Please try again.'})
    }
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