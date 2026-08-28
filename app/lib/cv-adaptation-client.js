import {buildAdaptationInput} from './cv-adaptation-input.js'

async function postJson(fetchImpl,body){
  const response=await fetchImpl('/api/tailor-cv',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body)
  })
  const data=await response.json()
  if(!response.ok) throw new Error(data?.error||'CV adaptation stage failed safely.')
  return data
}

export async function requestCvAdaptation({baseline,job,fetchImpl=fetch}={}){
  const input=buildAdaptationInput({baseline,job})
  const summary=await postJson(fetchImpl,{action:'write_professional_summary',sourceCv:input.sourceCv,job:input.job})
  if(summary?.stage!=='summary_written'||summary?.block?.blockId!=='professional_summary') throw new Error('Professional Summary writing did not complete.')
  const latest=await postJson(fetchImpl,{action:'write_latest_role_overview',sourceCv:input.sourceCv,job:input.job})
  if(latest?.stage!=='latest_role_written'||latest?.block?.blockId!=='latest_role_overview') throw new Error('Latest role overview writing did not complete.')
  const previous=await postJson(fetchImpl,{action:'write_previous_role_overview',sourceCv:input.sourceCv,job:input.job})
  if(previous?.stage!=='previous_role_written'||previous?.block?.blockId!=='previous_role_overview') throw new Error('Previous role overview writing did not complete.')
  return {stage:'adaptation_written',blocks:{professionalSummary:summary.block,latestRoleOverview:latest.block,previousRoleOverview:previous.block}}
}

async function runEvidenceStages({input,fetchImpl}){
  const analysed=await postJson(fetchImpl,{
    action:'analyze_job',
    cvId:input.sourceCv.cvId,
    sourceVersion:input.sourceCv.sourceVersion,
    job:input.job
  })
  if(analysed?.stage!=='job_analyzed'||!analysed?.token) throw new Error('Job analysis did not produce a valid selected-CV stage token.')

  const mapped=await postJson(fetchImpl,{
    action:'map_selected_cv_evidence',
    token:analysed.token,
    sourceCv:input.sourceCv,
    job:input.job
  })
  if(mapped?.stage!=='evidence_mapped'||!mapped?.token) throw new Error('Selected CV evidence mapping did not complete safely.')
  return mapped
}

export async function requestSelectedCvEvidence({baseline,job,fetchImpl=fetch}={}){
  const input=buildAdaptationInput({baseline,job})
  return runEvidenceStages({input,fetchImpl})
}

export async function requestProfessionalSummary({baseline,job,fetchImpl=fetch}={}){
  const input=buildAdaptationInput({baseline,job})
  const mapped=await runEvidenceStages({input,fetchImpl})
  const written=await postJson(fetchImpl,{
    action:'write_professional_summary',
    token:mapped.token,
    sourceCv:input.sourceCv,
    job:input.job
  })
  if(written?.stage!=='summary_written'||!written?.token||written?.block?.blockId!=='professional_summary') throw new Error('Professional Summary writing did not complete safely.')
  return written
}

export async function requestLatestRoleOverview({baseline,job,fetchImpl=fetch}={}){
  const input=buildAdaptationInput({baseline,job})
  const summary=await requestProfessionalSummary({baseline,job,fetchImpl})
  const written=await postJson(fetchImpl,{
    action:'write_latest_role_overview',
    token:summary.token,
    sourceCv:input.sourceCv,
    job:input.job
  })
  if(written?.stage!=='latest_role_written'||!written?.token||written?.blocks?.latestRoleOverview?.blockId!=='latest_role_overview') throw new Error('Latest role overview writing did not complete safely.')
  return written
}

export async function requestPreviousRoleOverview({baseline,job,fetchImpl=fetch}={}){
  const input=buildAdaptationInput({baseline,job})
  const latest=await requestLatestRoleOverview({baseline,job,fetchImpl})
  const written=await postJson(fetchImpl,{
    action:'write_previous_role_overview',
    token:latest.token,
    sourceCv:input.sourceCv,
    job:input.job
  })
  if(written?.stage!=='previous_role_written'||!written?.token||written?.blocks?.previousRoleOverview?.blockId!=='previous_role_overview') throw new Error('Previous role overview writing did not complete safely.')
  return written
}

export async function requestTruthGuard({baseline,job,fetchImpl=fetch}={}){
  const input=buildAdaptationInput({baseline,job})
  const previous=await requestPreviousRoleOverview({baseline,job,fetchImpl})
  const guarded=await postJson(fetchImpl,{
    action:'run_truth_guard',
    token:previous.token,
    sourceCv:input.sourceCv,
    job:input.job
  })
  if(guarded?.stage!=='truth_guarded'||!guarded?.token||!guarded?.truthGuard||typeof guarded.truthGuard!=='object') throw new Error('Truth Guard did not complete safely.')
  return guarded
}
