import {extractExpertiseRequirements} from './expertise-requirements.js'
import {evaluateExpertise} from './expertise-match.js'

export async function analyzeExpertiseMatch({job,cvText,modelCall}={}){
  const sourceCv=String(cvText??'').trim()
  if(sourceCv.length<40) throw new Error('Source CV text is required for Expertise Match.')
  const structured=await extractExpertiseRequirements(job,modelCall)
  return evaluateExpertise(structured.requirements,sourceCv)
}
