const text=value=>String(value??'').trim()

export const jobAnalysisSchema={
  type:'object',
  additionalProperties:false,
  properties:{
    roleMission:{type:'string',minLength:1},
    candidatePositioning:{type:'string',minLength:1},
    priorities:{
      type:'array',minItems:3,maxItems:5,
      items:{
        type:'object',additionalProperties:false,
        properties:{
          id:{type:'string',minLength:1},
          rank:{type:'integer',minimum:1,maximum:5},
          kind:{type:'string',enum:['must_have','important','supporting']},
          requirement:{type:'string',minLength:1},
          why:{type:'string',minLength:1},
          jdEvidence:{type:'array',minItems:1,maxItems:3,items:{type:'string',minLength:1}}
        },
        required:['id','rank','kind','requirement','why','jdEvidence']
      }
    },
    mustHaves:{
      type:'array',maxItems:10,
      items:{
        type:'object',additionalProperties:false,
        properties:{
          id:{type:'string',minLength:1},
          requirement:{type:'string',minLength:1},
          jdEvidence:{type:'array',minItems:1,maxItems:3,items:{type:'string',minLength:1}}
        },
        required:['id','requirement','jdEvidence']
      }
    },
    gapsToAvoid:{type:'array',items:{type:'string'}}
  },
  required:['roleMission','candidatePositioning','priorities','mustHaves','gapsToAvoid']
}

export const professionalSummaryDraftSchema={
  type:'object',
  additionalProperties:false,
  properties:{
    tailoredText:{type:'string',minLength:1},
    claims:{
      type:'array',minItems:1,maxItems:12,
      items:{
        type:'object',additionalProperties:false,
        properties:{
          text:{type:'string',minLength:1},
          evidenceIds:{type:'array',minItems:1,maxItems:8,items:{type:'string',minLength:1}}
        },
        required:['text','evidenceIds']
      }
    },
    why:{type:'string',minLength:1}
  },
  required:['tailoredText','claims','why']
}

export function validateJobAnalysis(value){
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error('Invalid JD analysis.')
  if(!text(value.roleMission)||!text(value.candidatePositioning)) throw new Error('Invalid JD analysis text.')
  if(!Array.isArray(value.priorities)||value.priorities.length<3||value.priorities.length>5) throw new Error('JD analysis must contain 3 to 5 priorities.')
  const ids=new Set()
  for(const [index,priority] of value.priorities.entries()){
    if(!priority||typeof priority!=='object') throw new Error('Invalid JD priority.')
    if(!text(priority.id)||ids.has(text(priority.id))) throw new Error('JD priority IDs must be unique.')
    ids.add(text(priority.id))
    if(!Number.isInteger(priority.rank)||priority.rank<1||priority.rank>5) throw new Error('Invalid JD priority rank.')
    if(!['must_have','important','supporting'].includes(priority.kind)) throw new Error('Invalid JD priority kind.')
    if(!text(priority.requirement)||!text(priority.why)) throw new Error('Invalid JD priority text.')
    if(!Array.isArray(priority.jdEvidence)||priority.jdEvidence.length<1||priority.jdEvidence.some(excerpt=>!text(excerpt))) throw new Error('Every JD priority requires JD evidence.')
    if(priority.rank!==index+1) throw new Error('JD priorities must be ranked in order.')
  }
  if(!Array.isArray(value.mustHaves)) throw new Error('JD analysis requires a separate must-haves qualification list.')
  const mustHaveIds=new Set()
  for(const mustHave of value.mustHaves){
    if(!mustHave||typeof mustHave!=='object') throw new Error('Invalid JD must-have.')
    if(!text(mustHave.id)||mustHaveIds.has(text(mustHave.id))) throw new Error('JD must-have IDs must be unique.')
    mustHaveIds.add(text(mustHave.id))
    if(!text(mustHave.requirement)) throw new Error('Invalid JD must-have requirement.')
    if(!Array.isArray(mustHave.jdEvidence)||mustHave.jdEvidence.length<1||mustHave.jdEvidence.some(excerpt=>!text(excerpt))) throw new Error('Every JD must-have requires JD evidence.')
  }
  if(!Array.isArray(value.gapsToAvoid)) throw new Error('Invalid JD gaps list.')
  return value
}

export function validateProfessionalSummaryDraft(value){
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error('Invalid Professional Summary draft.')
  if(!text(value.tailoredText)||!text(value.why)) throw new Error('Professional Summary draft requires tailored text and rationale.')
  if(!Array.isArray(value.claims)||value.claims.length<1||value.claims.length>12) throw new Error('Professional Summary draft requires grounded claims.')
  for(const claim of value.claims){
    if(!claim||typeof claim!=='object'||!text(claim.text)) throw new Error('Invalid Professional Summary claim.')
    if(!Array.isArray(claim.evidenceIds)||claim.evidenceIds.length<1||claim.evidenceIds.some(id=>!text(id))) throw new Error('Every Professional Summary claim requires evidence IDs.')
    if(new Set(claim.evidenceIds.map(text)).size!==claim.evidenceIds.length) throw new Error('Professional Summary claim evidence IDs must be unique.')
  }
  return value
}
