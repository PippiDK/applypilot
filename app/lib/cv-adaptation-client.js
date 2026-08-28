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
