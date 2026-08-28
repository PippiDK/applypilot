import {callStructuredAi} from './ai-client.js'

const text=value=>String(value??'').trim()
const raw=value=>String(value??'')

const adaptationBlockSchema={
  type:'object',
  additionalProperties:false,
  properties:{tailoredText:{type:'string'},why:{type:'string'}},
  required:['tailoredText','why']
}

const cvAdaptationSchema={
  type:'object',
  additionalProperties:false,
  properties:{
    professionalSummary:adaptationBlockSchema,
    latestRoleOverview:adaptationBlockSchema,
    previousRoleOverview:adaptationBlockSchema
  },
  required:['professionalSummary','latestRoleOverview','previousRoleOverview']
}

export const CV_ADAPTATION_INSTRUCTIONS=`You are adapting the selected CV for a specific vacancy.
Rewrite these three existing CV blocks so they are better aligned with the supplied job description:
1. Professional Summary
2. Overview text for the latest employment role
3. Overview text for the previous employment role
Use the selected CV and the job description as context.
Return updated text and a short explanation for each block.`

function sourceCvInput(sourceCv={}){
  return {cvId:text(sourceCv?.cvId),sourceVersion:text(sourceCv?.sourceVersion),fileName:text(sourceCv?.fileName),cvText:raw(sourceCv?.cvText)}
}

function jobInput(job={}){
  return {sourceJobId:text(job?.sourceJobId),title:text(job?.title),company:text(job?.company),location:text(job?.location),description:text(job?.description)}
}

function roleInput(role){
  return role?{roleId:text(role?.id),title:text(role?.title),company:text(role?.company),dateText:text(role?.dateText),originalText:text(role?.overviewText)}:null
}

function blockResult({blockId,originalText,draft,role}={}){
  const original=text(originalText)
  const base={blockId,originalText:original}
  if(role){
    base.roleId=text(role?.id)
    base.title=text(role?.title)
    base.company=text(role?.company)
    base.dateText=text(role?.dateText)
  }
  if(!original) return {...base,status:'unavailable',tailoredText:'',why:`${blockId} is unavailable in the selected CV.`}
  return {...base,status:'generated',tailoredText:raw(draft?.tailoredText),why:raw(draft?.why)}
}

export async function writeCvAdaptation({job,sourceCv,structure}={},modelCall){
  const summaryOriginal=text(structure?.professionalSummary?.text)
  const latestRole=structure?.latestRole||null
  const previousRole=structure?.previousRole||null
  const draft=await callStructuredAi({
    stage:'cv_adaptation_writer',
    instructions:CV_ADAPTATION_INSTRUCTIONS,
    input:{
      sourceCv:sourceCvInput(sourceCv),
      job:jobInput(job),
      blocks:{
        professionalSummary:{originalText:summaryOriginal},
        latestRoleOverview:roleInput(latestRole),
        previousRoleOverview:roleInput(previousRole)
      }
    },
    schema:cvAdaptationSchema,
    modelCall
  })
  return {
    professionalSummary:blockResult({blockId:'professional_summary',originalText:summaryOriginal,draft:draft?.professionalSummary}),
    latestRoleOverview:blockResult({blockId:'latest_role_overview',originalText:latestRole?.overviewText,draft:draft?.latestRoleOverview,role:latestRole}),
    previousRoleOverview:blockResult({blockId:'previous_role_overview',originalText:previousRole?.overviewText,draft:draft?.previousRoleOverview,role:previousRole})
  }
}
