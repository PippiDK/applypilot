import {readFileSync,writeFileSync} from 'node:fs'

const pagePath='app/page.js'
const cssPath='app/globals.css'
let page=readFileSync(pagePath,'utf8')
let css=readFileSync(cssPath,'utf8')

function replaceExact(oldText,newText,label){
  if(!page.includes(oldText)) throw new Error(`M4.11 patch failed: ${label} anchor not found`)
  page=page.replace(oldText,newText)
}

replaceExact(
  "import {DEFAULT_PROFILE,mergeProfile,resumeToProfile,buildReviewChanges,deriveReviewTerms,applicationPackState} from './lib/profile-review.js'",
  "import {DEFAULT_PROFILE,mergeProfile,resumeToProfile,applicationPackState} from './lib/profile-review.js'",
  'profile review import'
)
replaceExact(
  "import {requestJobAnalysis} from './lib/jd-analysis-client.js'\nimport {readJobAnalysisCache,writeJobAnalysisCache} from './lib/job-analysis-cache.js'",
  "import {selectAdaptationCv,selectedAdaptationCv} from './lib/cv-adaptation-selection.js'\nimport {buildAdaptationBaseline,baselineKey,baselineMatches} from './lib/cv-adaptation-baseline.js'\nimport {requestTruthGuard} from './lib/cv-adaptation-client.js'\nimport {ADAPTATION_DECISION,readAdaptationDecision,setAdaptationDecision,safeAdaptationReviewBlocks} from './lib/cv-adaptation-decisions.js'",
  'adaptation imports'
)

replaceExact(
`  const [reviewOpen,setReviewOpen]=useState(false)
  const [jdAnalysisState,setJdAnalysisState]=useState({loading:false,error:'',analysis:null,token:'',jobKey:''})
  const [expertiseState,setExpertiseState]=useState({loading:false,error:'',analysis:null,jobKey:''})
  const [decisions,setDecisions]=useState({})`,
`  const [reviewOpen,setReviewOpen]=useState(false)
  const [adaptationSelections,setAdaptationSelections]=useState({})
  const [adaptationBaselines,setAdaptationBaselines]=useState({})
  const [adaptationRun,setAdaptationRun]=useState({loading:false,error:'',jobKey:'',baselineKey:'',result:null})
  const [expertiseState,setExpertiseState]=useState({loading:false,error:'',analysis:null,jobKey:''})
  const [decisions,setDecisions]=useState({})`,
  'M4.11 state'
)

replaceExact(
`  const pack=applicationPackState(resumeLoaded?cvData:null)
  const reviewFacts=useMemo(()=>Array.isArray(cvData?.facts)?cvData.facts.filter(f=>f&&f.verified!==false):[],[cvData])
  const proposedChanges=useMemo(()=>resumeLoaded&&active?buildReviewChanges(cvData,active):[],[cvData,active,resumeLoaded])
  const alignedTerms=useMemo(()=>active?deriveReviewTerms(active):[],[active])
  const jobKey=active?.job?.sourceJobId||''
  const conditionProfile=useMemo(()=>({...profile,acceptedWorkModels:acceptedWorkModels(profile.geography)}),[profile])
  const jobConditions=useMemo(()=>active?evaluateJobConditions(active.job,conditionProfile):null,[active,conditionProfile])
  const reviewedCount=proposedChanges.filter(change=>decisions[\`${'${jobKey}'}|${'${change.id}'}\`]).length`,
`  const pack=applicationPackState(resumeLoaded?cvData:null)
  const jobKey=active?.job?.sourceJobId||''
  const selectedAdaptationCvRecord=selectedAdaptationCv(adaptationSelections,jobKey,readyCvs)
  const storedAdaptationBaseline=adaptationBaselines[jobKey]||null
  const activeAdaptationBaseline=storedAdaptationBaseline&&selectedAdaptationCvRecord&&baselineMatches({baseline:storedAdaptationBaseline,job:active?.job,cv:selectedAdaptationCvRecord})?storedAdaptationBaseline:null
  const activeBaselineKey=activeAdaptationBaseline?baselineKey(activeAdaptationBaseline):''
  const currentAdaptationResult=adaptationRun.jobKey===jobKey&&adaptationRun.baselineKey===activeBaselineKey?adaptationRun.result:null
  const reviewChanges=safeAdaptationReviewBlocks({blocks:currentAdaptationResult?.blocks,truthGuard:currentAdaptationResult?.truthGuard})
  const conditionProfile=useMemo(()=>({...profile,acceptedWorkModels:acceptedWorkModels(profile.geography)}),[profile])
  const jobConditions=useMemo(()=>active?evaluateJobConditions(active.job,conditionProfile):null,[active,conditionProfile])
  const reviewedCount=activeAdaptationBaseline?reviewChanges.filter(change=>readAdaptationDecision(decisions,{jobId:activeAdaptationBaseline.jobId,cvId:activeAdaptationBaseline.cvId,sourceVersion:activeAdaptationBaseline.sourceVersion,blockId:change.blockId})).length:0`,
  'M4.11 derived review state'
)

