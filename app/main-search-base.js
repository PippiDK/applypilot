'use client'
import { useEffect, useMemo, useState } from 'react'
import {DEFAULT_PROFILE,mergeProfile,resumeToProfile,applicationPackState} from './lib/profile-review.js'
import {SOURCE_CV_STORAGE_KEY,LEGACY_CV_STORAGE_KEY,buildSourceCvRecord,normalizeStoredSourceCv,isSourceCvReady} from './lib/source-cv.js'
import {CV_LIBRARY_STORAGE_KEY,MAX_CVS,createCvLibrary,normalizeCvLibrary,upsertCvSlot,removeCvSlot,getPrimaryCv,readyCvCount} from './lib/cv-library.js'
import {requestSearchProfileRoles,requestSearchProfileExclusions} from './lib/search-profile-client.js'
import {requestNightFlightProfileSync} from './lib/night-flight-profile-client.js'
import {attemptNightFlightProfileSync} from './lib/night-flight-profile-failure.js'
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
import {readAppliedJobs,archiveAppliedJob,syncAppliedArchive} from './lib/applied-jobs.js'
import AppliedJobsArchive from './components/applied-jobs-archive.js'
import {readLinkedInMasterPoolSnapshot,writeLinkedInMasterPool} from './lib/linkedin-master-pool-cache.js'
import {DEFAULT_SEARCH_SOURCES,readSearchSources,writeSearchSources} from './lib/search-sources.js'
import {companyConnection,connectedCompanyNames,defaultCompanyWatch,readCompanyWatch,writeCompanyWatch,TARGET_COMPANIES} from './lib/company-watch.js'
import {CONSULTANT_PORTALS,connectedConsultantPortalIds,defaultConsultantPortals,readConsultantPortals,writeConsultantPortals} from './lib/consultant-portals.js'
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
function jobSourceLabel(job={}){const source=String(job?.source||job?.sourceRecords?.[0]?.source||'').toLowerCase();if(source==='consultant_portal')return `Consultant portal · ${job?.consultantPortal?.name||job?.company||'Consultant'}`;if(source==='company_site')return `Company site · ${job?.company||'Official'}`;if(source==='jobindex')return 'Jobindex';if(source==='jobnet')return 'Jobnet';if(source==='linkedin')return 'LinkedIn';const url=String(job?.originalUrl||'');if(url.includes('jobnet.dk'))return 'Jobnet';if(url.includes('linkedin.com'))return 'LinkedIn';return 'Source'}
function sourceDedupeKey(job={}){const company=String(job.company||'').toLowerCase().replace(/\b(a\/s|as)\b/g,'as').replace(/[.,]/g,'').trim();const title=String(job.title||'').toLowerCase().replace(/\s+/g,' ').trim();const location=String(job.location||'').toLowerCase().replace(/\s+/g,' ').trim();return company&&title?company+'|'+title+'|'+location:''}
function mergeSourceItems(groups=[]){const out=[];const byKey=new Map();for(const item of groups.flat()){const key=sourceDedupeKey(item?.job);if(key&&byKey.has(key)){const index=byKey.get(key);const current=out[index];const currentOfficial=String(current?.job?.source||'')==='company_site';const itemOfficial=String(item?.job?.source||'')==='company_site';if(itemOfficial&&!currentOfficial){out[index]=item;continue}if(currentOfficial&&!itemOfficial)continue;const richer=String(item?.job?.description||item?.job?.fullJd||'').length>String(current?.job?.description||current?.job?.fullJd||'').length?item:current;out[index]=richer;continue}if(key)byKey.set(key,out.length);out.push(item)}return out}

