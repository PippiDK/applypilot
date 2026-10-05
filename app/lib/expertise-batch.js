import {callStructuredAi} from './ai-client.js'
import {EXPERTISE_ONE_PASS_INSTRUCTIONS,expertiseOnePassSchema,validateExpertiseOnePass} from './expertise-one-pass.js'
import {evaluateExpertiseFromJudgements} from './expertise-semantic-score.js'
import {safeValidationDiagnosticCode} from './night-flight-validation-diagnostics.js'

export const DEFAULT_EXPERTISE_BATCH_MAX_JOBS=24
export const DEFAULT_EXPERTISE_BATCH_MAX_INPUT_CHARS=180000
export const DEFAULT_EXPERTISE_BATCH_MAX_OUTPUT_TOKENS=32000

const clean=value=>String(value??'').trim()
const itemArraySchema=expertiseOnePassSchema.properties.items

export const expertiseBatchSchema={
  type:'object',
  additionalProperties:false,
  properties:{
    jobs:{
      type:'array',
      minItems:1,
      maxItems:DEFAULT_EXPERTISE_BATCH_MAX_JOBS,
      items:{
        type:'object',
        additionalProperties:false,
        properties:{
          jobKey:{type:'string',minLength:1},
          items:itemArraySchema,
        },
        required:['jobKey','items'],
      },
    },
  },
  required:['jobs'],
}

export const EXPERTISE_BATCH_INSTRUCTIONS=`${EXPERTISE_ONE_PASS_INSTRUCTIONS}

Batch execution rules:
- Evaluate every supplied vacancy independently against the one shared Source CV.
- Return exactly one result object for every supplied jobKey, with the same jobKey copied verbatim.
- Never merge requirements, evidence, conclusions, or scores across vacancies.
- A vacancy may use only its own jobDescription for jdEvidence.
- The shared Source CV may be reused as evidence across vacancies when genuinely supported.
- Keep each reason concise because this is a multi-vacancy batch.`

function normalizedBatchJob(entry,index){
  const job=entry?.job&&typeof entry.job==='object'?entry.job:{}
  const jobKey=clean(entry?.jobKey)
  const title=clean(job.title)
  const description=clean(job.description||job.fullJd)
  if(!jobKey) throw new Error(`Batch vacancy ${index+1} requires jobKey.`)
  if(!title||description.length<80) throw new Error(`Batch vacancy ${jobKey} has insufficient job description.`)
  return {
    jobKey,
    job:{...job,description},
  }
}

function jobInputChars(entry){
  const job=entry.job
  return entry.jobKey.length+clean(job.title).length+clean(job.company).length+clean(job.description).length+80
}

export function packExpertiseBatchJobs(entries=[],{
  maxJobs=DEFAULT_EXPERTISE_BATCH_MAX_JOBS,
  maxInputChars=DEFAULT_EXPERTISE_BATCH_MAX_INPUT_CHARS,
}={}){
  const normalized=(Array.isArray(entries)?entries:[]).map(normalizedBatchJob)
  if(!normalized.length) return []
  const jobLimit=Math.max(1,Math.floor(Number(maxJobs)||DEFAULT_EXPERTISE_BATCH_MAX_JOBS))
  const charLimit=Math.max(1000,Math.floor(Number(maxInputChars)||DEFAULT_EXPERTISE_BATCH_MAX_INPUT_CHARS))
  const batches=[]
  let current=[]
  let chars=0

  for(const entry of normalized){
    const size=jobInputChars(entry)
    if(current.length&&(current.length>=jobLimit||chars+size>charLimit)){
      batches.push(current)
      current=[]
      chars=0
    }
    current.push(entry)
    chars+=size
  }
  if(current.length) batches.push(current)
  return batches
}

export async function analyzeExpertiseBatch({
  jobs=[],
  cvText,
  modelCall,
  maxOutputTokens=DEFAULT_EXPERTISE_BATCH_MAX_OUTPUT_TOKENS,
}={}){
  const sourceCv=clean(cvText)
  if(sourceCv.length<40) throw new Error('Source CV text is required for Expertise Match.')
  const entries=(Array.isArray(jobs)?jobs:[]).map(normalizedBatchJob)
  if(!entries.length) return {results:[],failures:[]}
  if(entries.length>DEFAULT_EXPERTISE_BATCH_MAX_JOBS) throw new Error('Expertise Match batch exceeds maximum job count.')

  const expectedKeys=new Set(entries.map(entry=>entry.jobKey))
  if(expectedKeys.size!==entries.length) throw new Error('Expertise Match batch job keys must be unique.')

  const response=await callStructuredAi({
    stage:'expertise_match_batch',
    instructions:EXPERTISE_BATCH_INSTRUCTIONS,
    input:{
      sourceCv,
      jobs:entries.map(entry=>({
        jobKey:entry.jobKey,
        title:clean(entry.job.title),
        company:clean(entry.job.company),
        jobDescription:clean(entry.job.description),
      })),
    },
    schema:expertiseBatchSchema,
    maxOutputTokens,
    modelCall,
  })

  const returned=Array.isArray(response?.jobs)?response.jobs:[]
  const byKey=new Map()
  for(const item of returned){
    const jobKey=clean(item?.jobKey)
    if(!expectedKeys.has(jobKey)||byKey.has(jobKey)) continue
    byKey.set(jobKey,item)
  }

  const results=[]
  const failures=[]
  for(const entry of entries){
    const raw=byKey.get(entry.jobKey)
    if(!raw){
      const error=new Error('Expertise Match batch response is missing a vacancy result.')
      error.code='AI_EXPERTISE_VALIDATION'
      error.diagnosticCode='OTHER_VALIDATION'
      failures.push({jobKey:entry.jobKey,error})
      continue
    }
    try{
      const validated=validateExpertiseOnePass({items:raw.items},entry.job.description,sourceCv)
      const analysis=evaluateExpertiseFromJudgements(validated.requirements,validated.evaluations)
      results.push({jobKey:entry.jobKey,analysis})
    }catch(error){
      if(!error.code) error.code='AI_EXPERTISE_VALIDATION'
      error.diagnosticCode=safeValidationDiagnosticCode(error)
      failures.push({jobKey:entry.jobKey,error})
    }
  }

  return {results,failures}
}