const runStart=page.indexOf('  async function runJobAnalysis(){')
const runEnd=page.indexOf('\n\n  return <main>',runStart)
if(runStart<0||runEnd<0) throw new Error('M4.11 patch failed: legacy review functions not found')
const newFunctions=`  function chooseAdaptationCv(cv){
    if(!active||!jobKey||!cv) return
    const baseline=buildAdaptationBaseline({job:active.job,cv})
    setAdaptationSelections(current=>selectAdaptationCv(current,{jobKey,cvId:cv.id,readyCvs}))
    setAdaptationBaselines(current=>({...current,[jobKey]:baseline}))
    setAdaptationRun({loading:false,error:'',jobKey:'',baselineKey:'',result:null})
    setReviewOpen(false)
  }

  async function runCvAdaptationReview(){
    if(!active||!activeAdaptationBaseline||adaptationRun.loading) return
    const runJobKey=jobKey
    const runBaseline=activeAdaptationBaseline
    const runBaselineKey=baselineKey(runBaseline)
    setReviewOpen(true)
    setAdaptationRun({loading:true,error:'',jobKey:runJobKey,baselineKey:runBaselineKey,result:null})
    try{
      const result=await requestTruthGuard({baseline:runBaseline,job:active.job})
      setAdaptationRun({loading:false,error:'',jobKey:runJobKey,baselineKey:runBaselineKey,result})
    }catch(error){
      setAdaptationRun({loading:false,error:error.message||'CV adaptation failed safely. Please try again.',jobKey:runJobKey,baselineKey:runBaselineKey,result:null})
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

  function setDecision(blockId,value){
    const identity=decisionIdentity(blockId)
    if(!identity) return
    setDecisions(current=>setAdaptationDecision(current,identity,value))
  }

  function acceptAll(){
    if(!activeAdaptationBaseline) return
    setDecisions(current=>reviewChanges.reduce((next,change)=>setAdaptationDecision(next,decisionIdentity(change.blockId),ADAPTATION_DECISION.ACCEPTED),current))
  }`
page=page.slice(0,runStart)+newFunctions+page.slice(runEnd)

replaceExact(
  '<BestCvPanel job={job} cvLibrary={cvLibrary}/>',
  '<BestCvPanel job={job} cvLibrary={cvLibrary} selectedCvId={activeAdaptationBaseline?.cvId||\'\'} onSelectCv={chooseAdaptationCv}/>',
  'BestCvPanel controlled selection'
)

const actionsPattern=/<div className="actions reviewActions">.*?<\/div>/s
if(!actionsPattern.test(page)) throw new Error('M4.11 patch failed: application actions not found')
page=page.replace(actionsPattern,`<div className="actions reviewActions">{pack.cvReady?<button className="primary" onClick={runCvAdaptationReview} disabled={!activeAdaptationBaseline||adaptationRun.loading}>{adaptationRun.loading&&adaptationRun.jobKey===jobKey?'Adapting CV…':activeAdaptationBaseline?'Adapt & review CV':'Choose CV to adapt'}</button>:<button className="primary" onClick={startProfile}>Upload CV</button>}<a className="secondary openLink" href={job.originalUrl} target="_blank" rel="noreferrer">Open LinkedIn vacancy</a>{job.officialUrl&&<a className="secondary openLink" href={job.officialUrl} target="_blank" rel="noreferrer">Employer link</a>}</div>`)

