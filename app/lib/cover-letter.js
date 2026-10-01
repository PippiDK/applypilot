import {callStructuredAi} from './ai-client.js'

const text=value=>String(value??'').trim()
const raw=value=>String(value??'')

const coverLetterSchema={
  type:'object',
  additionalProperties:false,
  properties:{
    letter:{type:'string'},
    focusPoints:{type:'array',items:{type:'string'},minItems:3,maxItems:4}
  },
  required:['letter','focusPoints']
}

export const COVER_LETTER_INSTRUCTIONS=`Write a concise senior-level cover letter for the supplied vacancy.

Hard rules:
- 250-350 words.
- 3-4 short paragraphs plus a brief greeting and closing.
- Do not use generic filler such as "I am writing to express my interest".
- Do not invent motivations, company admiration, skills, achievements, employers, responsibilities, dates, metrics or technologies.
- Every factual claim about the candidate must be supported by the supplied Source CV.
- Job/company facts may only come from the supplied job description.
- Treat finalCvBlocks as the user's approved positioning for this application. Use them for emphasis, but never treat an edited phrase as permission to invent facts beyond Source CV evidence.
- Do not repeat the CV. Select 2-3 concrete facts most relevant to the vacancy.
- Keep the tone direct, calm, credible and senior.
- Avoid exaggerated adjectives and unsupported claims.
- Follow the supplied languageMode exactly.
- If languageMode is "english", write the entire letter and focus points in English.
- If languageMode is "same_as_job", use the dominant language of the job description. If the job description is mixed-language or unclear, use English.
- Keep the greeting and closing in the same language as the letter. Use a natural generic hiring-team greeting unless a named recipient is explicitly present in the job description.
- End with a natural professional closing in the same language and the candidate name when it can be read from the Source CV.
- Return the finished letter and 3-4 short focus points in the same chosen language explaining which grounded themes were used.`

function jobInput(job={}){
  return {
    sourceJobId:text(job?.sourceJobId),
    title:text(job?.title),
    company:text(job?.company),
    location:text(job?.location),
    description:text(job?.description||job?.jd)
  }
}

function sourceCvInput(sourceCv={}){
  return {
    cvId:text(sourceCv?.cvId),
    sourceVersion:text(sourceCv?.sourceVersion),
    fileName:text(sourceCv?.fileName),
    cvText:raw(sourceCv?.cvText)
  }
}

export async function writeCoverLetter({job,sourceCv,finalCvBlocks=[],languageMode='same_as_job'}={},modelCall){
  const result=await callStructuredAi({
    stage:'cover_letter_writer',
    instructions:COVER_LETTER_INSTRUCTIONS,
    input:{
      job:jobInput(job),
      sourceCv:sourceCvInput(sourceCv),
      finalCvBlocks:Array.isArray(finalCvBlocks)?finalCvBlocks:[],
      languageMode:languageMode==='english'?'english':'same_as_job'
    },
    schema:coverLetterSchema,
    maxOutputTokens:1800,
    modelCall
  })
  return {
    letter:text(result?.letter),
    focusPoints:Array.isArray(result?.focusPoints)?result.focusPoints.map(text).filter(Boolean).slice(0,4):[]
  }
}
