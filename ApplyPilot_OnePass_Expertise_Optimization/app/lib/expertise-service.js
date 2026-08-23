import {evaluateExpertiseOnePass} from './expertise-one-pass.js'
import {evaluateExpertiseFromJudgements} from './expertise-semantic-score.js'

export async function analyzeExpertiseMatch({job,cvText,modelCall}={}){
  const sourceCv=String(cvText??'').trim()
  if(sourceCv.length<40) throw new Error('Source CV text is required for Expertise Match.')
  const onePass=await evaluateExpertiseOnePass(job,sourceCv,modelCall)
  return evaluateExpertiseFromJudgements(onePass.requirements,onePass.evaluations)
}