const modalStart=page.indexOf('    {reviewOpen&&active&&<div className="overlay"')
const mainEnd=page.indexOf('\n  </main>',modalStart)
if(modalStart<0||mainEnd<0) throw new Error('M4.11 patch failed: legacy review modal not found')
const newModal=`    {reviewOpen&&active&&activeAdaptationBaseline&&<div className="overlay" onMouseDown={event=>{if(event.target===event.currentTarget&&!adaptationRun.loading)setReviewOpen(false)}}><div className="modal reviewModal"><div className="modalHead"><div><p className="eyebrow">CV UPDATE REVIEW</p><h2>{active.job.title}</h2><p className="muted">{active.job.company} · {active.job.location}</p><p className="reviewBaseline">CV {selectedAdaptationCvRecord?.slot} · {activeAdaptationBaseline.fileName}</p></div><button className="close" onClick={()=>setReviewOpen(false)} disabled={adaptationRun.loading}>×</button></div>
      <div className="reviewScopeLine">Professional Summary · Latest role overview · Previous role overview</div>
      {adaptationRun.loading&&adaptationRun.jobKey===jobKey&&adaptationRun.baselineKey===activeBaselineKey&&<div className="adaptationLoading"><b>Adapting selected CV…</b><span>JD analysis → selected-CV evidence → three writers → Truth Guard.</span></div>}
      {adaptationRun.error&&adaptationRun.jobKey===jobKey&&adaptationRun.baselineKey===activeBaselineKey&&<div className="errorBox"><b>CV adaptation failed safely</b><span>{adaptationRun.error}</span></div>}
      {currentAdaptationResult&&<>
        <div className="adaptationRunStatus"><b>✓ Truth Guard complete</b><span>{reviewChanges.length} safe change{reviewChanges.length===1?'':'s'} available for review · {reviewedCount}/{reviewChanges.length} decided</span></div>
        <div className="reviewToolbar"><div><h3>Selected-CV changes</h3><p>Only Truth-Guard-safe UPDATED text is shown. Source CV remains unchanged.</p></div>{reviewChanges.length>0&&<button className="secondary" onClick={acceptAll}>Accept all safe changes</button>}</div>
        {reviewChanges.map(change=>{const decision=decisionFor(change.blockId);return <div className={'changeCard '+(decision?'decided':'')} key={change.blockId}>
          <div className="changeHead"><span>{change.label}</span><b>{decision===ADAPTATION_DECISION.ACCEPTED?'Accepted':decision===ADAPTATION_DECISION.ORIGINAL?'Original kept':'Review needed'}</b></div>
          <div className="compareGrid"><div className="compareBox"><small>ORIGINAL</small><p>{change.original}</p></div><div className="compareArrow">→</div><div className="compareBox updatedBox"><small>UPDATED</small><p>{change.updated}</p></div></div>
          <div className="changeWhy"><div><small>WHY CHANGED</small><p>{change.why}</p></div></div>
          <div className="evidenceActions"><button className={'secondary '+(decision===ADAPTATION_DECISION.ORIGINAL?'chosen':'')} onClick={()=>setDecision(change.blockId,ADAPTATION_DECISION.ORIGINAL)}>Keep original</button><button className={'primary smallPrimary '+(decision===ADAPTATION_DECISION.ACCEPTED?'chosenPrimary':'')} onClick={()=>setDecision(change.blockId,ADAPTATION_DECISION.ACCEPTED)}>Accept change</button></div>
        </div>})}
        {!reviewChanges.length&&<div className="reviewEmpty"><b>No safe changes to review.</b><span>Truth Guard did not offer a changed block. The selected Source CV remains unchanged.</span></div>}
      </>}
      <div className="reviewFooter"><button className="secondary" onClick={()=>setReviewOpen(false)} disabled={adaptationRun.loading}>Close review</button></div>
    </div></div>}`
page=page.slice(0,modalStart)+newModal+page.slice(mainEnd)

const cssMarker='/* M4.11 — selected-CV review */'
if(!css.includes(cssMarker)){
  css+=`\n\n${cssMarker}\n.reviewBaseline{margin:8px 0 0;color:#7ee2b8;font-size:12px;font-weight:750}.reviewScopeLine{margin:16px 0;color:#7f8c99;font-size:11px;letter-spacing:.03em}.adaptationLoading,.adaptationRunStatus,.reviewEmpty{margin:18px 0;padding:14px 16px;border-radius:12px;display:flex;flex-direction:column;gap:5px}.adaptationLoading{background:#151a20;border:1px solid #343d48}.adaptationLoading span,.reviewEmpty span{color:#9aa5b1;font-size:12px}.adaptationRunStatus{background:#132019;border:1px solid #285e4a}.adaptationRunStatus b{color:#7ee2b8}.adaptationRunStatus span{color:#aab5ae;font-size:12px}.reviewEmpty{background:#151a20;border:1px solid #2a323c}.reviewEmpty b{color:#dce2e8}\n`
}

writeFileSync(pagePath,page)
writeFileSync(cssPath,css)
console.log('M4.11 page/CSS patch applied')