export default function Home(){
  const [freshnessDays,setFreshnessDays]=useState(7)
  const [jobs,setJobs]=useState([])
  const [selectedSources,setSelectedSources]=useState(()=>[...DEFAULT_SEARCH_SOURCES])
  const [companyWatch,setCompanyWatch]=useState(()=>defaultCompanyWatch())
  const [companyWatchOpen,setCompanyWatchOpen]=useState(false)
  const [consultantPortals,setConsultantPortals]=useState(()=>defaultConsultantPortals())
  const [consultantPortalsOpen,setConsultantPortalsOpen]=useState(false)
  const [selectedAreas,setSelectedAreas]=useState(()=>SEARCH_AREAS.map(({id})=>id))
  const [selectedWorkModels,setSelectedWorkModels]=useState(()=>WORK_MODELS.map(({id})=>id))
  const [selectedStatuses,setSelectedStatuses]=useState(()=>[...DEFAULT_JOB_STATUS_FILTERS])
  const allFiltersSelected=SEARCH_AREAS.every(({id})=>selectedAreas.includes(id))&&WORK_MODELS.every(({id})=>selectedWorkModels.includes(id))
  const someFiltersSelected=selectedAreas.length>0||selectedWorkModels.length>0
  const [selected,setSelected]=useState(null)
  const [jobStatuses,setJobStatuses]=useState({})
  const [appliedJobs,setAppliedJobs]=useState([])
  const [appliedArchiveOpen,setAppliedArchiveOpen]=useState(false)
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
  const [nightFlightSyncWarning,setNightFlightSyncWarning]=useState('')
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

      setSelectedSources(readSearchSources(localStorage))
      setCompanyWatch(readCompanyWatch(localStorage))
      setConsultantPortals(readConsultantPortals(localStorage))
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
    setAppliedJobs(readAppliedJobs(localStorage))
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
    const item=jobs.find(candidate=>candidate?.job?.sourceJobId===jobId)
    setJobStatuses(current=>writeJobStatus({storage:localStorage,statuses:current,jobId,status}))
    if(status==='applied'&&item){
      setAppliedJobs(current=>archiveAppliedJob({storage:localStorage,archive:current,job:item.job,evaluation:item.evaluation}))
    }
  }

  function toggleJobFilter(setter,id){
    setter(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id])
  }

  function toggleAllJobFilters(event){
    const checked=event.target.checked
    setSelectedAreas(checked?SEARCH_AREAS.map(({id})=>id):[])
    setSelectedWorkModels(checked?WORK_MODELS.map(({id})=>id):[])
  }

  function toggleSource(source){
    setSelectedSources(current=>{
      const next=current.includes(source)?current.filter(value=>value!==source):[...current,source]
      return writeSearchSources(localStorage,next)
    })
  }

  function toggleCompanyWatchEnabled(){
    setCompanyWatch(current=>writeCompanyWatch(localStorage,{...current,enabled:!current.enabled}))
  }

  function toggleCompany(name){
    setCompanyWatch(current=>{
      const selected=current.selected.includes(name)?current.selected.filter(value=>value!==name):[...current.selected,name]
      return writeCompanyWatch(localStorage,{...current,selected})
    })
  }

  function toggleConsultantPortalsEnabled(){
    setConsultantPortals(current=>writeConsultantPortals(localStorage,{...current,enabled:!current.enabled}))
  }

  function toggleConsultantPortal(id){
    setConsultantPortals(current=>{
      const selected=current.selected.includes(id)?current.selected.filter(value=>value!==id):[...current.selected,id]
      return writeConsultantPortals(localStorage,{...current,selected})
    })
  }

  async function search(){
  if(!resumeLoaded){
    setState({loading:false,error:'Please Upload Your CV',coverage:null,stats:null,fetchedAt:null,audit:[]})
    return
  }
  const activeCompanySites=companyWatch.enabled?companyWatch.selected.filter(name=>connectedCompanyNames().includes(name)):[]
  const activeConsultantPortals=consultantPortals.enabled?consultantPortals.selected.filter(id=>connectedConsultantPortalIds().includes(id)):[]
  if(!selectedSources.length&&!activeCompanySites.length&&!activeConsultantPortals.length){
    setState({loading:false,error:'Select at least one search source.',coverage:null,stats:null,fetchedAt:null,audit:[]})
    return
  }
  setJobs([]); setState({loading:true,error:'',coverage:null,stats:null,fetchedAt:null,audit:[]})
  setShadowState({status:'skipped',error:'',stats:null,coverage:null,comparison:null})
  const hasProfilePlan=Array.isArray(profile?.unionSearchPlan?.directions)&&profile.unionSearchPlan.directions.length>0
  try{
    const tasks=[]

    if(selectedSources.includes('linkedin')) tasks.push((async()=>{
      let res
      if(hasProfilePlan){
        const fingerprint=profile.unionSearchPlanFingerprint||profile.unionSearchPlan?.fingerprint
        const poolSnapshot=readLinkedInMasterPoolSnapshot({storage:localStorage,fingerprint})
        res=await fetch('/api/linkedin-profile-search',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            freshnessDays,
            unionSearchPlan:profile.unionSearchPlan,
            exclusionRules:Array.isArray(profile.exclusionRules)?profile.exclusionRules:[],
            previousCandidates:poolSnapshot.candidates,
            previousVerifiedJobs:poolSnapshot.verifiedJobs,
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
      if(hasProfilePlan&&Array.isArray(data.masterCandidates)){
        writeLinkedInMasterPool({
          storage:localStorage,
          fingerprint:profile.unionSearchPlanFingerprint||profile.unionSearchPlan?.fingerprint,
          candidates:data.masterCandidates,
          verifiedJobs:Array.isArray(data.masterVerifiedJobs)?data.masterVerifiedJobs:[],
        })
      }
      return {source:'linkedin',data}
    })())

    if(selectedSources.includes('jobindex')) tasks.push((async()=>{
      if(!hasProfilePlan) throw new Error('Jobindex requires a saved Search Profile.')
      const res=await fetch('/api/jobindex-profile-search',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          freshnessDays,
          unionSearchPlan:profile.unionSearchPlan,
          exclusionRules:Array.isArray(profile.exclusionRules)?profile.exclusionRules:[],
        }),
      })
      const data=await res.json()
      if(!res.ok) throw new Error(data.error||'Jobindex search failed')
      return {source:'jobindex',data}
    })())

    if(selectedSources.includes('jobnet')) tasks.push((async()=>{
      if(!hasProfilePlan) throw new Error('Jobnet requires a saved Search Profile.')
      const res=await fetch('/api/jobnet-profile-search',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          freshnessDays,
          unionSearchPlan:profile.unionSearchPlan,
          exclusionRules:Array.isArray(profile.exclusionRules)?profile.exclusionRules:[],
        }),
      })
      const data=await res.json()
      if(!res.ok) throw new Error(data.error||'Jobnet search failed')
      return {source:'jobnet',data}
    })())

    if(activeCompanySites.length){
      if(!hasProfilePlan) throw new Error('Company Watch requires a saved Search Profile.')
      const companyChunks=[]
      for(let i=0;i<activeCompanySites.length;i+=4) companyChunks.push(activeCompanySites.slice(i,i+4))
      companyChunks.forEach(companies=>tasks.push((async()=>{
        const res=await fetch('/api/company-profile-search',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            freshnessDays,
            companies,
            unionSearchPlan:profile.unionSearchPlan,
            exclusionRules:Array.isArray(profile.exclusionRules)?profile.exclusionRules:[],
          }),
        })
        const raw=await res.text()
        let data
        try{data=raw?JSON.parse(raw):{}}catch{throw new Error(res.ok?'Company site search returned invalid response':`Company site search failed (HTTP ${res.status})`)}
        if(!res.ok) throw new Error(data.error||`Company site search failed (HTTP ${res.status})`)
        return {source:'company_site',data}
      })()))
    }

    if(activeConsultantPortals.length) tasks.push((async()=>{
      if(!hasProfilePlan) throw new Error('Consultant Portals require a saved Search Profile.')
      const res=await fetch('/api/consultant-profile-search',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          freshnessDays,
          portalIds:activeConsultantPortals,
          unionSearchPlan:profile.unionSearchPlan,
          exclusionRules:Array.isArray(profile.exclusionRules)?profile.exclusionRules:[],
        }),
      })
      const data=await res.json()
      if(!res.ok) throw new Error(data.error||'Consultant portal search failed')
      return {source:'consultant_portal',data}
    })())

    const settled=await Promise.allSettled(tasks)
    const successful=settled.filter(item=>item.status==='fulfilled').map(item=>item.value)
    const failed=settled.filter(item=>item.status==='rejected')
    if(!successful.length) throw failed[0]?.reason||new Error('Search failed')

    const mergedJobs=mergeSourceItems(successful.map(result=>Array.isArray(result.data.jobs)?result.data.jobs:[]))
    setJobs(mergedJobs)
    setAppliedJobs(current=>syncAppliedArchive({storage:localStorage,archive:current,items:mergedJobs,statuses:jobStatuses}))

    const stats={
      masterPoolSize:successful.reduce((sum,result)=>sum+Number(result.data.stats?.masterPoolSize??result.data.stats?.discovered??0),0),
      fullJdVerified:successful.reduce((sum,result)=>sum+Number(result.data.stats?.fullJdVerified??0),0),
      returned:mergedJobs.length,
    }
    const audit=successful.flatMap(result=>(Array.isArray(result.data.audit)?result.data.audit:[]).map(row=>({...row,source:result.source})))
    const limited=failed.length>0||successful.some(result=>result.data.coverage?.status==='ACCESS LIMITED')
    setState({
      loading:false,
      error:'',
      coverage:{source:[...selectedSources,...(activeCompanySites.length?['company-sites']:[]),...(activeConsultantPortals.length?['consultant-portals']:[])].join('+'),freshnessDays,status:limited?'ACCESS LIMITED':mergedJobs.length?'SEARCHED':'NO RELEVANT RESULTS',detail:failed[0]?.reason?.message||null},
      stats,
      fetchedAt:new Date().toISOString(),
      audit,
    })
  }catch(error){ setState({loading:false,error:error.message||'Search failed',coverage:null,stats:null,fetchedAt:null,audit:[]}) }
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
      const syncResult=await attemptNightFlightProfileSync({sync:requestNightFlightProfileSync,searchProfile:saved,cv:cvData?{text:cvData.cvText,sourceVersion:cvData.sourceVersion}:null})
      setNightFlightSyncWarning(syncResult.stale?syncResult.error:'')
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
      writeExpertiseMatchCache({...cacheArgs,analysis})
      setExpertiseState({loading:false,error:'',analysis,jobKey:runKey})
    }catch(error){
      setExpertiseState({loading:false,error:error.message||'Expertise Match analysis failed safely. Please try again.',analysis:null,jobKey:runKey})
    }
  }

  function chooseAdaptationCv(cv){
    if(!active||!jobKey||!cv) return
    const baseline=buildAdaptationBaseline({job:active.job,cv})
    setAdaptationSelections(current=>selectAdaptationCv(current,{jobKey,cvId:cv.id,readyCvs}))
    setAdaptationBaselines(current=>({...current,[jobKey]:baseline}))
    setAdaptationRun({loading:false,error:'',jobKey:'',baselineKey:''})
    setExportState({loading:false,error:'',baselineKey:''})
    setReviewOpen(false)
  }

  async function runCvAdaptationReview(){
    if(!active||!activeAdaptationBaseline||adaptationRun.loading||currentAdaptationResult) return
    const runJobKey=jobKey
    const runBaseline=activeAdaptationBaseline
    const runBaselineKey=baselineKey(runBaseline)
    setReviewOpen(true)
    setAdaptationRun({loading:true,error:'',jobKey:runJobKey,baselineKey:runBaselineKey})
    try{
      const result=await requestCvAdaptation({baseline:runBaseline,job:active.job})
      setAdaptationResults(current=>({...current,[runBaselineKey]:result}))
      setAdaptationRun({loading:false,error:'',jobKey:runJobKey,baselineKey:runBaselineKey})
    }catch(error){
      setAdaptationRun({loading:false,error:error.message||'CV adaptation failed safely. Please try again.',jobKey:runJobKey,baselineKey:runBaselineKey})
    }
  }

  function decisionIdentity(blockId){
    if(!activeAdaptationBaseline) return null
    return {jobId:activeAdaptationBaseline.jobId,cvId:activeAdaptationBaseline.cvId,sourceVersion:activeAdaptationBaseline.sourceVersion,blockId}
  }

  function decisionFor(blockId){
    const identity=decisionIdentity(blockId)
    return identity?readAdaptationDecision(decisions,identity):null
  }

  function editedUpdateKey(blockId){
    return activeBaselineKey&&blockId?`${activeBaselineKey}|${blockId}`:''
  }

  function editedUpdateFor(change){
    const key=editedUpdateKey(change?.blockId)
    return key&&Object.prototype.hasOwnProperty.call(editedUpdates,key)?editedUpdates[key]:change?.updated||''
  }

  function setEditedUpdate(blockId,value){
    const key=editedUpdateKey(blockId)
    if(!key) return
    setEditedUpdates(current=>({...current,[key]:value}))
  }

  function setDecision(blockId,value){
    const identity=decisionIdentity(blockId)
    if(!identity) return
    setDecisions(current=>setAdaptationDecision(current,identity,value))
  }

  function acceptAll(){
    if(!activeAdaptationBaseline) return
    setDecisions(current=>reviewChanges.reduce((next,change)=>setAdaptationDecision(next,decisionIdentity(change.blockId),ADAPTATION_DECISION.ACCEPTED),current))
  }

  function attachSourceDocx(file){
    if(!file||!activeAdaptationBaseline) return
    if(!String(file.name||'').toLowerCase().endsWith('.docx')){ setExportState({loading:false,error:'Please choose the matching source DOCX file.',baselineKey:activeBaselineKey}); return }
    setSourceDocxFiles(current=>({...current,[activeAdaptationBaseline.sourceVersion]:file}))
    setExportState({loading:false,error:'',baselineKey:activeBaselineKey})
  }

  async function downloadTailoredCv(){
    if(!active||!activeAdaptationBaseline||!selectedSourceDocx||!allReviewDecisionsMade||exportState.loading) return
    const replacements=reviewChanges
      .filter(change=>decisionFor(change.blockId)===ADAPTATION_DECISION.ACCEPTED)
      .map(change=>({blockId:change.blockId,originalText:change.original,newText:editedUpdateFor(change)}))
    const company=String(active.job.company||'tailored').replace(/[^a-z0-9]+/gi,'_').replace(/^_+|_+$/g,'')||'tailored'
    const base=String(activeAdaptationBaseline.fileName||'CV').replace(/\.docx$/i,'')
    const outputName=`${base}_${company}_TAILORED.docx`
    setExportState({loading:true,error:'',baselineKey:activeBaselineKey})
    try{
      const form=new FormData()
      form.append('file',selectedSourceDocx)
      form.append('replacements',JSON.stringify(replacements))
      form.append('outputName',outputName)
      const res=await fetch('/api/export-tailored-cv',{method:'POST',body:form})
      if(!res.ok){
        let message='Tailored DOCX could not be created.'
        try{const data=await res.json();message=data.error||message}catch{}
        throw new Error(message)
      }
      const blob=await res.blob()
      const url=URL.createObjectURL(blob)
      const anchor=document.createElement('a')
      anchor.href=url
      anchor.download=outputName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setExportState({loading:false,error:'',baselineKey:activeBaselineKey})
    }catch(error){
      setExportState({loading:false,error:error.message||'Tailored DOCX could not be created.',baselineKey:activeBaselineKey})
    }
  }

  return <main>
    <header><div><div className="brand">ApplyPilot</div><div className="tag">Search less. Apply better.</div></div><div className="headerActions"><div className={`sourceBadge profileStatus ${resumeLoaded?'statusReady':'statusEmpty'}`}>{resumeLoaded?'Profile ready':'Profile empty'}</div><div className="sourceBadge">MULTI-SOURCE + COMPANY WATCH · TEST</div></div></header>

    <section className="hero">
      <div><p className="eyebrow">MULTI-SOURCE · END-TO-END</p><h1>Find the right roles for your Search Profile in Denmark.</h1><p>Search Profile → selected sources → full job description → worthwhile matches only.</p></div>
      <div className="metric"><b>{state.loading?'…':jobs.length}</b><span>matches</span></div>
    </section>

    <div className="profileStrip"><span className="profileSearchSummary">{profileSearchPlanSummary}</span><button className="profileEditButton" onClick={startProfile}>{profileReady?'Edit profile':'Search profile'}</button><button className="cvButton" onClick={startProfile}>{cvReadyCount?`✓ CVs ${cvReadyCount}/${MAX_CVS}`:'Upload CVs'}</button></div>

    {nightFlightSyncWarning&&<div className="warningBox"><b>Night Flight backend is not synced</b><span>{nightFlightSyncWarning}</span></div>}

    <section className="controls">
      <div><small>POSTED WITHIN</small><div className="choices">{WINDOWS.map(days=><button key={days} className={freshnessDays===days?'choice selected':'choice'} onClick={()=>setFreshnessDays(days)}>{days} day{days===1?'':'s'}</button>)}</div></div>
      <div><small>SEARCH SOURCES</small><div className="choices"><label className="choice"><input type="checkbox" checked={selectedSources.includes('linkedin')} onChange={()=>toggleSource('linkedin')}/> LinkedIn</label><label className="choice"><input type="checkbox" checked={selectedSources.includes('jobindex')} onChange={()=>toggleSource('jobindex')}/> Jobindex</label><label className="choice"><input type="checkbox" checked={selectedSources.includes('jobnet')} onChange={()=>toggleSource('jobnet')}/> Jobnet</label></div></div>
      <button className="primary" onClick={search} disabled={state.loading}>{state.loading?'Searching…':'Search'}</button>
    </section>

    <section className="companyWatch">
      <div className="companyWatchMain">
        <label className="companyWatchToggle"><input type="checkbox" checked={companyWatch.enabled} onChange={toggleCompanyWatchEnabled}/><span><small>DIRECT COMPANY WATCH</small><b>Company career sites</b></span></label>
        <div className="companyWatchActions"><span>{companyWatch.selected.length} companies selected</span><button className="secondary companyManage" onClick={()=>setCompanyWatchOpen(open=>!open)}>{companyWatchOpen?'Close':'Manage'}</button></div>
      </div>
      {companyWatchOpen&&<div className="companyWatchList">
        {TARGET_COMPANIES.map(name=>{const connection=companyConnection(name);return <label key={name}><input type="checkbox" checked={companyWatch.selected.includes(name)} onChange={()=>toggleCompany(name)}/><span>{name}</span><small className={connection.status==='connected'?'ready':''}>{connection.status==='connected'?('Connected · '+connection.connector):'Connection pending'}</small></label>})}
      </div>}
    </section>

    <section className="companyWatch consultantPortals">
      <div className="companyWatchMain">
        <label className="companyWatchToggle"><input type="checkbox" checked={consultantPortals.enabled} onChange={toggleConsultantPortalsEnabled}/><span><small>CONSULTANT PORTALS</small><b>Freelance & consulting assignments</b></span></label>
        <div className="companyWatchActions"><span>{consultantPortals.selected.length} portals selected</span><button className="secondary companyManage" onClick={()=>setConsultantPortalsOpen(open=>!open)}>{consultantPortalsOpen?'Close':'Manage'}</button></div>
      </div>
      {consultantPortalsOpen&&<div className="companyWatchList consultantPortalList">
        {CONSULTANT_PORTALS.map(portal=><label key={portal.id}><input type="checkbox" checked={consultantPortals.selected.includes(portal.id)} onChange={()=>toggleConsultantPortal(portal.id)}/><span>{portal.name}</span><small className={portal.status==='connected'?'ready':''}>{portal.status==='connected'?('Connected · '+portal.connector):'Connection pending'}</small></label>)}
      </div>}
    </section>

    {state.error&&<div className="errorBox"><b>{state.error==='Please Upload Your CV'?'Please Upload Your CV':'Search failed'}</b>{state.error!=='Please Upload Your CV'&&<span>{state.error}</span>}</div>}
    {state.stats&&<div className="searchMeta"><span><b>{state.stats.masterPoolSize??state.stats.discovered}</b> jobs discovered</span><span><b>{state.stats.fullJdVerified}</b> full JDs read</span><span><b>{state.stats.returned??jobs.length}</b> worthwhile after evaluation</span><span>Coverage: <b>{state.coverage?.status}</b></span></div>}
    {state.coverage?.detail&&<div className="warningBox">Partial source access: {state.coverage.detail}</div>}

    <section className="grid">
      <div className="list">
        <div className="listHead"><div><h2>Live matches</h2>{jobs.length>0&&<small className={filterStyles.resultCount}>{visibleJobs.length} of {jobs.length}</small>}</div><small>Newest {freshnessDays} days</small></div>
        {jobs.length>0&&<details className={filterStyles.filters}>
          <summary><span>FILTERS</span><span>{visibleJobs.length} of {jobs.length}</span></summary>
          <div className={filterStyles.body}>
            <label className={filterStyles.option}><input type="checkbox" checked={allFiltersSelected} ref={node=>{if(node)node.indeterminate=someFiltersSelected&&!allFiltersSelected}} onChange={toggleAllJobFilters}/><span>All filters</span><b></b></label>
            <div className={filterStyles.group}><small className={filterStyles.groupTitle}>SEARCH AREAS</small>{SEARCH_AREAS.map(area=><label className={filterStyles.option} key={area.id}><input type="checkbox" checked={selectedAreas.includes(area.id)} onChange={()=>toggleJobFilter(setSelectedAreas,area.id)}/><span>{area.label}</span><b>{areaCounts[area.id]||0}</b></label>)}</div>
            <div className={filterStyles.group}><small className={filterStyles.groupTitle}>WORK MODEL</small>{WORK_MODELS.map(model=><label className={filterStyles.option} key={model.id}><input type="checkbox" checked={selectedWorkModels.includes(model.id)} onChange={()=>toggleJobFilter(setSelectedWorkModels,model.id)}/><span>{model.label}</span><b>{workModelCounts[model.id]||0}</b></label>)}</div>
            <div className={filterStyles.group}><small className={filterStyles.groupTitle}>STATUS</small>{JOB_STATUS_FILTERS.map(status=><label className={filterStyles.option} key={status.id}><input type="checkbox" checked={selectedStatuses.includes(status.id)} onChange={()=>toggleJobFilter(setSelectedStatuses,status.id)}/><span>{status.label}</span><b>{statusCounts[status.id]||0}</b></label>)}</div>
          </div>
        </details>}
        {!state.loading&&!state.error&&!state.stats&&<div className="empty">Run search to find matching vacancies from the selected sources.</div>}
        {state.loading&&<div className="empty">Searching selected sources and reading full job descriptions…</div>}
        {!state.loading&&state.stats&&jobs.length===0&&<div className="empty">NO STRONG NEW MATCHES FOUND.</div>}
        {!state.loading&&state.stats&&jobs.length>0&&visibleJobs.length===0&&<div className="empty">NO MATCHES IN SELECTED FILTERS.</div>}
        {visibleJobs.map(item=>{const {job,evaluation}=item; const score=Math.round(evaluation.score*10); const manualStatus=jobStatuses[job.sourceJobId]||''; return <div className="jobWrap" key={job.sourceJobId}>
          <button onClick={()=>setSelected(item)} className={'job '+(active?.job.sourceJobId===job.sourceJobId?'active':'')}>
            <span className="score">{fitLabel(score)}</span>
            <span><b>{job.title}</b><small>{job.company} · {job.location}</small><small className="sourceLine">{jobSourceLabel(job)} · {dateText(job.publishedAt)}</small></span>
            <span>→</span>
          </button>
          <select aria-label={`Status for ${job.title}`} className={`jobStatusSelect status-${manualStatus||'none'}`} value={manualStatus} onChange={event=>changeJobStatus(job.sourceJobId,event.target.value)}>
            {JOB_STATUS_OPTIONS.map(option=><option key={option.value||'none'} value={option.value}>{option.label}</option>)}
          </select>
        </div>})}
      </div>

      <div className="panel">
        {active?(()=>{const {job}=active; const expertise=expertiseState.jobKey===jobKey?expertiseState.analysis:null; return <>
          <div className="panelTop expertiseHeader"><div><h2>{job.title}</h2><p>{job.company} · {job.location}</p><small className="sourceLine">Source: {jobSourceLabel(job)} · {dateText(job.publishedAt)}</small></div></div>

          <div className="conditionGrid">
            <div className="conditionCard"><small>Area</small><b>{conditionScore(jobConditions?.area.score)}</b><span>{jobConditions?.area.value||'Not stated'}</span></div>
            <div className="conditionCard"><small>Salary</small><b>{conditionScore(jobConditions?.salary.score)}</b><span>{jobConditions?.salary.value||'Not stated'}</span></div>
            <div className="conditionCard"><small>Employment type</small><b>{conditionScore(jobConditions?.employmentType.score)}</b><span>{jobConditions?.employmentType.value||'Not stated'}</span></div>
            <div className="conditionCard"><small>Work model</small><b>{conditionScore(jobConditions?.workModel.score)}</b><span>{jobConditions?.workModel.value||'Not stated'}</span></div>
            <a className="secondary openLink" style={{gridColumn:'1 / -1',justifySelf:'start'}} href={job.originalUrl||job.detailUrl||job.applicationUrl} target="_blank" rel="noreferrer">Open vacancy</a>
          </div>

          <BestCvPanel
            job={job}
            cvLibrary={cvLibrary}
            selectedCvId={activeAdaptationBaseline?.cvId||''}
            onSelectCv={chooseAdaptationCv}
            adaptationActions={<div className="actions reviewActions">
              <button className="primary" onClick={runCvAdaptationReview} disabled={!activeAdaptationBaseline||adaptationRun.loading||Boolean(currentAdaptationResult)}>{adaptationRun.loading&&adaptationRun.jobKey===jobKey?'Generating…':currentAdaptationResult?'Generated':'Generate CV update'}</button>
              <button className="secondary" onClick={()=>setReviewOpen(true)} disabled={!currentAdaptationResult}>View CV update</button>
              {job.officialUrl&&<a className="secondary openLink" href={job.officialUrl} target="_blank" rel="noreferrer">Employer link</a>}
            </div>}
          />

          <div className="expertiseHero">
            <div className="expertiseHeroHead"><div><p className="eyebrow">EXPERTISE MATCH</p><p className="expertiseIntro">Full JD ↔ Source CV professional expertise only</p></div><div className="expertiseScore">{expertiseState.loading&&expertiseState.jobKey===jobKey?'…':expertise?`${expertise.expertiseMatch}%`:'N/A'}</div></div>
            {expertiseState.loading&&expertiseState.jobKey===jobKey&&<div className="expertiseLoading">Analysing professional requirements and Source CV evidence…</div>}
            {expertiseState.error&&expertiseState.jobKey===jobKey&&<div className="errorBox"><b>Expertise Match analysis failed safely</b><span>{expertiseState.error}</span></div>}
            {!expertise&&!expertiseState.loading&&<button className="primary" onClick={runExpertiseMatch}>Run Expertise Match</button>}
            {expertise&&<>
              <div className="expertiseSection"><h3>Why you fit</h3>{expertise.whyYouFit.length?expertise.whyYouFit.map((item,index)=><p key={index}>✓ {item}</p>):<p className="muted">No direct professional match evidence returned.</p>}</div>
              {expertise.transferableStrengths?.length>0&&<div className="expertiseSection"><h3>Transferable strengths</h3>{expertise.transferableStrengths.map((item,index)=><p key={index}>↔ {item}</p>)}</div>}
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


          <div className="section"><h3>Application pack</h3><div className="docs"><div>{pack.cvReady?'✓':'○'} Tailored CV <span className={pack.cvReady?'ready':'pending'}>{pack.tailoredCvLabel}</span></div><div>○ Cover letter <span className="pending">{pack.coverLetterLabel}</span></div></div></div>
        </>})():<div className="emptyPanel"><h2>No selected vacancy</h2><p>{state.loading?'Searching LinkedIn public pages…':'Run the LinkedIn search to see matching vacancies.'}</p></div>}
      </div>
    </section>

    {(state.audit.length>0||(shadowState.status!=='idle'&&shadowState.status!=='skipped'))&&<section className="auditLog">
      <div className="auditLogTitle">AUDIT LOG</div>
      <SearchAudit audit={state.audit}/>
      <ShadowSearchAudit shadowState={shadowState}/>
    </section>}

    <AppliedJobsArchive jobs={appliedJobs} open={appliedArchiveOpen} onOpen={()=>setAppliedArchiveOpen(true)} onClose={()=>setAppliedArchiveOpen(false)}/>

    <footer>TEST · LinkedIn + Jobindex + Jobnet multi-source search</footer>

    {profileOpen&&<div className="overlay" onMouseDown={event=>{if(event.target===event.currentTarget&&!profileSaveState.loading)closeProfile()}}><div className="modal profileModal">
      <div className="modalHead"><div><p className="eyebrow">BUILD YOUR SEARCH AGENT</p><h2>Search profile</h2></div><button className="close" onClick={closeProfile} disabled={profileSaveState.loading}>×</button></div>
      <div className="progress"><span style={{width:`${profileStep/4*100}%`}}></span></div><div className="stepMeta"><span>Step {profileStep} of 4</span><span>{profileCompletion}% profile data</span></div>
      {profileStep===1&&<CvLibraryStep library={cvLibrary} loadingSlot={cvState.loadingSlot} error={cvState.error} primarySkills={draft.skills} onUpload={parseCv} onRemove={removeCv}/>} 
      {profileStep===2&&<SearchProfileRolesStep primaryRoles={draftPrimaryRoles} adjacentRoles={draftAdjacentRoles} status={profileRoleState.status} error={profileRoleState.error} source={profileRoleState.source} totalCount={profileRoleState.totalCount||cvReadyCount} analysedCount={profileRoleState.analysedCount} failedCvs={profileRoleState.failedCvs} onPrimaryChange={roles=>updateDraftRoles('primaryRoles',roles)} onAdjacentChange={roles=>updateDraftRoles('adjacentRoles',roles)} onRetry={()=>buildProfileRoles({forceCvIds:(profileRoleState.failedCvs||[]).map(cv=>cv.cvId)})}/>} 
      {profileStep===3&&<div className="wizard"><h3>What should ApplyPilot exclude?</h3><p>Optional. Write any hard no-go roles, industries, languages or working conditions. ApplyPilot interprets this text only when you save the profile.</p><textarea value={draft.exclusions} onChange={event=>setDraft(current=>({...current,exclusions:event.target.value}))} rows="6"/></div>}
      {profileStep===4&&<div className="wizard review"><h3>Confirm your search profile</h3><p>This saves your Search Profile and activates profile-driven LinkedIn discovery for future searches.</p><div className="reviewRow"><span>CV library</span><b>{readyCvs.length?readyCvs.map(cv=>`CV ${cv.slot} · ${cv.fileName}`).join(' · '):'No CVs uploaded'}</b></div><div className="reviewRow"><span>CV preparation</span><b>{cvReadyCount?`Ready — ${cvReadyCount} complete Source CV${cvReadyCount===1?'':'s'} prepared`:'CV not ready'}</b></div><div className="reviewRow"><span>Role profiles</span><b>{cvReadyCount?`${analysedRoleProfileCount}/${cvReadyCount} CVs analysed`:'Not generated'}</b></div><div className="reviewRow"><span>Target roles</span><b>{draft.roles||'Not set'}</b></div><div className="reviewRow"><span>Exclude</span><b>{draft.exclusions||'None'}</b></div><SearchPlanPreview plan={draftUnionSearchPlan}/>{profileSaveState.error&&<div className="errorBox"><b>Search Profile save failed</b><span>{profileSaveState.error}</span></div>}<div className="truth"><b>Truth rule</b><span>ApplyPilot may rephrase verified experience, but may never invent skills, achievements, employers or responsibilities.</span></div></div>}
      <div className="modalActions"><button className="secondary" disabled={profileSaveState.loading} onClick={()=>profileStep===1?closeProfile():setProfileStep(step=>step-1)}>{profileStep===1?'Cancel':'Back'}</button>{profileStep<4?<button className="primary" disabled={(profileStep===1&&(Boolean(cvState.loadingSlot)||cvReadyCount===0))||(profileStep===2&&profileRoleState.status==='loading')} onClick={nextProfileStep}>Continue</button>:<button className="primary" disabled={profileSaveState.loading} onClick={saveProfile}>{profileSaveState.loading?'Saving profile…':'Save profile'}</button>}</div>
    </div></div>}

    {reviewOpen&&active&&activeAdaptationBaseline&&<div className="overlay" onMouseDown={event=>{if(event.target===event.currentTarget&&!adaptationRun.loading)setReviewOpen(false)}}><div className="modal reviewModal"><div className="modalHead"><div><p className="eyebrow">CV UPDATE REVIEW</p><h2>{active.job.title}</h2><p className="muted">{active.job.company} · {active.job.location}</p><p className="reviewBaseline">CV {selectedAdaptationCvRecord?.slot} · {activeAdaptationBaseline.fileName}</p></div><button className="close" onClick={()=>setReviewOpen(false)} disabled={adaptationRun.loading}>×</button></div>
      <div className="reviewScopeLine">Professional Summary · Latest role overview · Previous role overview</div>
      {adaptationRun.loading&&adaptationRun.jobKey===jobKey&&adaptationRun.baselineKey===activeBaselineKey&&<div className="adaptationLoading"><b>Adapting selected CV…</b><span>Selected CV + JD → three AI updates.</span></div>}
      {adaptationRun.error&&adaptationRun.jobKey===jobKey&&adaptationRun.baselineKey===activeBaselineKey&&<div className="errorBox"><b>CV adaptation failed safely</b><span>{adaptationRun.error}</span></div>}
      {currentAdaptationResult&&<>
        <div className="adaptationRunStatus"><b>✓ Adaptation complete</b><span>{reviewChanges.length} change{reviewChanges.length===1?'':'s'} available for review · {reviewedCount}/{reviewChanges.length} decided</span></div>
        <div className="reviewToolbar"><div><h3>Selected-CV changes</h3><p>AI UPDATED text is shown directly. Source CV remains unchanged.</p></div>{reviewChanges.length>0&&<button className="secondary" onClick={acceptAll}>Accept all changes</button>}</div>
        {reviewChanges.map(change=>{const decision=decisionFor(change.blockId);return <div className={'changeCard '+(decision?'decided':'')} key={change.blockId}>
          <div className="changeHead"><span>{change.label}</span><b>{decision===ADAPTATION_DECISION.ACCEPTED?'Accepted':decision===ADAPTATION_DECISION.ORIGINAL?'Original kept':'Review needed'}</b></div>
          <div className="compareGrid"><div className="compareBox"><small>ORIGINAL</small><p>{change.original}</p></div><div className="compareArrow">→</div><div className="compareBox updatedBox"><small>UPDATED · EDITABLE</small><textarea className="updatedTextEditor" value={editedUpdateFor(change)} onChange={event=>setEditedUpdate(change.blockId,event.target.value)} rows="8"/></div></div>
          <div className="changeWhy"><div><small>WHY CHANGED</small><p>{change.why}</p></div></div>
          <div className="evidenceActions"><button className={'secondary '+(decision===ADAPTATION_DECISION.ORIGINAL?'chosen':'')} onClick={()=>setDecision(change.blockId,ADAPTATION_DECISION.ORIGINAL)}>{decision===ADAPTATION_DECISION.ORIGINAL?'✓ Original kept':'Keep original'}</button><button className={'primary smallPrimary '+(decision===ADAPTATION_DECISION.ACCEPTED?'chosenPrimary':'')} onClick={()=>setDecision(change.blockId,ADAPTATION_DECISION.ACCEPTED)}>{decision===ADAPTATION_DECISION.ACCEPTED?'✓ Accepted':'Accept change'}</button></div>
        </div>})}
        {!reviewChanges.length&&<div className="reviewEmpty"><b>No changes to review.</b><span>AI returned no changed block. The selected Source CV remains unchanged.</span></div>}
      </>}
      {exportState.error&&exportState.baselineKey===activeBaselineKey&&<div className="errorBox"><b>DOCX update failed</b><span>{exportState.error}</span></div>}
      <div className="reviewFooter"><button className="secondary" onClick={()=>setReviewOpen(false)} disabled={adaptationRun.loading||exportState.loading}>Close review</button>{allReviewDecisionsMade&&(selectedSourceDocx?<button className="primary" onClick={downloadTailoredCv} disabled={exportState.loading}>{exportState.loading?'Creating DOCX…':'Download tailored DOCX'}</button>:<label className="secondary">Re-upload source DOCX<input type="file" accept=".docx" hidden onChange={event=>{const file=event.target.files?.[0];if(file)attachSourceDocx(file);event.target.value=''}}/></label>)}</div>
    </div></div>}
  </main>
}