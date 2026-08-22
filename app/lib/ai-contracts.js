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
    gapsToAvoid:{type:'array',items:{type:'string'}}
  },
  required:['roleMission','candidatePositioning','priorities','gapsToAvoid']
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
  if(!Array.isArray(value.gapsToAvoid)) throw new Error('Invalid JD gaps list.')
  return value
}
