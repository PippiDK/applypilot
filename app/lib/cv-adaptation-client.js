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

export async function requestSelectedCvEvidence({baseline,job,fetchImpl=fetch}={}){
  const input=buildAdaptationInput({baseline,job})
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
