import {extractExpertiseRequirements} from './expertise-requirements.js'
import {evaluateExpertiseSemantically} from './expertise-evaluator.js'
import {evaluateExpertiseFromJudgements} from './expertise-semantic-score.js'

export async function analyzeExpertiseMatch({job,cvText,modelCall}={}){
  const sourceCv=String(cvText??'').trim()
  if(sourceCv.length<40) throw new Error('Source CV text is required for Expertise Match.')
  const structured=await extractExpertiseRequirements(job,modelCall)
  const semantic=await evaluateExpertiseSemantically(structured.requirements,sourceCv,modelCall)
  return evaluateExpertiseFromJudgements(structured.requirements,semantic.evaluations)
}
